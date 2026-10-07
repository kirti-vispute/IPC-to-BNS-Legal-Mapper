// Classical NLP applied to ASR output. A neural recognizer is good at acoustics but writes numbers
// inconsistently and misspells domain terms; these deterministic, auditable stages repair that.
//
//   1. Text normalization            Unicode NFC, zero-width and control characters, spacing
//   2. Acronym transliteration       IPC / BNS / BNSS / CrPC written in Devanagari, Gujarati or Urdu script
//   3. Inverse text normalization    spoken numbers -> digits (section numbers, dates, rupee amounts)
//   4. Lexicon correction            Levenshtein + consonant-skeleton similarity against a closed legal lexicon
//   5. Confidence review             word posterior probabilities -> words the user should check
//
// Every change is recorded in `corrections` so the UI can show it and nothing is altered silently.

// ---------- 1. Text normalization ----------
export function normalizeText(text) {
  return String(text ?? "")
    .normalize("NFC")
    .replace(/[​‎‏⁠﻿]/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ")
    .replace(/[ \t ]+/g, " ")
    .replace(/\s+([,.;:!?।۔])/g, "$1")
    .trim();
}

// ---------- 2. Acronym transliteration ----------
const ACRONYMS = [
  ["BNSS", ["बीएनएसएस", "बी एन एस एस", "બીએનએસએસ", "بی این ایس ایس"]],
  ["CrPC", ["सीआरपीसी", "सी आर पी सी", "સીઆરપીસી", "سی آر پی سی"]],
  ["IPC", ["आईपीसी", "आयपीसी", "आई पी सी", "आई.पी.सी.", "આઈપીસી", "આઈ પી સી", "آئی پی سی", "آئی-پی-سی"]],
  ["BNS", ["बीएनएस", "बी एन एस", "બીએનએસ", "બી એન એસ", "بی این ایس"]]
];
const NOT_LETTER = "(?<![\\p{L}\\p{M}])";
const NOT_LETTER_AFTER = "(?![\\p{L}\\p{M}])";
const ACRONYM_RULES = ACRONYMS.map(([acronym, variants]) => ({
  acronym,
  pattern: new RegExp(`${NOT_LETTER}(?:${variants.map(escapeRegex).join("|")})${NOT_LETTER_AFTER}`, "gu")
}));

export function transliterateAcronyms(text, corrections) {
  let output = text;
  for (const { acronym, pattern } of ACRONYM_RULES) {
    output = output.replace(pattern, (match) => {
      corrections.push({ kind: "acronym", from: match, to: acronym });
      return acronym;
    });
  }
  // Latin letters spoken one by one: "I P C", "B.N.S."
  output = output.replace(/\b([ibc])[\s.]+([pnr])[\s.]+([cs])(?:[\s.]+(s))?\b\.?/gi, (match, a, b, c, d) => {
    const spelled = `${a}${b}${c}${d || ""}`.toUpperCase();
    const known = { IPC: "IPC", BNS: "BNS", BNSS: "BNSS" }[spelled];
    if (!known) return match;
    corrections.push({ kind: "acronym", from: match.trim(), to: known });
    return known + (match.endsWith(".") ? "." : "");
  });
  return output;
}

// ---------- 3. Inverse text normalization (English number words) ----------
const UNITS = { zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALES = { hundred: 100, thousand: 1000, lakh: 100000, lakhs: 100000, crore: 10000000, crores: 10000000 };
const ORDINALS = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18,
  nineteenth: 19, twentieth: 20, thirtieth: 30 };
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_NAMES = MONTHS.map(name => name[0].toUpperCase() + name.slice(1));
const SECTION_WORDS = new Set(["section", "sections", "sec", "ipc", "bns", "bnss", "crpc", "article"]);
const MONEY_WORDS = new Set(["rupees", "rupee", "rs", "inr"]);
const FILLER_AFTER_SECTION = new Set(["number", "no", "num"]);

function wordTokens(text) {
  const tokens = [];
  for (const match of text.matchAll(/[A-Za-z]+(?:-[A-Za-z]+)*|\d+/g)) {
    const start = match.index;
    let offset = 0;
    for (const part of match[0].split("-")) {
      tokens.push({ word: part, lower: part.toLowerCase(), start: start + offset, end: start + offset + part.length });
      offset += part.length + 1;
    }
  }
  return tokens;
}

const gapBetween = (text, a, b) => text.slice(a.end, b.start);
const plainGap = (text, a, b) => /^[\s-]+$/.test(gapBetween(text, a, b));
const dateGap = (text, a, b) => /^[\s,]+$/.test(gapBetween(text, a, b));

// Parses a run of number words ("three hundred and seventy nine") into { value, count }.
function parseCardinal(text, tokens, index) {
  let total = 0;
  let current = 0;
  let count = 0;
  let sawScale = false;
  let tensOpen = false; // a unit may follow a tens word
  let unitDone = false;
  for (let i = index; i < tokens.length; i++) {
    const token = tokens[i];
    if (i > index && !plainGap(text, tokens[i - 1], token)) break;
    const word = token.lower;
    if (word === "and" && sawScale && i + 1 < tokens.length && (word => word in UNITS || word in TENS)(tokens[i + 1].lower)) {
      count++;
      continue;
    }
    if (word in TENS && !tensOpen && !unitDone && current % 100 === 0) {
      current += TENS[word];
      tensOpen = true;
      count++;
    } else if (word in UNITS && word !== "oh" && !unitDone && (current % 100 === 0 || tensOpen) && !(tensOpen && UNITS[word] >= 10)) {
      if (UNITS[word] >= 10 && current % 100 !== 0) break;
      current += UNITS[word];
      unitDone = true;
      tensOpen = false;
      count++;
    } else if (word === "hundred" && current > 0 && current < 100) {
      current *= 100;
      sawScale = true;
      tensOpen = false;
      unitDone = false;
      count++;
    } else if ((word === "thousand" || word === "lakh" || word === "lakhs" || word === "crore" || word === "crores") && (current > 0 || total > 0)) {
      total += (current || 1) * SCALES[word];
      current = 0;
      sawScale = true;
      tensOpen = false;
      unitDone = false;
      count++;
    } else {
      break;
    }
  }
  if (!count) return null;
  // A trailing "and" belongs to the sentence, not the number.
  if (tokens[index + count - 1]?.lower === "and") count--;
  return count ? { value: total + current, count } : null;
}

// Section numbers are spoken in several ways: "three seventy nine", "three hundred and seventy nine",
// "four twenty", "three oh two", "three seven nine", "seventy nine".
function parseSectionNumber(text, tokens, index) {
  let start = index;
  if (tokens[start] && FILLER_AFTER_SECTION.has(tokens[start].lower) && start + 1 < tokens.length) start++;
  const first = tokens[start];
  if (!first) return null;
  if (/^\d+$/.test(first.word)) return null;
  const digitWord = word => word in UNITS && UNITS[word] >= 1 && UNITS[word] <= 9;
  const next = (offset) => {
    const token = tokens[start + offset];
    return token && plainGap(text, tokens[start + offset - 1], token) ? token : null;
  };
  const cardinal = parseCardinal(text, tokens, start);
  if (cardinal && cardinal.count >= 2 && tokens.slice(start, start + cardinal.count).some(token => token.lower === "hundred")) {
    return { value: cardinal.value, from: start, count: cardinal.count };
  }
  if (digitWord(first.lower)) {
    const second = next(1);
    const third = next(2);
    if (second && (second.lower in TENS || (second.lower in UNITS && UNITS[second.lower] >= 10))) {
      const tens = second.lower in TENS ? TENS[second.lower] : UNITS[second.lower];
      const unit = second.lower in TENS && third && digitWord(third.lower) ? UNITS[third.lower] : 0;
      return { value: UNITS[first.lower] * 100 + tens + unit, from: start, count: unit ? 3 : 2 };
    }
    if (second && (second.lower === "oh" || second.lower === "zero") && third && digitWord(third.lower)) {
      return { value: UNITS[first.lower] * 100 + UNITS[third.lower], from: start, count: 3 };
    }
    if (second && digitWord(second.lower)) {
      const digits = [first, second, third && digitWord(third.lower) ? third : null].filter(Boolean);
      return { value: Number(digits.map(token => UNITS[token.lower]).join("")), from: start, count: digits.length };
    }
  }
  if (cardinal && cardinal.value > 0 && cardinal.value < 1000) return { value: cardinal.value, from: start, count: cardinal.count };
  return null;
}

function parseYear(text, tokens, index) {
  const first = tokens[index];
  if (!first) return null;
  if (/^(?:19|20)\d{2}$/.test(first.word)) return { value: Number(first.word), count: 1 };
  const next = (offset) => {
    const token = tokens[index + offset];
    return token && plainGap(text, tokens[index + offset - 1], token) ? token : null;
  };
  if (first.lower === "two" && next(1)?.lower === "thousand") {
    let offset = 2;
    if (next(offset)?.lower === "and") offset++;
    const rest = next(offset) ? parseCardinal(text, tokens, index + offset) : null;
    if (rest && rest.value < 100) return { value: 2000 + rest.value, count: offset + rest.count };
    return { value: 2000, count: 2 };
  }
  if (first.lower === "twenty" || first.lower === "nineteen") {
    const century = first.lower === "twenty" ? 2000 : 1900;
    const second = next(1);
    if (!second) return null;
    if (second.lower === "oh" || second.lower === "zero") {
      const unit = next(2);
      if (unit && UNITS[unit.lower] >= 1 && UNITS[unit.lower] <= 9) return { value: century + UNITS[unit.lower], count: 3 };
      return null;
    }
    if (second.lower in TENS || (second.lower in UNITS && UNITS[second.lower] >= 10)) {
      const tens = second.lower in TENS ? TENS[second.lower] : UNITS[second.lower];
      const unit = second.lower in TENS ? next(2) : null;
      if (unit && UNITS[unit.lower] >= 1 && UNITS[unit.lower] <= 9) return { value: century + tens + UNITS[unit.lower], count: 3 };
      return { value: century + tens, count: 2 };
    }
  }
  return null;
}

// "twenty first", "twenty-first", "21st", "twenty one" before a month name.
function parseDayEndingAt(text, tokens, end) {
  for (const length of [3, 2, 1]) {
    const start = end - length + 1;
    if (start < 0) continue;
    const slice = tokens.slice(start, end + 1);
    if (slice.some((token, i) => i > 0 && !plainGap(text, slice[i - 1], token))) continue;
    const words = slice.map(token => token.lower);
    if (words.length === 1 && /^\d{1,2}$/.test(slice[0].word)) {
      const value = Number(slice[0].word);
      if (value >= 1 && value <= 31) return { value, start };
    }
    const last = words.at(-1);
    let value = null;
    if (last in ORDINALS) {
      const lead = words.slice(0, -1);
      if (!lead.length) value = ORDINALS[last];
      else if (lead.length === 1 && lead[0] in TENS && ORDINALS[last] < 10) value = TENS[lead[0]] + ORDINALS[last];
    } else {
      const cardinal = parseCardinal(text, slice, 0);
      if (cardinal && cardinal.count === slice.length) value = cardinal.value;
    }
    if (value !== null && value >= 1 && value <= 31) return { value, start };
  }
  return null;
}

export function inverseNormalizeEnglish(text, corrections) {
  const tokens = wordTokens(text);
  const edits = [];
  const taken = new Set();
  const claim = (from, to) => {
    for (let i = from; i <= to; i++) if (taken.has(i)) return false;
    for (let i = from; i <= to; i++) taken.add(i);
    return true;
  };

  // Dates first: they contain number words that must not be read as section numbers.
  tokens.forEach((token, index) => {
    const month = MONTHS.indexOf(token.lower);
    if (month < 0 || taken.has(index)) return;
    let day = null;
    let before = index - 1;
    if (before >= 0 && (tokens[before].lower === "of" || tokens[before].lower === "the") && plainGap(text, tokens[before], token)) before--;
    if (before >= 0) day = parseDayEndingAt(text, tokens, before);
    let year = null;
    let yearCount = 0;
    const after = tokens[index + 1];
    if (after && dateGap(text, token, after)) {
      const parsed = parseYear(text, tokens, index + 1);
      if (parsed) { year = parsed.value; yearCount = parsed.count; }
    }
    const spokenDay = day && tokens.slice(day.start, before + 1).some(piece => !/^\d+$/.test(piece.word));
    const spokenYear = yearCount > 0 && tokens.slice(index + 1, index + 1 + yearCount).some(piece => !/^\d{4}$/.test(piece.word));
    if (!day && !year) return;
    if (!spokenDay && !spokenYear) return; // already written with digits: nothing to convert
    // "may" and "march" are ordinary words ("no one may enter"); only trust them with a year.
    if ((token.lower === "may" || token.lower === "march") && !year) return;
    let from = day ? day.start : index;
    // "the twenty first of June ..." reads as "21 June ...": the article goes with the spoken form.
    if (day && from > 0 && tokens[from - 1].lower === "the" && plainGap(text, tokens[from - 1], tokens[from])) from--;
    const to = year ? index + yearCount : index;
    if (!claim(from, to)) return;
    const label = [day ? String(day.value) : null, MONTH_NAMES[month], year ? String(year) : null].filter(Boolean).join(" ");
    edits.push({ start: tokens[from].start, end: tokens[to].end, to: label, kind: "date" });
  });

  tokens.forEach((token, index) => {
    if (taken.has(index)) return;
    if (SECTION_WORDS.has(token.lower)) {
      const next = tokens[index + 1];
      if (!next || !plainGap(text, token, next) || taken.has(index + 1)) return;
      const parsed = parseSectionNumber(text, tokens, index + 1);
      if (!parsed) return;
      const from = parsed.from;
      const to = parsed.from + parsed.count - 1;
      if (!claim(from, to)) return;
      edits.push({ start: tokens[from].start, end: tokens[to].end, to: String(parsed.value), kind: "section" });
      return;
    }
    if (token.lower in TENS || token.lower in UNITS || token.lower === "hundred") {
      const cardinal = parseCardinal(text, tokens, index);
      if (!cardinal) return;
      const after = tokens[index + cardinal.count];
      if (!after || !MONEY_WORDS.has(after.lower) || !plainGap(text, tokens[index + cardinal.count - 1], after)) return;
      if (!claim(index, index + cardinal.count - 1)) return;
      edits.push({ start: token.start, end: tokens[index + cardinal.count - 1].end, to: cardinal.value.toLocaleString("en-US"), kind: "amount" });
    }
  });

  let output = text;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    corrections.push({ kind: edit.kind, from: output.slice(edit.start, edit.end), to: edit.to });
    output = output.slice(0, edit.start) + edit.to + output.slice(edit.end);
  }
  return output;
}

