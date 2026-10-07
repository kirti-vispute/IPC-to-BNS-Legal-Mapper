# Production Speech Continuation Audit Results

2026-10-05. Read-only audit completed; no production fix, recognizer inference, model load, service restart, holdout submission or accuracy improvement. No Git repository/branch/commit. Baseline231 JavaScript/48 Python tests.

## Actual Website Path

1. `frontend/app.js toggleRecording()` captures one recording; automatic stop90s. `handleRecordingStopped()` sends the complete Blob to `/api/transcribe`, with selected language and a130s browser deadline (Hindi190s).
2. `backend/server.js` reads up to10MiB, then calls `transcribeAudio()` in `backend/core/transcriber.js`.
3. Selected Marathi prefers existing `marathi-small-ct2`, falling back to existing small if unavailable; selected Hindi uses medium, Auto uses tiny. Config/environment can override paths. Hindi/Marathi reuse a persistent line-framed Python worker; "stream" means whole-request transport/model reuse, NOT live partial audio decoding. Worker deadlines are120s/180s respectively; timeout rejects the request rather than returning partial text.
4. `backend/speech/transcribe.py recognize()` decodes16kHz, rejects >90s, then invokes ordinary `WhisperModel.transcribe`: transcription task, beam3, temperature0, default VAD, no preceding-text conditioning. Selected Hindi/Marathi have no English initial prompt. It consumes ALL yielded segments, joins their text and returns the complete string; no application-side word/token clipping was found.
5. Installed faster-whisper1.2.1 concatenates VAD-kept audio, uses default30s feature windows and a seek loop, then restores timestamps. Selected Marathi prompt is `[50258,50320,50359]`, WITHOUT the no-timestamps token. `condition_on_previous_text=False` resets text context, not the audio continuation loop. `word_timestamps=False` means word alignment is not used to repair seek positions.
6. Browser inserts the returned native transcript into the editable query; the user must review it and press Analyze. Existing checked-English translation, date extraction, Applicable Law Check, corpus isolation, retrieval, citations and IRAC are unchanged. No diagnostic tool is called by this path.

## Token Bound

Worker does not override `max_new_tokens`, `chunk_length`, `without_timestamps` or `word_timestamps`. Installed model default `max_length=448`. The versioned [CTranslate2 4.8.2 implementation](https://raw.githubusercontent.com/OpenNMT/CTranslate2/v4.8.2/src/models/whisper.cc) gives an upper bound of 224 decoding steps for this three-special-token prompt; timestamps share that budget and returned hypotheses omit EOS. This is source-derived for the pinned runtime, not an observed production exhaustion. Earlier low-cap probes corroborated the implementation's cap behavior, but are not a 448-cap acoustic experiment.

The previous offline196->384 comparison used a DIFFERENT no-timestamp path. Its98-step exhaustion cannot be treated as the website's limit or as the cause of website errors.

## Saved Recording Evidence

These eight inspected development clips use production-style timestamped options and exactly match their saved HTTP baseline transcripts. All emit one window/one segment, with no no-speech skip.

| Clip | Original Seconds | Generated Tokens Including Timestamps | At224 Bound |
|---|---:|---:|---|
| mr-30 |5.940|60|No|
| mr-64 |7.699|87|No|
| mr-79 |7.779|71|No|
| mr-148 |6.679|113|No|
| mr-262 |6.699|74|No|
| mr-332 |9.079|119|No|
| mr-458 |7.580|80|No|
| mr-539 |8.401|135|No|

Therefore these known short-clip recognition errors are NOT explained by reaching the audited token bound. Their word errors remain unresolved; matching a baseline transcript is not matching the spoken words. None of these clips covers a30s window or tests long-sentence fidelity.

Supplemental existing evidence, inspected AFTER audit registration: `output/project-completion/long-public-speech.json` records a60.0460625s HTTP response from repeated licensed human read-speech clips, with transcription errors including one replacement character. `scripts/verify_public_long_speech.py` assembles this repeated audio and calls the website endpoint. Neither artifact records generated tokens, seek positions, VAD intervals or stopping reason. It cannot establish cap exhaustion, omitted-audio boundaries, spontaneous long-sentence quality or faithful dates/sections. Its hashes are saved separately in `integrity.json`; no old report was edited or old stress tool executed.

## Executed Continuation Controls

The audit calls the ACTUAL installed `_split_segments_by_timestamps` helper without initializing a model. Synthetic inputs below are not speech recordings or possible-output frequency estimates.

| Synthetic Pattern In30s Window | Next Audio Position | Meaning |
|---|---:|---|
|224 tokens, no consecutive timestamp pair|30s|Whole window advances; helper does not check cap/EOS.|
|224 tokens, single ending timestamp at1s|30s|Emitted end1s does not force revisit of the remaining audio.|
|Completed pair at2s followed by unfinished text|2s|Unfinished tail is excluded now and remaining audio is revisited.|
|Two completed segments with single ending timestamp|30s|Full advance, based on model-indicated completion.|

**Conditional risk:** if actual generation exhausts its budget without a valid unfinished paired-timestamp tail, full-window advance could leave undecoded speech unrevisited. The helper receives no stop-reason/cap indicator; ordinary quality fallback examines repetition/log probability/no-speech, not explicit cap exhaustion. Temperature0 supplies only one attempt. This proves a control-flow risk, NOT that it caused the saved long-recording errors. No absence of words can be inferred from model timestamps alone.

## Tests And Integrity

- Four new control-flow/evidence tests pass; full Python52/52 and JavaScript231/231, no failures/skips.
- Same-crosswalk IPC and BNS benchmark104/104 each Top-1/Top-3, unchanged. This is not independent legal validation.
- Separate current resolved official-source replay5/5 Top-1 and5/5 Top-3, unchanged from the preceding session. Historical sealed official result40% and its labels/report/methodology remain unchanged; NOT independent lawyer validation.
- 83 protected/current hashes, 19 new registered inputs, 39 earlier segment commitments and 144 commitments in nine preceding comparison registrations remain unchanged. Reserved eight decoding/assessment outputs absent. No production/UI/model/library/legal change.

New files: frozen plan; standalone `scripts/audit_speech_continuation.py`; `tests/test_speech_continuation.py`; this results document; exclusive `output/public-speech-validation/continuation-audit-20261005/{registration.json,report.json,integrity.json}`; separate `output/project-completion/speech-continuation-replay-20261005.json`. Engineering handover/flow/decision/checklist/rollback/completion and existing Marathi speech bug documentation updated. Complete additions reviewed; no production rollback needed.

## Next Single Task

Preregister a diagnostic-only trace of the SAME existing60s assembled public recording using unchanged production timestamped options. Register its manifest/clip checksums and complete assembly recipe; record every generation window's tokens, timestamps, prompt, seek before/after and cap-relative length, plus VAD retention, output and a bounded uninterrupted execution window. Preserve the original report; do not execute its overwrite-capable script. No reserved holdout or production tuning. Compare expected repeated phrases carefully, treating them only as a stress-control reference, not natural legal-speech validation. Only after a real cap/seek failure is demonstrated should a minimal continuation change be proposed.
