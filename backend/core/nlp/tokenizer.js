import { SCRIPTS } from "./languageProfiles.js";

// Digits of the scripts we handle, mapped to ASCII one character for one character (offsets stay valid).
const DIGIT_BASES = [0x0966, 0x0ae6, 0x0660, 0x06f0];
export function asciiDigits(text) {
  return [...String(text)].map(char => {
    const code = char.codePointAt(0);
    const base = DIGIT_BASES.find(start => code >= start && code <= start + 9);
    return base === undefined ? char : String(code - base);
  }).join("");
}

// Words keep their combining marks and joiners (Devanagari/Gujarati conjuncts, Urdu zero-width joiners) intact.
const TOKEN = /[\p{L}\p{M}‌‍]+(?:['’][\p{L}\p{M}]+)?|\p{N}+(?:[.,:/-]\p{N}+)*|[^\s\p{L}\p{M}\p{N}]/gu;

export function scriptOf(text) {
  for (const [name, pattern] of Object.entries(SCRIPTS)) if (pattern.test(text)) return name;
  return "other";
}

export function tokenize(text) {
  const tokens = [];
  for (const match of String(text).matchAll(TOKEN)) {
    const surface = match[0];
    const isNumber = /^\p{N}/u.test(surface);
    const isWord = /^[\p{L}\p{M}]/u.test(surface);
    tokens.push({
      text: surface, start: match.index, end: match.index + surface.length,
      type: isNumber ? "number" : isWord ? "word" : "punct",
      script: isWord ? scriptOf(surface) : null,
      ...(isNumber ? { value: asciiDigits(surface) } : {})
    });
  }
  return tokens;
}

// Abbreviations whose full stop does not end a sentence.
const ABBREVIATIONS = new Set(["rs", "no", "sec", "dr", "mr", "mrs", "ms", "vs", "ltd", "co", "st", "smt", "shri", "adv"]);
const HARD_ENDERS = /[।॥!?؟۔]/u; // । ॥ ! ? ؟ ۔

export function splitSentences(text) {
  const source = String(text);
  const sentences = [];
  let start = 0;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    const hard = HARD_ENDERS.test(char);
    let soft = false;
    if (char === ".") {
      const before = source.slice(0, i).match(/[\p{L}\p{N}]+$/u)?.[0]?.toLowerCase() || "";
      const after = source.slice(i + 1);
      const decimal = /^\d/.test(after) && /\d$/.test(source.slice(0, i));
      soft = !decimal && !ABBREVIATIONS.has(before) && (after === "" || /^\s+\S/u.test(after));
    }
    if (!hard && !soft) continue;
    let end = i + 1;
    // A closing quote or bracket directly after the full stop belongs to the sentence it closes.
    while (end < source.length && /["')\]”’]/u.test(source[end])) end++;
    const piece = source.slice(start, end).trim();
    if (piece) sentences.push(piece);
    start = end;
  }
  const tail = source.slice(start).trim();
  if (tail) sentences.push(tail);
  return sentences;
}
