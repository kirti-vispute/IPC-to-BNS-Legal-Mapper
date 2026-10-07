# Recording Language Selection

## Problem And Investigation (2026-10-06)

User reports incorrect Hindi/Marathi text in the input box. No exact intended sentence, incorrect transcript or failing recording was supplied in this session; general recognition failure is not reproduced. The visible textarea was empty. No physical microphone was accessed.

Confirmed narrower cause: `frontend/app.js:toggleRecording()` previously read ONLY Spoken language. Written language Hindi/Marathi with Spoken language Auto therefore submitted `language=auto`, selecting the existing tiny automatic recognizer instead of the explicitly selected-language model. Backend explicit Hindi/Marathi handling already worked. `handleRecordingStopped()` inserts the original returned transcript, not translated or invented words. Speech uses transcription; legal translation occurs separately on manual Analyze.

## Decision And Implementation

Only when Spoken language is Auto and Written language is hi/mr, snapshot that supported explicit hint before awaiting microphone permission. Explicit Spoken language always wins. Other written selections keep existing automatic behavior. `setVoiceBusy()` locks both selectors until completion/error, preserving analysis-busy locking. No HTML/CSS, decoder/model, backend, date routing, translation or retrieval change. Two small production blocks in `frontend/app.js`; no new automatic Analyze or word correction.

Hindi continues to use local multilingual Whisper medium; Marathi continues to use the existing Marathi-tuned Whisper small. This is not translating a recording into an arbitrary selected target language and is not an acoustic-quality improvement.

## Tests And Result

- Nine new contracts in `tests/voiceLanguageSelection.test.js` execute actual frontend and backend adapter with a stub recognizer. Before fix: six pass/three fail; after fix: nine pass. They prove selection, precedence, unchanged synthetic response text, permission snapshot, timeouts and cleanup, NOT recognition accuracy.
- Focused voice suites:45/45. Full `npm test`:254/254; full Python unittest discovery:92/92, no failures/skips. Project-local TEMP/TMP and approved localhost test access used.
- Registered real HTTP checks on two previously inspected public clips return200, native Devanagari, selected-language metadata and correct existing models; text preserved. They do not score word correctness, unseen speech or legal meaning. Actual UI recording/microphone not exercised.
- Official mapping benchmark:IPC104/104 and BNS104/104 Top-1/Top-3, same-crosswalk consistency only. Separate resolved current replay remains5/5 Top-1/Top-3, before and after. Historical sealed40% unchanged and not independent lawyer validation.
- Streaming audit of327 prior identities finds exactly the authorized frontend change, no unexpected/registered-input changes, verified backup and no reserved holdout outputs. Backend/legal/corpus/model/evaluation artifacts unchanged.

## Files And Evidence

Production: `frontend/app.js`. Tests: `tests/voiceLanguageSelection.test.js`. Standalone diagnostics: `scripts/verify_voice_language_selection.mjs`, `scripts/verify_voice_selection_integrity.py`. Engineering records: Decisions/Architecture/Flow/TestChecklist/Rollback/Handover/ProjectCompletion and this bug record.

Exclusive evidence: `output/public-speech-validation/voice-selection-20261006/` contains before map/source copy, before-failure and final test logs, mapping results, frozen live registration/raw Hindi-Marathi responses/report, integrity registration/report. Separate replay: `output/project-completion/voice-language-selection-replay-20261006.json`. Do not overwrite occupied results or edit registered tools/inputs. Full production/new tests/tools/docs diff read.

Existing site3002/PID29660 reused without restart; served app hash matches new source and empty user browser tab reloaded. No layout redesign or microphone permission request.

## Remaining Risk And Next Step

If Spoken language was already explicitly Hindi/Marathi, this fix does NOT explain incorrect words. Marathi fidelity and natural long legal speech/date-section recognition remain open; script/model metadata is not word accuracy. Need one intended sentence, actual inserted transcript and selected control to reproduce that failure before another production change. This information was requested once; no speculative model switch/tuning, retrieval compensation or fabricated corrections.

Rollback is one verified frontend before copy, after checking subsequent edits; see Rollback.md. No Git repository/commit available.
