# Architecture

## 2026-10-06 - Broader Public Hindi Baseline, No Production Change

scripts/obtain_hindi_baseline.mjs owns fixed disjoint public acquisition/source metadata; validate_hindi_baseline.py owns frozen registrations/audio checks and actual backend.speech.transcribe streaming CLI collection. Production receives audio bytes only; frozen study_hindi_beam.scores assesses published references outside worker. New diagnostic contracts/plan/results are imported by neither UI nor backend server. Current explicit Hindi medium/beam3/promptNone remains, no correction/model/dependency/legal architecture change. See Feature-hindi-broader-baseline-results.md.

## 2026-10-06 - Rejected Hindi Context Diagnostic

Production architecture unchanged. scripts/study_hindi_cue.py delegates actual recognize through Hindi-only CueAdapter, uses previous frozen scoring/hash helpers and owns registered paired assessment/silence/fresh-confirmation gate. obtain_hindi_cue_confirmation.mjs owns fixed-row acquisition/license checks after PASS only, not executed. New five tests/plan/results are diagnostics, imported by neither UI nor backend server. Context candidate rejected; current medium/beam3/promptNone remains. No correction layer, dependency/model service or legal-flow change.

## 2026-10-06 - Hindi Beam Study Is Diagnostic Only

Production responsibilities unchanged. Standalone scripts/study_hindi_beam.py registers pinned current inputs, loads current local medium and delegates both beams through actual production recognize, collects raw paired outputs and strictly scores published annotations. Worker does not receive reference text. Server/UI import none of this; candidate rejected, original beam3 retained. New five scorer tests are synthetic. See Feature-hindi-beam-study-results.md; no new correction/translation/retrieval layer.

## 2026-10-06 - Frontend Recording Hint Resolution

frontend/app.js:toggleRecording owns selected speech hint: explicit Spoken language first, otherwise explicit Written hi/mr when Spoken is Auto, otherwise Auto. Snapshot before microphone permission; setVoiceBusy locks both controls. Existing transcriber adapter/model selection, native transcription and editable textarea/manual Analyze boundary unchanged. New nine VM/adapter tests and two standalone HTTP/integrity diagnostics are not production imports. No architecture/model/legal responsibility change; see Bug-voice-language-selection.md for scope and unverified word fidelity.

## 2026-10-06 - Real Long-Fixture Diagnostic, Architecture Unchanged

Production architecture remains the optional Marathi observer -> validated adapter -> existing frontend status consumer. New validate_long_speech_review.py registers current hashes/reconstructs inspected fixture/derives expected summary/audits inputs; original browser tool freezes its missing-Blob-inspection failure. Separately registered validate_long_review_upload.py/UI tool observes the same client Blob before unchanged native fetch and checks realHTTP/desktop/mobile. Server/UI import NONE of these diagnostic tools. No service/model/settings/legal responsibility change. Actual long response preserves historical text and reports3 windows/warnings0/1; see Feature-long-speech-review-validation-results.md. Physical microphone/natural legal speech quality still unverified.

## 2026-10-06 - Frontend Review Notice Consumer

`frontend/app.js:getSpeechReviewNotice()` maps optional selected-Marathi metadata to controlled advisory UI text. `handleRecordingStopped()` passes it through `setVoiceBusy()` cleanup; `clearSpeechReviewNotice()` handles empty/demo replacement. Existing status node/controls/page structure remain. `style.css` owns amber/wrapping only. Review never enters `voiceInput`/Analyze request or legal modules; server/Python/Node speech observer unchanged. New nine VM tests, original failed and separately successful frozen Edge browser tools, plus streaming audit are standalone. Current website running3002; see `Feature-frontend-speech-review.md` for evidence/limits.

## 2026-10-06 - Optional Backend Speech Review Contract

