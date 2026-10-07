import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { analyzeQuery } from "./pipeline.js";
import { extractFacts, toIso } from "./dateExtractor.js";
import { BNS_COMMENCEMENT } from "./gateway.js";
import { createLegalPresentation, presentationTranslationTargets, syncDecisionLabels } from "../../frontend/legalPresentation.js";
import { LANGUAGE_NAMES, normalizeLanguageCode, speechLanguageStatus } from "./languages.js";
import { translationMeaningIssue } from "./translationChecks.js";
export { LANGUAGE_NAMES } from "./languages.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const DIGIT_BASES = [0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0b66, 0x0be6, 0x0c66, 0x0ce6, 0x0d66, 0x0660, 0x06f0];
const NUMBER_WORDS = Object.fromEntries(["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"].map((word, number) => [word, String(number)]));
const SPOKEN_DAYS = new Map([
  [1, "एक"], [2, "दो|दोन"], [3, "तीन"], [4, "चार"], [5, "पाँच|पांच|पाच"],
  [6, "छह|छः|सहा"], [7, "सात"], [8, "आठ"], [9, "नौ|नऊ"], [10, "दस|दहा"],
  [11, "ग्यारह|अकरा"], [12, "बारह|बारा"], [13, "तेरह|तेरा"], [14, "चौदह|चौदा"],
  [15, "पंद्रह|पन्द्रह|पंधरा"], [16, "सोलह|सोळा"], [17, "सत्रह|सतरा"],
  [18, "अठारह|अठरा"], [19, "उन्नीस|एकोणीस"], [20, "बीस|वीस"],
  [21, "इक्कीस|एकवीस"], [22, "बाईस|बावीस"], [23, "तेईस|तेवीस"],
  [24, "चौबीस|चोवीस"], [25, "पच्चीस|पंचवीस"], [26, "छब्बीस|सव्वीस"],
  [27, "सत्ताईस|सत्तावीस"], [28, "अट्ठाईस|अठ्ठावीस"],
  [29, "उनतीस|एकोणतीस"], [30, "तीस"], [31, "इकतीस|एकतीस"]
].flatMap(([number, spellings]) => spellings.split("|").map(word => [word, number])));
const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const SCRIPT_LANGUAGE_PATTERNS = [
  ["gu", /[\u0a80-\u0aff]/u],
  ["bn", /[\u0980-\u09ff]/u],
  ["ta", /[\u0b80-\u0bff]/u],
  ["te", /[\u0c00-\u0c7f]/u],
  ["kn", /[\u0c80-\u0cff]/u],
  ["ml", /[\u0d00-\u0d7f]/u],
  ["pa", /[\u0a00-\u0a7f]/u],
  ["ur", /[\u0600-\u06ff]/u],
  ["hi", /[\u0900-\u097f]/u],
  ["mr", /[\u0900-\u097f]/u]
];
const HINDI_MARKERS = /(?:^|[\s।,.!?])(?:को|की|का|के|हुई|हुआ|मेरा|मेरी|गया|है)(?=$|[\s।,.!?])/u;
const MARATHI_MARKERS = /(?:^|[\s।,.!?])(?:रोजी|माझा|माझी|माझे|झाली|झाला|गेला|गेली|चोरीला|मोबाईल)(?=$|[\s।,.!?])/u;
const outputTranslationEnabled = language => process.env.LOCAL_OUTPUT_TRANSLATION === "1"
  || (process.env.LOCAL_OUTPUT_TRANSLATION !== "0" && !["hi", "mr"].includes(language));
const MONTH_ALIASES = new Map([
  ["జూలై", 7]
]);
let running = false;

