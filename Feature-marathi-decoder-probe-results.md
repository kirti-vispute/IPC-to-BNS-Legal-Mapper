# Marathi Decoder Prefix Results

Date: 2026-10-05. One previously inspected public telephone clip, mr-30.wav, using its frozen shared Mel features. No Git repository/branch/commit. Baseline231 JavaScript/37 Python tests; known Marathi word errors remain open. New evidence is exclusive under five `output/public-speech-validation/marathi-decoder-*-20261005/` directories. All tools are outside the website.

## Findings

Source float32/eager/eval: both fixed prefixes have exactly identical entire vocabulary logits with no mask and the explicit all-ones control mask; maximum absolute difference0. Initial source generation returns35082 with both masks and beam1/3. All-ones is a full-feature control, not an audio-duration mask or a long-form/batch validation.

| Fixed prefix | Source local Top-1 | Source local Top-2 | Converted new token, all four beam/suppression conditions |
|---|---:|---:|---:|
| Marathi/transcribe/no-timestamp initial prefix |35082 (15.68055)|3941 (14.29634)|35082|
| Same prefix plus common first five text tokens |3941 (9.98631)|8485 (9.47518)|3941|

The final converted cap probe verifies exactly one NEW token in all8 conditions. Beam1/3 and observed/empty general suppression produce the same choices; blank suppression stayed enabled. Source filtering also leaves its winner unchanged. Raw source logits are not directly comparable to converted hypothesis scores; the converted vocabulary buffer could not be read. No distribution or numerical-weight parity claim.

Earlier source full beam3 selected8485 after the common prefix, while its local maximum is3941. This supports a sequence-path explanation for that discrepancy. It does not isolate beam stopping, cache arithmetic or float32/int8 effects, or explain the known wrong Marathi word. Token agreement does not establish faithful recognition.

## Cap limitation discovered

The versioned [CTranslate2 4.8.2 implementation](https://raw.githubusercontent.com/OpenNMT/CTranslate2/v4.8.2/src/models/whisper.cc) applies a half-length bound and returns supplied text tokens in hypotheses. Executed raw conditions corroborate this: cap1 has no new token; initial cap5 returns two; common-text-prefix cap10 returns only supplied five. Final caps4/12 return exactly one new token each, verified from output.

The earlier shared-feature run passed converted max_length196, yielding an effective98-token cap, against source max_new_tokens192. Converted mr-148/mr-332/mr-539 each have98 tokens; their source rows have108/115/137 including EOS. Those converted rows may be truncated. Earlier0/8 exact-token parity also includes source EOS but excludes converted EOS. Preserve historical reports, but do not interpret them as a controlled conversion-fidelity test. No evaluation artifact was edited.

## Attempts preserved

Restricted source and separate PyTorch-import commands stalled before output and were interrupted; approved local source completed. First converted wrapper failed reading optional NULL vocabulary storage. Second failed an incorrect one-token assertion. Third indexed an absent hypothesis at cap1/beam3; two empty greedy rows were preserved in its failure record. Fourth raw observer saved16 conditions with zero errors. Fifth cap probe verified8/8 one-new-token conditions. All frozen plans/tools/registrations and successful source rows remain unchanged. This is one investigation with diagnostic corrections, no production change.

## Verification

- Full Python45/45 (eight new diagnostic tests); JavaScript231/231, zero failures/skips.
- Same-crosswalk mapping benchmark: IPC104/104 and BNS104/104 Top-1/Top-3.
- Separate current resolved replay5/5 Top-1/Top-3: `output/project-completion/marathi-decoder-probe-replay-20261005.json`.
- 83 protected/current hashes unchanged; previous44+17+20 and new18+6+6+4+6 registered commitments unchanged. Reserved8 holdout decoding/assessment files absent.
- Historical sealed40% official-source result, labels/report/methodology, corpus/provenance, Applicable Law Check and production source unchanged. No independent lawyer validation, speech gain or speed claim.

Final evidence: `marathi-decoder-cap-20261005/{observations.jsonl,report.json,assessment.json,integrity.json}`. Source: `marathi-decoder-probe-20261005/source.json`. Raw caps: `marathi-decoder-observe-20261005/observations.jsonl`. Earlier failed attempts remain separate.

## Next single task

Preregister a converted-only replay of the same eight inspected feature files with a VERIFIED effective cap matching saved192-token source rows; compare EOS-normalized text-token sequences. Reuse existing source outputs. Preserve original cap-limited reports, holdout and production settings/models/retrieval. Full-sequence cross-framework differences still cannot establish speech/legal accuracy without reference measurement.