`backend/speech/review.py` owns production pure risk assessment, version guard and bounded delegating observer; no imports from diagnostic scripts. `transcribe.py.main()` selects observer only for explicit Marathi; `recognize()` resets/collects/clears request metadata around unchanged `_recognize()` logic. `backend/core/transcriber.js` validates and forwards only known optional review fields. `backend/server.js` already forwards the complete adapter response, unchanged. Hindi/Auto, model/services/decoding, frontend and legal modules unchanged.11 Python/5 JS regression tests and separate registered actual-worker validator cover the contract. Existing website not restarted; frontend does not yet consume review. See `Feature-backend-speech-review.md`.

## 2026-10-06 - Offline Speech Review Metadata Prototype

Production unchanged. `scripts/assess_speech_review_warning.py` owns pure `assess_window`/`add_review_metadata` functions and a separate frozen saved-output evaluator. It uses existing runtime/hash/silence helpers, no neural model or audio decode; server/UI import none. Results add metadata only to copied offline responses. No service/dependency/decoder/legal architecture change. Backend integration must extract the pure helper rather than importing this fixture evaluator. See `Feature-speech-review-warning-results.md`.

## 2026-10-06 - Saved-Result Speech Control Replay

Production unchanged. `audit_final_speech_window.py` owns registered saved evidence, dummy-feature/stub-result replay through actual installed fallback/generation/split/prompt and tokenizer; no neural runtime initialized. Separate `audit_first_speech_window.py` corrects only iterator consumption when a saved partial seek would start another window, preserving frozen original failure. Both are standalone diagnostics, never server/UI imports. Responsibilities/models/services/legal architecture unchanged. See `Feature-speech-tail-audit-results.md`.

## 2026-10-06 - Isolated Rejected Window Candidate

Production architecture unchanged. `scripts/compare_short_speech_window.py` reuses frozen trace/recognize helpers in a fresh candidate-only child, injects15s windows, registers identities, saves immediate events/raw responses and compares historical30s evidence. `tests/test_short_speech_window.py` covers diagnostic contracts. Server/UI import neither; no new dependency/service/model setting. Candidate rejected after long-text regressions, not deployed. See `Feature-short-speech-window-results.md`.

## 2026-10-05 - Isolated Long Recording Trace

Production responsibilities unchanged. `scripts/trace_long_marathi_speech.py` owns pinned stress assembly, exclusive registration, isolated worker calling `backend/speech/transcribe.py recognize`, original-method observers, immediate events and bounded assessment. `scripts/retry_long_marathi_trace.py` preserves the sleep-invalidated first attempt and redirects only the exact diagnostic-worker launch to a new evidence directory. Server/UI import neither tool. Existing `audit_speech_continuation.py` provides checked defaults/hashes; earlier observer/power/interval helpers are reused unchanged. No new website path/service dependency/model setting. See `Feature-long-speech-trace-results.md`; offline15s candidate is pending, not deployed.

## 2026-10-05 - Isolated Matched-Budget Comparison

Production unchanged. `scripts/compare_marathi_matched_cap.py` owns exclusive registration, existing converted model inference on eight frozen feature arrays, raw JSONL rows and EOS-aware comparison against saved source outputs. `normalize_eos`/`compare_rows` are diagnostic functions tested synthetically; no application module imports them. Evidence is exclusive under `marathi-matched-cap-20261005/`. It preserves all older wrappers/reports and changes no voice service/model, translation, retrieval, date or citation responsibilities. See `Feature-marathi-matched-cap-results.md`.

## 2026-10-05 - Offline Prefix Decoder Observation

Production unchanged. Five separately registered `scripts/probe_marathi_decoder*.py` tools preserve diagnostic failures/source rows, observe raw converted hypotheses safely and verify one-new-token cap behavior. They use one inspected feature, existing isolated runtimes/hash helpers; server/UI/legal modules import none. Evidence in five exclusive `marathi-decoder-*-20261005/` directories. Source direct-forward/generation and converted generation remain distinct paths; converted vocabulary distribution unavailable. See `Feature-marathi-decoder-probe-results.md`. No model, service, dependency or legal architecture deployment.

## 2026-10-04 - Isolated Marathi Source Versus Converted Decoder Comparison

