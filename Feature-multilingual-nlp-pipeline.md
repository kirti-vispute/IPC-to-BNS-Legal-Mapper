# Feature: Multilingual NLP layer for transcripts (Hindi, Urdu, Gujarati, English)

This document describes the **NLP layer** that runs on text. Everything it says is backed by code that executes. Where a technique is absent, it says so.

## Whisper is the ASR component, not the NLP layer

Speech is converted to text by an **automatic speech recognition (ASR) model**: a language-tuned Whisper model (Whistle for English). That is deep learning, and its responsibility ends at producing the transcript. The NLP layer starts from that text. The same NLP layer also runs on typed text.

```text
Audio
 ↓
Whisper ASR (deep learning; language-tuned model from the registry; no generic fallback for Hindi, Urdu, Gujarati)
 ↓                                   ── transcript text ──
Text normalization            (Unicode NFC, zero-width characters, spacing)
 ↓
Legal terminology normalization (IPC / BNS / BNSS / CrPC in Indian scripts → Latin acronyms;
 ↓                               English only: spoken numbers → digits, closed-lexicon spelling correction)
Language context              (the language chosen or detected for the recording; script inference when none is given)
 ↓
Sentence segmentation         (। ॥ ۔ ؟ ! ? . with guards for abbreviations and decimals)
 ↓
Unicode-aware tokenization    (combining marks and joiners stay inside words; Indian and Arabic-script digits normalized)
 ↓
Stop-word handling            (function words identified and flagged; negations never treated as stop-words)
 ↓
Light stemming                (suffix stripping, not lemmatization)
 ↓
Rule-based / gazetteer NER    (DATE, SECTION, LAW, MONEY, OFFENCE)
 ↓
RAKE keyphrase extraction
 ↓
Existing legal concept classification (rule-based tagger on English text)
 ↓
Final NLP output (returned in the transcription and analysis responses and shown in the NLP analysis panel)
```

Only the normalization steps change the text that the legal analysis receives. The remaining steps (tokens, stems, entities, keyphrases) are returned and displayed; the retrieval, temporal gateway and classification do **not** use them (they keep using the existing `dateExtractor.js`).

## NLP audit

| NLP concept | Status | Where | Notes |
|---|---|---|---|
| Unicode-aware tokenization | Implemented | `nlp/tokenizer.js` | Letters with combining marks and joiners, digits in Indian and Arabic scripts |
| Sentence segmentation | Implemented | `nlp/tokenizer.js` | Rule-based |
| Stop-word handling | Implemented | `nlp/languageProfiles.js`, `nlp/index.js` | Words are **identified and flagged**, and excluded from keyphrases and stems; they are not deleted from the token list |
| Negation preservation | Implemented | same | Negations (not, without, नहीं, નથી, نہیں and others) are never stop-words and stay inside keyphrases |
| Light stemming | Implemented | `nlp/stemmer.js` | Longest-suffix stripping with a minimum stem length; function words are not stemmed |
| Rule-based / gazetteer NER | Implemented | `nlp/entities.js` | Regular-expression rules plus a small legal gazetteer |
| Legal entity extraction | Implemented | `nlp/entities.js` | DATE, SECTION, LAW, MONEY, OFFENCE. A separate, older extractor (`dateExtractor.js`) still drives retrieval; the two are not unified |
| RAKE keyphrase extraction | Implemented | `nlp/keywords.js` | Word degree over frequency, stop-word delimited |
| Text normalization | Implemented | `asrPostprocess.js` | Unicode, whitespace, zero-width characters |
| Legal terminology normalization | **Partial** | `asrPostprocess.js` | Acronym normalization for Hindi, Marathi, Gujarati, Urdu and English; spoken-number conversion and lexicon spelling correction for **English only** |
| Language context / identification | **Partial** | `nlp/languageProfiles.js` | Uses the language selected or detected for the recording; otherwise script inference, which reports Devanagari as ambiguous (Hindi or Marathi). The NLP layer has no statistical language identifier (the pre-existing translation step has one for typed text) |
| Hindi processing | Implemented | profile `hi` | |
| Urdu processing | Implemented | profile `ur` | Right-to-left script |
| Gujarati processing | Implemented | profile `gu` | |
| English processing | Implemented | profile `en` | |
| Marathi processing | Implemented | profile `mr` | Present from before; unchanged in scope |
| Legal concept classification | Implemented (existing) | `dateExtractor.js` | Reused, not replaced; runs on English text (after translation for other languages) |
| Lemmatization | **Not implemented** | | Light stemming is used instead. No lemmatizer was added |
| Transformer / statistical NER | **Not implemented** | | Only rules and a gazetteer. No person, place or organization recognition |
| Sentiment analysis | **Not implemented** | | |
| POS tagging | **Not implemented** | | |
| Dependency parsing | **Not implemented** | | |
| Semantic embeddings | **Not implemented** | | Retrieval is lexical (IDF-weighted term overlap) |
| RAG | **Not implemented** | | IRAC text is assembled from templates and retrieved statute text |
| LLM-based NLP | **Not implemented** | | |

Pre-existing deep-learning and ML components outside this NLP layer: Whisper/Whistle ASR, an NLLB-200 machine-translation model, and `py3langid` (Naive Bayes) text language identification. They are not NLP-layer algorithms and were not changed.

## ASR model registry (unchanged by the NLP layer)

`backend/core/speechModels.js` maps each language to its tuned model. Hindi, Urdu and Gujarati have **no generic Whisper fallback**: a missing model returns HTTP 503 with the folder and the setup command. Measured on 12 held-out FLEURS test clips per language, generic Whisper medium reached 37.9% WER on Hindi and 139% on Gujarati (hallucinated text), against 9.7% and 44.8% for the tuned models, so a silent fallback would return confidently wrong legal text.

| Language | Generic Whisper medium (baseline, not used) | Tuned model |
|---|---|---|
| Hindi | 37.9% WER | 9.7% |
| Urdu | 30.0% | 27.5% |
| Gujarati | 139.0% | 44.8% |

These come from saved evaluation runs (`scripts/evaluate_speech_models.py --report`), not new experiments, on one machine and 12 read-speech clips per language. They are not accuracy guarantees. Setup and model details: [Feature-indic-speech-models.md](Feature-indic-speech-models.md).

## Limits worth knowing

- The stop-word lists, suffix rules and gazetteers are small hand-curated resources for the legal-query domain, not complete linguistic resources.
- Stemming can over- or under-strip; it is a heuristic.
- ASR confidence is per segment for Whisper models and per word for Whistle. These are model probabilities and are not calibrated. Word-level scores are not used for Whisper because enabling word timestamps changed the Hindi transcript on 4 of 4 test clips and took 1.9 times as long.
- On the 12 English FLEURS clips the English-only normalization changed nothing (no WER change, no false corrections). Its measured benefit is on spoken legal numbers and Indian-script acronyms; for example an `आईपीसी` Hindi sentence that the translation safety check rejected is accepted after normalization.

## Tests

`tests/nlpPipeline.test.js` (tokenization, digits, sentences, stemming, entities, RAKE, stop-word and negation behaviour, capabilities), `tests/asrPostprocess.test.js` (normalization, number conversion, lexicon correction, confidence), `tests/transcriber.test.js` (post-processing in the result, registry, no-fallback rule).
