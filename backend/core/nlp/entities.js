import { asciiDigits } from "./tokenizer.js";

// Rule- and gazetteer-based named-entity recognition for the legal-query domain.
// Entity types: DATE, SECTION (a statute section reference), LAW (a law or code name), MONEY, OFFENCE.
// There is no statistical NER model here, so PERSON / LOCATION / ORGANIZATION are deliberately not produced.
// All patterns are built from fixed, trusted word lists; no user text is ever compiled into a pattern.

const SECTION_WORDS = ["section", "sections", "sec", "धारा", "कलम", "કલમ", "દફા", "دفعہ", "دفعه"];
const CODES = ["IPC", "BNS", "BNSS", "CrPC"];
const MONEY_WORDS = ["rupees", "rupee", "rs", "inr", "रुपये", "रुपए", "रूपये", "रुपया", "रु", "रू", "રૂપિયા", "રૂપિયો", "રૂ", "روپے", "روپیہ", "روپیے"];

const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const alternation = list => [...list].sort((a, b) => b.length - a.length).map(escape).join("|");
const BOUNDARY_BEFORE = "(?<![\\p{L}\\p{M}\\p{N}])";
const BOUNDARY_AFTER = "(?![\\p{L}\\p{M}\\p{N}])";

// Month names in every supported language, taken from the platform's locale data rather than typed by hand.
function monthNames() {
  const months = new Map();
  for (const locale of ["en", "hi", "mr", "gu", "ur"]) {
    for (let month = 1; month <= 12; month++) {
      for (const style of ["long", "short"]) {
        const name = new Intl.DateTimeFormat(locale, { month: style, timeZone: "UTC" }).format(new Date(Date.UTC(2024, month - 1, 1)));
        months.set(name.toLowerCase().replace(/\.$/, ""), month);
      }
    }
  }
  return months;
}
const MONTHS = monthNames();
const MONTH_PATTERN = alternation([...MONTHS.keys()].filter(name => name.length >= 3));

export const isMonthName = word => MONTHS.has(String(word).toLowerCase().replace(/\.$/, ""));

function isoDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : null;
}

function dateEntities(text) {
  const found = [];
  const add = (match, iso) => { if (iso) found.push({ type: "DATE", text: match[0], value: iso, start: match.index, end: match.index + match[0].length }); };
  for (const m of text.matchAll(/(?<!\d)(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/g)) add(m, isoDate(+m[1], +m[2], +m[3]));
  for (const m of text.matchAll(/(?<!\d)(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})(?!\d)/g)) add(m, isoDate(+m[3], +m[2], +m[1]));
  const day = "(\\d{1,2})(?:st|nd|rd|th)?";
  const dayFirst = new RegExp(`${BOUNDARY_BEFORE}${day}\\s+(?:of\\s+)?(${MONTH_PATTERN})\\.?,?\\s+(20\\d{2})${BOUNDARY_AFTER}`, "giu");
  for (const m of text.matchAll(dayFirst)) add(m, isoDate(+m[3], MONTHS.get(m[2].toLowerCase()), +m[1]));
  const monthFirst = new RegExp(`${BOUNDARY_BEFORE}(${MONTH_PATTERN})\\.?\\s+${day},?\\s+(20\\d{2})${BOUNDARY_AFTER}`, "giu");
  for (const m of text.matchAll(monthFirst)) add(m, isoDate(+m[3], MONTHS.get(m[1].toLowerCase()), +m[2]));
  return found;
}

function sectionEntities(text) {
  const found = [];
  const sectionWord = alternation(SECTION_WORDS);
  const code = alternation(CODES);
  const withCode = new RegExp(`${BOUNDARY_BEFORE}(${code})\\s*(?:(?:${sectionWord})\\.?\\s*)?(\\d{1,3}[A-Za-z]?)${BOUNDARY_AFTER}`, "giu");
  for (const m of text.matchAll(withCode)) {
    const lawCode = CODES.find(item => item.toLowerCase() === m[1].toLowerCase());
    found.push({ type: "SECTION", text: m[0], value: `${lawCode} ${m[2].toUpperCase()}`, code: lawCode, section: m[2].toUpperCase(), start: m.index, end: m.index + m[0].length });
  }
  const bare = new RegExp(`${BOUNDARY_BEFORE}(?:${sectionWord})\\.?\\s*(\\d{1,3}[A-Za-z]?)${BOUNDARY_AFTER}`, "giu");
  for (const m of text.matchAll(bare)) {
    found.push({ type: "SECTION", text: m[0], value: m[1].toUpperCase(), code: null, section: m[1].toUpperCase(), start: m.index, end: m.index + m[0].length });
  }
  return found;
}

