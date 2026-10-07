# Offline Short Speech Window Comparison

Run: 2026-10-05. Reviewed: 2026-10-06. Decision: REJECT this candidate; no production change.

## Problem And Decision

The unchanged 30-second speech path had emitted an incomplete character while advancing past a saturated window on the existing Marathi stress recording. Test one preregistered 15-second candidate, not a collection of tuning attempts. Read relevant production recognition, observer, installed feature extractor, frozen baselines and constraints before editing. No Git repository or previous commit exists.

`scripts/compare_short_speech_window.py` wraps the actual `recognize` call in an isolated candidate-only child. Only `chunk_length=15` is added to its model call. CPU int8/four threads, Marathi selection, beam3, temperature0, context disabled, VAD and other transcription options remain unchanged. The fresh child never mixes default30s calls with the mutable feature extractor. Production imports none of this tool. Four synthetic tests cover option injection, failure detection, literal phrase counts and separate generated/emitted malformed-character metrics.

Registered75 input identities before inference, including saved baseline evidence and original recipe. Exact reconstructed stress body remains SHA256 `44ed4a19e50da09a37b5f07e9def964c6958f9a4867d6e285be44b52fb103951`, 60.0460625 seconds. Eight inspected Marathi development clips are not the reserved telephony holdout.

## Results

| Diagnostic | Saved30s baseline | Offline15s candidate |
|---|---:|---:|
| Long generation windows | 3 | 5 |
| Windows reaching224 tokens | 2 | 2 |
| Generated replacement characters | 2 | 0 |
| Emitted replacement characters | 1 | 0 |
| Reference CER | 0.1954 | 0.6694 |
| Reference WER | 0.4842 | 0.9263 |
| Literal fourth-source phrase occurrences | 9 | 11 |

The reference contains9 occurrences of that fourth phrase, so11 is an overcount, not improved retention. Other three literal phrase families remain0 in both outputs; their supplied reference counts are10/10/9. No synonyms, legal labels or corrected transcripts were fabricated. Character/word edit rates use the existing normalization helper and artificial repeated dataset text; they are not natural legal-speech accuracy or independent expert validation. Replacement characters are counted separately because normalization removes symbols.

All8 short transcripts match their saved text exactly, with token counts60/87/71/113/74/119/80/135. This preserves known short-word errors rather than resolving them. All9 calls retain identical transcription options and VAD duration.

Long seek advances0->1500->3000->4500->6000->6004 frames. Token counts224/139/145/127/224. First window is still saturated. Final4-frame input, approximately0.04 seconds, emits224 tokens with repetitive text instead of trustworthy speech. Complete seek coverage is therefore NOT evidence of complete or correct transcription. One emitted segment ends45.26s across the next window's45.0s start, a0.26s timestamp overlap; do not infer word alignment from it.

The run completes11:17:02.024860Z->11:19:05.876523Z, no failure, no recorded Kernel-Power506/507 event, and all registered execution/input gates pass. `comparisonUsable=true` means intact diagnostic evidence, NOT acceptable speech quality. Frozen eligibility is false: cap hits did not decrease, phrase overcount appeared, and both error rates worsened. Do not deploy or quietly weaken the criteria. Historical baselines were saved earlier, so no speed comparison is supported.

## Verification And Files

- Full Python suite62/62, JavaScript231/231; no failures/skips.
- Mapping benchmark IPC and BNS104/104 each Top-1/Top-3, unchanged; same official crosswalk supplies both queries and expectations, not independent validation.
- Separate current resolved replay5/5 Top-1 and Top-3, unchanged: `output/project-completion/short-window-replay-20261005.json`. Historical sealed40% and official-source report/labels/methodology remain untouched; NOT lawyer validation.
- Exclusive evidence: `output/public-speech-validation/short-window-20261005/{registration.json,events.jsonl,observations.jsonl,report.json,integrity.json}`. Original successful/failed traces and short baselines are preserved.
- Integrity:83 protected/current files and14 registered groups merge into243 distinct checked files, all unchanged with no conflicting commitments. Both reserved holdout output files remain absent. All required command sessions finished.
- New source/test/plan: `scripts/compare_short_speech_window.py`, `tests/test_short_speech_window.py`, `Feature-short-speech-window-plan.md`. Result and engineering/bug notes are documentation only. No UI/backend behavior, model/library, routing, retrieval, corpus, provenance or service restart change.

## Remaining Risk And Next Step

Marathi short-word fidelity and long natural/legal speech remain unresolved. These inspected public samples cannot establish general accuracy, microphone performance or spoken date/section fidelity. No reserved holdout inference occurred. Next single task: read-only trace of the final4-frame remainder, original padding/timestamp behavior and emitted repetitions using the saved candidate evidence and installed code. Establish the precise boundary cause before proposing any production continuation guard. Do not try another window size or compensate for speech errors in retrieval.

Rollback: none needed in production. Retire only this standalone diagnostic/test after checking imports if it becomes obsolete; preserve frozen inputs, rejected evidence, separate replay and documentation. Never rerun into the occupied output directory or restore older production files.
