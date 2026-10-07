# Bug: Speech Comparison Accepts Late Timings

Investigation started 2026-10-03; verification/documentation completed 2026-10-04. No Git branch/commit. This is an OFFLINE COMPARISON TOOL bug, not a confirmed production/UI timeout failure.

## Problem And Evidence

Saved development beam2 `mr-148.wav` reports 1,702.734 seconds despite the planned 120-second budget. The original runner used `Future.result(timeout=120)` but did not check elapsed time after a successful return. Its scorer required finite positive timings but no maximum. Thus a late result could be considered valid timing even when it should disqualify an experiment. Existing beam2 rejection remains independently justified by word/character regressions.

Local Python3.12.14 reports `perf_counter` implemented with QueryPerformanceCounter. Installed `Future.result()` returns a completed value after its condition wait without recomputing elapsed time. A synthetic notification test reproduces that control path; it does not physically suspend the laptop or prove native wait implementation details.

Read-only Kernel-Power506/507 records confirm Modern Standby during the saved run:

| 2026-10-03 Local Time (Asia/Calcutta) | Duration |
|---|---:|
| 21:09:01.392 to21:10:50.302 | 108.910s |
| 21:10:50.306 to21:39:01.905 | 1,691.598s |

The second interval is about28 minutes, close to the 1,702.734s measurement. **Strongly supported inference:** standby contributed most of that elapsed delay. Exact per-clip overlap and active decode time cannot be recovered: old rows have no request UTC/CPU timestamps. Do NOT subtract standby or remove outliers to manufacture a speed result.

Microsoft documents that [QueryPerformanceCounter includes standby/hibernate time](https://learn.microsoft.com/en-us/windows/win32/sysinfo/acquiring-high-resolution-time-stamps). [Windows wait timeout accounting differs in low-power states](https://learn.microsoft.com/en-us/windows/win32/api/synchapi/nf-synchapi-waitforsingleobject). These explain why a completed timed wait is not sufficient elapsed-time validation; this investigation does not prove which native wait branch the installed Python binary used.

## Decision And Implementation

One logical diagnostic reliability fix; production speech, UI, model, translation and retrieval untouched.

- `scripts/assess_marathi_decoder.py bounded_reply()`: retain existing Future timeout and bounded framing; independently measure around response wait and raise TimeoutError if a successful result arrives after120s. Existing finally block kills the worker on failure. This detects a late response AFTER resumption; no process can guarantee execution/termination while the host is asleep. It does not measure total upload/setup latency.
- `scripts/score_marathi_decoder.mjs assessPairs()`: both baseline/candidate decode timings must also be at most120,000ms. One overrun invalidates timing even if the median is favourable; word/character scoring formulas unchanged.
- `scripts/audit_speech_deadlines.py`: verify saved input identities, flag invalid/over-budget times, read bounded local power events in the run's file-metadata window, write fresh evidence only. No inference or audio download. UTC results must fall in the requested absolute window.
- `tests/test_speech_deadlines.py`:9 synthetic checks cover overruns, invalid/empty/error timings, notification return, resume-like clock jump, preserved framing/timeout, power intervals, event time-zone boundaries and non-overwrite evidence.
- `tests/marathiDecoderAssessment.test.js`: one regression checks late baseline/candidate rejection despite a fast median.

Initial audit queried an unintended time window because Get-WinEvent interpreted the supplied UTC DateTime as local. Its report in `deadline-audit-20261003/` is preserved but its POWER INTERVALS MUST NOT BE USED. Corrected query uses local filter values, returns UTC events and checks bounds, with a new regression. Corrected/postguard reports are separate, never replacements.

## Tests And Result

- Original16 saved jobs audited; one over-budget result found. No new inference or reserved-holdout decoding.
- Separate in-memory gate comparison: old `noErrors=true`, new `noErrors=false`; candidate acceptance stays false; word/character totals unchanged. Original assessment JSON not rewritten.
- Final full JavaScript suite231/231, zero failures/skips; all Python tests18/18 (9 new,2 decoder options,7 readiness).
- Sandbox reruns initially failed on restricted temporary files and localhost connections. Python passed with TEMP/TMP under the project; JavaScript229/231 under socket restrictions, then231/231 with approved local-network access. No test/app code weakened to bypass failures.
- Mapping benchmarkIPC/BNS104/104 each Top1/Top3, unchanged same-crosswalk consistency. Current resolved replay5/5 each under `output/project-completion/speech-deadline-final-replay-20261004.json`; NOT independent lawyer validation. Sealed historical40% unchanged.
-83 protected/current identities unchanged;34 additional frozen plan/model/audio/prior-results/backup identities unchanged. Eight reserved calls remain undecoded. Full diff read against before copies; new script/tests inspected.
- Existing app stopped responding after interruption; read-only approved check confirmed connection refused. Restarted unchanged service on3002; translation warmup ready. No production timeout change or accuracy/speed improvement claimed.

## Evidence And Rollback

Use `output/public-speech-validation/deadline-audit-20261003-postguard/{report.json,gate-check-20261004.json,final-protected-integrity-20261004.json,evidence-integrity-20261004.json}`. Original assessment, raw log, frozen plan and prior source hashes remain in their old locations. Before copies of the two changed tools are under `deadline-audit-20261003-corrected/`, named `<filename>.before`.

Reproduce audit with `.venv-speech/Scripts/python.exe scripts/audit_speech_deadlines.py --output-name fresh-deadline-run`; an existing directory is refused. Unit tests use `-m unittest discover -s tests -p 'test_*.py' -v`. Set TEMP/TMP to an existing writable project scratch directory when sandbox temporary-file permissions prevent fixtures. `npm test` needs access to its temporary localhost servers. Never run holdout or overwrite assessment JSON to verify this patch.

Rollback only the bounded_reply extraction/post-return check and two scorer upper bounds after comparing current tools. Retire new audit/tests selectively; retain all evidence. No production rollback; do not restore old application/model files. See `Rollback.md`.

## Remaining Risk And Next Single Step

Follow-up2026-10-04: the next baseline-only timing task described below is now completed, separately in `Feature-marathi-baseline-timing-results.md`. All8 inspected clips completed within120s, max UTC drift1.997ms, available windowed power log empty, prior HTTP transcript parity8/8. Inference median6.446s is a usable baseline, not a speed/quality improvement. Reserved8 remain undecoded; no production change. Next task is VAD retention inspection on inspected development audio only. Earlier evidence/results below are historical, not overwritten.

Marathi fidelity and long multilingual meaning/GU-KN intent remain unresolved. No legal speech/microphone/expert validation. This is not a remedy for general transcription latency. Next task: preregister and run an instrumented baseline-only timing check on ALREADY INSPECTED development audio, recording per-request UTC, elapsed time and CPU time. Keep reserved8 calls undecoded, retain beam3/settings, reject interrupted/standby runs, and avoid concurrent benchmarks. Only then propose another evidence-backed candidate. Do not alter power policy, force wake locks or deploy rejected beam2.