Production remains unchanged. `scripts/compare_marathi_checkpoints.py` registers model/fixture/VAD/library identities, creates eight hash-checked shared Mel arrays from saved default-VAD intervals and runs a separate converted-int8 diagnostic child. Initial source worker was sleep-interrupted. `scripts/retry_marathi_source_parity.py` preserves the first failure and retries source only using frozen features/converted rows; it exposed a plain-return prefix parser error. `scripts/source_parity_structured.py` runs the same local float32 source in its own child with structured full-sequence output and prefix verification. All diagnostic evidence is exclusive under three `source-parity-*/` directories and is not imported by the website. See `Feature-marathi-source-parity-results.md`. No new model selector, legal pipeline path, service dependency or runtime setting was deployed.

## 2026-10-04 - Isolated Checkpoint Audit

Production architecture is unchanged. `scripts/audit_marathi_checkpoint.py` reads the pinned source, local cache metadata, converted checkpoint/tokenizer, installed feature defaults and registered protected identities, then writes only exclusive `output/public-speech-validation/checkpoint-audit-20261004/` evidence. It parses the setup constants without executing setup; no recognizer, server or retriever imports it. `tests/test_marathi_checkpoint.py` tests consistency checks with synthetic data. No inference or model replacement. See `Feature-marathi-checkpoint-audit-results.md` for findings and limits.

## 2026-10-04 - Isolated Decoder Observation

Production unchanged. `scripts/inspect_marathi_segments.py` owns frozen registration and separate persistent diagnostic child. Its subclass observes original `generate_with_fallback` results without mutation, returning the same tuple, then captures actual emitted Segment fields and bounded debug logs. Pure `skip_decision` mirrors the installed guard only for diagnostics; it is not imported by production and never changes routing/recognition. New exclusive evidence under `output/public-speech-validation/segment-diagnostic-20261004/`. Zero skips/text parity8/8 is not recognition accuracy. See `Feature-marathi-segment-diagnostic-results.md`.

## 2026-10-04 - Default VAD Sample Audit Boundary

Production unchanged. Isolated `scripts/audit_marathi_vad.py` registers30 input hashes/runtime versions and calls installed `get_speech_timestamps(VadOptions())`/`collect_chunks` on inspected development audio. It validates sample spans, complements and library collection parity; no Whisper recognizer loaded/transcript generated or app import. Silero VAD inference only. Read-only supplemental power evidence preserves the failed original validity gate. Separate results in `Feature-marathi-vad-retention-results.md`; no VAD/model/settings/retrieval/UI/date architecture change.

## 2026-10-04 - Isolated Baseline Timing Profiler

Production architecture unchanged. `scripts/profile_marathi_baseline.py` owns hash registration, a separate persistent baseline-only worker, per-request UTC/elapsed/process CPU measurement and bounded local power-log checks. It reuses offline `assess_marathi_decoder.bounded_reply` and `audit_speech_deadlines.validate_power_events`; the server/UI/retriever imports none of these. Evidence is exclusive under `output/public-speech-validation/baseline-timing-20261004/`. Model/settings, corpus isolation, date routing and legal pipeline unchanged. Measurement completed8/8 with prior HTTP transcript parity, not a quality fix. See `Feature-marathi-baseline-timing-results.md`.

## 2026-10-04 - Offline Speech Deadline Boundary

Production architecture unchanged. `assess_marathi_decoder.py bounded_reply()` adds post-wait elapsed validation to its separate diagnostic child; `score_marathi_decoder.mjs` also bounds recorded timings. `audit_speech_deadlines.py` reads saved hashes/timings and bounded local power records, writing exclusive reports; not imported by server/UI/legal modules. No model/settings change, inference or holdout execution. Original reports remain frozen. Windows standby observed; exact per-request attribution absent. See `Bug-speech-benchmark-deadline.md`.

## 2026-10-03 - Isolated Marathi Decoder Assessment

