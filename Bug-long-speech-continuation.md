# Bug: Saturated Long Speech Window Advances With Incomplete Text

2026-10-06 real long-fixture follow-up: actual running selected-MarathiHTTP response retains historical text/3-window warnings0/1, native advisory visible desktop/mobile2/2; no acoustic repair or settings change. Original Blob-inspection diagnostic failure preserved; separate same-Blob/native-fetch retry passes,327 identities stable. Full245 JS/92 Python, mapping/current replay unchanged. Warning wiring verified, but malformed character/word errors remain in exact text, recovered paired tails can still warn and natural legal speech/mic quality remains open. See Feature-long-speech-review-validation-results.md.

2026-10-06 frontend follow-up: selected Marathi review metadata now appears as a native possible-incomplete/unchecked notice in the existing transcript status area; original text/manual Analyze/voice payload unchanged. Nine regression tests/full245 JS/88 Python, eight controlled desktop/mobile states and one unchanged public-clip real HTTP response pass. Website running3002; only app/CSS modified, legal artifacts/backend unchanged. No acoustic correction or recognition accuracy claim. Saved long-risk warning still conservative; actual long HTTP/UI smoke remains next. See `Feature-frontend-speech-review.md`.

2026-10-06 follow-up: backend-only advisory review integrated into selected Marathi worker/Node responses. Delegates original generation once, unchanged text/settings, reset per request; saturation AND missing single ending timestamp warns. No transcript correction, recovered paired tails may warn, and ordinary word errors may not. Runtime/observation uncertainty remains unavailable/null.11 Python/5 JS contracts/full88/236 pass; actual eight inspected clips plus repeat retain original text/no warning, invalid request recovers; saved16 windows match frozen warning. Legal benchmark/current replay unchanged; UI does not yet show warning. See `Feature-backend-speech-review.md`. Acoustic fidelity remains OPEN.

2026-10-05. Status: production-style behavior reproduced; production fix NOT implemented.

## Follow-up: Offline Risk Warning Preserves All Output (2026-10-06)

Preregistered93-input prototype flags bound-length output lacking installed ending predicate, not deletion/retry. Saved30s windows0/1 and rejected15s0/4 warn; short8 none, all10 text/fields/tokens/options preserved. Silence/repetition supporting metadata separate. Baseline paired recovery still warns, so cannot infer missing words/accuracy. No production fix/deployment. Full77 Python/231 JS, mapping104/104 each/current replay5/5 unchanged; protected83/261 identities stable. Next only backend review-metadata integration with unchanged decoder/text/error contract; see `Feature-speech-review-warning-results.md`.

## Follow-up: Controls Accept A Saturated Tiny Tail (2026-10-06)

Saved-result replay8/8 confirms actual pad/fallback/silence/split acceptance, no neural inference. Candidate4-frame remainder pads2996 columns; compression13.611>2.4 fails but single temperature returns sole result; avgLogprob-0.143>-1 overrides noSpeech0.7266>0.6; only initial timestamp emits224-token text over0.04s, advances6004. Explains acceptance, not neural choice or all production errors. Baseline partial-seek collection bug preserved/corrected separately. Full70 Python/231 JS, mapping104/104 each/current replay5/5; protected83/255 identities stable. No fix/deployment. Next single OFFLINE review-warning guard for saturated unclosed output, preserving speech; see `Feature-speech-tail-audit-results.md`.

## Follow-up: Offline15s Candidate Rejected (2026-10-06)

One preregistered candidate75 inputs/9 cases, actual recognizer with only diagnostic chunk_length15. Full execution/integrity gates pass; eight short transcripts unchanged. Long bound hits remain2, emitted replacement1->0, but CER0.1954->0.6694/WER0.4842->0.9263 and fourth phrase9->11 exceed reference9. Final4-frame remainder emits repetitive224-token text; emitted timestamp overlap0.26s also observed. No production deployment or claim of safe continuation. Full62 Python/231 JS, mapping104/104 each/current replay5/5 unchanged. See `Feature-short-speech-window-results.md`. Next single read-only final-tail/padding/timestamp investigation, not another parameter change.

Problem: the saved60-second Marathi stress transcript contains malformed/truncated text. A prior read-only helper audit showed possible full-window advance without completion checks, but short clips did not reach the bound.

Investigation: reconstruct four previously inspected public read-speech clips with pinned recipe/hashes. Invoke actual production `recognize()` in an isolated unchanged-option observer. First attempt slept and was rejected; preserve it. Separate uninterrupted retry reproduces historical text exactly. VAD keeps100%; windows generate224/224/75 tokens. First has only initial timestamp, ends in incomplete byte-level character and advances0->30s; second revisits unfinished paired tail at52.16s. No application/translation/retrieval/date change occurs.

Decision: treat no-pair full advance with malformed bound-length text as confirmed unsafe continuation behavior. Decoder stop reason and exact missing-word timing are unavailable; do not overstate causality/general recognition accuracy or deploy a speculative guard. Short-clip model word errors remain separate.

Implementation: diagnostic observer/assembly/assessment plus narrow separate retry launcher only. Actual production worker, model settings, installed library and legal pipeline remain unchanged. Evidence/results in `Feature-long-speech-trace-results.md`; original failed and successful retry directories preserved.

Tests:4 assembly/observer/assessment and2 launcher contracts; full58 Python/231 JavaScript pass. Mapping104/104 each, current resolved replay5/5 each unchanged; historical sealed40% untouched, not lawyer validation.83 protected/current and235 distinct checked files stable; reserved8 never decoded.

Result: actual saturation/no-pair continuation risk reproduced, not fixed. Next single task: offline15s-window candidate with fresh isolated model, same stress audio/eight short inspected clips and all other settings fixed. Do not change production/holdout/legal artifacts or mask ASR errors with retrieval.
