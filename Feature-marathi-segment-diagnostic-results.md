# Marathi Segment And Skip Diagnostic Results

## Scope And Reason

2026-10-04. One frozen baseline-only investigation on eight previously inspected public Marathi development calls. No Git repository/branch/commit. Plan: `Feature-marathi-segment-diagnostic-plan.md`. No production fix, new candidate, settings change, training, download or reserved-holdout execution.

The previous sample-retention audit ruled out VAD trimming as the explanation for errors in seven fully retained clips; the eighth lost only a48ms prefix. This investigation asks whether the recognizer later rejects a window as no speech or emits the incorrect words itself.

Read production `backend/speech/transcribe.py`, relevant existing diagnostic/helpers/tests and installed ordinary `generate_segments`/`generate_with_fallback`, tokenizer and VAD paths before coding. Added isolated `scripts/inspect_marathi_segments.py` and four synthetic tests. An offline subclass delegates exactly once to the original method, records the returned result and returns that identical tuple. It does not change prompt, scores, tokens, thresholds or the library's control flow. Bounded original debug logs corroborate the mirrored skip guard; emitted segments retain their actual fields.

Thirty-nine input identities/runtime versions frozen before recognition. Same Marathi-tuned small model, CPUint8/four threads, explicit mr/transcribe, beam3/temp0, VAD on, previous conditioning off, prompt/hotwords None, default timestamps. A separate persistent worker, eight calls once in manifest order, no concurrent agent tests/benchmarks. Existing public CC BY4.0 ConvoZenAI/indictelephony-bench development manifest, collection pin `aa72c79dbb97644e50ae26cfa267d8fa81a37ce7`. References are published telephone transcripts, not expert legal labels; speaker/training disjointness not established.

## Actual Decoder Evidence

Installed guard: skip if no_speech_prob >0.6, unless avg_logprob >-1.0; strict comparisons. Compression threshold2.4, scheduled temperatures[0], word_timestamps false, without_timestamps false. Every row used those unchanged values. Forced mr is not independent language detection; no language-confidence claim.

| Clip | Generation windows | Emitted segments | Avg log probability | No-speech probability | Actual window skips |
|---|---:|---:|---:|---:|---:|
| mr-30 | 1 | 1 | -0.266926 | 1.8671e-10 | 0 |
| mr-64 | 1 | 1 | -0.201010 | 1.9599e-8 | 0 |
| mr-79 | 1 | 1 | -0.236792 | 2.2065e-9 | 0 |
| mr-148 | 1 | 1 | -0.230394 | 1.0469e-8 | 0 |
| mr-262 | 1 | 1 | -0.254763 | 9.5627e-9 | 0 |
| mr-332 | 1 | 1 | -0.263572 | 7.9199e-10 | 0 |
| mr-458 | 1 | 1 | -0.272256 | 4.3370e-10 | 0 |
| mr-539 | 1 | 1 | -0.238134 | 1.1572e-9 | 0 |

All eight actual skip-log counts agree with the observed guard annotations: zero. Each emits one segment; its text is already present in the generated decoder token sequence, and exactly matches the saved production HTTP/baseline transcript. Compression ratios1.5054..2.0438 stay below2.4; no low-logprob/compression/skip warning was logged. The observed prompt is consistently[50258,50320,50359], with the tokenizer reporting language mr/task transcribe; no lexical or legal-answer prompt. Full token IDs, segment timestamps, thresholds/options and debug logs are in the raw observations/report.

Published-reference mismatches already occur in generated text: mr-30 reference phrase `तीन हजार` becomes `तीनधार`; mr-332 published `site visit` is rendered `साळी जिली`. These are not new gold labels or backend/frontend corrections. Eight baseline-identical transcripts retain the earlier strict development microWER64.44%/CER33.43%, which include spelling/spacing/transliteration differences and do not certify legal meaning.

## Diagnosis And Limits

