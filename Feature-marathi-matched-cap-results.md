# Matched-Cap Marathi Comparison Results

Date: 2026-10-05. Completed the next single task from Handover. No Git branch/commit; baseline231 JS/45 Python. This is an offline comparison on eight previously inspected public telephone clips, using the same saved features and source outputs. No app deployment or recognition improvement claimed.

## Change and reason

Only the standalone diagnostic changes converted max_length196 to384, giving the same nominal192-step budget as the saved source run under the registered runtime's cap rule. See frozen `Feature-marathi-matched-cap-plan.md` and its primary implementation reference. Prompt/model/int8/CPU threads/beam3/suppression/features stay the same. Source weights are not loaded or rerun. Compare token IDs after removing only one terminal EOS; reject internal EOS, invalid IDs, mismatched/duplicate/reordered or incomplete cases. Preserve decoded text exactly.23 new input identities were registered before inference, including all eight features and CT2 binding/library binaries.

## Observed results

All8 converted rows completed without errors, under the new cap. Three formerly98-token outputs extend to107/116/134; none of the new outputs reaches192. Exact EOS-normalized token agreement and exact text agreement each change1/8 ->2/8 against the saved source. These are model-output agreement counts, not transcription accuracy. The historical raw-token comparison was0/8 because it also differed in EOS handling.

| Clip | Old converted length | New converted length | Source length without EOS | Old normalized match | New normalized match |
|---|---:|---:|---:|---|---|
| mr-30 |58|58|56|No|No|
| mr-64 |85|85|88|No|No|
| mr-79 |68|69|69|No|Yes|
| mr-148 |98|107|107|No|Yes|
| mr-262 |73|75|73|No|No|
| mr-332 |98|116|114|No|No|
| mr-458 |78|78|78|Yes|No|
| mr-539 |98|134|136|No|No|

Six converted sequences changed; mr-30/mr-64 stayed identical. Two new source matches and one former match lost, so agreement is not uniformly improved. Higher cap can affect full beam-path selection even when the final selected sequence is shorter than the old limit; exact mechanism not isolated here. New mr-30 still contains the known erroneous `तीनधार`, as does saved source output. Increasing the diagnostic cap does not solve that recognition error.

## Limits

Different beam implementations, stopping/cache behavior and float32/int8 arithmetic remain confounded. No converted vocabulary distribution or numerical-weight comparison was performed. Original source timing was interrupted by sleep; current elapsed values are observations, not a speed experiment. These no-timestamp single-window calls differ from ordinary timestamped website transcription. This does not establish production truncation, long legal-speech fidelity, legal accuracy, native-speaker validation or a reason to replace the model. Reserved8 holdout recordings remain undecoded. Historical diagnostic and legal evaluation files retain their original contents.

## Verification and files

- Full Python48/48, three new comparison tests; full JavaScript231/231, no failures/skips.
- Same-crosswalk mapping IPC/BNS104/104 each Top-1/Top-3; not independent legal validation.
- Separate current resolved replay5/5 each: `output/project-completion/marathi-matched-cap-replay-20261005.json`; historical sealed40% result unchanged.
- 83 protected/current hashes and all144 registered input commitments unchanged; reserved decoding/assessment files absent. Production/UI/query retrieval/Applicable Law Check/corpus/provenance/labels/methodology unchanged.

Added `scripts/compare_marathi_matched_cap.py`, `tests/test_marathi_matched_cap.py`, frozen plan and this result document. Updated Decisions/Architecture/Flow/TestChecklist/Rollback/ProjectCompletion/Handover and the relevant decoder/speech bug documents to record why, the tests, remaining risk and next action. No production rollback necessary.

Exclusive evidence: `output/public-speech-validation/marathi-matched-cap-20261005/{registration.json,converted.jsonl,report.json,integrity.json}`. Raw source rows and prior converted reports remain in their earlier directories; all are hash-checked, not overwritten.

## Next single task

Read-only audit of the actual production speech worker and installed timestamped segment continuation/token limits, using existing long-recording/segment evidence. Determine whether capped generation can omit words in the website path before proposing any setting/model change. Do not infer this from the offline comparison alone or alter retrieval to compensate for ASR errors.