export class TranslationError extends Error {
  constructor(code, message = "Local translation could not be verified. Your original text is unchanged; please rephrase or use English.", statusCode = 422) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function runTranslationWorker(payload, timeoutMs = 180_000, spawnImpl = spawn) {
  if (running) return Promise.reject(new TranslationError("TRANSLATION_BUSY", "Local translation is busy. Please try again shortly.", 429));
  running = true;
  return new Promise((resolve, reject) => {
    const python = process.env.LOCAL_TRANSLATION_PYTHON || join(ROOT, ".venv-translation", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
    let child;
    try { child = spawnImpl(python, [join(ROOT, "backend", "translation", "worker.py")], {
      shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, HF_HUB_OFFLINE: "1", TRANSFORMERS_OFFLINE: "1", HF_HUB_DISABLE_TELEMETRY: "1", PYTHONUTF8: "1" }
    }); } catch {
      running = false;
      reject(new TranslationError("TRANSLATION_RUNTIME_UNAVAILABLE", "Local translation runtime is unavailable. Run setup or use English.", 503));
      return;
    }
    let output = "", settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      running = false;
      error ? reject(error) : resolve(result);
    };
    const timer = setTimeout(() => { child.kill(); finish(new TranslationError("TRANSLATION_TIMEOUT", "Local translation timed out. Please shorten the query or use English.", 504)); }, timeoutMs);
    child.on("error", () => finish(new TranslationError("TRANSLATION_RUNTIME_UNAVAILABLE", "Local translation runtime is unavailable. Run the translation setup, or use English.", 503)));
    child.stdin.on("error", () => {});
    child.stderr.on("data", () => {});
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", chunk => {
      output += chunk;
      if (output.length > 512 * 1024) { child.kill(); finish(new TranslationError("TRANSLATION_FAILED")); }
    });
    child.on("close", code => {
      if (settled) return;
      let result;
      try { result = JSON.parse(output); } catch { finish(new TranslationError("TRANSLATION_FAILED")); return; }
      if (code !== 0 || result.error) {
        const unavailable = ["TRANSLATION_MODEL_MISSING", "TRANSLATION_RUNTIME_UNAVAILABLE"].includes(result.error);
        const error = new TranslationError(result.error || "TRANSLATION_FAILED", unavailable ? "Local translation model/runtime is missing. Run the translation setup, or use English." : undefined, unavailable ? 503 : 422);
        error.segmentIndex = result.segmentIndex;
        error.reason = result.reason;
        finish(error);
      } else finish(null, result);
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

export function createStreamingTranslationWorker(spawnImpl = spawn) {
  let session = null;
  let warming = null;
  const stop = (current, error, kill = false) => {
    if (session !== current) return;
    session = null;
    if (current.pending) {
      clearTimeout(current.pending.timer);
      current.pending.reject(error);
      current.pending = null;
    }
    if (kill) current.child.kill();
  };
  const dispatch = (payload, timeoutMs = 180_000) => new Promise((resolve, reject) => {
    if (session?.pending) {
      reject(new TranslationError("TRANSLATION_BUSY", "Local translation is busy. Please try again shortly.", 429));
      return;
    }
    if (!session) {
      const python = process.env.LOCAL_TRANSLATION_PYTHON || join(ROOT, ".venv-translation", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
      let child;
      try {
        child = spawnImpl(python, [join(ROOT, "backend", "translation", "worker.py"), "--stream"], {
          shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"],
          env: { ...process.env, HF_HUB_OFFLINE: "1", TRANSFORMERS_OFFLINE: "1", HF_HUB_DISABLE_TELEMETRY: "1", PYTHONUTF8: "1" }
        });
      } catch {
        reject(new TranslationError("TRANSLATION_RUNTIME_UNAVAILABLE", "Local translation runtime is unavailable. Run setup or use English.", 503));
        return;
      }
      const current = { child, buffer: "", pending: null };
      session = current;
      child.stdin.on("error", () => stop(current, new TranslationError("TRANSLATION_RUNTIME_UNAVAILABLE", undefined, 503), true));
      child.stderr.on("data", () => {});
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", chunk => {
        current.buffer += chunk;
        if (current.buffer.length > 512 * 1024) {
          stop(current, new TranslationError("TRANSLATION_FAILED"), true);
          return;
        }
        const newline = current.buffer.indexOf("\n");
        if (newline < 0) return;
        const line = current.buffer.slice(0, newline);
        current.buffer = current.buffer.slice(newline + 1);
        const pending = current.pending;
        if (!pending || current.buffer.trim()) {
          stop(current, new TranslationError("TRANSLATION_FAILED"), true);
          return;
        }
        current.pending = null;
        clearTimeout(pending.timer);
        let result;
        try { result = JSON.parse(line); } catch { /* Malformed worker output fails closed. */ }
        if (!result || typeof result !== "object") {
          stop(current, new TranslationError("TRANSLATION_FAILED"), true);
          pending.reject(new TranslationError("TRANSLATION_FAILED"));
        } else if (result.error) {
          const unavailable = ["TRANSLATION_MODEL_MISSING", "TRANSLATION_RUNTIME_UNAVAILABLE"].includes(result.error);
          const error = new TranslationError(result.error, unavailable ? "Local translation model/runtime is missing. Run the translation setup, or use English." : undefined, unavailable ? 503 : 422);
          error.segmentIndex = result.segmentIndex;
          error.reason = result.reason;
          pending.reject(error);
        } else pending.resolve(result);
      });
      child.on("error", () => stop(current, new TranslationError("TRANSLATION_RUNTIME_UNAVAILABLE", undefined, 503), true));
      child.on("close", () => stop(current, new TranslationError("TRANSLATION_FAILED")));
    }
    const current = session;
    const timer = setTimeout(() => stop(current, new TranslationError("TRANSLATION_TIMEOUT", "Local translation timed out. Please shorten the query or use English.", 504), true), timeoutMs);
    current.pending = { resolve, reject, timer };
    try { current.child.stdin.write(`${JSON.stringify(payload)}\n`); }
    catch { stop(current, new TranslationError("TRANSLATION_RUNTIME_UNAVAILABLE", undefined, 503), true); }
  });
  const run = (payload, timeoutMs = 180_000) => warming
    ? warming.catch(() => {}).then(() => dispatch(payload, timeoutMs))
    : dispatch(payload, timeoutMs);
  run.warmup = () => {
    if (warming) return warming;
    // An empty translation loads the existing local model without processing case text.
    warming = dispatch({ action: "translate", source: "en", target: "en", texts: [],
      modelPath: process.env.LOCAL_TRANSLATION_MODEL || join(ROOT, "models", "translation", "nllb-int8") });
    const attempt = warming;
    warming = attempt.finally(() => { warming = null; });
    return warming;
  };
  run.close = () => {
    if (session) stop(session, new TranslationError("TRANSLATION_RUNTIME_UNAVAILABLE", "Local translation worker stopped.", 503), true);
  };
  return run;
}

export function normalizeInputDates(text) {
  const asciiDigits = normalizeDigits(text);
  const months = new Map();
  for (const locale of Object.keys(LANGUAGE_NAMES)) for (let month = 1; month <= 12; month++) {
    const name = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, month - 1, 1)));
    months.set(name.toLowerCase(), month);
  }
  for (const [name, month] of MONTH_ALIASES) months.set(name.toLowerCase(), month);
  const pattern = new RegExp(`(?<!\\d)(\\d{1,2})\\s+(${[...months.keys()].sort((a, b) => b.length - a.length).map(escapeRegex).join("|")})[,]?\\s+(20\\d{2})(?!\\d)`, "giu");
  const numericDates = asciiDigits.replace(pattern, (raw, day, name, year) => {
    const iso = toIso(Number(year), months.get(name.toLowerCase()), Number(day));
    if (!iso) throw new TranslationError("INVALID_TRANSLATED_DATE", "The offence date is not a valid calendar date. Please correct it; the original query is unchanged.");
    return `${iso} `;
  });
  const yearFirstPattern = new RegExp(`(?<!\\d)(20\\d{2})\\s+(${[...months.keys()].sort((a, b) => b.length - a.length).map(escapeRegex).join("|")})[,]?\\s+(\\d{1,2})(?!\\d)`, "giu");
  const yearFirstDates = numericDates.replace(yearFirstPattern, (raw, year, name, day) => {
    const iso = toIso(Number(year), months.get(name.toLowerCase()), Number(day));
    if (!iso) throw new TranslationError("INVALID_TRANSLATED_DATE", "The offence date is not a valid calendar date. Please correct it; the original query is unchanged.");
    return `${iso} `;
  });
  const dayWords = [...SPOKEN_DAYS.keys()].sort((a, b) => b.length - a.length).map(escapeRegex).join("|");
  const monthWords = [...months.keys()].sort((a, b) => b.length - a.length).map(escapeRegex).join("|");
  const yearWords = [...SPOKEN_DAYS.keys()].filter(word => SPOKEN_DAYS.get(word) <= 31).sort((a, b) => b.length - a.length).map(escapeRegex).join("|");
  const spoken = new RegExp(`(?<![\\p{L}\\p{N}])(?<day>${dayWords}|\\d{1,2})\\s+(?<month>${monthWords})[,]?\\s+(?<year>20\\d{2}|(?:दो|दोन)\\s+(?:हजार|हज़ार)\\s+(?:${yearWords}))(?![\\p{L}\\p{N}])`, "giu");
  const spokenDates = yearFirstDates.replace(spoken, (raw, ...args) => {
    const { day, month, year } = args.at(-1);
    const yearNumber = /^20\d{2}$/.test(year) ? Number(year) : 2000 + SPOKEN_DAYS.get(year.split(/\s+/).at(-1));
    const dayNumber = /^\d+$/.test(day) ? Number(day) : SPOKEN_DAYS.get(day);
    const iso = toIso(yearNumber, months.get(month.toLowerCase()), dayNumber);
    if (!iso) throw new TranslationError("INVALID_TRANSLATED_DATE", "The offence date is not a valid calendar date. Please correct it; the original query is unchanged.");
    return `${iso} `;
  });
  return stripNormalizedDateConnectors(spokenDates);
}

