# Bug: Retrieval Ranking for Theft/Cheating Fact Patterns

Date opened: 2026-09-09

Status: Fixed for the resolved theft and cheating replay cases in current production source; sealed benchmark artifacts unchanged.

## Problem

The official-source reference evaluation showed provision retrieval failures on resolved fact-only cases:

- pre-transition theft facts missed `IPC 378`/`IPC 379`
- post-transition theft facts missed `BNS 303`
- post-transition cheating facts missed `BNS 318`

A related debug report found that `mobile` could be incorrectly detected as `mob`.

## Investigation

Files inspected:

- `backend/core/dateExtractor.js`
- `backend/core/gateway.js`
- `backend/core/retriever.js`
- `backend/core/pipeline.js`
- `backend/data/statutes.json`
- `evaluation/official-source-reference-evaluation/retrieval-error-analysis.md`
- `evaluation/official-source-reference-evaluation/retrieval-debug-report.md`

Findings:

- Applicable Law Check was correct.
- The errors happened after route selection.
- Keyword extraction used substring matching.
- The retriever lacked phrase-level legal feature signals for theft and cheating.
- Correct provisions existed in the official-source corpus.

## Decision

Use only the confirmed `retrieval-debug-report.md` fixes in the current production source:

- token-bound keyword detection so `mobile` cannot trigger `mob`
- primary-code explicit section-reference guard
- narrow theft-element phrase boost

Do not weaken or modify the Applicable Law Check.

## Implementation

Files changed:

- `backend/core/dateExtractor.js`
- `backend/core/retriever.js`
- `tests/retriever.test.js`

Implemented:

- token-bound keyword matching
- preserved theft legal phrase extraction
- primary-code explicit section-reference guard
- narrow theft feature boosts for `IPC 378`, `IPC 379`, and `BNS 303`
- regression tests for confirmed debug-report failures

## Tests

Command:

```text
npm run test
```

Result:

```text
21 passed, 0 failed
```

## Result

Current post-fix pipeline on the 5 resolved official-source reference cases:

- Top-1 provision accuracy: `80%`
- Acceptable Top-3 any-hit: `80%`

Sealed official-source evaluation remains:

- Top-1 provision accuracy: `40%`
- Acceptable Top-3 any-hit: `40%`

Reason:

The sealed evaluation reads historical `blind-predictions.json`, which was intentionally not modified.

## Remaining Risk

The fix is intentionally narrow. It improves the confirmed theft/mobile/exact-section failures and the separately approved cheating fact-only miss in `blind-004`, but it is not a broad semantic retriever. Broader paraphrases may still need separate evidence-driven fixes.

## Post-Fix Validation

Validation report:

- `evaluation/official-source-reference-evaluation/post-fix-validation.md`

Result:

- Full tests pass: 21/21.
- Official BPR&D mapping-derived retrieval benchmark remains 104/104 Top-1 and Top-3 for both IPC and BNS splits.
- Current resolved-case replay remains 80% Top-1 and 80% Top-3 any-hit.
- Unseen theft diagnostics show partial generalization, not a broad solution.
- Consent/general-exception provisions are not globally suppressed.

## Cheating Follow-Up Fix

2026-09-10:

- Added a separate narrow cheating fact-pattern boost for deception, dishonest inducement, and delivery/property facts.
- `blind-004` now retrieves `BNS-318` first in a no-write current-pipeline replay.
- The 5 resolved official-source cases now replay at `5/5` Top-1 and `5/5` Top-3 any-hit.
- Sealed predictions and official-source reference labels were not modified.

## Multi-Period Cheating Review Support

2026-09-10:

- Added a separate review-support fix for multi-period deceptive delivery-of-property facts.
- `blind-005` remains `MULTI_PERIOD_REVIEW`, but now surfaces `IPC-420`, `BNS-318`, and `IPC-415` in the current replay Top-3.
- This is not a new legal gold label and does not convert the case into a provision-eligible accuracy case.
- Sealed predictions and official-source reference labels were not modified.

## Theft/Mobile Paraphrase Follow-Up Fix

2026-09-10:

- Reproduced the UI failure for: `On 20 June 2024, A took B's mobile phone from his possession without B's consent with the intention of keeping it. Which law and section apply?`
- Before the fix, the current production pipeline returned `IPC-92`, `IPC-474`, and `IPC-119`.
- Root cause: the extractor preserved only `mobile phone`; it missed `took`, `from his possession`, and `without B's consent`, so the theft feature boost did not activate.
- Implemented token-bound theft taking variants and possessive consent/possession phrase extraction.
- Added retrieval stopwords for obvious non-legal query noise such as party-letter artifacts, pronouns, and `which/law/section/apply`.
- After the fix, the same current pipeline query returns `IPC-378`, `IPC-379`, then `IPC-313`.
- Regression tests now cover the exact failing query and guard against misrouting medical consent, forged-document possession, and public-servant concealment facts into theft.
- `npm run test` passes `31/31`.
- `npm run evaluate` remains `104/104` Top-1 and Top-3 for both IPC and BNS mapping-derived retrieval.
- Current no-write resolved-case replay remains `5/5` Top-1 and `5/5` Top-3.
- Sealed predictions and official-source reference labels were not modified.
- Note: `npm run evaluate:official` was run and regenerated `official-source-reference-report.json` with the same historical sealed metrics but a new timestamp/checksum. This did not change the methodology, labels, or sealed predictions, but the report artifact checksum changed.
