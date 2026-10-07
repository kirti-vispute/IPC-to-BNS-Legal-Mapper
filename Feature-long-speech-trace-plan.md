# Long Marathi Speech Trace Plan

Date:2026-10-05. One diagnostic task, no production change. No Git repository; baseline231 JavaScript/52 Python tests. Marathi fidelity and long-window continuation remain unresolved.

Register this plan, tool/tests/helper/worker/library/runtime/model files, previous continuation evidence, protected baseline, old long-speech report/tool, and four previously inspected Marathi MP3s/manifest before recognition. These older read-speech clips are NOT the eight reserved telephony holdout recordings. Respect recorded CC BY-NC4.0 terms; no redistribution, training or new download.

Reconstruct the old60-second stress recipe: decode manifest-ordered clips16kHz, repeat whole clips until at least960000 samples, clamp[-1,1], multiply32767, encode mono signed little-endian16-bit WAV. Register derived body hash/sample count/repetition intervals/expected dataset transcript. Verify duration and reference against old report; original request bytes are unavailable, so do not claim archived-byte identity. Preserve old report and do NOT execute its overwrite-capable script.

Use an isolated child with existing local Marathi model CPUint8/four threads. Invoke actual `backend/speech/transcribe.py recognize()` with its unchanged arguments/defaults. Observer methods delegate to installed ordinary generation/split/transcribe and return identical objects/results; only record metadata. Wrap the actual VAD call once, retaining returned intervals unchanged. Save each generation/split/emission event immediately to exclusive JSONL, including UTC/elapsed token budget/seek positions. Keep source-derived224 bound separate from unavailable decoder stop reason. Record current transcript and historical text parity, not word accuracy.

Bound readiness and one full recording request to120s each using existing post-wait elapsed guard; always terminate/join child. Verify UTC/elapsed drift and bounded local Kernel-Power506/507 event evidence; no power-setting changes. Preserve interrupted/failed evidence, never rerun into occupied outputs. No causal/speed claim from an interrupted run. Output exclusively `output/public-speech-validation/long-trace-20261005/`.

Compare VAD-retained input/window spans, per-window cap-relative lengths, emitted text and seek continuation. Artificial repetition is a stress control, not spontaneous legal-speech validation; no invented gold/legal labels. If cap exhaustion is observed, distinguish resulting full-window advance from actual missing words, which require time-aligned source evidence. Do not implement a continuation fix in this task.

Run new observer/assembly/assessment tests, full existing suites, official mapping benchmark and a separate resolved replay. Recheck protected/registered hashes and reserved holdout output absence. Update engineering handover/decision/flow/bug/checklist/rollback with evidence and next single task.
