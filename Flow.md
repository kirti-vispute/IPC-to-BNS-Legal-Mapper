# Flow

## 2026-10-06 - Fixed Broader Hindi Reference Baseline

Diagnostic only: retain351 prior identities -> freeze359 before public acquisition -> fixed12 disjoint source rows/audio/sample metadata -> freeze374 -> actual backend.speech.transcribe.main --stream --language hi -> recognize -> _recognize -> current local medium -> exclusive raw native responses -> external published-reference scores. No annotation in model input. All12 return; WER37.37%/CER12.89%, general speech quality still open. No alternative recognizer or correction deployed.

Live flow UNCHANGED: frontend.toggleRecording resolves selected language -> microphone/MediaRecorder -> handleRecordingStopped/server /api/transcribe/core transcriber -> backend.speech.transcribe native text -> exact editable textarea -> manual Analyze -> multilingual.analyzeMultilingualQuery/checked English when needed -> pipeline.analyzeQuery/dateExtractor.extractFacts -> gateway.routeByTemporalGate -> isolated corpus/retriever.retrieveStatutes -> original source citations/grounded IRAC -> native presentation. Broader sample shows recognizer errors BEFORE translation, not user's exact audio or legal correctness. Separate legal checks remain104 per code/5 resolved cases; sealed report unchanged.

## 2026-10-06 - Public Hindi Cue Study, Production Unchanged

Register351 inputs -> existing public Hindi audio decode once per pair -> actual production recognize via baseline/neutral-context adapter -> raw responses -> published-reference exact edit scores and separate synthetic silence -> failed quality gate -> STOP, no confirmation acquisition/decode or deployment. No annotations/case facts/answer hints in model prompt.

Actual recording still selected native model -> original transcript/metadata -> editable textarea -> manual Analyze -> checked English when needed -> original date extractor/Applicable Law Check -> isolated corpus/retrieval/citations/grounded IRAC -> native presentation. No production path changed, no new Marathi evidence. User original recording unavailable; public-only work supersedes personal-audio next-step dependency but cannot validate that exact failure.

## 2026-10-06 - Explicit Hindi Failure Investigation, Flow Unchanged

Selected Hindi recording -> existing local medium recognize/task transcribe/beam3 -> unchanged original transcript/metadata -> frontend handleRecordingStopped inserts data.text -> editable manual review -> Analyze -> checked English translation -> original date extractor/Applicable Law Check -> corpus isolation/retrieval/citations/IRAC -> native result. User confirms explicit Hindi, so written-selector fallback does not fix reported words. Live typed intended sentence preserves Hindi/English serious-injury meaning.

Separate registered study -> same decoded public audio -> production recognize via beam-only3/5 adapter -> raw text -> annotation edit counts -> failed quality gate -> NO deployment. No annotations/user sentence sent to recognizer, word reconstruction, UI rewrite or legal change. Exact user's recording remains absent; see Feature-hindi-beam-study-results.md.

## 2026-10-06 - Selected Recording Language

frontend.toggleRecording -> setVoiceBusy locks Written/Spoken controls -> snapshot explicit Spoken choice, or Written hi/mr only when Spoken Auto -> microphone permission/MediaRecorder -> handleRecordingStopped POST /api/transcribe?mode=transcribe&language=<snapshot> -> unchanged server/transcriber existing selected model -> native transcription -> EXACT returned text in editable input -> restore controls -> MANUAL Analyze. Explicit spoken wins; unrelated written choices retain Auto. No speech translation or automatic legal analysis.

Manual Analyze still follows multilingual.js checked English representation when required -> pipeline.analyzeQuery/dateExtractor -> gateway Applicable Law Check -> isolated corpus -> retriever -> source citations -> grounded IRAC/verifier -> original-language presentation. No legal-path change. Public HTTP checks validate model/native text delivery, not correct words; selection regression uses stub audio recognition. See Bug-voice-language-selection.md.

## 2026-10-06 - Live Long-Recording Path Confirmed

Synthetic capture supplies registered60.046s public WAV -> actual frontend toggleRecording/handleRecordingStopped -> unchanged POST /api/transcribe?mode=transcribe&language=mr -> server/transcriber persistent Marathi worker/recognize/review -> native text + assessed3-window summary/warnings0/1 -> actual editable textarea + getSpeechReviewNotice -> native existing live warning/final controls cleanup. Same text/metadata as saved original30s evidence; manual Analyze remains separate and was NOT invoked for this nonlegal fixture. Desktop/mobile warning geometry passes. Client Blob observed without replacing native fetch; network/server-side body hash is unavailable. No production execution path or retrieval changes; tests cover unchanged legal Analyze boundary. Diagnostics never imported by production.

## 2026-10-06 - Display-Only Speech Review

Existing recording -> existing `/api/transcribe` -> unchanged Marathi observer/Node adapter -> `frontend.handleRecordingStopped()` copies EXACT native transcript/old voice fields -> `getSpeechReviewNotice()` checks selected mr/optional metadata -> final `setVoiceBusy(false, message, notice)` displays native incomplete/unchecked advisory in existing status area and releases controls -> editable text -> MANUAL Analyze. New recording/error/cancellation clears the old notice; empty query/demo replacement resets it; edits/localized rendering preserve it. Legacy/no flag keeps ordinary review instruction, not verified quality.

Analyze still sends only existing query/voice language/original-input fields -> checked English when needed -> unchanged date extraction/Applicable Law Check -> allowed corpus -> retrieval/citations/IRAC/grounding -> original-language result. Neither review flag nor notice is part of this request, law selection or ranking. Actual short public-clip HTTP and controlled desktop/mobile checks cover wiring, not speech/legal accuracy.

## 2026-10-06 - Marathi Backend Review Flow

