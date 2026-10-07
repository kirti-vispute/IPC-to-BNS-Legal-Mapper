# Bug: Selected Hindi transcription latency

Date: 2026-09-30. No Git repository, branch or commit exists in this workspace.

## Problem and investigation

Two consecutive live `/api/transcribe?language=hi` calls using the same licensed public Hindi FLEURS clip each took 41.9 seconds. Selected Hindi already forced Hindi decoding, but `backend/speech/transcribe.py recognize()` still ran language detection first; a direct profile measured 8.6 seconds for that unused step. Each request also started a fresh Python worker and loaded the medium model; standalone loading took about 5 seconds. The comparable Marathi path already reused a bounded local worker. The clip's reference contains `लूट`; the recognized transcript retained that term, but the downstream English translation changed it to an unrelated protest concept. That translation defect is not addressed by this speed-only fix.

The public dataset search for a verified spoken legal-theft/date query did not produce a usable case in this session (zero Hindi validation hits for `चोरी`, other searches timed out or errored). No user recording was available. Do not infer legal-word accuracy from these timings.

## Decision and implementation

Extend the existing selected-Marathi line-framed worker to explicitly selected Hindi. One shared worker holds only the currently selected model; switching language or model path kills the previous worker. Skip language detection for both explicitly selected languages, return no fabricated detected-language confidence, and preserve Auto's one-shot detection and confidence guard. No ASR model, beam/VAD, audio limit, browser deadline, translation, UI, date routing, retrieval, corpus, citation or IRAC change.

Production: `backend/core/transcriber.js`, `backend/speech/transcribe.py`. Regression: `tests/transcriber.test.js` verifies reuse, switching, crash and timeout behavior. Exact pre-change copies are under ignored `.voice-rollback/selected-hindi-stream/`.

## Tests and result

Focused transcriber tests: 25/25. Full serialized suite: 168/168, zero failures/skips. Mapping benchmark: IPC and BNS each 104/104 Top-1 and Top-3, crosswalk-derived rather than independent legal validation. No-write resolved official-source replay: 5/5 Top-1 and acceptable Top-3. Historical sealed predictions, official labels/report and legal corpus/provenance checksums matched all nine protected baselines.

After restarting the project server, the same public Hindi clip took 23.5 then 20.6 seconds through the live HTTP endpoint; its transcript was unchanged. A direct Hindi-to-Marathi model switch returned the expected respective native transcripts. CPU load and audio duration vary, so these times are local observations, not a service-level promise.

## Remaining risks

Hindi medium on CPU still takes roughly 20 seconds for this clip; longer recordings may take much longer. Marathi ASR and NLLB translation can still alter legal concepts, dates or section words, and an erroneous speech transcript cannot be repaired without independently known audio content. The original reported `चोरी` recording, public spoken legal-date/section fixtures, and a real microphone test are unavailable. Keep the editable transcript and manual Analyze step; do not claim general speech or legal accuracy.
