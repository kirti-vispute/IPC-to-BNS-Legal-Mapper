# Backend Marathi Speech Review Metadata

2026-10-06. One backend-only integration, no Git repository/branch/commit. Starting tests231 JavaScript/77 Python. Status: production source integrated and real local worker smoke-tested; existing website service was not restarted. No frontend renderer yet. This is NOT a speech-recognition correction.

## Problem And Investigation

`backend/speech/transcribe.py` previously joined segments and returned only text/language metadata. `backend/core/transcriber.js` constructed its own response and would discard additional worker fields. `backend/server.js` already forwards that response unchanged, so no server or UI edit was needed.

Read the complete worker/adapter, relevant installed fallback/options/timestamp contracts, previous pure warning prototype, saved windows, tests and Constraints/Handover. The earlier30s stress recording has saturated unclosed windows; the rejected15s candidate worsened output. Only an advisory indicator is justified, not word deletion, invented corrections, model/threshold tuning or a legal retrieval workaround.

## Decision And Implementation

- New production `backend/speech/review.py` owns the pure rule and a delegating model subclass. Production imports no diagnostic/fixture scripts. It calls the original fallback exactly once and returns the identical tuple, preserving arguments/tokens/options. No extra decoding/tokenizer pass.
- Warning ONLY when generated-token count reaches the audited source-derived bound AND the installed single-ending-timestamp predicate is false. Formula: `min(max_length // 2, max_length - len(prompt) + 1)`; predicate: `tokens[-2] < timestamp_begin <= tokens[-1]`. Typical audited bound224. This is not an exposed decoder stop reason.
- Silence/confidence contradictions and compression exceedances are separate supporting window indices; neither independently triggers the warning or suppresses speech.
- Only explicitly selected Marathi instantiates the observer. Hindi/Auto retain their existing model path/response. Model/device/int8/thread settings, beam3/temp0/VAD/previous-context/prompt/timestamps/chunk settings are unchanged.
- `recognize()` resets observer state before every request and clears it in `finally`, including decoding/generation failure. Existing recognition core and errors remain intact. Empty text gets no assessment. Both CLI and file-spec diagnostic imports are supported.
- Success gets optional `speechReview` version1: `status`, nullable `requiresReview`, `windowCount`, `textModified:false`, `warningCode`, `warningWindows`, `silenceConfidenceWindows`, `compressionWindows`. Index arrays are ascending, copied, bounded128; no token arrays/audio/transcript logs added in production.
- `assessed` plus `requiresReview:false` means this ONE risk condition was absent, NOT that the transcript is correct. Unsupported runtime (other than faster-whisper1.2.1/CTranslate2 4.8.2), incomplete/invalid observations, zero windows or more than128 windows yields `unavailable`/null, never a fabricated clear verdict. Transcript is retained.
- Node validates optional Marathi metadata and passes a whitelisted copy. Legacy absent metadata remains supported without claiming a clean verdict. Malformed supplied metadata fails closed with existing `SPEECH_PROCESS_ERROR`; empty speech remains `NO_SPEECH_DETECTED`. Existing transport framing/timeouts/busy behavior are unchanged.

## Files And Reasons

| File | Reason |
|---|---|
| `backend/speech/review.py` | Pure risk rule, bounded observer, audited-runtime guard. |
| `backend/speech/transcribe.py` | Marathi-only observation and per-request metadata/reset. |
| `backend/core/transcriber.js` | Validate/pass optional metadata without changing text/language. |
| `tests/test_backend_speech_review.py` |11 production/import/delegation/state/preservation/parity contracts. |
| `tests/speech-review.test.js` |5 adapter/transport/validation/backward-compatibility contracts. |
| `scripts/validate_backend_speech_review.mjs` | Exclusive registered real-worker smoke evidence and read-only integrity audit. |
| `scripts/verify_backend_speech_review.ps1`, `scripts/assess_backend_review_integrity.ps1` | Separate streaming audit and canonical-path assessment; preserve failed frozen attempts. |
| `Bug-speech-review-import.md` | Import regression caught/fixed during this integration. |
| `Bug-speech-review-audit.md` | Whole-file hash limit and duplicate-path counting failures, evidence and verified assessment. |
| Engineering docs and long-speech bug note | Current responsibilities/flow/decision/test/rollback/handoff. |

## Tests And Results

- 11 new Python and5 new JS contracts. Full Python88/88 and JavaScript236/236, no failures/skips in final runs. Project-local TEMP/TMP needed for sandbox file tests; JS localhost tests run with approved access.
- Initial full Python attempt had sandbox temporary-path errors and a real file-spec import regression; preserved in session output, fixed import with added regression. No frozen test edits. Final full run passed.
- 10 saved responses/16 original windows exactly match frozen pure rule; original response text/tokens/options unchanged. Original30s stress warnings0/1, rejected15s warnings0/4, eight short outputs no warning.
- Installed original fallback executed with a stub generation result: identical arguments, return and one delegated call. No changes to library files.
- Separate actual adapter -> persistent Python -> existing local Marathi model smoke: eight already inspected public development clips plus one repeat,9/9 original-text parity and assessed one-window/no-warning responses. One invalid-audio request rejected, subsequent request recovers. All registered smoke inputs unchanged. This is not unseen-data evaluation or a physical microphone test.
- Same-crosswalk mapping remains IPC104/104 and BNS104/104 Top-1/Top-3. Separate current resolved official-source replay remains5/5 Top-1/Top-3. Historical sealed40% remains untouched; none is independent lawyer validation.

Evidence: exclusive `output/public-speech-validation/backend-review-20261006/` contains verified before copies/261-key snapshot,16-input smoke registration, actual responses/report and original audit failure. Node whole-file hash failed on a greater-than-2-GiB model; frozen tool preserved. Separate `backend-review-audit-retry-20261006/` streams hashes and finds no protected differences, but counts the two changed paths twice because historical keys use both slash styles; its `usable:false` report is preserved. Final `backend-review-normalized-audit-20261006/{registration.json,integrity.json}` verifies current files after canonicalizing identical path aliases, and is the valid integrity verdict (`usable:true`). Current legal replay: `output/project-completion/backend-speech-review-replay-20261006.json`. Do NOT rerun into occupied outputs or rewrite old commitments.

## Integrity And Rollback

Before editing verified261 historical keys,17 registration files and37 legal/pipeline files. Canonicalizing four identical slash aliases gives257 distinct files; only the two authorized pre-existing production files differ, with no unexpected changes or conflicting commitments. New helper/tests/tool are separately registered; smoke inputs and before copies verified. Prior snapshots are historical and now intentionally differ on those two normal-source files. Do not refresh them to hide the diff. All evaluation files/labels/sealed predictions/corpus/provenance/gateway/date/retrieval and frozen diagnostic tools/plans remain protected. Reserved eight holdout outputs remain absent. See the final normalized integrity report and `Rollback.md` for exact old/new hashes and safe restore steps.

## Limitations And Next Step

No speech accuracy/latency gain, legal accuracy gain or acoustic error correction claimed. Recovered paired tails can warn; double-ending layouts remain a limitation. Known short-word errors can occur without warning. Natural long legal speech/date-section fidelity, physical microphone, native/expert review and other previously open tasks remain unresolved. No live long-voice test in this integration, only saved long-window parity.

Next SINGLE task: expose optional assessed/unavailable review status using the existing transcript-status UI, preserving editable text/manual Analyze/record controls and existing layout. Read frontend/status/localization tests first; no decoder or legal retrieval change. That task is NOT implemented here.