Recording -> existing `/api/transcribe` -> `transcriber.transcribeAudio()` validates/picks same model -> existing persistent worker -> `transcribe.main()` chooses review subclass ONLY for selected mr -> `recognize()` resets -> unchanged `_recognize()` audio decode/transcribe -> `review.generate_with_fallback()` delegates once/returns original tuple and computes risk metadata -> original segment join -> optional `speechReview` snapshot -> reset in finally -> Node schema validates/copies -> unchanged server sends response. No auto-correction/extra generation. Hindi/Auto unchanged; empty/error requests get no clean assessment; unsupported observation remains unknown. Frontend currently keeps its existing editable transcript/manual Analyze behavior and does not yet display review.

Legal flow unchanged: user text/native transcript -> checked English representation if needed (`multilingual.js`) -> `pipeline.analyzeQuery()`/`dateExtractor.js` -> `gateway.js` Applicable Law Check -> isolated corpus (`corpus.js`) -> `retriever.js` -> citations -> grounded IRAC/verifier -> original-language presentation. Review metadata is NOT a retrieval/date/legal signal.

## 2026-10-06 - Offline Unfinished-Window Warning Flow

Register93 input identities -> read original30s/rejected15s stress and eight inspected short outputs -> derive bound from pinned runtime/prompt -> inspect ending timestamp -> warning only if saturated AND unclosed -> record separate silence/confidence/compression evidence -> copy response/add speechReview -> verify original text/fields/tokens/options preserved -> exclusive report/tests/mapping/separate replay/hash audit. No recognizer call. Actual recording -> editable transcript -> manual Analyze -> checked English/date/Applicable Law Check -> corpus isolation/retrieval/citations/IRAC -> original-language display remains unchanged; warning is not yet returned by website.

## 2026-10-06 - Read-Only Tail Acceptance Trace

Register82 saved/source identities -> dummy features/saved tokens and derived scores -> actual generate_segments/fallback/pad -> original full collector exposes baseline partial-seek next generation -> preserve failure -> register87 separate first-window collector -> actual repetition warning/one-temperature return -> original silence confidence override -> original timestamp split/seek/emitted text -> verify8/8 raw split/text/seek -> tests/mapping/separate replay/hash audit. No new recognition. Website recording -> editable transcript/manual Analyze -> checked English/date/Applicable Law Check -> allowed corpus/retrieval/citations/IRAC -> native presentation unchanged. Next guard is offline warning only, not deployed.

## 2026-10-06 - Offline15s Comparison, Not User Workflow

Register75 identities -> reconstruct identical60.046s body -> fresh candidate-only child -> original `recognize`/VAD -> diagnostic-only chunk_length15 -> original generation/split/emission -> immediately save9 rows/events -> deadline/power/seek/options/VAD/hash gates -> frozen comparison criteria -> reject (same2 cap hits, worse edit rates, phrase overcount). All8 short texts unchanged. Website recording -> editable native transcript -> manual Analyze -> checked English/date extraction/Applicable Law Check -> allowed corpus/retrieval/citations/IRAC -> original-language display is unchanged. Complete seek does not mean correct text; final4-frame repetition and timestamp overlap remain evidence to investigate.

## 2026-10-05 - Recorded Long Speech Window Trace

Register34 inputs -> reconstruct checked MP3 recipe/body -> isolated child -> actual `recognize` WAV decode -> observe original VAD result unchanged -> original30s features/`generate_segments` -> observe generation tokens/bound -> original timestamp helper updates seek -> record split -> restore timestamps and emit original segments -> production join -> immediate events/raw response -> parent deadline/power/hash assessment. Sleep attempt rejected and preserved; separate41-input retry redirects only diagnostic-worker launch and repeats same body/settings, successful text parity. Seek0->3000->5216->6004, tokens224/224/75, VAD all samples retained. No diagnostic call from website; recording -> editable native transcript -> manual Analyze -> checked English/date/Applicable Law Check/corpus isolation/retrieval/citations/IRAC/native display unchanged.

## 2026-10-05 - Actual Timestamped Speech Continuation

`frontend/app.js toggleRecording/handleRecordingStopped` -> complete audio Blob `/api/transcribe` -> `backend/server.js` raw size guard -> `backend/core/transcriber.js transcribeAudio/runLocalRecognizer/createStreamingRecognizer` selected model and request deadline -> persistent `backend/speech/transcribe.py recognize` -> installed ordinary `WhisperModel.transcribe` default VAD/feature windows -> `generate_segments/generate_with_fallback` -> `_split_segments_by_timestamps` updates seek -> restored timestamps -> consume all segment text -> reviewed editable native transcript -> manual Analyze -> existing checked English/date/Applicable Law Check/corpus isolation/retrieval/citations/IRAC/native presentation. "Streaming" is framed whole requests, not partial audio. Offline `audit_speech_continuation` registers identities -> reads saved8 short observations -> calls installed helper on synthetic tokens -> separate report/tests/mapping/replay/integrity. No production insertion or setting change; long stress evidence has no token/seek trace.

## 2026-10-05 - Matched-Budget Diagnostic Flow

Register23 tool/test/plan/prior rows/features/tokenizer/runtime binary identities -> verify source Marathi prompt/EOS/budget/shared-tokenizer text -> existing local converted CPUint8 model -> same features/prompt/beam/suppression, diagnostic cap384 -> immediately save8 raw rows -> strip only terminal EOS for comparison -> before/after agreement/cap counts -> full tests/mapping/separate current replay/hash audit/docs. Source inference is reused, not repeated. Actual recording/text -> reviewed transcript -> checked English -> date/Applicable Law Check -> isolated retrieval/citations/IRAC -> original-language presentation remains unchanged. This no-timestamp comparison does not establish behavior of production timestamped continuation.

## 2026-10-05 - Offline Prefix And Cap Trace

Freeze inputs -> source initial/common-text-prefix forward with no/full mask -> save Top-10/entire-logit difference -> source initial beam1/3 -> preserve failed converted wrappers -> raw cap1/5/10 observer records nested/empty hypotheses -> inspect versioned implementation -> cap4/12 probe verifies supplied text and one new token -> compare to source local winner -> full tests/mapping/separate replay/integrity/docs. Earlier eight-clip parity has unequal effective caps/EOS conventions; preserve reports and qualify interpretation. Actual input -> checked English when needed -> date -> Applicable Law Check -> restricted corpus -> retrieval/citations/IRAC -> original-language display is unchanged.

