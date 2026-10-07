# Offline Unfinished-Speech Review Warning

2026-10-06. Status: offline prototype tested; NOT deployed and NOT a recognition fix. No Git repository/branch/commit. Starting tests:231 JavaScript/70 Python.

## Problem And Investigation

The actual recognizer joins every emitted segment without a quality warning. Prior diagnostics reproduced saturated, unclosed generation on the original30s stress recording and repetitive output on a tiny tail in the rejected15s candidate. A silence-confidence override and single-temperature repetition fallback explain how text is accepted, not why neural decoding chooses it. Shortening windows was rejected; deleting tails or filtering all repetitive text would risk losing real speech.

Read current worker, installed-helper contracts, saved generation observations, constraints and handover. Implement only a language-independent token-layout warning prototype using the pinned timestamped runtime; evidence is Marathi only. No production path, window size, temperature, model, UI or retrieval edit.

## Exact Rule

`assess_window` derives the source-verified generation bound from max_length/prompt length. Here it is224. It requires BOTH token count reaching that bound AND absence of the installed helper's single-ending-timestamp predicate (`tokens[-2] < timestamp_begin <= tokens[-1]`). Returned code: `REVIEW_SATURATED_UNFINISHED_WINDOW`.

`add_review_metadata` copies the original response and adds per-window `speechReview` metadata. Silence probability/confidence contradiction and compression threshold exceedance are supporting evidence only, using saved original thresholds. They do not independently warn, reject or suppress text. No words, identifiers, dates, repeated phrases or replacement characters are changed. Tokens, seek/timestamps, options and source files remain unchanged. Invalid/incomplete metadata raises an explicit diagnostic error rather than a clean result.

The helper's ending predicate is not acoustic completion: unusual double-ending layouts may warn conservatively. Actual decoder stop reason remains unavailable. This guard does not detect ordinary substitutions, translation errors, lost words below the cap, or every hallucination. A no-warning result is not an accuracy verdict.

## Saved-Output Results

Preregistered93 tool/test/plan/source/evidence identities before evaluation. Ten saved response identities,16 generation windows; no audio decoding, neural inference, download or reserved holdout use.

| Saved case/path | Window token counts | Warned indices (zero-based) | Original text preserved |
|---|---|---|---|
| Production-style30s stress | 224/224/75 | 0,1 | Yes |
| Rejected offline15s stress | 224/139/145/127/224 | 0,4 | Yes |
| Eight inspected short clips | 60/87/71/113/74/119/80/135 | None | All8 |

All10 original responses are preserved when the added metadata is removed; inputs are not mutated. Existing audio files are checksum-preserved, not decoded or resaved. The15s final-tail warning records both high silence/confidence contradiction and compression exceedance. Its first-window warning does not depend on high silence. Three middle15s windows exceed compression but do NOT warn because the cap condition is absent. No generic repetition rejection was introduced.

Baseline window1 correctly revisits unfinished audio at52.16s. It still warns because raw generated output reached the bound without a closing ending timestamp. This is expected conservative review behavior, not a proven false/true error classification or a claim that words were lost. No reviewer labels or precision/recall percentages are invented. Known short-word errors remain even though the short clips do not trigger this indicator.

Before: no offline review metadata on these saved responses. After: four segment-level indicators across the two saved stress outputs, zero indicators across eight short outputs, with text exactly unchanged. Recognition accuracy and speed are unchanged/unmeasured, not improved.

## Tests And Integrity

- Seven new regression/contract tests: saturated-unclosed warning, completed-ending control, below-bound repetition/silence controls, warning without supporting evidence, native text/date/section/response preservation, paired recovery semantics and invalid metadata/budget rejection.
- Full Python77/77 and JavaScript231/231; no failures/skips.
- Same-crosswalk mapping IPC/BNS104/104 each Top-1/Top-3, unchanged. Separate current resolved replay5/5 each: `output/project-completion/speech-review-warning-replay-20261006.json`.
- Historical sealed40%, official-source labels/report/methodology, legal corpus/provenance/checksums, Applicable Law Check, query retrieval and website unchanged. These evaluations are NOT independent lawyer validation or real-world speech accuracy.
- 83 protected/current files and17 registration groups merge261 distinct checked identities: no changes/conflicts. Reserved telephony8 decoding/assessment outputs remain absent.

## Files And Rollback

New: `scripts/assess_speech_review_warning.py` (pure warning functions plus standalone saved-output evaluator), `tests/test_speech_review_warning.py`, frozen `Feature-speech-review-warning-plan.md`, this results document. Exclusive evidence: `output/public-speech-validation/review-warning-20261006/{registration.json,report.json,integrity.json}`. Engineering handover and relevant speech bug notes updated. All prior failed/rejected/source evidence remains intact. Server/UI import none of the prototype.

No production rollback needed. To retire the prototype, inspect later imports then retire only its standalone entry point/test; preserve frozen plan/registration/results, prior evidence and separate replay. Never rerun into an occupied evidence directory, restore old application files or edit historical legal evaluation.

## Next Single Task

Backend-only integration of review metadata into the actual Marathi speech response, preserving the existing decoder settings/text/error contract. First read worker/Node adapter/server contracts; move only the pure rule into a normal production helper, capture original generation results with a delegating observer, reset state per request and pass validated optional metadata through the adapter. Test successful, failed, repeated and consecutive requests, native transcript preservation and unchanged decoding arguments. Do not import this fixture evaluator into production. No frontend redesign, window-size/model change, audio deletion or legal pipeline change in that task.

Production integration is pending, not approved/deployed by this offline run. It will flag uncertainty, not fix Marathi acoustic fidelity. Natural long speech/date-section accuracy, physical microphone/native meaning, GU/KN intent, gated translator readiness and independent bilingual/legal/IRAC reviews remain open. All required command sessions finished; website untouched.