No production architecture change. Diagnostic collector can exclude named previous runs while retaining original history. `scripts/assess_marathi_decoder.py` owns frozen registration/hash checks and a separate local paired decoder; `scripts/score_marathi_decoder.mjs` owns conservative development/holdout gates and exclusive result files. Neither is imported by the HTTP server, UI or retriever. Beam2 rejected; reserved8 calls remain undecoded. Existing selected-Marathi production worker stays beam3. Separate results in `Feature-marathi-decoder-results.md`; plan file remains frozen. An unexplained elapsed-time/deadline anomaly remains open in the diagnostic, not attributed to production.

## 2026-10-03 - Separate Public Speech Measurement

No production architecture change. `scripts/validate_public_speech.mjs` owns separate mark-preserving measurement, offline saved-output rescoring and prepared licensed disjoint-call collection. Only its pending `run` mode calls existing `/api/transcribe`; no diagnostic is imported by the server/UI/retriever. New raw audio/evidence are ignored under `output/public-speech-validation/`. Original ASR settings/models/adapter and legal evaluation remain unchanged. Download/HTTP new-sample validation blocked, not completed. See `Feature-public-speech-validation.md`.

## 2026-10-03 - Candidate Readiness Boundary

Offline `scripts/check_indictrans2_files.py` reads pinned metadata in `scripts/translation-candidates/indictrans2-200m.json`, hashes a user-supplied snapshot and writes only fresh diagnostics under `output/indictrans2-readiness/`. No model import, download, credential lookup, dependency installation or application integration. Tests use tiny synthetic files. Production architecture/model unchanged; compatible toolkit/runtime and custom-code review remain required before isolated inference. See `Feature-indictrans2-readiness.md`.

## 2026-10-03 - Isolated Alternative-Model Assessment

No production architecture change. `scripts/assess_translation_model.py` downloads/verifies/converts and runs a candidate under `output/translation-model-assessment/`; `scripts/compare_translation_models.mjs` reproduces raw-output safety/timing comparisons offline. No HTTP, legal pipeline, voice or display module imports either script. Existing `models/translation/` and runtime dependency configuration stay untouched. Candidate rejected; no automatic fallback/model selector added. See `Feature-local-translation-model-assessment.md`.

## 2026-10-03 - Translation Role Safety Boundary

`backend/core/translationChecks.js` adds a narrow accused-to-accuser inversion check to the existing pre-analysis role/intent boundary. `multilingual.js` owns the unchanged one-time retry and fail-closed error; downstream legal modules are untouched. `scripts/diagnose_translation_context.py` is offline-only, with generated diagnostics under `output/translation-context-search/`; neither wider beams nor intact-paragraph/coverage prototypes are connected to the HTTP worker. No new framework, model, API, source or UI component.

## 2026-10-02 - Translation Diagnostic Boundary

No architectural or production changes in this investigation. `scripts/verify_sentence_translation.mjs` is an offline diagnostic, not an HTTP or retrieval path; prototype chunkers exist only there. Real-model comparisons and checksums are written to ignored `output/sentence-translation/`, never sealed evaluation. `tests/sentenceTranslation.test.js` covers source/literal/order/length invariants. Both tested chunking alternatives were rejected; the current adapter and worker remain unchanged.

## Current Additions: 2026-10-02

`backend/core/corpus.js` verifies separate supplement JSON/PDF hashes and replaces only an existing mapping-reference record with primary text, preserving its ID/code/section/mappings. `retriever.js` consumes that merged corpus; original statutory dataset stays frozen.

`backend/translation/local_tokenizer.py` provides the installed NLLB token sequence without the Transformers import. `worker.py` retains the persistent CPU/int8 translator, one tokenizer, native-input uncached behavior, bounded display cache and optional hash-bound static display catalog. `translationChecks.js` checks narrow actor/intent preservation before the English legal pipeline; one quality retry cannot bypass literal/date/concept guards.