## 2026-10-04 - Offline Marathi Checkpoint Comparison

Diagnostic flow: register frozen inputs -> decode eight previously inspected development WAVs at16kHz -> apply saved VAD sample intervals and verify sample hashes -> create identical 80x3000 Mel features -> converted CTranslate2 child generates no-timestamp beam3 tokens -> separate source Transformers/PyTorch child consumes those same features/prompt -> structured sequence validates `[50258,50320,50359,50363]` -> shared tokenizer decodes both -> save raw rows/report -> separate corrected power-log assessment -> tests, mapping benchmark, current replay and protected-hash check. First two failed diagnostic attempts remain distinct and unusable. Structured third attempt has complete8 pairs but sleep during its timing window; accuracy/causal claims remain unsupported. Actual user workflow is still recording or text -> checked English representation when needed -> date extraction -> Applicable Law Check -> allowed corpus -> retrieval -> citations -> IRAC -> original-language presentation, with no diagnostic code in the path.

## 2026-10-04 - Checkpoint Audit And Unchanged User Flow

Diagnostic flow: `audit_marathi_checkpoint.run()` verifies prior protected identities -> registers source/converted/cache/tool/library hashes -> parses `setup_marathi_speech.py` constants without importing it -> compares weight pin, cached Git identities, all token IDs, merges, installed audio defaults and source/converted generation settings -> rechecks hashes and reserved holdout absence -> exclusive report -> tests/mapping/separate current replay. No audio, decoder or model initialization occurs. Actual user path remains recording or text -> reviewed original-language query -> checked English representation when needed -> date extraction -> `gateway.js` Applicable Law Check -> restricted corpus -> `retriever.js` -> citations -> IRAC -> original-language presentation. This audit does not enter that path or change its outputs.

## 2026-10-04 - Unchanged Decoder Segment Trace

Offline flow: `inspect_marathi_segments.register()` freezes39 inputs -> verified defaults/versions/hashes -> separate observed model worker -> registered development audio -> unchanged model.transcribe -> original generate_with_fallback returns -> record probabilities/tokens/prompt/diagnostic skip guard -> return identical tuple -> original skip/timestamp/emission flow -> bounded original logs/segments -> saved-text and VAD-duration parity -> power/elapsed/hash gates -> new report -> full tests/mapping/separate replay/audit/docs. Eight windows emitted eight segments, no skip. No production path change: reviewed native speech -> checked English -> date/gateway -> corpus isolation/retrieval/citations/IRAC -> original-language presentation. Incorrect text is already in generation output; unique model cause remains unknown.

## 2026-10-04 - Default VAD Retention Investigation

Offline flow: `audit_marathi_vad.register()` freezes plan/tools/tests/library/VAD asset/model/audio/prior evidence -> `verified_registration()` checks hashes/defaults/versions -> existing audio decode16000Hz -> default `get_speech_timestamps` -> `interval_summary` validates spans/complement -> exact library `collect_chunks` parity -> raw sample statistics/hashes -> bounded power check -> original report (gate fails unavailable logs) -> separate authorized same-window power evidence (empty; no VAD rerun) -> tests/mapping/new replay/integrity/docs. No recognizer transcription or reserved holdout. Actual production reviewed-transcript -> checked English -> date/gateway -> corpus isolation -> retrieval/citations/IRAC -> native presentation flow remains unchanged. Seven clips retain every sample; eighth only loses48ms prefix. Recognition/skip decisions remain to investigate, not fixed.

## 2026-10-04 - Baseline-Only Speech Measurement

Offline flow: `profile_marathi_baseline.register()` freezes plan/tool/model/audio hashes -> `run()` verifies registration -> `worker()` loads existing model separately -> manifest-ordered8 inspected recordings -> verify/read/decode audio -> unchanged `model.transcribe` and segment text -> log request UTC/elapsed/preparation/inference CPU -> kill/join diagnostic worker -> bounded local power records -> `assess()` gates complete/parity/unchanged/deadline/drift -> new report -> tests/benchmark/separate replay/integrity checks. Reserved8 are never submitted. No candidate or production-path change. Actual user flow remains reviewed native transcript -> checked English representation -> date extraction -> Applicable Law Check -> isolated allowed corpus -> retrieval -> verified citations -> IRAC -> original-language display, as documented below. See separate baseline results; timing cannot establish faithful legal speech.

## 2026-10-04 - Saved Speech Timing Audit

Executed: verify saved raw/assessment/plan identities -> inspect16 recorded durations -> flag one120s overrun -> read power events in file-metadata window -> validate absolute UTC boundaries -> separate report. No audio/model/legal inference. Future diagnostic flow now measures around response wait, rejects a late successful return after resume, preserves framing/finally cleanup, then scorer rejects any recorded baseline/candidate over120s. Original raw/results not rescored in place; in-memory gate check changes noErrors only, acceptance remains false. Website uses original Node speech adapter, not this Python comparison runner; reviewed transcript -> checked translation -> date/router -> isolated corpus/retrieval/citations/IRAC -> native presentation unchanged.

## 2026-10-03 - Marathi Beam Candidate Rejected Offline

Diagnostic only: exclude original AND prior development calls -> reserve/hash8 new calls -> freeze plan/model/split registration -> decode existing8 development clips in alternating beam3/beam2 order -> verify baseline against saved actual HTTP transcripts -> mark-preserving paired error/timing checks -> reject candidate -> DO NOT decode holdout or deploy. Timer budget observation is unexplained and not a certified deadline. No HTTP Analyze, date/router/retrieval/citations/IRAC called for telephone clips. Production native transcript -> manual review/Analyze -> checked English -> date extraction -> Applicable Law Check -> isolated corpus -> retrieval/citations/IRAC -> native display unchanged. See `Feature-marathi-decoder-results.md`.

## 2026-10-03 - Fresh Public Speech Endpoint Validation Completed

