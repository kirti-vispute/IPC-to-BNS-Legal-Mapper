# Retrieval Fix Change Report

## What Changed

This change implements the smallest safe retrieval fix identified in `retrieval-error-analysis.md` and `retrieval-debug-report.md`.

The deterministic Applicable Law Check was not changed. Official reference labels, sealed predictions, and existing benchmark results were not edited.

Code changes:

- `backend/core/dateExtractor.js`
  - Replaced substring keyword matching with token-bound matching.
  - This prevents `mobile` from being detected as `mob`.
  - Added preserved legal phrase extraction for narrow cues such as:
    - `movable property`
    - `mobile phone`
    - `without consent`
    - `out of possession`
    - `from possession`
    - `dishonestly induced`
    - `deliver property`
    - `deceived person`

- `backend/core/retriever.js`
  - Included preserved legal phrases in the lexical query text.
  - Added narrow deterministic feature boosts for high-confidence theft patterns.
  - Added narrow deterministic feature boosts for high-confidence cheating patterns.
  - The boosts operate only inside the already selected allowed corpus after the Applicable Law Check.

- `tests/retriever.test.js`
  - Added regression coverage for:
    - explicit `IPC 379` section priority
    - IPC theft fact pattern ranking
    - BNS theft fact pattern ranking
    - BNS cheating fact pattern ranking
    - IPC cheating fact pattern ranking
    - `mobile` not becoming `mob`
    - strong mobile-phone theft facts outranking unrelated `IPC 92/89/88`-style consent exceptions

## What Did Not Change

- `backend/core/gateway.js` was not changed.
- `evaluation/runs/blind-predictions.json` was not changed.
- Official reference labels were not changed.
- Existing official evaluation methodology was not changed.
- No lawyer/expert labels were fabricated.
- No broad semantic, fuzzy, or LLM-based retrieval override was added.

## Verification

Full test suite:

```text
npm run test
Tests: 23 passed, 0 failed
```

Separate sealed official-source evaluation rerun:

```text
node scripts/score_official_source_evaluation.mjs evaluation/runs/blind-predictions.json evaluation/official-source-reference-evaluation/official-source-reference-labels.json evaluation/official-source-reference-evaluation/post-fix-sealed-official-report.json
```

Because this uses the immutable sealed prediction file, the sealed official metrics remain unchanged:

| Metric | Before sealed result | After sealed rerun |
|---|---:|---:|
| Applicable-law accuracy | `100%` | `100%` |
| Top-1 provision accuracy | `40%` | `40%` |
| Acceptable Top-3 any-hit | `40%` | `40%` |
| Acceptable provision recall@3 | `33.33%` | `33.33%` |
| Exact Top-1 citation accuracy | `40%` | `40%` |

This is expected and correct: sealed predictions are historical and immutable.

## Current Pipeline After Fix

I separately ran the current post-fix pipeline against the 5 resolved official-source reference cases. This is not a replacement for the sealed blind run; it is a post-fix retrieval check.

| Case | Reference | Post-fix Top-1 | Post-fix Top-3 | Correct |
|---|---|---|---|---|
| `blind-001` | `IPC-378` | `IPC-378` | `IPC-378`, `IPC-379`, `IPC-92` | Yes |
| `blind-002` | `BNS-303` | `BNS-303` | `BNS-303`, `BNS-314`, `BNS-129` | Yes |
| `blind-004` | `BNS-318` | `BNS-318` | `BNS-318`, `BNS-314`, `BNS-320` | Yes |
| `blind-007` | `BNS-111` | `BNS-111` | `BNS-111`, `BNS-146`, `BNS-189` | Yes |
| `blind-010` | `BNS-127` | `BNS-127` | `BNS-127`, `BNS-126`, `BNS-142` | Yes |

Post-fix current pipeline result on the 5 resolved cases:

| Metric | Before sealed baseline | Current post-fix pipeline |
|---|---:|---:|
| Top-1 provision accuracy | `40%` | `100%` |
| Acceptable Top-3 any-hit | `40%` | `100%` |

## Interpretation

The retrieval fix improved the current pipeline on the resolved official-source cases from `40%` to `100%` for both Top-1 and Top-3 any-hit, without changing the sealed benchmark file or the official references.

The original sealed benchmark result still remains `40%` unless a new blind prediction run is intentionally generated and sealed in a future evaluation cycle.