// ---------- 4. Lexicon correction ----------
export const LEGAL_LEXICON = [
  "Bharatiya Nyaya Sanhita", "Bharatiya Nagarik Suraksha Sanhita", "Indian Penal Code", "Code of Criminal Procedure",
  "criminal breach of trust", "dishonest intention", "movable property", "without consent", "grievous hurt",
  "culpable homicide", "wrongful restraint", "wrongful confinement", "criminal intimidation", "criminal conspiracy",
  "organized crime", "extortion", "misappropriation", "defamation", "kidnapping", "abduction"
];

export function levenshtein(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return previous[b.length];
}

const letters = value => value.toLowerCase().replace(/[^a-z]/g, "");
// Consonant skeleton: vowels and y carry most of the ASR spelling noise ("Sanhita" / "Sanhada").
const skeleton = value => letters(value).replace(/[aeiouy]/g, "");
const similarity = (a, b) => (a.length || b.length ? 1 - levenshtein(a, b) / Math.max(a.length, b.length) : 1);

export function phraseSimilarity(heard, term) {
  return Math.max(similarity(letters(heard), letters(term)), similarity(skeleton(heard), skeleton(term)));
}

export function correctWithLexicon(text, corrections, lexicon = LEGAL_LEXICON) {
  const tokens = wordTokens(text).filter(token => !/^\d+$/.test(token.word));
  const edits = [];
  const used = new Set();
  for (const term of lexicon) {
    const termTokens = term.split(/\s+/).length;
    const longPhrase = letters(term).length >= 18;
    const threshold = termTokens === 1 ? 0.86 : longPhrase ? 0.72 : 0.82;
    if (termTokens === 1 && letters(term).length < 8) continue;
    for (const size of new Set([termTokens, termTokens + 1, termTokens - 1].filter(length => length >= 1))) {
      for (let i = 0; i + size <= tokens.length; i++) {
        const window = tokens.slice(i, i + size);
        if (window.some(token => used.has(token.start))) continue;
        if (window.some((token, k) => k > 0 && !plainGap(text, window[k - 1], token))) continue;
        const heard = text.slice(window[0].start, window.at(-1).end);
        if (heard.toLowerCase() === term.toLowerCase()) { window.forEach(token => used.add(token.start)); continue; }
        if (letters(heard)[0] !== letters(term)[0]) continue;
        // Skip windows that are only ordinary short words, and a window already spelled like another lexicon term.
        if (letters(heard).length < 7) continue;
        if (phraseSimilarity(heard, term) < threshold) continue;
        edits.push({ start: window[0].start, end: window.at(-1).end, to: term, from: heard });
        window.forEach(token => used.add(token.start));
      }
    }
  }
  let output = text;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    corrections.push({ kind: "lexicon", from: edit.from, to: edit.to });
    output = output.slice(0, edit.start) + edit.to + output.slice(edit.end);
  }
  return output;
}