Executed diagnostic: approved download -> verify current pinned revision/license before/after -> metadata-only exclusion of original calls/utterances/audio hashes -> hash8 clips -> existing HTTP `/api/transcribe` -> `transcriber.js transcribeAudio()` selected`mr` -> Marathi-tuned small through unchanged `transcribe.py recognize()` -> native transcript/metadata -> separate mark-preserving error report. No Analyze, translation, Applicable Law Check, retrieval or IRAC invoked for these nonlegal calls. User workflow/source unchanged. Earlier prepared/blocked status below is historical.

## 2026-10-03 - Speech Diagnostic Flow Is Separate

Executed: old saved public speech outputs -> verify reference/fixture/audio hashes -> preserve Indic marks -> separate corrected edit-rate report. No inference or legal pipeline invoked. Prepared but blocked: licensed metadata-only disjoint-call selection -> audio hashes -> existing selected-Marathi HTTP speech worker -> native editable transcript/metadata checks -> diagnostic edit rates. No automatic legal analysis. User production flow remains reviewed transcript/text -> checked English translation -> date extraction -> unchanged Applicable Law Check -> isolated corpus -> retrieval -> original citations/IRAC -> native display.

## 2026-10-03 - Candidate Readiness Is Not Legal Analysis

`check_indictrans2_files.py`: supplied local folder -> read-only file sizes/hashes -> missing/identity report -> human/code/runtime review still required. No candidate execution or translation occurs; this tool does not call the website, Applicable Law Check, retrieval or scorer. Actual input -> checked English -> date routing -> isolated corpus -> citations/IRAC -> native presentation remains unchanged.

## 2026-10-03 - Alternative-Model Assessment (Offline Only)

Production execution unchanged. `scripts/assess_translation_model.py` runs raw prose directly through separate experimental translators; it does NOT call the date/router/retriever/IRAC path or change its inputs. Candidate outputs are untrusted diagnostics and never reach the website. Existing English bypass, checked native-to-English translation, deterministic Applicable Law Check, corpus isolation, citations, IRAC and original-language presentation remain intact. No candidate deployed.

## 2026-10-03 - Role-Inversion Safety Check

Before `pipeline.js analyzeQuery()` runs, `translationChecks.js translationMeaningIssue()` now also rejects a native explicit accused cue rendered only as English accuser with no accused/defendant remaining. The unchanged `multilingual.js analyzeMultilingualQuery()` runs one existing beam4 retry; unresolved inversion exits with `TRANSLATION_ROLE_CHANGED` before law routing, retrieval or IRAC. No word substitution, hypothesis selection, chunking or decoding change. Otherwise the date extraction -> Applicable Law Check -> isolated corpus -> retrieval -> citations -> IRAC -> grounding -> native presentation flow remains exactly as before.

## 2026-10-02 - Native Sentence Boundary Audit (No Production Change)

Actual input flow remains `analyzeMultilingualQuery()` -> `normalizeInputDates()` -> `translateInputQuery()` -> checked English -> `analyzeQuery()` -> date extraction -> unchanged Applicable Law Check -> isolated corpus -> retrieval -> citations/IRAC -> grounding -> native presentation. For fewer than two dates, `translateTexts()` calls `translationParts()` to protect literals, split ASCII sentence punctuation and space-cut remaining spans at320 characters. Indic/Urdu terminators are currently not sentence boundaries; this can cut clauses. Two diagnostic alternatives were rejected after real-model semantic regressions, so this path has NOT been changed. Multi-date complete-context masking and `splitTranslationInput()` also remain unchanged. See `Bug-native-sentence-translation.md`; tests of source/literal reconstruction do not establish translation meaning.

## Current Execution: 2026-10-02

1. `frontend/app.js` sends reviewed text or the original-language reviewed voice transcript to `backend/server.js`.
2. `analyzeMultilingualQuery()` bypasses translation for English; otherwise checks language/script, normalizes complete local dates in `normalizeInputDates()`, and calls `translateInputQuery()` with protected literals/chunking.
3. `translationMeaningIssue()` checks added accused roles and omitted explicit dishonesty. One beam4 retry is allowed; unresolved errors stop analysis. Date, weekday, number and theft-to-homicide checks still apply.
4. `pipeline.js analyzeQuery()` -> `dateExtractor.js extractFacts()` -> unchanged `gateway.js` -> allowed-code isolation in `retriever.js retrieveStatutes()` using the hash-verified merged corpus.
5. Existing lexical/title/explicit-reference/mapping scores remain; narrow phone/consent features and review-only comparison signals precede sorting. Explicit section priority and date-selected restrictions remain.
6. Existing source-bound IRAC generation -> `verifyGrounding(..., facts)` adds ambiguity/review warnings; missing-date preview still has no governing law or IRAC.
7. `createLegalPresentation()` preserves original texts, source metadata and citations. Native display prose uses exact static phrases or local model fallback; literals remain unmodified. Manual voice transcript review remains required.

## 2026-10-02 Startup Translation Warmup

At `backend/server.js server.listen()`, `translationWorker.warmup()` in `backend/core/multilingual.js` sends an empty translation payload to the existing `backend/translation/worker.py --stream` process. The worker loads the offline tokenizer and NLLB translator; it generates no translated case text. A non-English `POST /api/analyze` received while this runs waits for startup loading, then continues through `analyzeMultilingualQuery()` and the same date extraction -> Applicable Law Check -> allowed-corpus retrieval -> citations -> IRAC -> grounding flow below. English input can bypass translation as before. Later requests reuse the warm worker; a failed warmup permits a normal retry.

## 2026-10-01 Reusable Translation Flow

`frontend/app.js` posts the original query to `backend/server.js`. The server passes its reusable `translationWorker` to `backend/core/multilingual.js analyzeMultilingualQuery()`. Detection and native-to-English translation use JSON lines to `backend/translation/worker.py --stream`; the model/detector stay loaded after the first call. `normalizeInputDates()`, `translateInputQuery()`, and their date/identifier/fact checks remain in the same order. The resulting English text then enters unchanged `backend/core/pipeline.js analyzeQuery()` -> `dateExtractor.js` -> `gateway.js` -> `retriever.js` -> `synthesizer.js` -> `verifier.js`. `frontend/legalPresentation.js createLegalPresentation()` selects only display fields for English-to-original-language translation through the same worker. Successful exact display strings may be served from bounded in-memory cache; native query text is never cached. The browser receives the same schema and renders the same protected citations/source material.

