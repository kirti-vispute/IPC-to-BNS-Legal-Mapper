import { extractFacts } from "../dateExtractor.js";
import { normalizeText, transliterateAcronyms } from "../asrPostprocess.js";
import { getProfile, inferLanguageFromScript } from "./languageProfiles.js";
import { splitSentences, tokenize } from "./tokenizer.js";
import { STEMMING_METHOD, stem } from "./stemmer.js";
import { NER_SCOPE, extractEntities } from "./entities.js";
import { KEYWORD_METHOD, extractKeyphrases } from "./keywords.js";

// Language-specific NLP over a transcript (or typed text), in the order the pipeline defines:
//   language context -> normalization -> sentence split -> tokenization -> stop-word identification -> stemming
//   -> named entities -> keyphrases -> classification (existing rule-based tagger, English text only)
// Each stage reports what it produced. Nothing here is a trained model, and the result says so.

export const NLP_PIPELINE_STAGES = [
  "language", "normalization", "sentences", "tokenization", "stopwords", "stemming", "entities", "keyphrases", "classification"
];

const MAX_TOKENS = 600;

export function describeCapabilities(profile) {
  return {
    tokenization: "Unicode-aware (letters with combining marks, joiners, digits in Indian scripts)",
    sentenceSplitting: "punctuation rules with abbreviation and decimal guards",
    stopwords: profile ? `curated function-word list (${profile.stopwords.size} words); negations kept` : null,
    stemming: profile ? STEMMING_METHOD : null,
    lemmatization: false,
    namedEntities: { ...NER_SCOPE },
    keyphrases: KEYWORD_METHOD,
    classification: "existing rule-based legal concept tagger, applied to English text only",
    sentiment: false
  };
}

export function analyzeText(text, { language = null } = {}) {
  const corrections = [];
  const normalized = transliterateAcronyms(normalizeText(text), corrections);

  // 1. Language selection: the caller's choice wins; otherwise the script decides and ambiguity is reported.
  let selected = getProfile(language);
  let selection = { source: selected ? "provided" : "script", ambiguous: false, alternatives: [] };
  if (!selected) {
    const inferred = inferLanguageFromScript(normalized);
    selected = getProfile(inferred.language);
    selection = { source: "script", ambiguous: inferred.ambiguous, alternatives: inferred.alternatives || [] };
  }

  const result = {
    language: selected ? { code: selected.code, name: selected.name, script: selected.script, rtl: selected.rtl, ...selection } : { code: null, name: "Unknown", ...selection },
    normalization: { text: normalized, changed: normalized !== String(text ?? "").trim(), corrections },
    capabilities: describeCapabilities(selected),
    sentences: [], tokens: [], stopwords: { identified: [], keptNegations: [] }, stems: [], entities: [], keyphrases: [],
    classification: { available: false, reason: "The legal concept tagger works on English text; other languages are tagged after translation during analysis." },
    stats: { characters: normalized.length, sentences: 0, tokens: 0, words: 0, uniqueWords: 0, stopwords: 0, entities: 0 }
  };
  if (!selected || !normalized) return result;

  const sentences = splitSentences(normalized);
  const allTokens = tokenize(normalized);
  const words = allTokens.filter(token => token.type === "word");

  // Stop-words are identified and flagged; they stay in the token list and are excluded from keyphrases and stems.
  const stopIdentified = [];
  const negations = [];
  const stems = [];
  const decorated = allTokens.map(token => {
    if (token.type !== "word") return token;
    const lower = token.text.toLowerCase();
    const isNegation = selected.negations.has(lower);
    const isStop = !isNegation && selected.stopwords.has(lower);
    const stemmed = stem(token.text, selected);
    if (isStop) stopIdentified.push(token.text);
    if (isNegation) negations.push(token.text);
    if (!isStop && stemmed !== token.text.toLowerCase().normalize("NFC") && stemmed !== token.text) stems.push({ word: token.text, stem: stemmed });
    return { ...token, stopword: isStop, negation: isNegation, stem: stemmed };
  });

  const entities = extractEntities(normalized, selected);
  const keyphrases = extractKeyphrases(allTokens, selected);

  result.sentences = sentences.slice(0, 50);
  result.tokens = decorated.slice(0, MAX_TOKENS).map(({ text: surface, type, script, stopword, negation, stem: stemmed, value }) =>
    ({ text: surface, type, ...(script ? { script } : {}), ...(stopword ? { stopword } : {}), ...(negation ? { negation } : {}), ...(stemmed && stemmed !== surface ? { stem: stemmed } : {}), ...(value ? { value } : {}) }));
  result.stopwords = { identified: [...new Set(stopIdentified)].slice(0, 80), keptNegations: [...new Set(negations)] };
  result.stems = [...new Map(stems.map(item => [item.word, item])).values()].slice(0, 40);
  result.entities = entities;
  result.keyphrases = keyphrases;
  result.stats = {
    characters: normalized.length, sentences: sentences.length, tokens: allTokens.length, words: words.length,
    uniqueWords: new Set(words.map(token => token.text.toLowerCase())).size, stopwords: stopIdentified.length, entities: entities.length
  };
  if (selected.code === "en") {
    const facts = extractFacts(normalized);
    result.classification = { available: true, source: "existing rule-based legal concept tagger", concepts: facts.concepts, legalTerms: facts.keywords, legalPhrases: facts.legalPhrases };
  }
  return result;
}
