# Final Speech Window: Read-Only Diagnosis

2026-10-06. No production fix, model initialization, neural inference, audio decoding, download or reserved holdout submission. Starting231 JavaScript/62 Python tests; no Git repository/branch/commit.

## Reproduction

The rejected offline15s candidate's saved60.0460625s recording leaves4 feature frames after seek6000. The stored decoder result contains224 tokens, only initial timestamp50364 and repetitive text. One segment is emitted at60.0->60.04s. This is candidate evidence, not proof that all production recordings have this particular tiny-tail failure.

Registered82 source/evidence/tool/test/plan commitments before the first control replay. It failed because consuming a full synthetic clip after a saved baseline window's partial seek3000->5216 invokes another generation: a diagnostic collection error, not new recognition evidence. Original registration/failure remain under `tail-audit-20261006/`.

A separately registered87-input first-window collector delegates original `WhisperModel.generate_segments`, yields its original first-window segments, then closes its iterator. It changes neither generated results nor split/seek logic. This preserves the eight saved windows' original scope. `tail-audit-first-window-20261006/report.json` verifies8/8 decoded-text, raw split-event and seek matches across five15s candidate and three30s baseline windows. Reconstructed average log probabilities match within1e-9. No registered tool was edited after execution began.

The existing tokenizer decodes saved tokens. A stub supplies their recorded generation scores/tokens and dummy features let the installed methods reproduce control behavior. This is NOT fresh speech inference, actual encoder-feature identity or an acoustic experiment. Raw split events precede VAD timestamp restoration; comparison deliberately uses them rather than claiming restored endpoints are identical.

## Confirmed Control Cause

| Stage | Saved evidence and original behavior |
|---|---|
| Candidate window slicing | `generate_segments` processes any positive remainder: min(1500,6004-6000)=4 frames. No minimum speech/context-duration guard. |
| Encoder padding | Installed `pad_or_trim` always pads to3000 frames. Four frames become80x3000, with2996 appended zero columns:99.8667% padding. Even full15s windows are padded50%; shorter chunk length does not shrink encoder input or generation budget. |
| Fixed generation budget | max_length448 and previously verified source-derived224 bound apply independently of remaining duration. The saved4-frame result reaches224 tokens. Actual neural stop reason remains unexposed. |
| Repetition check | Compression13.611111 exceeds2.4. Original fallback logs failure, but temperatures=[0] gives only one result; after exhausting alternatives it returns the highest-average-logprob result, even if every result failed. This check is not a rejection gate. |
| Silence check | noSpeechProbability0.7265628576 exceeds0.6, but avgLogprob-0.1431927448 exceeds-1.0. Original `generate_segments` clears should_skip because the average score is high. No silence-skip log is produced. |
| Timestamp splitting | Only initial timestamp, no ending pair. Original helper emits all returned text over nominal segment_duration0.04s and advances6000->6004. It does not reject saturation or verify a closing timestamp. |
| Application join | Unchanged `recognize` joins all nonempty emitted segment text. It adds no cap/repetition/contradictory-silence warning, so the tail reaches the editable transcript. |

Relevant installed sources: `.venv-speech/Lib/site-packages/faster_whisper/transcribe.py:1024` (split), `:1173` (slice/pad), `:1215` (silence override), `:1402` (fallback), `.venv-speech/Lib/site-packages/faster_whisper/audio.py:111` (pad default), `backend/speech/transcribe.py:17` (recognize). No library or application edit.

This explains HOW already-generated repetition survives the controls. Padding and small context are consistent risk factors, but the audit does not establish WHY the neural model selected these tokens, whether the final waveform is silent, or whether it contains a legitimate word ending. Do not convert nominal4-frame0.04s into a claim of no audio: the original samples beyond60 seconds total737, or0.0460625s, and feature extraction has centered FFT/padding and frame rounding.

## Additional Boundary Finding

Candidate window2 has a final timestamp token51127, representing15.26s relative to its30.0s start. With single ending timestamp, the original helper preserves end45.26s but advances seek4500 (45.0s). Next window starts45.0s, so the raw boundary overlaps0.26s. Synthetic test reproduces the same unclamped behavior. Timestamp agreement/complete seek alone therefore cannot establish accurate word coverage.

Baseline window1 correctly revisits unfinished audio at52.16s; baseline last window has788 real frames and75 tokens. This is distinct from candidate's4-frame224-token tail. All five candidate windows and two baseline windows exceed the compression threshold, including portions of the intentionally repeated source. Generic compression rejection would incorrectly remove source-supported repetition.

## Safe Direction, Not An Implemented Fix

Reject deploying15s. Do not remove every short remainder, globally raise silence thresholds, strip repetitions, clamp all timestamps as an accuracy fix, introduce higher temperatures or mask transcript errors through legal retrieval. Such changes could delete real speech, dates, sections or deliberate repetition and are not justified by this audit.

Next single task: preregister ONE OFFLINE review-warning guard for cap-length output lacking a completed ending timestamp, with contradictory silence/repetition evidence recorded separately. Preserve transcript/audio and flag uncertainty; do not invent words or silently discard the tail. Test saved30s/15s evidence, synthetic high-confidence/high-silence and valid-ending controls, legitimate repetition and existing short samples' saved outputs before proposing production integration. A warning is not improved recognition accuracy or a remedy for every Marathi error; retry/overlap/acoustic validation remains separate work.

## Verification And Handoff

- Eight new tests:6 installed control contracts and2 first-window collector contracts. Full Python70/70 and JavaScript231/231, no failures/skips.
- Same-crosswalk mapping IPC/BNS104/104 each Top-1/Top-3, unchanged. Separate current resolved replay5/5 each: `output/project-completion/speech-tail-audit-replay-20261006.json`.
- Historical sealed40%, official-source labels/report/methodology, legal corpus/provenance, routing and UI unchanged. These benchmarks are NOT independent lawyer validation or multilingual speech accuracy.
- 83 protected/current files and16 registration groups merge255 distinct checked identities: no changes/conflicts. Reserved telephony8 decoding/assessment outputs remain absent.
- New tools: `scripts/audit_final_speech_window.py`, `scripts/audit_first_speech_window.py`; tests: `tests/test_final_speech_window.py`, `tests/test_first_speech_window.py`; two frozen plans, this results document and `Bug-speech-tail-replay.md`. Engineering handover updated. Server imports neither tool.
- Evidence: original82-input registration/failure; separate87-input registration/report/integrity. Keep both and every prior speech/evaluation artifact. No production rollback required; retiring diagnostics means inspecting subsequent imports and retiring only their entry points/tests, not restoring older application files.

Marathi short-word fidelity, spontaneous long legal speech/date-section accuracy, physical microphone/native meaning, GU/KN intent, gated translator runtime and independent bilingual/legal/IRAC review remain open. All required command sessions finished; existing website untouched.