## 2026-10-01 Current Multilingual Flow

`frontend/app.js analyze()` sends native text/language to `backend/server.js`, which calls `backend/core/multilingual.js analyzeMultilingualQuery()`. `normalizeInputDates()` preserves dates and removes date-adjacent Gujarati `ના રોજ` or Kannada `ರಂದು` before `translateInputQuery()` produces English. The adapter checks that dates match and rejects invented weekdays. `backend/core/pipeline.js analyzeQuery()` calls `dateExtractor.js extractFacts()` (including theft variants), `gateway.js routeByTemporalGate()` (unchanged), `retriever.js retrieveStatutes()` (allowed corpus only), `synthesizer.js synthesizeIrac()`, and `verifier.js verifyGrounding()`.

`frontend/legalPresentation.js createLegalPresentation()` builds protected display nodes. For the eight languages outside EN/HI/MR, `presentationTranslationTargets()` translates allowlisted result prose, titles, and interface text back to the input language through the local model. `frontend/app.js renderStructuredResult()` displays those fields and keeps original English statute/source/citation material separately. Hindi/Marathi use their controlled fast presentation; English bypasses translation. `LOCAL_OUTPUT_TRANSLATION=0` opts out of model output translation, while `=1` enables it for HI/MR as well. The older fast-path descriptions below are historical.

## 2026-10-01 Fast Multilingual Analysis Flow

The active non-English analysis path is:

1. `frontend/app.js` sends the original query/language metadata to `backend/server.js`.
2. `backend/core/multilingual.js analyzeMultilingualQuery()` detects or accepts the input language.
3. `normalizeInputDates()` preserves localized dates before translation.
4. `translateInputQuery()` translates only the user query into English and verifies dates/statutory identifiers/offence facts.
5. `backend/core/pipeline.js analyzeQuery()` runs the unchanged English legal pipeline: fact extraction, Applicable Law Check, corpus-isolated retrieval, citations, IRAC and grounding.
6. `createLegalPresentation()` builds the structured result. By default the result is returned without the second English-to-native output translation pass, and `presentation.outputTranslation` is `disabled-fast-path`.

`LOCAL_OUTPUT_TRANSLATION=1` re-enables the old allowlisted output presentation translation after a server restart. The default fast path preserves legal fields and source material while reducing observed non-English query latency.

## 2026-10-01 Multilingual Typed Query Flow

1. User enters or pastes a natural-language legal query in `frontend/index.html`.

2. Optional written-language selection is read by `frontend/app.js`.

   - `Auto detect` sends no language override.
   - A selected written language sends `originalLanguage`.
   - Existing voice metadata is kept separate and takes priority for voice transcripts.

3. `backend/server.js` passes the query and language metadata to `analyzeMultilingualQuery()` in `backend/core/multilingual.js`.

4. `analyzeMultilingualQuery()` decides the processing language.

   - Clearly English queries bypass translation.
   - User-selected written language is accepted only when the input script matches.
   - Automatic detection is used when reliable.
   - If automatic detection mislabels a supported native script, a bounded script fallback may choose the supported language.

5. Native date text is normalized before translation.

   File/function:

   - `backend/core/multilingual.js`, `normalizeInputDates(text)`

   Current coverage:

   - native digits
   - day-month-year localized month names
   - year-month-day localized month names
   - Hindi/Marathi complete spoken day-month-year forms
   - date suffix spacing so later English translation cannot attach prose to the ISO date
   - Gujarati `ના રોજ` immediately after a normalized ISO date is removed because the date has already been preserved and the connector can cause weekday hallucination

6. Translation is verified before legal analysis.

   File/function:

   - `backend/core/multilingual.js`, `translateInputQuery()`

   Verification:

   - statutory identifiers must not be injected
   - dates must match exactly after translation
   - unmentioned weekdays are rejected
   - native theft must not translate into homicide for Hindi/Marathi checks

7. The resulting English query enters the unchanged legal pipeline.

   File/function:

   - `backend/core/pipeline.js`, `analyzeQuery(query)`

   Then:

   - `backend/core/dateExtractor.js` extracts offense dates, section references, keywords, and legal phrases.
   - `backend/core/gateway.js` applies the deterministic Applicable Law Check.
   - `backend/core/retriever.js` retrieves only from the allowed corpus.
   - `backend/core/synthesizer.js` generates citation-bound IRAC.
   - `backend/core/verifier.js` checks grounding warnings.

8. Output presentation is structured for the input language. By default, the expensive output-machine-translation pass is skipped for speed; statutory excerpts and source metadata remain protected. Optional output translation can be re-enabled with `LOCAL_OUTPUT_TRANSLATION=1`.

## Selected Hindi/Marathi speech execution (2026-09-30)

`frontend/app.js` and `backend/server.js` pass the explicit recording-language choice unchanged. `backend/core/transcriber.js transcribeAudio()` selects the existing local Hindi-medium or Marathi-tuned-small model; `runLocalRecognizer()` routes either selected language to one `createStreamingRecognizer()` instance. `backend/speech/transcribe.py --stream` decodes line-framed audio with the chosen language, beam 3 and VAD, and returns native text without rerunning language detection. The next same-language recording reuses the loaded model; changing language/model stops that worker and starts the other. Timeout/crash closes the worker, and a later request can recreate it. Auto still runs a one-shot tiny model with language detection and its existing confidence policy. The native transcript remains editable; pressing Analyze still invokes the multilingual adapter, date extraction, Applicable Law Check, corpus-isolated retrieval, citations, IRAC and grounding described below.

## Selected Marathi fidelity and latency (2026-09-30)

