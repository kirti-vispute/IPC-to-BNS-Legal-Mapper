# Long Marathi Recording Trace Results

2026-10-05. One isolated diagnostic task completed. No production/UI/model/dependency/legal pipeline change, restart, training, new download or reserved telephony holdout decoding. No Git repository/branch/commit. Baseline231 JavaScript/52 Python tests.

## What Was Reproduced

Reconstructed the old public stress recording from four manifest-ordered, previously inspected Marathi read-speech MP3s. All source hashes/provenance/license fields match the historical report. Whole clips repeat until60s, then use the original mono16kHz/int16 WAV recipe. Derived body SHA-256 `44ed4a19e50da09a37b5f07e9def964c6958f9a4867d6e285be44b52fb103951`;960737 samples,60.0460625s,38 clip occurrences. Duration/reference exactly match the historical report. Original HTTP request bytes were not saved, so archived-byte identity cannot be established.

The observer calls ACTUAL `backend/speech/transcribe.py recognize()` with selected Marathi and unchanged production settings, using the existing local CPUint8 model/four threads. All generation/split/transcribe overrides delegate to installed methods and preserve returned objects/segments. Actual VAD intervals are observed once, not recomputed with different parameters. This is the production recognition function inside an isolated child, not a new website path or UI-only demonstration.

## Attempts And Integrity

First34-input registered attempt slept at07:43:49Z, resumed08:00:12Z. Post-wait elapsed guard rejected the response; original `long-trace-20261005/` report remains `traceUsable:false`. Incremental events survived. Its aggregate bound count0 and parityfalse are fallback values from a missing accepted response, NOT evidence of zero saturation or different text. Do not use this attempt for timing/causal claims.

Separately registered41-input retry reuses identical body/settings/model and preserves all original artifacts. Only its standalone worker launcher/output directory differ. Retry08:03:26.369810Z ->08:03:54.501254Z completed successfully, with available bounded Kernel-Power506/507 evidence and no events; UTC/elapsed drift0.257ms. Request26.067s excludes model readiness and is NOT a controlled speed comparison with the old HTTP run. This event check does not cover every possible Windows power event.

**Retry exactly reproduces the entire historical HTTP transcript**, including its existing word errors and replacement character.13 segments and21 immediately saved events; no logger truncation. This links the observed boundary behavior to the website's saved output without changing the app.

## Actual Windows

Coordinates are in VAD-kept audio; here VAD kept every sample, so they also correspond to original input. Feature end60.04s is a frame-resolution boundary, not proof that spoken words in the final6.0625ms were lost.

| Window | Input Span | Generated Tokens | Source-Derived Bound | Next Audio Position | Result |
|---|---|---:|---:|---|---|
|0|0-30s|224|224|30s|Only initial timestamp50364; no closing timestamp/pair. Full window advances.|
|1|30-60s|224|224|52.16s|Paired timestamps; unfinished tail excluded from emitted text and remaining audio revisited.|
|2|52.16-60.04s|75|224|60.04s|Remaining audio processed; below bound.|

All three prompts are the forced Marathi transcription prefix. Beam3, temperature0, default VAD, no initial prompt, `condition_on_previous_text=False`, timestamped generation, no word alignment and no explicit `max_new_tokens` override. No no-speech skip. VAD retains960737/960737 samples, discarding0; it is NOT responsible for this recording's missing text.

### First Window Failure

Window0 reaches224 returned tokens and ends with8485, whose byte-level vocabulary representation ends in an incomplete Devanagari UTF-8 prefix. Decoding yields a trailing replacement character (U+FFFD). It has no closing timestamp. `_split_segments_by_timestamps` emits that malformed tail, assigns segment end30s and advances seek0->3000. Thus an emitted end time of30s is NOT evidence that all spoken content in that window was transcribed.

Registered assembly places the fifth clip0 occurrence at25.2525-26.7824375s, clip1 at26.7824375-28.4804375s and clip2 at28.4804375-30.0505s. Output ends during the fifth clip0-like phrase; it contains no subsequent clip1/clip2 phrase before the next window starts with clip3-like text. This sequence evidence is consistent with omitted tail content, not just alternative punctuation. Exact missing-word alignment remains unverified: source intervals bound whole read-speech files, not human-labelled word timestamps. Do not assign a lost-word percentage or claim the decoder's text ends at an acoustically measured instant.

