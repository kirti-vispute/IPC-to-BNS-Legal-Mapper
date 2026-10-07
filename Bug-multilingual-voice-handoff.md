# Bug: Multilingual voice handoff

2026-09-27 follow-up: current native handoff/targets re-audited, no production edits. Baseline135 ->148 tests after13 target/parity safeguards. Actual Greek/Japanese/Chinese acoustic failure not reproduced without the user's recording; supported output target checks and fresh HI/MR local translation pass while MR missing-date candidate weakness remains. Current app restarted on3001. See Bug-voice-language-target-audit.md; do not infer human speech accuracy from these checks.

Date: 2026-09-26. No Git repository/commit available.

## Problem and investigation

Read speech worker/adapter, server endpoints, frontend recording and analysis, multilingual adapter/worker, structured presentation, readiness checks and tests. Whisper already detects language automatically; no forced English language existed. The UI could select audio translation instead of native transcription. The analysis adapter independently detected text, so reliable Marathi speech metadata could be overridden or a short transcript rejected. Editing the transcript discarded its language hint. Old frontend tests sent transcribed text straight to analyzeQuery, missing this boundary.

Reproduction before edits: analyzeMultilingualQuery("चोरी झाली", {originalLanguage:"mr", worker returning hi/confidence0.3}) raises LANGUAGE_UNCERTAIN despite the Marathi hint. The option mode=translate also called Whisper's translate task. Frontend only passed originalLanguage while query matched the unedited transcript.

## Decision and implementation

Keep one multilingual adapter and the English legal pipeline. Reject direct audio translation at both JS validation and Python argument parsing. Retain automatic acoustic language detection and explicit native-language decoding, including existing recognition settings/prompt. Do not tune ASR, retrieval or statutory data speculatively.

New backend/core/languages.js shares the existing eleven ISO language names, case/locale normalization and supported-language/confidence status. Supported probabilities in [0.8,1] permit voice handoff; missing/low/invalid probability asks for clarification, unsupported language stays unsupported. This is a conservative heuristic, not calibrated ASR accuracy. Text detection and its Marathi consensus remain unchanged for typed input.

transcriber.js preserves text even when its language is unsupported/uncertain. multilingual.js uses valid speech metadata only for inputMode=voice, then runs the SAME date-normalization, input translation, literal/date/weekday checks, analyzeQuery, presentation creation, field translation and renderer. English voice bypasses translation. Response input records originalInput (unedited transcript), reviewedInput, processedInput (English), inputMode/inputLanguage/processingLanguage/outputLanguage and actual probability. Canonical result fields remain unchanged.

server.js forwards these fields. app.js retains voice state across corrections, clears it when the textarea is emptied or a demo is loaded, requires manual Analyze, shows detected/uncertain/unsupported language and Voice/English processing/same-language output. index.html removes only the retired audio-translation checkbox. No fake staged progress: analysis/translation share one truthful busy message because the endpoint is not streaming progress.

Voice language remains the detected language during edits. For a completely new typed query in another language, clear the textarea first. Client speech metadata is trusted in this local prototype, not cryptographically authenticated.

## Files and tests

Production: backend/core/languages.js (new), transcriber.js, multilingual.js, backend/speech/transcribe.py, backend/server.js, frontend/app.js, frontend/index.html.

Tests: tests/multilingualVoice.test.js (new), voiceInput.test.js, transcriber.test.js, branding.test.js. Changed legacy assertions only for explicitly retired audio translation, correction-state retention and the removed checkbox; all other checks retained. Added actual adapter and renderer coverage instead of bypassing them. New script scripts/verify_multilingual_voice.mjs separates controlled transcripts with real translation from actual audio inference.

Baseline118 passed; final full suite135 passed,0 failed,0 skipped. Dedicated speech/voice/multilingual/branding suite81 passed. Includes EN/HI/MR, both-date periods, missing date, explicit IPC/BNS, multi-period, mixed input, original transcript/correction preservation, language propagation, canonical field/source/citation equality, literal dates/sections, unsupported/uncertain detection, translation failure and existing capture/timeouts/readiness/concurrency.

Mapping: IPC and BNS each104/104 Top-1 and Top-3, unchanged. Current no-write resolved official-source replay5/5 each, unchanged; historical sealed40% report untouched. These are not human speech, translation or independent legal accuracy.

## Real local checks and limits

Eight controlled HI/MR native transcript + speech metadata fixtures used the real local NLLB worker. All retained expected route, output language and canonical metadata parity. This does NOT test acoustic recognition. Explicit IPC379/BNS303 stayed first. HI missing-date retained theft candidates IPC378/BNS303; MR missing-date correctly remained CLARIFY with both-corpus preview and no IRAC, but translation "The date of the incident is not given but it was stolen." retrieved IPC88/410/87 and BNS26/317/25 rather than theft definitions. Mixed Hindi/English routed BNS correctly but "Ko accused ne mobile phone stolen" retrieved BNS317/249/253. MR continuing fraud routed review but retrieved IPC105/BNS303/BNS43. These remaining translation/retrieval failures are exposed, not fixed in this integration task. Routing/language parity is not useful-candidate quality.

The verifier's --summarize mode rechecks these recorded observations against fixture-only theft expectations, writes output/voice-verification/acceptance-summary.json and exits1 for the two confirmed missing-candidate failures. Eight plumbing checks are not an all-green acceptance report; no legal gold labels are created.

Real existing Windows-synthetic English WAV -> fresh HTTP /api/transcribe -> /api/analyze: en, probability0.99504143, native transcript, date2024-06-20, IPC_ONLY, IPC379 first, structured inputMode=voice. This is not human-speaker accuracy. Source/field parity asserted in controlled real-translation checks.

Port3000 contained an old backend: current static JS but old response metadata. Fresh verified backend on port3001 returns the new contract. Real HTTP uncertain/unsupported requests return422 without English fallback. Browser on3001 shows retired checkbox absent and unchanged English IPC379/citations/grounding workflow. VM tests cover frontend native voice insertion and rendering; successful physical browser capture is unverified.

Hindi/Marathi audio fixtures are unavailable. Only English Windows synthesis voices are installed; user recordings were requested. Therefore Hindi/Marathi acoustic recognition and all final voice acceptance criteria are NOT certified complete. No ASR/translation/legal accuracy percentage is claimed. NLLB may change legal semantics despite numerical guards. No paid/cloud API/key/provider/model/dependency introduced. Both recognition and translation remain local/open-source (NLLB noncommercial license restriction applies).

## Integrity and rollback

All42 protected task-start hashes must match: complete evaluation, legal sources/manifest/data, six legal modules, translation worker, structured renderer/CSS and benchmark/scorer. No labels, seals, methodology, source documents, mapping or legal behavior changed. Full diffs read against .voice-rollback/multilingual-voice copies, plus all new files. Scoped rollback instructions: Rollback.md.

Final hash comparison:42/42 unchanged, no additions to protected trees. Fresh final detached server PID22688 on3001 verified with structured voice analysis response. Port3000 was not stopped or altered.

Next single step: attach Hindi and Marathi recordings and run the real-audio verifier; separately authorize investigation of the observed translation-to-retrieval terminology failures. Do not claim complete multilingual voice quality from mocked transcripts.