`frontend/app.js` still records, posts audio, inserts an editable native transcript, then waits for the user to press Analyze. `backend/core/transcriber.js transcribeAudio()` selects Marathi and `runLocalRecognizer()` sends line-framed audio to a reusable `backend/speech/transcribe.py --stream` process. The model stays local and loaded between recordings; explicitly selected Marathi skips model language detection and reports no invented detected-language confidence. Auto/Hindi continue on the existing one-shot path. The worker is killed on timeout/crash and recreated on a later request.

For analysis, `backend/core/multilingual.js normalizeInputDates()` converts complete numeric or recognized spoken Hindi/Marathi dates to ISO, rejecting invalid calendar dates. `translateInputQuery()` translates bounded chunks and restores exact date/statute markers; a second marker form is tried only when a long multi-date translation damaged the first. Missing/changed markers or invented numbers still fail closed. `verifyOffenceTranslation()` rejects an unsupported theft-to-homicide translation before `backend/core/pipeline.js`. `dateExtractor.js extractLegalPhrases()` and `retriever.js hasTheftCue()` recognize narrow victim-reported stolen-property wording so that the existing corpus-isolated retrieval can surface theft provisions. `gateway.js` and all citation/IRAC functions are unchanged. Unclear dates still enter the existing clarification/candidate-only route.

## Marathi model selection (2026-09-30)

After the existing UI language selection, `backend/core/transcriber.js localSpeechConfig()` identifies the local Marathi-tuned CT2 folder. `speechStatus()` checks its model, config, tokenizer and JSON vocabulary; `transcribeAudio()` prefers it for selected `mr`, otherwise uses the existing multilingual small model. The returned model name identifies which was used. `backend/speech/transcribe.py` accepts either valid CT2 vocabulary format and still decodes selected Marathi without an initial prompt. Auto/tiny and Hindi/medium selection, deadlines, native editable transcript, manual Analyze, translation and all legal steps below are unchanged. `scripts/setup_marathi_speech.py` is one-time, pinned and checksum-verified; runtime does not fetch a model.

## Selected-language voice flow (2026-09-29, historical model choice)

`frontend/app.js` snapshots `#speech-language` at recording start -> `handleRecordingStopped()` posts audio to `/api/transcribe?mode=transcribe&language=auto|hi|mr` -> `backend/server.js` forwards choice -> `backend/core/transcriber.js` validates it, selects tiny (Auto), medium (Hindi), or small (Marathi), and launches `backend/speech/transcribe.py`. Auto detects/decodes and retains probability. Selected-language decoding omits the English legal prompt, retains the detected code only as a diagnostic, and reports selected language with null model confidence. Native text is put in the editable textarea; Analyze is a separate action. Hindi alone has a 180-second worker and 190-second browser deadline to preserve longer recordings with the larger model; other language deadlines remain 120/130 seconds.

`frontend/app.js analyze()` forwards `languageSource` and transcript metadata -> `backend/server.js` -> `backend/core/multilingual.js analyzeMultilingualQuery()`. Auto still requires the existing supported/reliable detection. Explicitly selected Hindi/Marathi uses the speaker's choice without pretending it passed an ASR confidence threshold. The adapter translates native text to English, checks literal/date integrity, then calls `backend/core/pipeline.js analyzeQuery()` -> dateExtractor.js `extractFacts()` -> gateway.js `routeByTemporalGate()` -> retriever.js `retrieveStatutes()` with corpus isolation -> synthesizer.js `synthesizeIrac()` -> verifier.js `verifyGrounding()` -> structured presentation and `frontend/app.js renderStructuredResult()`. No legal/routing/retrieval function was changed. The 2026-09-26 voice flow below is historical for Auto mode.

## Current native voice flow (2026-09-26)

app.js toggleRecording()/handleRecordingStopped() -> MediaRecorder audio Blob -> POST /api/transcribe?mode=transcribe -> transcriber.js validateAudioInput()/speechStatus()/runLocalRecognizer() -> speech/transcribe.py automatic model.detect_language() -> task=transcribe with detected language -> native text, normalized inputLanguage, probability/status. Unsupported/uncertain language still returns editable text. No direct audio translation and no automatic analysis.

User reviews/corrects transcript -> app.js analyze() retains inputMode=voice/inputLanguage/languageProbability/originalInput; query is reviewed text. Emptying textarea/demo resets voice state -> server.js forwards metadata -> multilingual.js analyzeMultilingualQuery() validates supported reliable speech language (no text re-detection for voice) -> normalizeInputDates()/translateInputQuery() -> existing literal/date/weekday checks -> pipeline.js analyzeQuery() -> extractFacts() -> routeByTemporalGate() -> corpus-isolated retrieveStatutes() -> synthesizeIrac()/verifyGrounding() -> existing createLegalPresentation()/allowed-field translateTexts()/syncDecisionLabels() -> existing renderStructuredResult()/renderLegalPresentation(). Missing date still returns candidates, no governing law and irac:null. English voice skips translation and uses existing English rendering.

Response input includes native originalInput, reviewedInput, English processedInput and all mode/language fields. Unsupported/uncertain speech fails analysis without mutating transcript/guessing English. No streamed step events; UI truthfully shows combined local translation/analysis busy state. This supersedes earlier checkbox/direct-translation/edit-cleared-hint descriptions below; typed and all legal steps remain unchanged.

## Branding-only rendering (2026-09-26)

The existing page loads style.css, then isolated branding.css. Header image/favicon are typed embedded SVG copies generated from frontend/assets by scripts/build_brand_assets.mjs, requiring no SVG server route/MIME change. CSS chooses native cursor assets only for fine-hover pointers; text/selection, disabled/progress, reduced-motion and forced-colors/touch retain native states. There is no added runtime JS or cursor event interception. User input -> language adapter -> date extraction -> Applicable Law Check -> corpus isolation -> retrieval -> citations -> IRAC remains exactly unchanged. All existing controls/IDs/module entry points retained.

## Structured multilingual output (2026-09-26)