### Second Window Recovery

Window1 also reaches224 and its raw decoded tail contains a replacement character. Unlike window0, valid paired timestamps reach52.16s; the library excludes unfinished raw text from emitted segments and resumes audio there. Final transcript retains only the first window's replacement character. Window2 then emits the remaining segments. This demonstrates that the two saturation cases are handled differently by the existing continuation logic.

## Diagnosis And Limits

Confirmed behavior: production-style generation reaches its token bound with an incomplete text tail, and the no-timestamp-pair branch emits that tail and advances the entire window without an exhaustion/completion check. That unsafe continuation behavior is reproduced on the real reconstructed recording, not merely a synthetic helper input. Original VAD and application transcript joining do not explain the problem; no translation/date/retrieval/IPC-BNS decision occurs in this speech-only test.

The installed decoder does not expose a stopping-reason field. Bound-length outputs plus incomplete byte-level tails strongly support budget-related truncation, but this trace is not a counterfactual intervention isolating all decoder causes. Shortening the windows must still be tested before a production fix is justified. Do not claim every cap-length result loses words, every Marathi error has this cause, the model is corrupt, or natural legal speech is validated. Earlier eight short clips remain below the bound and have separate unresolved word errors.

## Tests And Evaluation

- Six new tests:4 assembly/observer/assessment contracts and2 exact retry-launcher contracts. Full Python58/58 and JavaScript231/231; no failures/skips.
- Mapping benchmark:IPC104/104 and BNS104/104 Top-1/Top-3, unchanged. This uses the same official crosswalk, not independent legal validation.
- Separate current resolved official-source replay5/5 Top-1,5/5 Top-3, unchanged. Historical sealed result40% and original reference labels/report/methodology remain unchanged; NOT independent lawyer validation.
- 83 protected/current files unchanged. All checked prior and new commitments match; 235 distinct registered/protected files, no hash conflicts/changes. New attempt34 and retry41 inputs stable; reserved8 decoding/assessment outputs absent. Older speech reports/failed attempts retained.

## Files And Reason

| Files | Reason |
|---|---|
|`scripts/trace_long_marathi_speech.py`, `tests/test_long_speech_trace.py`, `Feature-long-speech-trace-plan.md`|Frozen assembly/real-worker observer/deadline assessment, with four regression contracts.|
|`scripts/retry_long_marathi_trace.py`, `tests/test_long_speech_retry.py`, `Feature-long-speech-trace-retry-plan.md`|Preserve sleep-invalidated attempt and redirect only isolated retry worker; two launcher contracts.|
|This results file, `Bug-long-speech-continuation.md`, `Bug-marathi-speech-quality.md`|Distinguish observed saturation/unsafe continuation from unverified missing-word extent and remaining fidelity errors.|
|`Decisions.md`, `Architecture.md`, `Flow.md`, `TestChecklist.md`, `Rollback.md`, `ProjectCompletion.md`, `Handover.md`|Record rationale, diagnostic-only responsibilities, actual execution, tests/integrity, retirement guidance and next action.|
|`output/public-speech-validation/long-trace-20261005/`|Original34-input registration, incremental events, failed observation/report. Immutable historical diagnostic evidence.|
|`output/public-speech-validation/long-trace-retry-20261005/`|Separate41-input registration, successful events/observation/report/integrity.|
|`output/project-completion/long-speech-trace-replay-20261005.json`|Current legal replay, not overwritten historical evaluation.|

Complete added source/tests/plans/results and documentation entries reviewed; no production rollback needed. Existing website was not touched or restarted.

## Next Single Task

Preregister ONE offline candidate: `chunk_length=15` instead of default30, on the SAME reconstructed recording and the eight previously inspected short development clips, with all other production options/model unchanged. Use fresh isolated model instances: installed feature extraction mutates its window-size state when `chunk_length` is supplied, so do not mix default/candidate calls in a persistent website worker. Compare bound hits, unfinished Unicode tails, timestamp/seek behavior, stress-reference phrase retention and short-clip text parity. Keep timing/power and protected-artifact gates. Shorter windows may split words or context;15s cannot guarantee absence of saturation on faster/dense speech. No production deployment, holdout decoding, retrieval compensation or accuracy claim until evidence supports it.