`frontend/legalPresentation.js` keeps source objects literal and contains controlled HI/MR interface drafts. Eight other languages use the protected output translator and precomputed exact display phrases. New performance/fixture diagnostics live under `output/project-completion/`, separate from sealed evaluation.

`frontend/app.js applyInterfaceText()` now recognizes `interfaceLocalization: controlled-draft` as well as local-model output, so native HI/MR controls do not require decoding. English resets and original-language voice metadata remain covered by tests. Speech worker/model/decoding are unchanged after the failed holdout comparison.

## 2026-10-02 Startup Translation Warmup

`backend/server.js` calls `translationWorker.warmup()` after the HTTP listener starts. The `createStreamingTranslationWorker()` instance in `backend/core/multilingual.js` sends an empty English-to-English request through the existing offline stream protocol, loading the Python translation runtime without translating case text. Queries arriving during warmup wait and then enter the unchanged `analyzeMultilingualQuery()` path. Warmup failure does not disable later retries or English requests. The service logs model readiness; model loading is moved earlier, not removed. Legal routing and retrieval modules are unaffected.

## 2026-10-01 Translation Runtime

`backend/server.js` owns one `createStreamingTranslationWorker()` instance for HTTP Analyze requests. `backend/core/multilingual.js` still owns language detection, input translation/verification, the unchanged `analyzeQuery()` call, and allowlisted display translation. The worker sends line-framed JSON to local `backend/translation/worker.py --stream`, which retains the offline detector, CPU/int8 NLLB translator, and source-language tokenizers across requests. It caches only exact successful English-to-display translations, never native query text. The original one-shot `runTranslationWorker()` remains for standalone verification. A single request at a time, 180-second deadline, bounded response/cache, and crash restart preserve fail-closed behavior. The persistent process uses memory until the backend stops.

This does not alter `dateExtractor.js`, `gateway.js`, `retriever.js`, `synthesizer.js`, `verifier.js`, the statutory corpus or source manifest. Earlier sections below record prior multilingual behavior; this section is the current runtime implementation.

## 2026-10-01 Multilingual Result and Theft Parity

`backend/core/multilingual.js` now uses the existing, source-protected output translator by default for Gujarati, Bengali, Tamil, Telugu, Kannada, Malayalam, Punjabi, and Urdu. Hindi and Marathi retain their controlled fast presentation. `LOCAL_OUTPUT_TRANSLATION=0` disables output model translation; `=1` enables it for Hindi/Marathi too. `frontend/legalPresentation.js` also supplies allowlisted interface text, and `frontend/app.js` applies it after analysis and resets English on an English result. Original statute text, citation/provenance fields, legal codes, dates, scores, and canonical IRAC are unchanged.

The same input adapter removes Kannada `ರಂದು` directly after a normalized ISO date before translating; the existing rejection of invented weekdays remains. `backend/core/dateExtractor.js` recognizes `steal`/`stole` inflections and `without permission`, and `backend/core/retriever.js` uses these only in the existing theft-feature rule under the unchanged date gateway. See `Bug-multilingual-result-and-theft-parity.md`.

The following sections retain historical decisions; this entry is the current behavior.

## 2026-10-01 Fast Multilingual Analysis

`backend/core/multilingual.js` now treats output presentation translation as optional. By default, non-English analysis translates the user's input into English, runs the unchanged canonical legal pipeline, and returns the structured presentation without a second English-to-native model pass. `LOCAL_OUTPUT_TRANSLATION=1` can re-enable the previous output translation path after a server restart.

This keeps the legal answer fast and source-bound: `gateway.js`, `retriever.js`, `synthesizer.js`, `verifier.js`, `backend/data/statutes.json`, and `legal-sources/manifest.json` are unchanged. Built-in Hindi/Marathi UI terminology remains controlled by `frontend/legalPresentation.js`; other languages may show English system prose/source titles while preserving multilingual input handling and legal routing.

## 2026-10-01 Multilingual Input Layer

The production legal pipeline still runs in English after input normalization and translation. The multilingual layer now has two entry paths:

