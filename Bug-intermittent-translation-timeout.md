# Bug audit: Intermittent local translation timeout

Date: 2026-09-29. No Git branch or commit is available.

## Problem and investigation

An earlier selected-language analysis of `hi-29.wav` returned `TRANSLATION_TIMEOUT` after speech recognition. The relevant boundary is `backend/core/multilingual.js` `runTranslationWorker()` (180-second per-worker deadline) and `backend/translation/worker.py` (local NLLB input/output translation). Speech recognition and deterministic legal routing are separate. The original timeout happened while other local speech/translation diagnostics were active; resource contention is plausible, not proven.

The exact saved Hindi transcript was replayed with timing around each worker call. Hindi-to-English input translation completed in 13.2 seconds; English-to-Hindi presentation translation (seven short phrases) completed in 13.8 seconds. The same transcript completed through the live port-3001 `/api/analyze` endpoint in 27.2 seconds. Serial selected-language replays of all eight licensed local speech samples completed analysis on 8/8 with no timeout. The chosen input and final output languages matched in 8/8; the model's separate automatic language detection matched the source in only 3/8. Selection is not detection accuracy. These are observations on eight ordinary-speech samples, not a reliability or legal-accuracy estimate.

## Decision and result

No production fix: the timeout was not reproducible under isolated/serial load, so changing deadlines, concurrency, batching or fallback behavior would be speculative. Added only `--selected` to `scripts/verify_real_speech.mjs`, writing `output/voice-verification/real-speech/selected-observations.json` rather than overwriting the historical Auto observations. The diagnostic skips redundant typed-reference analysis in selected mode. No legal corpus, retrieval, Applicable Law Check, evaluation result or sealed artifact changed.

Completion does not establish translation quality. The saved English processing text for `hi-82.wav` is nonsensical against the annotated satellite-phone sentence; `mr-3.mp3` and `mr-8.mp3` also lose meaning. All source clips lack offence dates and statute sections, so CLARIFY/no IRAC is the observed workflow state, not a legal score. Native transcripts still contain word errors. Physical microphone and consented spoken legal-query recordings remain untested.

If the timeout recurs, record the exact reviewed transcript, clip duration, concurrent worker processes, memory/CPU pressure and whether input or presentation translation stalled. Then reproduce under the same load before changing production. For translation quality, obtain consented Hindi/Marathi legal utterances with date/section references and assess transcript and English processing text against their actual words; do not infer correctness from output language alone.
