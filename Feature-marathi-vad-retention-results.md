# Marathi VAD Retention Results

## Scope And Investigation

2026-10-04. One offline default-VAD audit on the eight already-inspected public Marathi development recordings. No Git repository/branch/commit. Frozen preregistration: `Feature-marathi-vad-retention-plan.md`. No production change, new recognizer transcripts, recognition candidate, training, download or reserved-holdout execution.

Question: is speech discarded before recognition? Production `backend/speech/transcribe.py recognize()` calls ordinary `WhisperModel.transcribe` with `vad_filter=True`, without custom VAD parameters. The installed ordinary path in `faster_whisper/transcribe.py` constructs `VadOptions()`, calls `get_speech_timestamps`, then `collect_chunks` and concatenation. It does not use the separate batched defaults.

Read the actual production worker, adapter, existing baseline/deadline tools, relevant tests and installed VAD/collection/ordinary-transcribe code before adding isolated `scripts/audit_marathi_vad.py`. The diagnostic uses those exact installed default functions, validates ordered/nonoverlapping sample bounds and checks retained library audio equals independent slicing without rescaling/reordering. It records complements, signal statistics, sample hashes and diagnostic UTC/elapsed/CPU; it never loads Whisper recognition weights or calls transcribe. Local bundled Silero VAD inference does run.

Defaults: threshold0.5, negative threshold derived0.35, minimum speech0ms, maximum speech duration unbounded, minimum silence2000ms, padding400ms. Runtime: faster-whisper1.2.1, onnxruntime1.30.0, numpy2.5.3, av18.1.0, ctranslate2 4.8.2. Thirty input identities and these versions frozen before execution, including plan/tool/test, previous baseline evidence, production worker, installed dependency code, bundled Silero asset, model identities and development audio.

Source: existing ConvoZenAI/indictelephony-bench public CC BY4.0 development manifest, collection pin `aa72c79dbb97644e50ae26cfa267d8fa81a37ce7`. Published telephone transcripts are not expert legal labels. No proof of speaker/training disjointness. Reserved eight calls stay undecoded.

## Actual Sample Retention

| Clip | Decoded seconds | Retained seconds | Removed samples | Retained fraction |
|---|---:|---:|---:|---:|
| mr-30 | 5.940 | 5.940 | 0 | 100% |
| mr-64 | 7.699 | 7.699 | 0 | 100% |
| mr-79 | 7.779 | 7.779 | 0 | 100% |
| mr-148 | 6.679 | 6.679 | 0 | 100% |
| mr-262 | 6.699 | 6.699 | 0 | 100% |
| mr-332 | 9.079 | 9.031 | 768 | 99.4713% |
| mr-458 | 7.580 | 7.580 | 0 | 100% |
| mr-539 | 8.401 | 8.401 | 0 | 100% |

All eight passed interval bounds and sample-by-sample library parity. Seven retained original sample hashes exactly. mr-332 retained samples768..145264; only samples0..768 (first0.048s) removed, no internal or trailing gaps. Removed prefix RMS0.00027617, peak0.00076294 and total signal-energy fraction2.7811e-8. These are signal measures, NOT speech annotations; do not label the prefix silent or assert no word onset was lost without competent review.

VAD sample removal cannot explain the previous transcript errors in the seven fully retained recordings on these decoded samples. It also removed no interior audio in mr-332. Evidence does not identify an exact recognizer/model root cause or prove VAD safe for other quiet/long recordings. Upstream microphone capture loss and later feature/decoder/skip behavior remain outside this audit.

## Validity And Environmental Limitation

Run:2026-10-04 09:13:57.694..09:13:58.798UTC (14:43:57.694..14:43:58.798 Asia/Calcutta). All8 rows completed without inference errors or120s overruns; maximum UTC/elapsed discrepancy0.835ms. Registered inputs unchanged. These tiny diagnostic timings include preparation/statistics and first VAD initialization; they are NOT new recognizer-speed measurements.

