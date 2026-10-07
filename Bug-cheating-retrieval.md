# Bug: Cheating Fact-Only Retrieval Miss

Date: 2026-09-10

## Problem

`blind-004` described cheating facts without naming the offence or section:

```text
On 12 July 2024, a person was deceived and dishonestly induced to deliver property.
```

The Applicable Law Check correctly routed the query to `BNS_PRIMARY`, but retrieval ranked property/dishonesty provisions above `BNS 318`.

## Investigation

The failing query extracted only broad terms such as `dishonestly` and `property`. It did not preserve the cheating elements `deceived`, `induced`, or `deliver property`, so lexical ranking favored provisions containing similar broad property language.

`BNS 318` was present in the indexed official corpus, so this was not a corpus/provenance issue. The failure was retrieval feature coverage after correct routing.

## Decision

Add a narrow deterministic cheating fact-pattern recognizer:

- deception cue
- dishonest or fraudulent cue
- inducement cue
- delivery or property cue

Boost only:

- `BNS 318` when the route allows BNS as primary or multi-period review
- `IPC 420` and `IPC 415` when the route allows IPC-only or multi-period review

Delivery/property language alone must not trigger the boost.

## Implementation

Files changed:

- `backend/core/dateExtractor.js`
- `backend/core/retriever.js`
- `tests/retriever.test.js`

The Applicable Law Check in `backend/core/gateway.js` was not changed.

## Tests

```text
npm run test
24 passed, 0 failed
```

```text
npm run evaluate
104/104 Top-1 and Top-3 for both IPC and BNS mapping-derived retrieval
```

No-write current-pipeline replay on the 5 resolved official-source cases:

```text
5/5 Top-1
5/5 Top-3 any-hit
```

## Result

`blind-004` now retrieves:

```text
BNS-318, BNS-314, BNS-320
```

The fix did not modify sealed predictions, official-source labels, official reports, legal-source manifest, or statute corpus.