function moneyEntities(text) {
  const found = [];
  const words = alternation(MONEY_WORDS);
  const add = (m, amount) => found.push({ type: "MONEY", text: m[0], value: Number(amount.replace(/,/g, "")), currency: "INR", start: m.index, end: m.index + m[0].length });
  for (const m of text.matchAll(/₹\s*(\d[\d,]*(?:\.\d+)?)/g)) add(m, m[1]);
  for (const m of text.matchAll(new RegExp(`${BOUNDARY_BEFORE}(?:${words})\\.?\\s*(\\d[\\d,]*(?:\\.\\d+)?)${BOUNDARY_AFTER}`, "giu"))) add(m, m[1]);
  for (const m of text.matchAll(new RegExp(`${BOUNDARY_BEFORE}(\\d[\\d,]*(?:\\.\\d+)?)\\s*(?:${words})${BOUNDARY_AFTER}`, "giu"))) add(m, m[1]);
  return found;
}

function gazetteerEntities(text, profile) {
  const found = [];
  for (const [name, code] of profile.lawNames) {
    for (const m of text.matchAll(new RegExp(`${BOUNDARY_BEFORE}${escape(name)}${BOUNDARY_AFTER}`, "giu"))) {
      found.push({ type: "LAW", text: m[0], value: code, start: m.index, end: m.index + m[0].length });
    }
  }
  for (const code of CODES) {
    for (const m of text.matchAll(new RegExp(`${BOUNDARY_BEFORE}${escape(code)}${BOUNDARY_AFTER}`, "gu"))) {
      found.push({ type: "LAW", text: m[0], value: code, start: m.index, end: m.index + m[0].length });
    }
  }
  for (const [term, concept] of profile.offences) {
    // Offence terms match on word starts so inflected forms ("चोरी", "चोरी की") are found without a lemmatizer.
    for (const m of text.matchAll(new RegExp(`${BOUNDARY_BEFORE}${escape(term)}`, "giu"))) {
      const tail = text.slice(m.index + m[0].length).match(/^[\p{L}\p{M}]*/u)[0];
      if (tail.length > 3) continue;
      found.push({ type: "OFFENCE", text: m[0] + tail, value: concept, start: m.index, end: m.index + m[0].length + tail.length });
    }
  }
  return found;
}

// Overlaps keep the longer span; an equal span keeps the more specific type (SECTION over LAW).
const PRIORITY = { SECTION: 5, DATE: 4, MONEY: 3, LAW: 2, OFFENCE: 1 };

export function extractEntities(text, profile) {
  const normalized = asciiDigits(text); // 1:1 character mapping, so offsets still index the original text
  const all = [...dateEntities(normalized), ...sectionEntities(normalized), ...moneyEntities(normalized), ...gazetteerEntities(normalized, profile)];
  all.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start) || PRIORITY[b.type] - PRIORITY[a.type]);
  const kept = [];
  for (const entity of all) {
    const clash = kept.find(other => entity.start < other.end && other.start < entity.end);
    if (!clash) { kept.push(entity); continue; }
    const longer = (entity.end - entity.start) > (clash.end - clash.start);
    const moreSpecific = (entity.end - entity.start) === (clash.end - clash.start) && PRIORITY[entity.type] > PRIORITY[clash.type];
    if (longer || moreSpecific) kept[kept.indexOf(clash)] = entity;
  }
  return kept.sort((a, b) => a.start - b.start).map(entity => ({ ...entity, text: text.slice(entity.start, entity.end), source: entity.type === "OFFENCE" || entity.type === "LAW" ? "gazetteer" : "rule" }));
}

export const NER_SCOPE = {
  supported: ["DATE", "SECTION", "LAW", "MONEY", "OFFENCE"],
  method: "regular-expression rules plus a small legal gazetteer",
  notSupported: ["PERSON", "LOCATION", "ORGANIZATION"]
};