// ---------- 5. Confidence review ----------
export function reviewWords(words, { wordThreshold = 0.5, numberThreshold = 0.75, limit = 8 } = {}) {
  if (!Array.isArray(words)) return { average: null, uncertain: [] };
  const clean = words.filter(item => item && typeof item.w === "string" && Number.isFinite(item.p) && /[\p{L}\p{N}]/u.test(item.w));
  if (!clean.length) return { average: null, uncertain: [] };
  const average = clean.reduce((sum, item) => sum + item.p, 0) / clean.length;
  const seen = new Set();
  const uncertain = clean
    .filter(item => item.p < (/\d/.test(item.w) ? numberThreshold : wordThreshold))
    .sort((a, b) => a.p - b.p)
    .filter(item => {
      const key = item.w.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .map(item => ({ word: item.w.trim(), probability: Number(item.p.toFixed(2)) }));
  return { average: Number(average.toFixed(3)), uncertain };
}

// Whisper models report a mean log-probability per segment (word-level scores need word timestamps, which changed the
// transcript and doubled decoding time on the Hindi model, so they are not used). Low segments are flagged for review.
export function reviewSegments(segments, { threshold = 0.6, limit = 5 } = {}) {
  if (!Array.isArray(segments)) return { average: null, uncertain: [] };
  const clean = segments.filter(item => item && typeof item.text === "string" && item.text.trim() && Number.isFinite(item.p));
  if (!clean.length) return { average: null, uncertain: [] };
  const total = clean.reduce((sum, item) => sum + item.text.length, 0) || 1;
  // Longer segments weigh more, so one short noisy fragment cannot dominate the average.
  const average = clean.reduce((sum, item) => sum + item.p * item.text.length, 0) / total;
  const uncertain = clean.filter(item => item.p < threshold).sort((a, b) => a.p - b.p).slice(0, limit)
    .map(item => ({ text: item.text.trim().slice(0, 160), probability: Number(item.p.toFixed(2)) }));
  return { average: Number(average.toFixed(3)), uncertain };
}

export function postprocessTranscript(text, { language = null, words = null, segments = null } = {}) {
  const rawText = String(text ?? "");
  const corrections = [];
  let output = normalizeText(rawText);
  output = transliterateAcronyms(output, corrections);
  if (!language || language === "en") {
    output = inverseNormalizeEnglish(output, corrections);
    output = correctWithLexicon(output, corrections);
  }
  const wordReview = reviewWords(words);
  const segmentReview = reviewSegments(segments);
  return {
    text: output, rawText, corrections: corrections.reverse(),
    confidence: wordReview.average ?? segmentReview.average, confidenceLevel: wordReview.average !== null ? "word" : segmentReview.average !== null ? "segment" : null,
    uncertainWords: wordReview.uncertain, uncertainSegments: segmentReview.uncertain
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