function stripNormalizedDateConnectors(text) {
  return text
    .replace(/\b(20\d{2}-\d{2}-\d{2})\s+ના\s+રોજ(?=\s|[।,.!?]|$)/giu, "$1 ")
    .replace(/\b(20\d{2}-\d{2}-\d{2})\s+ರಂದು(?=\s|[।,.!?]|$)/giu, "$1 ");
}

function normalizeDigits(text) {
  return [...text].map(char => {
    const base = DIGIT_BASES.find(base => char.codePointAt(0) >= base && char.codePointAt(0) <= base + 9);
    return base === undefined ? char : String(char.codePointAt(0) - base);
  }).join("");
}

// Literal spans never enter the model: protect identifiers/dates, not unreliable placeholders.
export function translationParts(text, protectedValues = []) {
  const fixed = protectedValues.filter(value => typeof value === "string" && value.length).sort((a, b) => b.length - a.length).map(escapeRegex);
  const literals = new RegExp([
    ...fixed,
    "https?:\\/\\/[^\\s<>]+", "\\b[\\w.-]+\\.(?:pdf|jsonl?|csv)\\b",
    "\\b(?:Ministry of Home Affairs, Government of India|Gazette of India, Ministry of Law and Justice|Gazette of India, Ministry of Home Affairs)\\b",
    "\\b(?:IPC_ONLY|BNS_PRIMARY|MULTI_PERIOD_REVIEW|CLARIFY|UNDETERMINED)\\b",
    "\\b(?:Relevance:?\\s+\\d+(?:\\.\\d+)?|PDF page\\s+\\d+)\\b",
    "\\b(?:Indian Penal Code|Bharatiya Nyaya Sanhita|IPC|BNS)(?:\\s+(?:Section\\s+)?\\d{1,3}[A-Za-z]{0,3}(?:\\([0-9A-Za-z]+\\))*)?(?![\\w(])",
    "\\bSection\\s+\\d{1,3}[A-Za-z]{0,3}(?:\\([0-9A-Za-z]+\\))*(?![\\w(])",
    "\\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\\s+\\d{1,2},?\\s+20\\d{2}\\b",
    "\\b\\d{1,2}\\s+(?:January|February|March|April|May|June|July|August|September|October|November|December),?\\s+20\\d{2}\\b",
    "\\bExplanation\\s+\\d+\\b", "\\bAct\\s+\\d+\\s+of\\s+\\d{4}\\b", "\\b\\d{4}-\\d{2}-\\d{2}\\b",
    "^[ \\t]*(?:#{1,6}[ \\t]+|(?:[-+*]|\\d+[.)])[ \\t]+)",
    "\\*\\*|__|`+|\\*|[\\[\\]()]|[-—–]{2,}|\\d+(?:[./-]\\d+)*|\\r?\\n"
  ].join("|").replaceAll("\\s+", "[ \\t]+"), "gim");
  const parts = [];
  let offset = 0;
  const append = value => {
    for (let chunk of value.match(/[^.!?;\n]+[.!?;\n]*|[.!?;\n]+/g) || []) {
      while (chunk.length) {
        const boundary = chunk.length <= 320 ? chunk.length : chunk.lastIndexOf(" ", 320) > 0 ? chunk.lastIndexOf(" ", 320) : 320;
        const segment = chunk.slice(0, boundary);
        chunk = chunk.slice(boundary);
        const leading = segment.match(/^\s*/)[0];
        const prose = segment.trim();
        const trailing = segment.slice(leading.length + prose.length);
        if (leading) parts.push({ text: leading, literal: true });
        if (prose) parts.push({ text: prose, literal: !/\p{L}/u.test(prose) });
        if (trailing) parts.push({ text: trailing, literal: true });
      }
    }
  };
  for (const match of text.matchAll(literals)) {
    append(text.slice(offset, match.index));
    parts.push({ text: match[0], literal: true });
    offset = match.index + match[0].length;
  }
  append(text.slice(offset));
  return parts;
}