Current actual path: frontend/app.js analyze() -> backend/server.js /api/analyze -> multilingual.js analyzeMultilingualQuery() -> worker.py detect/resolve_detection() -> persist input language -> normalizeInputDates()/translateInputQuery() -> existing date/number/weekday integrity checks -> pipeline.js analyzeQuery() -> dateExtractor.js extractFacts() -> gateway.js routeByTemporalGate() -> retriever.js retrieveStatutes() with existing corpus restrictions -> synthesizer.js synthesizeIrac() -> verifier.js verifyGrounding(). Missing-date candidate preview retains its existing irac:null branch.

Non-English output: createLegalPresentation(result, language, BNS_COMMENCEMENT) -> structured decision/provision/source/IRAC/citation/warning fields -> presentationTranslationTargets() -> translateTexts() ONLY for allowed prose -> syncDecisionLabels() -> multilingual.presentation schemaVersion2 -> app.js renderStructuredResult() -> legalPresentation.js renderLegalPresentation() -> escaped HTML. HI/MR use controlled terminology and route-derived system templates, not free machine translation. Title prose is explicitly marked machine-translated. Source text is exact original English; identifiers/scores/dates/citations/source metadata never become output-model targets. Literal nodes remain separately rendered. No English Rule-delimiter parsing. Language is never re-detected after analysis. English bypass and renderer remain intact; switching languages restores English heading defaults and language attributes. This supersedes the historical flat-output paragraph below.

## Multilingual bug correction (2026-09-26)

`worker.py main(action:detect)` -> full-inventory py3langid rank -> `resolve_detection()` -> conditional multi-family Marathi consensus -> original selected-language probability plus method/model-language diagnostics. `analyzeMultilingualQuery()` accepts the documented consensus separately from the normal >=0.8 model threshold; the normal UI shows only the language name. Unsupported/uncertain input remains rejected.

After `normalizeInputDates()`, `translateInputQuery()` uses ordinary literal spans for fewer than two dates. Multiple-date input uses one contextual translation with literal facts masked by __LEGAL_N__ markers. Exact marker count/order, no new numerals/identifiers and strict restoration precede the existing date-set/weekday checks and unchanged `analyzeQuery()`. The supplied Marathi range translates to "The fraud started on 2024-06-20 and continued till 2024-07-10." The unchanged extractor/gateway selects MULTI_PERIOD_REVIEW; no route is injected by the adapter.

Output remains field-by-field. `translationParts()`/`translateTexts()` retain structure/whitespace and runtime source identities. Statutory excerpts are no longer sent for display translation. `irac.rule` presentation contains only the explanation before the canonical source-material delimiter. `renderResult()` renders canonical excerpts/Rule material under "Original statutory source", titles/narrative separately, original scores/pages/citations directly, and an explicit separator before Relevance. Canonical IRAC/retrieved/source objects remain exact. Existing English, voice and missing-date legal paths are unchanged.

## Recording availability correction (2026-09-26)

refreshVoiceAvailability() permits recording when browser capture APIs are available. toggleRecording() requests permission, exposes Cancel while waiting, and recovers after an unanswered 20-second request. cancelRecording() invalidates pending requests; any later stream is stopped. After a successful grant, MediaRecorder -> Blob -> /api/transcribe is preserved. The transcription backend now uses free offline inference. The latest live browser attempt reported permission denied and recovered; successful physical capture remains unverified.

Last updated: 2026-09-26

This file traces the actual execution path from user input to final answer.

Adapter integrity detail: translated input must preserve the extracted date set and cannot introduce an English weekday absent from the original localized weekday names. Literal spans cover dates/statutory identifiers/numbered annotations/PDF definition separators. Written English quantities zero-through-twenty may use equivalent native digits, but changed/signed/fractional values fail. These are limited integrity checks, not validation of ownership, intention, negation or legal translation fidelity.

## Runtime Flow

Multilingual insertion (2026-09-26): frontend `analyze()` -> `/api/analyze` -> `analyzeMultilingualQuery()` -> clear-English bypass or `runTranslationWorker(action:detect)` -> supported-language/confidence check -> `normalizeInputDates()` -> `translateTexts()` with literal spans withheld from the model -> date-set equality check -> unchanged `analyzeQuery()` -> existing extraction/gateway/corpus isolation/retrieval/citations/IRAC/verifier -> translate selected natural-language display fields to stored original language -> frontend `renderResult()`. Source objects, bound citations, section numbers, scores, route codes and canonical IRAC remain unchanged. Missing-date queries retain candidateOnly, empty governing allowedCodes and irac:null. A failed translation returns an error without replacing the editable original text. Model scores and language-detector probabilities are heuristics, not legal confidence.

Voice now uses separate `model.detect_language()` and explicit detected-language transcription locally. `/api/transcribe` returns originalLanguage and languageProbability. Native text is detected/translated by the same adapter; explicit English speech translation retains the speech-language hint for output. Frontend passes that hint only while the textarea equals the reviewed transcript; an edit invalidates it. No legal analysis runs automatically. Physical Indian-language speech quality has not been measured. This preserves the prior English decoding path: automatic decoding initially changed the synthetic fixture's day to 22; separate detection plus explicit decoding restored 20 without altering transcript dates in code.

1. User enters, pastes, or records a legal query in the frontend.

   Files/functions:

   - `frontend/index.html`
   - `frontend/app.js`

   Voice-only branch:

   - `toggleRecording()` requests microphone access and starts `MediaRecorder`.
   - `handleRecordingStopped()` rejects unusably short/empty captures and sends raw audio to `POST /api/transcribe`.
   - `transcribeAudio()` validates format and size, checks local Python/model files, and rejects concurrent model jobs.
   - `runLocalRecognizer()` launches `backend/speech/transcribe.py` without a shell; audio travels on stdin, JSON on stdout. It forces offline settings and kills stalled processes after 120 seconds.
   - The worker decodes through PyAV, checks audio duration, loads only the local tiny model, and runs CPU/int8 faster-whisper inference. Normal mode auto-detects the spoken language; the checkbox explicitly selects English translation while retaining original-language metadata.
   - The frontend's audio request expires after 130 seconds and restores controls on failure. No external provider request occurs.
   - Audio remains in memory and is not written to project files or temporary files.
   - Returned text is placed in the same editable textarea. The user must review it and invoke Analyze; transcription never auto-submits legal analysis.

