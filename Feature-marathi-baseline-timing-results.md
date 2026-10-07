# Marathi Baseline Timing Results

## Scope And Decision

2026-10-04. One offline baseline-only measurement, not a production fix or candidate assessment. Frozen plan: `Feature-marathi-baseline-timing-plan.md`. No Git repository/branch/commit is available.

Why: the previous paired decoder comparison included a standby-contaminated timing outlier without request-level UTC/CPU evidence. Measure the unchanged decoder before proposing another setting. Do not subtract sleep, remove outliers or retest rejected beam2 as if it were new evidence.

Eight previously inspected public development recordings from ConvoZenAI/indictelephony-bench, CC BY 4.0, collection revision `aa72c79dbb97644e50ae26cfa267d8fa81a37ce7`. Published references are not independently verified legal labels; calls are not proven speaker- or training-disjoint. No training occurred. Eight separate reserved holdout calls were not decoded.

## Implementation

New isolated `scripts/profile_marathi_baseline.py` freezes hashes before inference, uses a separate persistent worker and writes exclusive evidence. It imports the existing diagnostic bounded-response helper, not the production server. Settings remain the existing Marathi-tuned small model, CPU int8/four threads, explicit mr, transcribe, beam3, temperature0, VAD on, previous-text conditioning off and prompt None; timestamp defaults unchanged.

Record parent request UTC/elapsed, worker UTC/elapsed, audio preparation elapsed and inference elapsed/process CPU separately. CPU aggregates worker threads and can exceed elapsed time. The inference span covers `model.transcribe()` and materializing segments: VAD/features/encoder/search are not separately timed. Read bounded local Kernel-Power506/507 events after inference. Missing logs, any event, elapsed over120s, UTC drift over1s, incomplete responses, transcript mismatch or changed registered inputs invalidate the run. No power-policy/wake-lock changes or concurrent agent tests/benchmarks during inference.

## Measured Result

Run window: 2026-10-04 08:57:04..08:58:06 UTC (14:27:04..14:28:06 Asia/Calcutta). All eight completed. Available bounded power records contained no506/507 events; maximum worker UTC/elapsed discrepancy was1.997ms. Registered inputs and all eight transcript strings match the saved production HTTP baseline exactly. The run satisfies its preregistered measurement gates, not hardware isolation or general latency guarantees.

| Clip | Parent request seconds | Inference elapsed seconds | Inference CPU seconds |
|---|---:|---:|---:|
| mr-30 (first decode) | 6.500 | 6.455 | 16.906 |
| mr-64 | 4.915 | 4.889 | 18.156 |
| mr-79 | 4.437 | 4.408 | 16.828 |
| mr-148 | 8.200 | 8.169 | 25.375 |
| mr-262 | 6.059 | 6.025 | 20.438 |
| mr-332 | 7.979 | 7.937 | 25.797 |
| mr-458 | 6.471 | 6.437 | 23.594 |
| mr-539 | 10.827 | 10.789 | 29.656 |

All-eight inference median6.446s; remaining-seven median6.437s; parent median6.485s. Inference range4.408..10.789s. Total inference55.110s, audio preparation0.274s, aggregate inference CPU176.750s. Model constructor0.757s elapsed/1.453s CPU; parent startup until first request6.010s includes imports and verification, so constructor time is not total cold startup.

Almost all measured request time is inside inference, not audio preparation. These measurements do not distinguish VAD/feature/encoder/search costs. Do not claim a speed improvement against the interrupted older run or equate isolated timings with browser/HTTP response time.

Transcript parity8/8 is NOT transcription accuracy8/8. Unchanged development text retains the earlier strict published-reference microWER64.44% and CER33.43%, including spelling/spacing/transliteration differences. No speech-quality improvement, unseen-query result, legal speech/date/section validation, physical microphone test or expert validation is claimed.

## Tests And Evaluation Integrity

- New synthetic timing contracts3/3; complete Python suite21/21. Covers completeness/parity/hash/power gates, resume-clock drift, late replies and invalid timings; aggregate CPU may exceed elapsed time.
- Full JavaScript suite231/231, zero failures/skips. Tests ran after inference. Writable project TEMP/TMP and approved localhost test connections were needed; no tests weakened.
- Official mapping benchmark: IPC104/104 and BNS104/104 each Top1/Top3. This is same-crosswalk consistency, not independent lawyer validation.
- Separate current resolved replay:5/5 Top1 and5/5 Top3, unchanged from before this diagnostic. `output/project-completion/marathi-baseline-timing-replay-20261004.json` is a new replay, not a replacement for sealed predictions.
- Historical sealed official-source result40% remains unchanged. No labels, methodology, sealed predictions, corpus/provenance, Applicable Law Check, production source/model or UI changed.
-83 protected/current files unchanged;40 additional distinct frozen evidence/model/audio/tool-input identities unchanged. Reserved8 holdout calls remain undecoded. Healthok onhttp://localhost:3002/ without restart this session.

## Evidence, Reproduction And Rollback

Evidence directory: `output/public-speech-validation/baseline-timing-20261004/`. Files: `registration.json`, `observations.jsonl`, `report.json`, `derived-stats.json`, `protected-integrity.json`, `evidence-integrity.json`. Registration SHA256 `97e74ca37703819723cc3607a62f4ad646c4a51d2e65f5fc644ced4db77c3a34`; raw observations SHA256 `df8e4f6664c5385e32814e4e583ac4b6560d855e739c4c2023f095b1ba87f5e4`.

The registration/run commands were `.venv-speech/Scripts/python.exe -m scripts.profile_marathi_baseline register` then `run`. Existing output is refused: do not rerun/overwrite it or edit the frozen plan/tools to change acceptance after seeing results. A later measurement needs a separately preregistered output identity. Tests: `.venv-speech/Scripts/python.exe -m unittest discover -s tests -p 'test_*.py' -v`, `npm test`, `npm run evaluate`, and `node scripts/project_completion_validation.mjs replay marathi-baseline-timing-replay-20261004.json` (existing replay output must not be overwritten). Set TEMP/TMP to an existing writable project scratch directory if necessary.

No production rollback is required. Retire only the new profiler/test selectively after checking subsequent edits; retain registration, frozen plan and all evidence. Complete added source/tests and documentation diff read before closing.

## Remaining Issue And Next Single Task

Marathi fidelity remains OPEN; reliable timing is not a repair. Next: inspect VAD retention/segmentation on these already-inspected development recordings, without changing production or decoding reserved holdout. Establish whether speech is discarded before recognition before proposing one evidence-backed candidate. Long multilingual meaning/GU-KN intent, natural legal dates/sections, physical microphone, gated candidate runtime and independent bilingual/legal/IRAC review remain unresolved. Do not hide ASR errors with retrieval changes or deploy rejected decoder settings.