- Typed/pasted text: `frontend/index.html` exposes a `Written language` selector. `frontend/app.js` sends `originalLanguage` only when the user selects a non-auto written language. The backend validates that the selected language matches the script before using it.
- Voice input: the existing spoken-language metadata remains separate. Voice requests continue to send `inputMode`, `inputLanguage`, `languageProbability`, `languageSource`, and `originalInput`; the written-language selector does not override voice metadata.

Backend responsibility remains in `backend/core/multilingual.js`:

- Detect clearly English text without loading the translation worker.
- Use the selected written language when provided and script-compatible.
- Fall back from unreliable detector output to native-script inference only for supported Indian scripts.
- Normalize native dates before translation.
- Reject translations that alter dates, identifiers, or unsupported weekday facts.

The legal decision modules remain unchanged:

- `backend/core/gateway.js` still owns the deterministic Applicable Law Check.
- `backend/core/retriever.js` still ranks only inside the corpus allowed by the gateway.
- `backend/data/statutes.json` and `legal-sources/manifest.json` remain the authoritative local corpus/provenance files.

Last updated: 2026-09-30

Current voice integration: backend/core/languages.js owns supported codes and automatic-speech confidence/status normalization. The recording UI offers Auto, Hindi, or Marathi. Auto uses local tiny Whisper and its existing detection threshold; user-selected Hindi uses medium and Marathi prefers the tuned small model with multilingual-small fallback. Selected Hindi and Marathi share one reusable local worker; switching selection replaces its model. Neither selected path invents detected-language confidence. transcriber.js returns native text/provenance to the editable query, then server /api/analyze uses the same multilingual.js adapter, English legal pipeline, and structured presentation. Typed detection is unchanged. Audio translation is retired. See Bug-selected-hindi-transcription-latency.md and Bug-multilingual-voice-latency-and-fidelity.md for current limits.

## Objective

This project is a local-first NLP/legal retrieval prototype for mapping fact patterns across the Indian Penal Code, 1860 (IPC) and the Bharatiya Nyaya Sanhita, 2023 (BNS). Its core safety property is deterministic date-based routing so BNS is not applied retrospectively to pre-commencement conduct.

The system is an academic software prototype. It is not legal advice and does not contain lawyer-validated labels.

## Major Responsibilities

Branding layer (2026-09-26): frontend/index.html adds one decorative logo and compact favicon; frontend/branding.css contains only header sizing/alignment and device/accessibility-gated native cursors. Four frontend/assets SVGs are reusable originals. scripts/build_brand_assets.mjs embeds exact typed vector copies to avoid altering the existing server's MIME handling; --check detects drift. No new JS runtime, component framework, backend route/API, pointer overlay or processing change. Existing style.css/app.js/legalPresentation.js remain unchanged. See Feature-legal-branding.md.

Current presentation architecture (2026-10-01): backend/core/multilingual.js adapts the unchanged canonical result using createLegalPresentation() in frontend/legalPresentation.js. This shared DOM-free module owns schemaVersion2, controlled EN/HI/MR terminology/system narrative, literal/prose nodes, the translation-target allowlist and escaped result-fragment rendering. Original excerpts/source metadata, scores, dates, citations and canonical IRAC are retained verbatim as separate structured fields. By default, the presentation is not sent through a second output translator, which removes the largest observed multilingual analysis delay; setting `LOCAL_OUTPUT_TRANSLATION=1` restores the earlier allowlisted output translation path. frontend/app.js renderStructuredResult() uses that contract; the old flat contract is rejected and English uses its existing renderer. No new routing, retriever, source corpus, model, dependency or provider. This supersedes the flat display-field/Rule-delimiter description in the historical paragraphs below. Details: Bug-structured-multilingual-presentation.md and Bug-multilingual-analysis-latency.md.