2. The frontend sends the reviewed text as a JSON request to the backend.

   File/function:

   - `frontend/app.js`, `analyze()`

   Request shape:

   ```json
   {
     "query": "On 12 July 2024, a person was deceived and dishonestly induced to deliver property."
   }
   ```

3. The server receives `POST /api/analyze`.

   Files/functions:

   - `backend/server.js`
   - `backend/core/multilingual.js`, `analyzeMultilingualQuery(query, {originalLanguage})`
   - `backend/core/pipeline.js`, `analyzeQuery(query)`

4. The pipeline trims the query.

   File/function:

   - `backend/core/pipeline.js`, `analyzeQuery(query)`

   Behavior:

   - Converts input to string.
   - Trims whitespace.
   - Throws an error if the query is empty.

5. Date, section, keyword, and legal phrase extraction runs.

   File/function:

   - `backend/core/dateExtractor.js`, `extractFacts(query)`

   Outputs:

   - `dates`
   - `offenseDate`
   - `sections`
   - `sectionRefs`
   - `keywords`
   - `legalPhrases`
   - `concepts`
   - `continuingSignal`

   Important detail:

   - Keywords are token-bound so `mobile` must not become `mob`.
   - Theft extraction recognizes common taking variants such as `take`, `took`, and `taking`.
   - Legal phrases preserve narrow concepts such as `without consent`, possessive consent wording, `out of possession`, `from possession`, possessive possession wording, `dishonestly induced`, `deliver property`, `give property`, `hand over property`, `transfer property`, `sell property`, `delivery of property`, `deceived person`, and translated deception/property-transfer variants.
   - Translated cheating concepts are normalized only when deception or fraud wording appears with property-transfer or dishonest-property evidence. Ordinary sale, transfer, giving, taking, or unrelated deception is not enough.
   - Injury/hurt facts are also normalized into a `hurt` concept when the query describes bodily pain, injury, wounds, physical injury, physical/bodily harm, or violence that caused injury/hurt/pain. Non-bodily harm, such as economic harm, does not become a hurt concept.

6. Applicable Law Check selects the legal route.

   File/function:

   - `backend/core/gateway.js`, `routeByTemporalGate(facts)`

   Routes:

   - `IPC_ONLY`: offense date before `2024-07-01`
   - `BNS_PRIMARY`: offense date on or after `2024-07-01`
   - `MULTI_PERIOD_REVIEW`: continuing conduct spans the transition
   - `CLARIFY`: missing or ambiguous offense date

   This check is deterministic and must remain isolated from retrieval tuning unless explicitly approved.

7. Corpus isolation happens inside retrieval.

   Missing-date preview: in pipeline.js analyzeQuery(), CLARIFY plus facts.dates.length===0 calls retrieveStatutes twice with isolated code-specific ranking contexts. No assumed date is passed or chosen. The returned gateway decision remains CLARIFY/UNDETERMINED, allowedCodes=[]; candidateCodes=[IPC,BNS] describes only the preview. Up to three results per code are returned in code groups, not a cross-corpus applicability ranking. candidateSummary names only returned records and asks for a date. IRAC generation is skipped (irac:null); unchanged verifyGrounding checks the summary and review warnings. frontend renderResult() displays DATE REQUIRED, candidate-only corpus/provision labels and the summary. Once the user supplies a valid date and re-analyzes, the ordinary path below runs unchanged. Ambiguous dated queries are not converted into this preview.

   File/function:

   - `backend/core/retriever.js`, `retrieveStatutes(query, facts, gate, limit)`

   Behavior:

   - If `gate.allowedCodes` is empty, return no retrieved statutes.
   - Filter `backend/data/statutes.json` to allowed codes only.
   - Exclude repealed records.

8. Lexical retrieval ranks statutory records.

   File/function:

   - `backend/core/retriever.js`, `retrieveStatutes()`

   Signals:

   - token overlap against section/title/text/keywords
   - IDF-like token weighting
   - title token boost
   - exact section-reference boost
   - primary-code explicit section-reference guard
   - official IPC-BNS mapping boost where allowed
   - narrow deterministic legal feature boost for theft, cheating, and fact-only hurt/grievous-hurt descriptions, including possessive mobile-phone theft wording, generalized bodily injury/hurt concepts, translated cheating-property-transfer wording, and multi-period cheating review support when deception and property-delivery cues are both present
   - hurt/grievous-hurt boosts are disabled when an explicit section reference is present, so official mapping stays authoritative for benchmark/reference-section queries
   - primary-code route preference for `BNS_PRIMARY`

9. Citations travel with each retrieved record.

   Data source:

   - `backend/data/statutes.json`

   Citation fields:

   - document title
   - authority
   - source file
   - PDF page
   - URL
   - SHA-256

10. IRAC synthesis uses retrieved material only.

   File/function:

   - `backend/core/synthesizer.js`, `synthesizeIrac(query, facts, gate, retrieved)`

   Output:

   - Issue
   - Rule
   - Application
   - Conclusion
   - Bound citations

11. Grounding verification checks the answer.

   File/function:

   - `backend/core/verifier.js`, `verifyGrounding(irac, gate, retrieved)`

   Responsibilities:

   - Verify that conclusion references are grounded in retrieved section identifiers.
   - Surface review warnings such as BNS 106(2) commencement status.

12. The frontend renders the result.

   File/function:

   - `frontend/app.js`, `renderResult(data)`

   Displays:

   - extracted offense date
   - Applicable Law Check decision
   - allowed corpus
   - retrieved provisions and citations
   - IRAC synthesis
   - review warnings

## Evaluation Flow

Official-source reference evaluation is separate from runtime analysis.

Files:

- `evaluation/runs/blind-predictions.json`
- `evaluation/official-source-reference-evaluation/official-source-reference-labels.json`
- `scripts/score_official_source_evaluation.mjs`

Rules:

- The scorer compares sealed predictions with official-source reference labels.
- It does not rerun the current pipeline.
- Re-running the scorer against sealed predictions should preserve the historical metrics unless the sealed file or reference file changes.
