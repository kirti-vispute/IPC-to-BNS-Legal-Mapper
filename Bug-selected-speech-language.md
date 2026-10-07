# Bug: Hindi/Marathi recording language and transcript

Date: 2026-09-29. No Git repository/commit available.

## Problem and investigation

The previous Auto path used a local tiny Whisper model. In eight licensed human clips (four Hindi FLEURS, four Marathi Tatoeba-derived, stored only under ignored `output/voice-verification/real-speech/`), Marathi was not identified correctly in any of four clips and native transcripts were often Romanized or unrelated. The error occurred in speech recognition before translation, not in the legal date gateway. A no-prompt tiny trial did not fix language codes. On the same clips, a pinned local base model remained weak; a pinned small model with explicitly chosen source language and no English legal prompt produced recognizable Devanagari in all eight, though words were still wrong. Clips are ordinary read speech with no dates/sections, not representative legal-query recordings. Dataset annotations are not expert legal labels.

## Decision and implementation

Add an optional speaker-selected Hindi/Marathi control. Keep Auto/tiny and its confidence guard. For a selected language only, use local small model decoding in that language, preserve the model-detected code separately, set model confidence to null, and pass the chosen source through the existing multilingual adapter. The transcript stays editable and is not analyzed automatically. No legal/routing/retrieval/evaluation change.

Changed: `frontend/index.html`, `frontend/style.css`, `frontend/app.js`, `backend/server.js`, `backend/core/transcriber.js`, `backend/core/multilingual.js`, `backend/speech/transcribe.py`, `scripts/setup_local_speech.py`. Added regression coverage in `tests/transcriber.test.js`, `tests/multilingualVoice.test.js`, `tests/voiceInput.test.js`.

## Verification and limits

Targeted voice tests passed. Eight selected real recordings returned Devanagari text, but all still had transcription errors. Live HTTP transcription followed by live HTTP analysis succeeded for `hi-44.wav` (Hindi output, English processing text “Police say the body is about a day old.”) and `mr-8.mp3` (Marathi output, English processing text “Why would he have a corner?”). The Marathi translation is semantically questionable against the source audio. One attempted full real-audio analysis of the longest Hindi clip failed with `TRANSLATION_TIMEOUT`, so long-clip translation is not certified. Controlled adapter/UI tests verify selected-language propagation and output target without inventing confidence; they do not measure acoustic or machine-translation quality. Physical microphone capture and controlled spoken dates/IPC/BNS references have not been verified. Do not treat selected language as proof that the speaker used it; users must review the transcript before Analyze.

Full serialized tests, official mapping and resolved replay results are recorded in `TestChecklist.md`. The sealed blind prediction/report and official labels remain historical and unchanged. Next: use consented Hindi/Marathi legal-query recordings to evaluate word/date/section fidelity and diagnose real NLLB timeout separately; do not change the legal gate or evaluation artifacts to mask either problem.

Follow-up on 2026-09-29: the exact previously timed-out transcript and all eight selected-language audio clips completed in serial replays; the timeout is intermittent, not a confirmed length limit. Output language was preserved in 8/8, while the model's own detected language matched the source in only 3/8. Multiple processing translations lost meaning. See `Bug-intermittent-translation-timeout.md` and ignored `selected-observations.json`. No production change was made in that follow-up.
