import { readFileSync } from "node:fs";
import { describeRegistry } from "../speechModels.js";

// What the website shows about the processing flow. Every entry names code that exists in this repository and the
// concept it applies. Categories: NLP (language processing), DL (deep neural networks), ML (classical statistical
// models), AML (applied ML: evaluation, quantization, model management and deployment).

export const CATEGORIES = {
  NLP: "Natural language processing: text and language rules and algorithms",
  DL: "Deep learning: neural network models",
  ML: "Machine learning: classical statistical models",
  AML: "Applied ML: evaluation, quantization and model management"
};

const stage = (id, title, categories, concepts, detail, file, group) => ({ id, title, categories, concepts, detail, file, group, implemented: true });

export const PIPELINE_STAGES = [
  stage("input", "Audio / video input", ["AML"], ["Container decoding", "Resampling to 16 kHz mono"],
    "A recording, or the audio track of an MP4, WebM, MKV, MOV or AVI file, is decoded and resampled to the 16 kHz mono signal the recognizers expect.",
    "backend/core/transcriber.js", "speech"),
  stage("vad", "Voice activity detection", ["DL"], ["Neural VAD (Silero)", "Silence trimming"],
    "A small neural network marks which parts of the signal contain speech so silence is not transcribed, which reduces invented text.",
    "backend/speech/transcribe.py", "speech"),
  stage("registry", "Language-specific model selection", ["AML"], ["Model registry", "Fail-closed deployment", "Checksum-pinned weights"],
    "The chosen language picks its own fine-tuned model from a registry. Hindi, Urdu and Gujarati never fall back to generic Whisper; a missing model returns a setup message.",
    "backend/core/speechModels.js", "speech"),
  stage("asr", "Speech-to-text", ["DL"], ["Transformer encoder-decoder", "Log-Mel spectrogram", "Self- and cross-attention", "Beam search decoding (beam 3)", "int8 weight quantization"],
    "Whisper-family models turn log-Mel features into subword tokens with an attention-based encoder-decoder. Whistle (English) is a compact quantized encoder-decoder with keyword biasing.",
    "backend/speech/transcribe.py, backend/speech/whistle_worker.py", "speech"),
  stage("confidence", "Confidence estimation", ["ML"], ["Softmax posterior probabilities", "Thresholding"],
    "Token probabilities become per-segment (Whisper) or per-word (Whistle) confidence; low-confidence spans are shown for review. Probabilities are model outputs and are not calibrated.",
    "backend/core/asrPostprocess.js", "speech"),
  stage("normalize", "Text normalization and number conversion", ["NLP"], ["Unicode NFC", "Inverse text normalization", "Rule grammar for number words"],
    "Zero-width characters are removed, and spoken numbers become digits in legal contexts (section numbers, dates, rupee amounts). Every change is logged.",
    "backend/core/asrPostprocess.js", "language"),
  stage("lexicon", "Lexicon correction", ["NLP"], ["Levenshtein edit distance", "Consonant-skeleton similarity", "Closed legal lexicon"],
    "Near-misses of legal terms are corrected by edit distance and phonetic skeleton against a closed lexicon, with guards against rewriting ordinary words.",
    "backend/core/asrPostprocess.js", "language"),
  stage("tokenize", "Tokenization and sentences", ["NLP"], ["Unicode-aware tokenization", "Rule-based sentence splitting", "Script identification"],
    "Words keep their combining marks and joiners; sentence ends in Devanagari, Gujarati and Urdu script are recognized, with guards for abbreviations and decimals.",
    "backend/core/nlp/tokenizer.js", "language"),
  stage("stopwords", "Stop-word handling", ["NLP"], ["Function-word lists", "Negation preservation"],
    "Per-language function words are identified and flagged (they are excluded from keyphrases, not deleted from the tokens); negations such as not, without and नहीं are never treated as stop-words because they change legal meaning.",
    "backend/core/nlp/languageProfiles.js", "language"),
  stage("stemming", "Stemming", ["NLP"], ["Light suffix stripping"],
    "Rule-based suffix stripping gives related forms a shared stem. It is not a lemmatizer; no lemmatizer exists for these languages here.",
    "backend/core/nlp/stemmer.js", "language"),
  stage("ner", "Named entities", ["NLP"], ["Regular-expression rules", "Gazetteer lookup", "Overlap resolution"],
    "Dates, section references, law names, rupee amounts and offence terms are found per language. Persons, places and organizations are not recognized.",
    "backend/core/nlp/entities.js", "language"),
  stage("keyphrases", "Keyphrase extraction", ["NLP"], ["RAKE", "Word degree / frequency scoring"],
    "Candidate phrases between stop-words are scored by the degree and frequency of their words to surface the important phrases.",
    "backend/core/nlp/keywords.js", "language"),
  stage("langid", "Language identification (text)", ["ML"], ["Naive Bayes over byte n-grams", "Script-consensus checks"],
    "py3langid, a multinomial Naive Bayes classifier, identifies the language of typed text; script rules decide when its output is unreliable.",
    "backend/translation/worker.py, backend/core/multilingual.js", "legal"),
  stage("mt", "Machine translation", ["DL"], ["Transformer (NLLB-200 distilled 600M)", "SentencePiece subwords", "Beam search", "int8 quantization (CTranslate2)"],
    "Non-English text is translated locally to English for the legal pipeline and the result is translated back; dates and section numbers are protected and checked.",
    "backend/translation/worker.py", "legal"),
  stage("facts", "Fact extraction and classification", ["NLP"], ["Regular-expression extraction", "Rule-based concept tagging"],
    "Offence dates, section references and legal concepts (theft, cheating, hurt and others) are extracted by rules from the English processing text.",
    "backend/core/dateExtractor.js", "legal"),
  stage("gate", "Temporal gateway", ["NLP"], ["Deterministic rule logic"],
    "The offence date decides IPC, BNS or a multi-period review by fixed rules around 1 July 2024; no model is involved.",
    "backend/core/gateway.js", "legal"),
  stage("retrieval", "Statute retrieval", ["NLP"], ["Lexical information retrieval", "IDF term weighting", "Field boosting", "Exact-reference matching"],
    "Statute sections are ranked by tokenized term overlap weighted by inverse document frequency, with boosts for title matches and explicit section references.",
    "backend/core/retriever.js", "legal"),
  stage("synthesis", "IRAC synthesis and verification", ["NLP"], ["Template-based extractive synthesis", "Rule-based grounding check"],
    "The Issue-Rule-Application-Conclusion answer is assembled from retrieved text, not generated by a language model, and checked against its sources.",
    "backend/core/synthesizer.js, backend/core/verifier.js", "legal"),
  stage("evaluation", "Evaluation", ["AML"], ["Word error rate", "Character error rate", "Held-out test split", "Model comparison"],
    "Language-wise WER and CER are measured on held-out FLEURS test clips through the real workers, and saved results are reported without re-running models.",
    "scripts/evaluate_speech_models.py", "speech")
];

export const GROUPS = [
  { id: "speech", title: "Speech recognition (ASR)", blurb: "Deep learning: sound to a transcript. Not NLP." },
  { id: "language", title: "NLP layer", blurb: "Runs on the transcript text" },
  { id: "legal", title: "Legal analysis", blurb: "From facts to statutes" }
];

// Saved measurement results (written by `scripts/evaluate_speech_models.py --report --write`). Absent file -> no table.
export function loadEvaluation(file = new URL("../../data/speech-evaluation.json", import.meta.url)) {
  try {
    const data = JSON.parse(readFileSync(file, "utf8"));
    return Array.isArray(data.results) && data.results.length ? data : null;
  } catch {
    return null;
  }
}

export function describePipeline(speechStatus = {}, evaluation = loadEvaluation()) {
  return { categories: CATEGORIES, groups: GROUPS, stages: PIPELINE_STAGES, registry: describeRegistry(speechStatus), evaluation };
}
