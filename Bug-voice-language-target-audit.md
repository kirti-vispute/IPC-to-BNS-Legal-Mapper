# Voice Language Target Audit

Date: 2026-09-27. Status: reported acoustic wrong-language failure NOT reproduced; recording required. No Git repository/branch/commit.

## Problem and evidence boundary

The user reports Marathi/Hindi speech becoming Greek, Japanese, Chinese or English. No failing audio, transcript/response pair or microphone trace was supplied. Neither port3000 nor3001 answered at task start. Restarted the existing current backend on3001, PID13500. Service availability is a confirmed operational issue; it does NOT establish the cause of an earlier wrong-language response.

Inspected speech adapter/worker, frontend acquisition/request/result code, legal endpoint, multilingual adapter/detector/translator/structured renderer, model setup scripts/dependencies/environment override names, readiness and speech/multilingual tests. No keys or secrets were inspected. No speech or translation dependency/setup/model changed.

## Current exact flow

frontend/app.js toggleRecording -> native audio Blob -> /api/transcribe?mode=transcribe -> transcriber.js validates local files/audio/concurrency and launches speech/transcribe.py offline -> model.detect_language -> task=transcribe with the detected language -> native transcript + actual originalLanguage/probability -> canonical language normalization/status -> editable textarea + voiceInput state -> manual Analyze -> /api/analyze forwards voice fields -> analyzeMultilingualQuery uses supported reliable speech language -> normalizeInputDates/translateInputQuery and existing literal/date/weekday checks -> unchanged analyzeQuery -> unchanged date/gateway/corpus/retrieval/citations/IRAC/grounding -> structured presentation/allowed prose translation -> original-language rendering.

Marathi: voice -> native transcript -> mr -> English -> legal processing -> mr. Hindi: voice -> native transcript -> hi -> English -> legal processing -> hi. English: voice -> en transcript -> legal processing -> en. These describe the implemented routing contract, not verified natural-language acoustic accuracy.

## Findings

- Whisper task is transcription only; direct audio translation is rejected in JS and Python. No forced English language. The existing English legal-term prompt is unchanged; there is insufficient audio evidence to establish whether it affects the reported error.
- Both typed and voice call analyzeMultilingualQuery. Reliable voice metadata bypasses text re-detection; typed detection remains unchanged. Supported codes: en/hi/mr/gu/bn/ta/te/kn/ml/pa/ur. Confidence is preserved, not invented by production code. The >=0.8 gate is heuristic, not calibrated accuracy.
- Translation source/target is language->en for input and en->language for allowed presentation prose. worker.py selects tokenizer src_lang=LANGS[source] and target_prefix=LANGS[target]. The canonical map contains no el/ja/zh. These requests are rejected, not silently mapped to English. Browser locale is not used to select a translation target.
- Frontend retains source-language metadata across transcript corrections and clears it on empty input/demo. Original transcript is distinct from reviewedInput and processedInput. Rendering uses the same stored outputLanguage; it never translates the whole HTML/Markdown result.
- Controlled tests exercise conflicting legacy English hints, all eleven supported target codes, typed/voice canonical parity and unsupported Greek/Japanese/Chinese detections. No unintended target or source/target reversal was reproduced.
- A confident but wrong ASR language remains possible: these tests cannot verify what a human actually spoke. Unsupported detection is blocked but not acoustically corrected. Supported-language misclassification also cannot be ruled out without the recording. No script-only classifier or hardcoded Marathi workaround was added.

## Changes and why

Production behavior unchanged. Only tests/multilingualVoice.test.js extended with13 tests: eleven controlled supported-language target/typed-parity checks, one el/ja/zh rejection check, one conflicting English hint check. Controlled ASR/translation responses explicitly test integration, NOT acoustic recognition or translation quality. Existing tests retained. Full diff reviewed against .voice-rollback/voice-target-audit/tests/multilingualVoice.test.js.

Documentation updated: this report, Decisions.md, TestChecklist.md, Rollback.md, Handover.md and the existing voice-handoff bug record. Flow/architecture require no change because production is unchanged. The prior integration fix is already present; rewriting it or replacing/tuning the model without evidence would violate the narrow-scope requirement.

## Fresh test results

- Baseline full suite135/135; final148/148,0 failures,0 skipped.
- Dedicated speech/voice/multilingual/LID/presentation suite107/107; voice target integration suite26/26.
- Official mapping: IPC and BNS each104/104 Top-1 and Top-3, unchanged.
- Current resolved official-source replay:5/5 Top-1 and Top-3, unchanged; no sealed predictions/report regenerated. Historical sealed40% is distinct. No independent expert validation claimed.
- Real HTTP el/ja/zh requests:422 UNSUPPORTED_LANGUAGE, no translation/result.
- Real existing Windows-synthetic English WAV -> live local /api/transcribe -> /api/analyze:en, probability0.99504143, native transcription, date2024-06-20,IPC_ONLY,IPC379 first, correct Voice/en processing/output/original input metadata. This is audio inference, NOT human/browser-microphone accuracy.
- Fresh HTTP Hindi and Marathi missing-date requests used CONTROLLED native transcripts/speech metadata (probability0.99 is a test input) with REAL local NLLB translation. Both returned their respective outputLanguage, CLARIFY, no date, irac:null and canonical legal/source-field equality. Recorded outside evaluation: output/voice-verification/target-audit-http-native.json. This is NOT Hindi/Marathi audio recognition.
- All five existing independence checks passed: builder read boundary/declared allowlist, blind seal/checksum and report/reference linkage. Executed existing verification source with only runtime root/output destination redirected to ignored output/voice-verification/target-audit-independence.json to avoid overwriting protected independence-verification.json. Original verifier file/algorithm unchanged.
- Final comparison:47/47 task-start protected/runtime baseline hashes unchanged, no protected additions. Includes complete evaluation/legal sources/data, six legal modules, speech/translation workers, speech/multilingual/language/server modules, frontend app/index/renderer and benchmark/scorer. No legal/evaluation or production writes occurred.

## Remaining failures and next action

Fresh HI missing-date translation contains theft and retrievesIPC378/379 andBNS303. Fresh MR equivalent becomes "The date of the incident is not given but it was stolen." and retrievesIPC88/410/87,BNS26/317/25. This is a real translation-to-retrieval terminology limitation, not a wrong output-language target. It is NOT fixed or hidden by this audit. Prior mixed-language/continuing-fraud candidate weaknesses remain; no retrieval change made.

Hindi/Marathi audio fixtures are still unavailable; successful physical browser microphone capture is not newly verified. All voice acceptance criteria cannot be certified. Attach the failing recording and say whether the wrong language first appears in the native transcript or final result. Then use scripts/verify_multilingual_voice.mjs --audio <file> <mime> [expectedRoute] and compare Whisper text/code/probability, adapter source/target and structured output. Establish that boundary before one evidence-backed production fix. Do not force a language or claim speech accuracy from mocked transcripts.

Recognition remains local/free faster-whisper, translation remains existing local/open-source NLLB (noncommercial license), no API/key/cloud provider introduced, all legal processing/source/citation logic unchanged.