Confirmed layer: erroneous strings are emitted by the unchanged recognizer, not introduced by the UI or removed through its no-speech window skip on these examples. VAD duration matches the prior sample audit8/8 within one sample. This does NOT isolate a unique acoustic/checkpoint/tokenizer/conversion/training defect, establish word-level alignment or show which phoneme caused a substitution.

Internal scores pass existing guards despite reference mismatches. Do NOT treat them as calibrated transcription/legal accuracy or hide the editable review step. There is no evidence to disable VAD, lower no-speech thresholds, add large/legal-answer prompts, change retrieval or retest rejected beam2/text-only/medium. Segment timestamps are decoder predictions, not word-aligned evidence of absent speech; word timestamps were not enabled. Short inspected telephone clips do not establish behavior on unseen/long/quiet speech or the laptop microphone.

## Validity, Tests And Integrity

Run2026-10-04 13:51:24.044..13:52:23.429UTC (19:21:24.044..19:22:23.429 Asia/Calcutta). All8 completed; `diagnosticUsable:true`, failure null, no truncation/120s overrun; maximum worker UTC drift0.589ms. Bounded power records available with zero506/507 events. All text/VAD-duration parity gates and registered hashes pass. Diagnostic timing includes observer overhead, not a speed-improvement comparison. Earlier VAD failed-validity report remains unchanged, not reclassified by this new run.

- Full JavaScript231/231, zero failures/skips, and Python30/30, including four new observer/skip/logging contracts. Tests ran after recognition with writable project TEMP/TMP and approved localhost test connections.
- Mapping benchmark IPC104/104 and BNS104/104 each Top1/Top3, same-crosswalk consistency only. Separate current resolved replay5/5 each, unchanged: `output/project-completion/marathi-segments-replay-20261004.json`.
- Historical sealed40%, official-source labels/report/methodology and all legal-source provenance unchanged; NOT independent lawyer validation.83 protected/current identities and61 additional distinct model/audio/library/prior-evidence identities unchanged. All39 registered inputs stable; reserved8 remain undecoded.
- Existing website healthy onhttp://localhost:3002/ without restart. No production/UI/model/translation/retrieval/date/gateway/corpus/dependency change or deployment.

## Files And Rollback

Added observer/test/frozen plan/separate results; updated Decisions/Architecture/Flow/TestChecklist/Rollback/ProjectCompletion/Marathi speech bug/Handover. Complete new source/tests/docs diff inspected; no production diff. Evidence exclusive under `output/public-speech-validation/segment-diagnostic-20261004/`: registration, observations, report, derived-summary, protected-integrity and evidence-integrity. Registration SHA256 `6b56df28f53523f4f05f137fa522eb524a576863a9277e8b66dedfd89f0cd058`; raw SHA256 `7e273e40340ca043d9ab9582cd6342476d80f4eb113093d2f81314fee17076eb`; report SHA256 `e4ebc92b1f95360d21120751b8a4d08eee3aeb5130c74ea5f7c3e42640ccc60d`.

Executed `.venv-speech/Scripts/python.exe -m scripts.inspect_marathi_segments register` then `run`, with authorized read-only power-log access. Existing output refused; do not rerun into this directory, revise the frozen plan/tools after outcome, or overwrite history. Synthetic tests can be rerun without audio recognition: `.venv-speech/Scripts/python.exe -m unittest discover -s tests -p 'test_*.py' -v`, plus `npm test`/`npm run evaluate`. Replays need a fresh filename. Retire only the new observer/tests selectively if needed; preserve all frozen evidence. No production rollback required.

## Next Single Task

Marathi fidelity remains OPEN; no justified production fix identified. Next: read-only provenance/tokenizer/conversion audit of the current Marathi checkpoint using existing local setup metadata, configuration and registered files. Verify compatibility and conversion history before proposing a new recognition candidate; no model replacement/inference or reserved holdout in that task. Do not guess the checkpoint is corrupt from poor output alone. Long native meaning/GU-KN intent, natural spoken dates/sections, physical mic, gated translator access/runtime and independent bilingual/legal/IRAC review remain unresolved.