The restricted process could not obtain power records: original `report.json` correctly has `auditUsable:false`, `failure:null`, `powerEvidence.available:false`; command exited1. Do NOT call this an originally passed preregistered run or overwrite that flag. A separately authorized read-only query of the identical rounded-second window succeeded, with zero Kernel-Power506/507 events. It wrote new `power-evidence.json`, binding the original report SHA256, without rerunning VAD or changing reports/settings. This corroborates the static retention evidence but does not rewrite the original failed gate or establish hardware isolation/general latency guarantees.

## Tests And Protected Artifacts

- New synthetic sample-accounting tests5/5: full/empty retention, prefix/internal/suffix gaps, adjacent spans, invalid/bool/fractional bounds, overlap/reordered intervals. These are not speech-quality tests.
- Complete Python suite26/26 and JavaScript suite231/231, zero JS failures/skips. After audit, writable project TEMP/TMP and approved local test connections; no weakened tests.
- Official mapping benchmark IPC104/104 and BNS104/104 each Top1/Top3, same-crosswalk consistency only.
- Current resolved official-source replay5/5 Top1 and5/5 Top3, unchanged from before; separate `output/project-completion/marathi-vad-replay-20261004.json`. NOT independent lawyer validation. Historical sealed40% unchanged.
-83 protected/current files unchanged;53 additional distinct registered/prior-evidence/model/audio/library identities unchanged. All30 new registered inputs stable. Original failed report preserved; reserved decoding/assessment absent.
- Existing website healthy onhttp://localhost:3002/; no restart, UI, production speech/model/settings, translation, retrieval, date/gateway, corpus/provenance, labels or evaluation methodology change.

## Files, Reproduction And Rollback

Added diagnostic/test and frozen plan/separate results; updated Decisions/Architecture/Flow/TestChecklist/Rollback/ProjectCompletion/Marathi speech bug/Handover. Complete new source/tests and documentation diff read. No production diff or rollback.

Evidence: `output/public-speech-validation/vad-retention-20261004/{registration.json,observations.jsonl,report.json,power-evidence.json,protected-integrity.json,evidence-integrity.json}`. Registration SHA256 `889c5952b0252127f7df98bd0b44e7b2eb65bce82cdb6adb945928a3309dc48b`; raw SHA256 `3798346b09bbfeefd45b2096b36228f56f4fe08057e5ed7a98fdb450399a2e39`; original failed report SHA256 `8f19aaef81673e23d8ec25c0355fdea4734407eddef81b63fc87b0faafed252b`.

Executed `.venv-speech/Scripts/python.exe -m scripts.audit_marathi_vad register` then `run`. Existing registration/observations are refused; never overwrite or rerun into this evidence directory. A new experiment requires a separately frozen plan/output identity. Existing results can be inspected without inference. Tests: `.venv-speech/Scripts/python.exe -m unittest discover -s tests -p 'test_*.py' -v`, `npm test`, `npm run evaluate`. TEMP/TMP used existing `output/test-tmp-deadline-20261004`. Replays require a new filename rather than overwriting an old report.

Retire only the new diagnostic/test selectively after checking subsequent edits; preserve plan/registration/raw evidence and historical reports. Do not edit frozen tools to change acceptance after outcomes. No application/dependency/model rollback required.

## Decision And Next Single Task

Do NOT disable VAD, lower thresholds, add padding/keyword prompts, change retrieval to conceal ASR mistakes, or deploy rejected beam2/text-only/medium on this evidence. There is no demonstrated VAD bug justifying a production fix. Marathi fidelity remains OPEN; this diagnostic produces no new accuracy or generalization result.

Next: preregister a baseline-only segment/skip diagnostic on these inspected clips, keeping recognition settings unchanged and reserved calls untouched. Record emitted segment timestamps, tokens, average log probability, no-speech probability and existing skip logs, while requiring saved transcript parity. Inspect the installed ordinary `generate_segments`/`generate_with_fallback` decisions before proposing any change; probabilities are not accuracy confidence and missing words need appropriate reference evidence. Long native meaning/GU-KN intent, natural spoken legal dates/sections, physical microphone, gated translator access/runtime and independent bilingual/legal/IRAC review remain unresolved.