export async function translateTexts(texts, source, target, worker = runTranslationWorker, protectedValues = []) {
  const groups = texts.map(text => translationParts(text, protectedValues));
  const phrases = groups.flat().filter(part => !part.literal);
  if (!phrases.length) return texts;
  const result = await worker({ action: "translate", source, target,
    modelPath: process.env.LOCAL_TRANSLATION_MODEL || join(ROOT, "models", "translation", "nllb-int8"),
    texts: phrases.map(part => part.text) });
  if (!Array.isArray(result.texts) || result.texts.length !== phrases.length) throw new TranslationError("TRANSLATION_FAILED");
  phrases.forEach((part, i) => {
    const translated = result.texts[i];
    // "Twelve years" may legitimately become "12 years"; accept only source-supported values.
    const allowed = new Set((part.text.toLowerCase().match(/\b[a-z]+\b/g) || []).map(word => NUMBER_WORDS[word]).filter(Boolean));
    const digits = typeof translated === "string" ? normalizeDigits(translated) : "";
    const numbers = digits.match(/[+-]?\d+(?:[.,/-]\d+)*/g) || [];
    const numericalMismatch = numbers.some(value => !allowed.has(value)) || /\p{N}/u.test(digits.replace(/[0-9]/g, ""));
    if (typeof translated !== "string" || !translated.trim() || numericalMismatch || /\b(?:IPC|BNS)\b/i.test(translated) || /\*\*|__|`|[\[\]\r\n]|^\s*(?:#{1,6}\s|[-+*]\s|\d+[.)]\s)/.test(translated)) {
      const error = new TranslationError("TRANSLATION_FACT_CHANGED");
      error.segmentIndex = i;
      throw error;
    }
    part.text = translated.trim();
  });
  return groups.map(group => group.map(part => part.text).join(""));
}

function clearlyEnglish(query) {
  if (/^(?:theft|cheating|(?:IPC|BNS)\s+(?:Section\s+)?\d{1,3}[A-Za-z]*(?:\(\d+\))?)$/i.test(query)) return true;
  return /^[\x00-\x7f]*$/.test(query) && (query.match(/\b(?:the|on|of|a|person|theft|cheating|offence|offense|happened|property|under|consent|law|act|IPC|BNS)\b/gi) || []).length >= 2;
}

function inferLanguageFromScript(query) {
  const lower = query.toLowerCase();
  for (const [language, pattern] of SCRIPT_LANGUAGE_PATTERNS) {
    if (!pattern.test(query)) continue;
    if (language !== "hi" && language !== "mr") return language;
    const marathiScore = [MARATHI_MARKERS, /ळ/u, /ऱ/u].reduce((score, pattern) => score + (pattern.test(query) ? 1 : 0), 0);
    const hindiScore = [HINDI_MARKERS, /ड़|ढ़/u].reduce((score, pattern) => score + (pattern.test(query) ? 1 : 0), 0);
    if (marathiScore > hindiScore) return "mr";
    if (hindiScore > marathiScore) return "hi";
    if (/(?:चोरीला|मोबाईल|रोजी)/u.test(lower)) return "mr";
    if (/(?:चोरी|मोबाइल)/u.test(lower)) return "hi";
    return null;
  }
  return null;
}

function hasExpectedScript(query, language) {
  if (language === "en") return /^[\x00-\x7f]*$/.test(query);
  if (language === "hi" || language === "mr") return /[\u0900-\u097f]/u.test(query);
  return SCRIPT_LANGUAGE_PATTERNS.find(([code]) => code === language)?.[1].test(query) || false;
}

function splitTranslationInput(text, maxLength = 320) {
  const chunks = [];
  let rest = text.trim();
  while (rest.length > maxLength) {
    const boundary = rest.lastIndexOf(" ", maxLength);
    if (boundary < maxLength / 2) throw new TranslationError("TRANSLATION_TEXT_TOO_LONG", "A long unbroken passage could not be translated safely. Please add spaces or shorter sentences.");
    chunks.push(rest.slice(0, boundary).trim());
    rest = rest.slice(boundary).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function verifyOffenceTranslation(original, english, language) {
  if (!["hi", "mr"].includes(language)) return;
  const theft = /(?<!\p{L})चोरी(?:ला|ची|चा|चे|च्या|ने)?(?!\p{L})/u.test(original);
  const homicide = /(?<!\p{L})(?:हत्या|खून|ख़ून)(?!\p{L})/u.test(original);
  if (theft && !homicide && /\b(?:murder|homicide|kill(?:ed|ing)?)\b/i.test(english)) {
    throw new TranslationError("TRANSLATION_CONCEPT_CHANGED", "The English processing text changed theft into a different offence. Please review the transcript or rephrase before analysis.");
  }
}

export async function translateInputQuery(query, language, worker = runTranslationWorker) {
  if (extractFacts(query).dates.length < 2) return (await translateTexts([query], language, "en", worker))[0];
  try {
    return await translateMultiDateQuery(query, language, worker, false);
  } catch (error) {
    if (query.length <= 320 || error.code !== "TRANSLATION_FACT_CHANGED") throw error;
    return translateMultiDateQuery(query, language, worker, true);
  }
}

async function translateMultiDateQuery(query, language, worker, alternateMarkers) {
  // Complete date-adjacent clauses stay together; only a verified marker can restore a date.
  const markerPattern = alternateMarkers ? /DATE\d+/g : /__LEGAL_\d+__/g;
  if (/__LEGAL_\d+__|DATE\d+/.test(query)) throw new TranslationError("TRANSLATION_FACT_CHANGED");
  const literals = [];
  const masked = translationParts(query).map(part => {
    if (!part.literal || !/[\p{L}\p{N}]/u.test(part.text)) return part.text;
    const marker = alternateMarkers ? `DATE${literals.length}` : `__LEGAL_${literals.length}__`;
    literals.push({ marker, text: part.text });
    return marker;
  }).join("");
  const chunks = splitTranslationInput(masked);
  const result = await worker({ action: "translate", source: language, target: "en",
    modelPath: process.env.LOCAL_TRANSLATION_MODEL || join(ROOT, "models", "translation", "nllb-int8"), texts: chunks });
  if (result.texts?.length !== chunks.length || result.texts.some(text => typeof text !== "string" || !text.trim())) throw new TranslationError("TRANSLATION_FAILED");
  const translated = result.texts.join(" ");
  const markers = translated.match(markerPattern) || [];
  const prose = translated.replace(markerPattern, "");
  if (JSON.stringify(markers) !== JSON.stringify(literals.map(item => item.marker)) || /\p{N}|\b(?:IPC|BNS)\b|__LEGAL_|\*\*|`|[\[\]\r\n]/u.test(prose)) throw new TranslationError("TRANSLATION_FACT_CHANGED");
  const byMarker = new Map(literals.map(item => [item.marker, item.text]));
  return translated.replace(markerPattern, marker => byMarker.get(marker));
}

// Whole-sentence translation reads far better than the literal-protecting path, whose fragments break grammar around
// dates and section numbers. It is accepted only if every number in the source survives; otherwise the caller falls back.
async function translateWholeSentences(text, source, target, worker) {
  const pieces = text.match(/[^.!?;।۔\n]+[.!?;।۔\n]*/gu) || [];
  const sentences = pieces.filter(piece => /\p{L}/u.test(piece));
  if (!sentences.length) return null;
  const result = await worker({ action: "translate", source, target,
    modelPath: process.env.LOCAL_TRANSLATION_MODEL || join(ROOT, "models", "translation", "nllb-int8"),
    texts: sentences.map(piece => piece.trim()) });
  if (!Array.isArray(result?.texts) || result.texts.length !== sentences.length
    || result.texts.some(value => typeof value !== "string" || !value.trim())) return null;
  let next = 0;
  const output = pieces.map(piece => {
    if (!/\p{L}/u.test(piece)) return piece;
    return piece.match(/^\s*/)[0] + result.texts[next++].trim() + piece.match(/\s*$/)[0];
  }).join("");
  const numbers = value => (normalizeDigits(value).match(/\d+(?:[.,]\d+)*/g) || []).sort().join("|");
  return numbers(text) === numbers(output) ? output : null;
}

// Translates the text box itself when the user changes the written language. Whole-sentence translation is tried
// first; if a number changes, the verified paths run: anything -> English is the analysis translation (dates
// normalized, facts checked) and English -> X protects dates, section numbers and IPC/BNS references as literals.
// Two non-English languages pivot through English on that fallback.
export async function translateDisplayText(text, { source, target, worker = runTranslationWorker } = {}) {
  const query = String(text ?? "").trim();
  const to = normalizeLanguageCode(target);
  if (!to || to === "auto" || !LANGUAGE_NAMES[to]) throw new TranslationError("UNSUPPORTED_LANGUAGE", "Choose a supported language to translate into.");
  if (!query) return { text: "", sourceLanguage: null, targetLanguage: to, changed: false };
  if (query.length > 4000) throw new TranslationError("TRANSLATION_TEXT_TOO_LONG", "Please keep the query under 4000 characters.", 413);
  const hint = normalizeLanguageCode(source);
  let from = hint && hint !== "auto" && LANGUAGE_NAMES[hint] && hasExpectedScript(query, hint) ? hint : null;
  if (!from) from = clearlyEnglish(query) ? "en" : inferLanguageFromScript(query);
  if (!from) {
    const detected = await worker({ action: "detect", text: query });
    if (!LANGUAGE_NAMES[detected?.language] || !(detected.confidence >= 0.8)) {
      throw new TranslationError("LANGUAGE_UNCERTAIN", "The language of the text could not be identified reliably, so it was not translated. Your text is unchanged.");
    }
    from = detected.language;
  }
  if (from === to) return { text: query, sourceLanguage: from, targetLanguage: to, changed: false };
  const tidy = value => value.replace(/[ \t]{2,}/g, " ").trim();
  const done = (value, method) => ({ text: tidy(value), sourceLanguage: from, targetLanguage: to, changed: true, method });
  let whole = null;
  try {
    whole = await translateWholeSentences(query, from, to, worker);
    if (whole && to === "en") verifyOffenceTranslation(query, whole, from);
  } catch {
    whole = null;
  }
  if (whole) return done(whole, "whole-sentence");
  const english = from === "en" ? query : repairTranslatedDateSpacing(await translateInputQuery(normalizeInputDates(query), from, worker));
  if (from !== "en") verifyOffenceTranslation(query, english, from);
  const output = to === "en" ? english : (await translateTexts([english], "en", to, worker))[0];
  return done(output, from !== "en" && to !== "en" ? "english-pivot" : "protected-literals");
}

export async function analyzeMultilingualQuery(query, { originalLanguage, inputMode, inputLanguage, languageProbability, languageSource, originalInput, worker = runTranslationWorker } = {}) {
  const originalQuery = String(query || "").trim();
  if (!originalQuery) return analyzeQuery(originalQuery);
  const selectedOriginalLanguage = normalizeLanguageCode(originalLanguage);
  const selectedTextLanguage = !voiceInputMode(inputMode) && selectedOriginalLanguage && selectedOriginalLanguage !== "auto" && (!clearlyEnglish(originalQuery) || selectedOriginalLanguage === "en") ? selectedOriginalLanguage : null;
  if (selectedTextLanguage && !LANGUAGE_NAMES[selectedTextLanguage]) throw new TranslationError("UNSUPPORTED_LANGUAGE", "The selected input language is not supported. Please use English or a supported Indian language.");
  if (originalQuery.length > 4000) throw new TranslationError("TRANSLATION_TEXT_TOO_LONG", "Please keep the query under 4000 characters.", 413);
  const voice = voiceInputMode(inputMode);
  const speechLanguage = normalizeLanguageCode(inputLanguage);
  const selectedSpeech = voice && languageSource === "user-selected";
  if (voice) {
    if (selectedSpeech && !["en", "hi", "mr", "ur", "gu"].includes(speechLanguage)) throw new TranslationError("UNSUPPORTED_LANGUAGE", "Choose English, Hindi, Marathi, Urdu, or Gujarati before recording; your transcript is unchanged.");
    if (!selectedSpeech) {
      const status = speechLanguageStatus(speechLanguage, languageProbability);
      if (status === "unsupported") throw new TranslationError("UNSUPPORTED_LANGUAGE", "The detected spoken language is unsupported. Your transcript is unchanged; please record in a supported language or clear it and type a new query.");
      if (status !== "detected") throw new TranslationError("LANGUAGE_UNCERTAIN", "The spoken language could not be identified reliably. Your transcript is unchanged; please record a longer query in one language or clear it and type a new query.");
    }
    if (typeof originalInput !== "string" || !originalInput.trim() || originalInput.length > 4000) throw new TranslationError("INVALID_VOICE_INPUT", "The original voice transcript is missing or too long. Please record again.");
  }
  // Do not reclassify reliable native ASR text using short/shared-script text detection.
  const detected = selectedTextLanguage ? { language: selectedTextLanguage, confidence: null, detection_method: "user-selected-text" }
    : voice ? { language: speechLanguage, confidence: selectedSpeech ? null : languageProbability,
    detection_method: selectedSpeech ? "user-selected-speech" : "faster-whisper" }
    : clearlyEnglish(originalQuery) ? { language: "en", confidence: 1 } : await worker({ action: "detect", text: originalQuery });
  if (selectedTextLanguage && !hasExpectedScript(originalQuery, selectedTextLanguage)) {
    throw new TranslationError("LANGUAGE_UNCERTAIN", "The selected language does not match the script in the input. Please choose the correct language or use Auto.");
  }
  if (!selectedTextLanguage && !voice && detected.detection_method !== "py3langid+marathi-consensus" && (!LANGUAGE_NAMES[detected.language] || detected.confidence < 0.8)) {
    const scriptLanguage = inferLanguageFromScript(originalQuery);
    if (scriptLanguage) {
      detected.language = scriptLanguage;
      detected.confidence = 1;
      detected.detection_method = "script-fallback";
    }
  }
  if (!LANGUAGE_NAMES[detected.language]) throw new TranslationError("UNSUPPORTED_LANGUAGE", "This input language is not supported. Please use English or one of the supported Indian languages.");
  const consensus = detected.detection_method === "py3langid+marathi-consensus" && detected.reliable === true && detected.language === "mr"
    && detected.marathi_signal_groups >= 3 && detected.hindi_signal_groups === 0;
  if (!selectedSpeech && !selectedTextLanguage && (!Number.isFinite(detected.confidence) || (detected.confidence < 0.8 && !consensus))) throw new TranslationError("LANGUAGE_UNCERTAIN", "The input language could not be identified reliably. Please rephrase in one language; the original text is unchanged.");
  const language = !voice && detected.language === "en" && LANGUAGE_NAMES[originalLanguage] ? originalLanguage : detected.language;
  const inputState = english => ({ inputMode: "voice", inputLanguage: language, processingLanguage: "en", outputLanguage: language,
    originalInput, reviewedInput: originalQuery, processedInput: english, languageName: LANGUAGE_NAMES[language],
    languageSource: selectedSpeech ? "user-selected" : "automatic", languageProbability: selectedSpeech ? null : languageProbability });
  if (language === "en") {
    const result = analyzeQuery(originalQuery);
    return voice ? { ...result, input: inputState(originalQuery) } : result;
  }
  const normalized = detected.language === "en" ? originalQuery : normalizeInputDates(originalQuery);
  let rawEnglish = detected.language === "en" ? normalized : await translateInputQuery(normalized, detected.language, worker);
  let english = repairTranslatedDateSpacing(rawEnglish);
  let meaningIssue = translationMeaningIssue(originalQuery, english, language);
  let translationRetry = false;
  if (meaningIssue && detected.language !== "en") {
    rawEnglish = await translateInputQuery(normalized, detected.language, payload => worker({ ...payload, quality: "review" }));
    english = repairTranslatedDateSpacing(rawEnglish);
    translationRetry = true;
    meaningIssue = translationMeaningIssue(originalQuery, english, language);
  }
  if (meaningIssue) throw new TranslationError(meaningIssue.code, meaningIssue.reason);
  verifyOffenceTranslation(originalQuery, english, language);
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const originalWeekdays = new Set();
  for (let day = 0; day < 7; day++) for (const locale of Object.keys(LANGUAGE_NAMES)) {
    const name = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 8, 1 + day)));
    if (originalQuery.toLowerCase().includes(name.toLowerCase())) originalWeekdays.add(weekdays[day].toLowerCase());
  }
  if ((english.match(/\b(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/gi) || []).some(day => !originalWeekdays.has(day.toLowerCase()))) throw new TranslationError("TRANSLATION_FACT_CHANGED");
  const expected = extractFacts(normalized).dates.map(d => d.value).sort();
  if (JSON.stringify(expected) !== JSON.stringify(extractFacts(english).dates.map(d => d.value).sort())) throw new TranslationError("TRANSLATION_DATE_CHANGED");
  const result = analyzeQuery(english);
  const presentation = createLegalPresentation(result, language, BNS_COMMENCEMENT);
  if (outputTranslationEnabled(language)) {
    const targets = presentationTranslationTargets(presentation, !["hi", "mr"].includes(language));
    const protectedValues = result.retrieved.flatMap(doc => [doc.id, ...Object.values(doc.source).filter(value => typeof value === "string")]);
    const translated = await translateTexts(targets.map(target => target.get()), "en", language, worker, protectedValues);
    targets.forEach((target, index) => target.set(translated[index]));
    syncDecisionLabels(presentation);
    presentation.outputTranslation = "local-model";
  } else {
    presentation.labels.translatedTitle = presentation.labels.originalTitle || "Original source title";
    presentation.outputTranslation = "disabled-fast-path";
  }
  return { ...result, ...(voice ? { input: inputState(english) } : {}), multilingual: { originalQuery, originalLanguage: language, inputLanguage: language, outputLanguage: language, languageName: LANGUAGE_NAMES[language], processingLanguage: "en", englishQuery: english, detectionConfidence: detected.confidence,
    detectionMethod: detected.detection_method || "py3langid", detectionModelLanguage: detected.model_language || detected.language, translationRetry,
    presentation } };
}

function voiceInputMode(inputMode) {
  return inputMode === "voice";
}

function repairTranslatedDateSpacing(text) {
  return text.replace(
    /\b([0-3]?\d\s+(?:January|February|March|April|May|June|July|August|September|October|November|December),?\s+20\d{2})(?=[A-Za-z])/g,
    "$1 "
  );
}
