# Marathi VAD Retention Investigation Plan

Preregistered 2026-10-04 before this audit. Freeze this plan, audit source/tests, existing diagnostic helpers, installed VAD/audio/transcribe code and bundled Silero model, current model identities and development fixtures before execution. Results belong in a separate document, not an edit of this plan.

## Question And Scope

Does the unchanged production-default VAD remove audio samples from the eight already-inspected public Marathi development recordings before speech recognition? Production `backend/speech/transcribe.py recognize()` calls ordinary `WhisperModel.transcribe` with `vad_filter=True` and no `vad_parameters`; the installed ordinary path uses `VadOptions()` and `get_speech_timestamps`, then `collect_chunks` and concatenation. This is NOT the batched inference path.

Use only the existing manifest in `output/public-speech-validation/fresh-marathi-20261003/`. Eight calls, once in manifest order, verified audio hashes. Do not submit reserved holdout recordings, generate new speech transcripts, load a Whisper recognizer, try alternative VAD thresholds, tune prompts/settings or change production. Local bundled VAD inference is allowed; no network/download/dependency installation.

## Measurement And Interpretation

Run the exact installed default `get_speech_timestamps` and `collect_chunks` on audio decoded at16000Hz. Validate sample-level intervals: integers, positive lengths, ordered, nonoverlapping, within input bounds. Record retained spans, complementary discarded spans, original/retained sample counts and durations. Assert concatenated library output equals independently sliced retained samples, with no rescaling/reordering. Save sample hashes, removed signal RMS/peak/energy fraction, and per-request UTC/elapsed/CPU only as diagnostic evidence, not a speed benchmark. Signal energy is NOT a speech annotation or proof of missing words.

If all samples survive for a recording, VAD trimming cannot explain its saved transcript errors on this decoded audio. If any samples are removed, no word-loss conclusion without time-aligned speech annotations or competent audio review. Full retention does not rule out later acoustic/feature/decoder errors, missing microphone audio upstream, or VAD errors on unseen/long/quiet recordings. Do not guess a model-quality root cause from retention alone.

## Gates, Preservation And Next Action

New exclusive directory `output/public-speech-validation/vad-retention-20261004/`, with registration, observations and report. Require all8 rows, valid bounds/library parity, registered hashes/package versions unchanged, no error, no request over120s, worker UTC/elapsed discrepancy over1s or standby during available bounded local Kernel-Power506/507 records. Unavailable logs invalidate this run, not evidence of no standby. No wake locks or power-policy changes. Preserve partial failure; no outcome-driven retry or candidate in this task.

After audit, run complete JS/Python tests, official mapping benchmark, separate current resolved replay and protected/evidence hash checks. Do not change historical sealed predictions/reference labels/reports/methodology, corpus/provenance, gateway, retrieval, translation or UI. Update decisions/architecture/flow/test checklist/rollback/Marathi bug/handover with actual evidence and one next task. No production fix is authorized by this diagnostic alone.