Current multilingual correction (2026-09-26): the same py3langid worker additionally resolves Hindi/Marathi model ambiguity using independent grammatical-family consensus, returning actual probabilities and method diagnostics. No script-only classifier or new provider. Multi-date input uses strict round-trip literal markers to retain sentence context; ordinary inputs and output prose preserve literal spans/formatting. Structured scores/citations/provenance never enter the display translator. Statutory excerpts and IRAC Rule source material are now rendered in original English source blocks, not translated as if authoritative. Canonical pipeline modules and data are unchanged. Details/limits: Bug-marathi-language-detection.md and Bug-multilingual-formatting.md.

Multilingual boundary (2026-09-26): `/api/analyze` invokes `analyzeMultilingualQuery()` in `backend/core/multilingual.js`. It detects the original language, normalizes explicit localized dates/digits, protects literal statutory identifiers/numbers, translates natural text to English with an offline Python worker, and calls the unchanged `analyzeQuery()`. Canonical English fields/citations are retained; `multilingual.presentation` supplies translated display fields. No translated legal corpus, retriever or IRAC engine was introduced. English requests bypass translation. `backend/translation/worker.py` uses py3langid and local CPU/int8 NLLB; setup and dependencies are separate from speech. Frontend reads presentation fields without modifying provenance.

| Area | Files | Responsibility |
|---|---|---|
| Static frontend | `frontend/index.html`, `frontend/app.js`, `frontend/style.css` | Typed query UI, optional microphone capture, analysis request, and display of date, applicable law, retrieval, citations, IRAC, and warnings. |
| HTTP server | `backend/server.js` | Serves the frontend, exposes analysis/corpus/health endpoints, and accepts bounded in-memory audio for transcription. |
| Speech adapter | `backend/core/transcriber.js` | Validates audio and selected language, checks local files, uses one bounded reusable worker for selected Hindi or Marathi, and returns native text plus distinct selected/detected speech metadata. Auto retains its one-shot worker. No cloud request or legal analysis. |
| Local speech worker | `backend/speech/transcribe.py`, `backend/speech/requirements.txt`, `scripts/setup_local_speech.py`, `scripts/setup_marathi_speech.py` | PyAV and faster-whisper CPU/int8. Auto/tiny remains one-shot; selected Hindi/medium and Marathi/tuned-small use line-framed requests to one reusable worker, without redundant detection. Language switches replace the worker. Downloads/conversion are separate from offline inference. |
| Pipeline orchestration | `backend/core/pipeline.js` | Trims input and calls extraction, gateway, retrieval, IRAC synthesis, and verification in order. |
| Fact extraction | `backend/core/dateExtractor.js` | Extracts dates, section references, legal keywords, and narrow preserved legal phrases. |
| Applicable Law Check | `backend/core/gateway.js` | Deterministically routes to `IPC_ONLY`, `BNS_PRIMARY`, `MULTI_PERIOD_REVIEW`, or `CLARIFY`. |
| Retrieval | `backend/core/retriever.js` | Performs deterministic lexical retrieval over allowed corpus records with exact section, mapping, title/token, and narrow theft/cheating legal feature boosts. |
| IRAC synthesis | `backend/core/synthesizer.js` | Builds citation-bound Issue, Rule, Application, Conclusion text from retrieved sources only. |
| Grounding verification | `backend/core/verifier.js` | Checks citation/conclusion grounding and flags review warnings such as commencement exceptions. |
| Corpus data | `backend/data/statutes.json`, `backend/data/ipc-bns-mappings.json` | Indexed legal source records and official IPC-BNS mappings. |
| Source provenance | `legal-sources/manifest.json`, `legal-sources/*.pdf` | Authoritative local legal PDFs and checksums. |
| Evaluation | `evaluation/**`, `scripts/*evaluation*.mjs` | Blind evaluation, official-source reference evaluation, scorer scripts, reports, and review packages. |
| Tests | `tests/*.test.js` | Regression tests for speech validation/integration, extraction, gateway, retrieval, pipeline, and grounding. |

## Current Architecture

