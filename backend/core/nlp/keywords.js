import { isMonthName } from "./entities.js";

// RAKE (Rapid Automatic Keyword Extraction, Rose et al. 2010), language-agnostic given a stop-word list.
// Candidate phrases are the runs of content words between stop-words and punctuation. A word scores deg(w) / freq(w),
// where deg(w) is the total length of the candidate phrases containing it, and a phrase scores the sum of its words.
// Negations are not delimiters: they stay inside phrases ("without consent") because they carry legal meaning.

export function extractKeyphrases(tokens, profile, { limit = 8, maxWords = 4 } = {}) {
  const stop = profile.stopwords;
  const negations = profile.negations;
  // Month names, section words and law codes are captured as entities; as keyphrases they are only noise.
  const noise = new Set([...profile.sectionWords, ...profile.moneyWords, "ipc", "bns", "bnss", "crpc"]);
  const isDelimiter = token => token.type !== "word"
    || (stop.has(token.text.toLowerCase()) && !negations.has(token.text.toLowerCase()))
    || noise.has(token.text.toLowerCase()) || isMonthName(token.text);

  const phrases = [];
  let current = [];
  for (const token of tokens) {
    if (isDelimiter(token)) {
      if (current.length) phrases.push(current);
      current = [];
    } else {
      current.push(token.text.toLowerCase());
    }
  }
  if (current.length) phrases.push(current);

  const frequency = new Map();
  const degree = new Map();
  for (const phrase of phrases) {
    for (const word of phrase) {
      frequency.set(word, (frequency.get(word) || 0) + 1);
      degree.set(word, (degree.get(word) || 0) + phrase.length);
    }
  }
  const wordScore = word => degree.get(word) / frequency.get(word);

  const scored = new Map();
  phrases.forEach((phrase, index) => {
    if (phrase.length > maxWords) return;
    const text = phrase.join(" ");
    const score = phrase.reduce((sum, word) => sum + wordScore(word), 0);
    const known = scored.get(text);
    if (!known) scored.set(text, { phrase: text, score: Number(score.toFixed(2)), words: phrase.length, occurrences: 1, first: index });
    else known.occurrences++;
  });
  return [...scored.values()]
    .sort((a, b) => b.score - a.score || b.occurrences - a.occurrences || a.first - b.first)
    .slice(0, limit)
    .map(({ phrase, score, words, occurrences }) => ({ phrase, score, words, occurrences }));
}

export const KEYWORD_METHOD = "RAKE (stop-word delimited candidate phrases scored by word degree / frequency)";
