# Bug: Multi-Period Cheating Review Support

Date: 2026-09-10

## Problem

`blind-005` is correctly routed to `MULTI_PERIOD_REVIEW`, but the current retrieval replay did not surface the BNS cheating counterpart for review.

Before this fix, the current replay Top-3 was:

```text
IPC-420, BNS-101, IPC-239
```

The route was correct, and no final Top-1 legal answer should be forced because the official-source labels mark this case as requiring expert review.

## Investigation

The query:

```text
A deceptive course of conduct continued from 20 June 2024 until 12 July 2024 and caused delivery of property.
```

extracted only:

```text
property, delivery
```

It did not preserve `deceptive` or the phrase `delivery of property`. The existing cheating feature group therefore did not trigger. During multi-period diversification, the system returned one IPC cheating candidate but selected a generic BNS provision from broad overlap instead of `BNS 318`.

## Decision

Add a narrow review-support signal:

- preserve `deceptive`
- preserve `delivery of property`
- in `MULTI_PERIOD_REVIEW` only, treat deception plus property-delivery cues as sufficient to surface cheating candidates for review

This does not select a final applicable law.

## Implementation

Files changed:

- `backend/core/dateExtractor.js`
- `backend/core/retriever.js`
- `tests/retriever.test.js`

No change was made to `backend/core/gateway.js`.

## Tests

```text
npm run test
27 passed, 0 failed
```

```text
npm run evaluate
104/104 Top-1 and Top-3 for both IPC and BNS mapping-derived retrieval
```

Focused result:

```text
blind-005 current replay Top-3:
IPC-420, BNS-318, IPC-415
```

## Result

The current pipeline now surfaces both IPC and BNS cheating provisions for the multi-period review case. Sealed predictions, official-source labels, official report, corpus, and manifest were not modified.