Missing-date exception: analyzeQuery retains the gateway's CLARIFY decision and empty governing allowedCodes. With zero extracted dates, it requests separate IPC/BNS candidate lists from the same retriever (three per corpus), adds candidateOnly/candidateSummary and gate.applicability=UNDETERMINED plus candidateCodes, and returns irac:null. The existing verifier checks the candidate summary and warns that a date is required. The frontend labels every provision Candidate and displays DATE REQUIRED; it does not render an applicable-law IRAC. Dated and ambiguous-date orchestration remains as before.

1. User enters a natural-language legal query or records speech.
2. For speech only, `handleRecordingStopped()` sends audio to `POST /api/transcribe`; `transcribeAudio()` launches the local Python worker with audio on stdin and receives JSON text on stdout, returned to the existing editable textarea.
3. The user reviews or edits the text and invokes the existing Analyze action.
4. `analyzeMultilingualQuery()` surrounds the canonical English `analyzeQuery()` with local input/output translation; `analyzeQuery()` in `backend/core/pipeline.js` trims the English query as before.
5. `extractFacts()` in `backend/core/dateExtractor.js` extracts date facts, section references, keywords, and preserved legal phrases.
6. `routeByTemporalGate()` in `backend/core/gateway.js` decides the allowed legal corpus using the BNS commencement date `2024-07-01`.
7. `retrieveStatutes()` in `backend/core/retriever.js` searches only the allowed corpus records.
8. `synthesizeIrac()` in `backend/core/synthesizer.js` builds IRAC from retrieved text and citations.
9. `verifyGrounding()` in `backend/core/verifier.js` checks whether outputs remain grounded and whether warnings are required.
10. `backend/server.js` returns the complete result to the frontend.

## Model Strategy

The legal analysis path uses deterministic symbolic and lexical methods only. There is no external LLM call, BM25 service, or dense embedding model in date routing, retrieval, citation selection, IRAC synthesis, or grounding.

Voice input is an optional offline preprocessing adapter. It uses pretrained multilingual tiny/small/medium Whisper conversions through faster-whisper, not a cloud API. No project-specific ASR training occurs. Model loading uses local directories with `local_files_only=True` and offline flags. Transcription is not legal analysis and never bypasses the deterministic pipeline.

The retrieval layer is intentionally inspectable for a college NLP project demonstration. Future dense retrieval or learned ranking may be explored only if it preserves:

- deterministic Applicable Law Check behavior
- official-source provenance
- citation-bound output
- reproducible evaluation boundaries
- no fabricated legal answers or labels

## API

`GET /api/health`

Returns service status.

`GET /api/corpus`

Returns available statutory records.

`POST /api/analyze`

Request:

```json
{
  "query": "The offense happened on 2024-07-02 and involved organized crime."
}
```

Response includes the normalized English query, extracted facts, gateway route, retrieved statutes, IRAC synthesis, verifier result, and legal-pipeline elapsed time. Non-English requests additionally return multilingual metadata and translated presentation fields. Optional originalLanguage retains an unchanged English-translated voice transcript's original language; ordinary typed inputs are detected automatically. No dates/law/processing-language dropdown is required.

`POST /api/transcribe?mode=transcribe&language=auto|hi|mr`

- Request body: raw supported audio with its audio `Content-Type`.
- `auto`: tiny model detects language and uses the existing confidence gate during analysis.
- `hi`/`mr`: small model decodes in the user-selected language; the detected code is retained separately. Selected language is not represented as model confidence.
- Response: native text, model, inputLanguage, languageSource, languageStatus, languageProbability and separate detected-language diagnostics. Audio translation is not supported.
- Limits: 10 MiB server limit and 90-second browser recording limit.
- Runtime: project `.venv-speech` Python and local tiny/medium/Marathi-tuned-small models, with multilingual-small fallback for Marathi; optional local-path overrides only. No credentials.
- Deadlines: 120-second worker timeout, 130-second browser request timeout; concurrent worker requests receive 429 rather than unbounded queuing.
- Health readiness checks required local paths/files, not full model inference or installed-package integrity. Worker errors distinguish decoding, dependencies, loading, and process failures.
