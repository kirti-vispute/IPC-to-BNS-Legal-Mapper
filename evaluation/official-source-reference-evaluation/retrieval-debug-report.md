# Retrieval Debug Report: Explicit IPC 379 Theft Query

## Scope

This report traces the retrieval pipeline for the query:

> The alleged act happened on 2024-06-20 and concerns theft of movable property under IPC 379.

Production code, official-source reference labels, sealed predictions, and benchmark results were not changed.

The live `http://localhost:3000/api/analyze` endpoint was not reachable during this trace, so the diagnosis below is based on the current source-level backend pipeline:

1. `backend/core/pipeline.js`
2. `backend/core/dateExtractor.js`
3. `backend/core/gateway.js`
4. `backend/core/retriever.js`
5. `backend/data/statutes.json`

## Executive Finding

The exact query above does not reproduce the reported result of `IPC 92`, `IPC 89`, and `IPC 88` in the current backend source. It routes to `IPC_ONLY`, detects explicit `IPC 379`, applies the exact-section boost, and ranks `IPC 379` first.

Observed source-level result for the exact query:

| Rank | Provision | Title | Score | Source |
|---:|---|---|---:|---|
| 1 | `IPC 379` | Punishment for theft | `64.112` | `ipc-1860-mha.pdf`, p. 154 |
| 2 | `IPC 22` | "Movable property" | `25.723` | `ipc-1860-mha.pdf`, p. 8 |
| 3 | `IPC 356` | Assault or criminal force in attempt to commit theft of property carried by a person | `24.848` | `ipc-1860-mha.pdf`, p. 141 |
| 4 | `IPC 381` | Theft by clerk or servant of property in possession of master | `24.848` | `ipc-1860-mha.pdf`, p. 155 |
| 5 | `IPC 378` | Theft | `21.835` | `ipc-1860-mha.pdf`, p. 152 |

However, the report uncovered two real retrieval weaknesses:

1. `mobile` is incorrectly tagged as `mob` because keyword extraction uses substring matching.
2. Fact-only theft queries without an explicit section can be misranked because broad lexical/title matches such as `without consent`, `consent`, `property`, or `mob` can overpower the intended theft concept.

## End-to-End Trace for the Exact Query

### 1. Input normalization

`pipeline.js` only trims the input:

```js
const normalizedQuery = String(query || "").trim();
```

No stemming, lemmatization, semantic embedding, or BM25 library is used.

### 2. Date and section extraction

For the exact query, `extractFacts()` returns:

```json
{
  "dates": [
    {
      "value": "2024-06-20",
      "raw": "2024-06-20"
    }
  ],
  "offenseDate": "2024-06-20",
  "sections": ["379"],
  "sectionRefs": [
    {
      "code": "IPC",
      "section": "379"
    }
  ],
  "keywords": ["theft", "movable", "property"],
  "continuingSignal": false
}
```

The explicit `IPC 379` is detected correctly.

### 3. Applicable Law Check

The offense date is before `2024-07-01`, so the gateway returns:

```json
{
  "route": "IPC_ONLY",
  "allowedCodes": ["IPC"],
  "reviewRequired": false
}
```

This part is correct and should not be weakened.

### 4. Query sent to lexical retrieval

The retriever constructs its lexical input from:

```js
[query, facts.keywords.join(" "), facts.sections.join(" ")].join(" ")
```

For the exact query, the effective pre-tokenization text is:

```text
The alleged act happened on 2024-06-20 and concerns theft of movable property under IPC 379. theft movable property 379
```

Then `tokenize()` lowercases, removes punctuation, removes stopwords, and drops numeric tokens of length 1 to 4. That means `379` is removed from the lexical token list, but it is still available separately through `facts.sectionRefs` for exact-section scoring.

Final lexical query tokens:

```json
["theft", "movable", "property", "ipc"]
```

IDF values in the IPC-only candidate set:

```json
{
  "theft": 4.112,
  "movable": 4.987,
  "property": 2.736,
  "ipc": 5.21
}
```

## Why `mobile` Becomes `mob`

The keyword extractor uses this logic:

```js
return vocabulary.filter((word) => lower.includes(word));
```

The vocabulary contains:

```js
"mob"
```

Therefore:

- `mobile`.includes(`mob`) is true
- `movable`.includes(`mob`) is false

So `mob` is not selected from `movable`; it is selected from `mobile`. If the UI output says "Detected legal terms include mob", the submitted text almost certainly contained `mobile`, not `movable`, or the displayed output came from an earlier/stale run containing `mobile`.

This is a preprocessing/query-entity extraction bug. It is not BM25, indexing, mapping, or applicable-law routing.

## Scoring Signals and Weights

The retriever scores each candidate as:

| Signal | Weight |
|---|---:|
| Token appears anywhere in section/title/text/keywords | `+idf(token)` |
| Token appears in title | `+8` per token |
| Exact section reference match | `+50` |
| Official IPC-BNS mapped reference match | `+30` |
| BNS document under `BNS_PRIMARY` | `+2` |
| IPC document under `IPC_ONLY` | `+2` |
| Any document under `MULTI_PERIOD_REVIEW` | `+1` |

There is no BM25 index. The retriever uses in-memory token overlap plus hand-weighted boosts.

## Why IPC 92/89/88 Do Not Outrank IPC 379 for the Exact Query

For the exact query, the relevant score components are:

| Provision | Matched tokens | Token score | Title score | Exact-section score | Route score | Total |
|---|---|---:|---:|---:|---:|---:|
| `IPC 379` | `theft` | `4.112` | `8` | `50` | `2` | `64.112` |
| `IPC 378` | `theft`, `movable`, `property` | `11.835` | `8` | `0` | `2` | `21.835` |
| `IPC 88` | none | `0` | `0` | `0` | `2` | `2` |
| `IPC 89` | none | `0` | `0` | `0` | `2` | `2` |
| `IPC 92` | none | `0` | `0` | `0` | `2` | `2` |

So the reported `IPC 92`, `IPC 89`, `IPC 88` ranking cannot be produced by the exact query in the current source tree. The exact-section boost is large enough to make `IPC 379` rank first.

## When Unrelated Consent/Mob Sections Can Appear

The unrelated general-exception sections appear when the query does not produce a theft title/section signal and instead produces broad words such as `without`, `consent`, or false-positive `mob`.

Example:

> mobile phone was taken without consent on 20 June 2024

Extracted keywords:

```json
["mob"]
```

Lexical tokens:

```json
["mobile", "phone", "taken", "without", "consent", "mob"]
```

Top results:

| Rank | Provision | Title | Score |
|---:|---|---|---:|
| 1 | `IPC 313` | Causing miscarriage without woman's consent | `25.411` |
| 2 | `IPC 92` | Act done in good faith for benefit of a person without consent | `25.411` |
| 3 | `IPC 87` | Act not intended and not known to be likely to cause death or grievous hurt, done by consent | `17.411` |
| 4 | `IPC 89` | Act done in good faith for benefit of child or insane person, by or by consent of guardian | `17.411` |
| 5 | `IPC 127` | Receiving property taken by war or depredation mentioned in sections 125 and 126 | `14.651` |
| 6 | `IPC 88` | Act not intended to cause death, done by consent in good faith for person's benefit | `14.199` |
| 9 | `IPC 378` | Theft | `14.062` |

Why this happens:

- The word `theft` is absent.
- The section reference is absent.
- `mobile` incorrectly contributes `mob`.
- `without` and `consent` strongly match general-exception titles.
- There is no phrase-level rule that recognizes "taken without consent" as a theft element.

This closely explains the style of the reported bad output, but it requires a query variant that lacks a detected `IPC 379` or `theft` signal.

## Indexed Corpus Check: IPC 378 and IPC 379

Both theft provisions exist in `backend/data/statutes.json` and have official source metadata.

| ID | Provision | Title | Source |
|---|---|---|---|
| `ipc-378` | `IPC 378` | Theft | `ipc-1860-mha.pdf`, p. 152 |
| `ipc-379` | `IPC 379` | Punishment for theft | `ipc-1860-mha.pdf`, p. 154 |

Relevant indexed keywords:

| Provision | Indexed keywords |
|---|---|
| `IPC 378` | `theft`, `dishonestly`, `possession`, `property`, `takes`, `consent`, `without`, `intention`, `move` |
| `IPC 379` | `theft`, `punishment`, `commits`, `imprisonment`, `fine`, `three`, `years` |

The corpus data is sufficient for the exact query and for ordinary theft queries. The problem is not absence of `IPC 378` or `IPC 379`.

## Diagnostics

### Query A

> The alleged act happened on 2024-06-20 and concerns theft of movable property under IPC 379.

Complete pipeline:

- Route: `IPC_ONLY`
- Keywords: `theft`, `movable`, `property`
- Section refs: `IPC 379`
- Lexical tokens: `theft`, `movable`, `property`, `ipc`

Top-10:

| Rank | Provision | Score |
|---:|---|---:|
| 1 | `IPC 379` | `64.112` |
| 2 | `IPC 22` | `25.723` |
| 3 | `IPC 356` | `24.848` |
| 4 | `IPC 381` | `24.848` |
| 5 | `IPC 378` | `21.835` |
| 6 | `IPC 403` | `21.835` |
| 7 | `IPC 97` | `21.835` |
| 8 | `IPC 215` | `17.723` |
| 9 | `IPC 479` | `17.723` |
| 10 | `IPC 481` | `17.723` |

Explanation: `IPC 379` wins because exact `IPC 379` is detected and receives `+50`.

### Query B

> theft of movable property IPC 379

Complete pipeline:

- Route: `CLARIFY`
- Reason: no offense date
- Top-10: none, because no corpus is selected

Forced `IPC_ONLY` diagnostic, used only to inspect retrieval behavior if a date had been supplied:

| Rank | Provision | Score |
|---:|---|---:|
| 1 | `IPC 379` | `64.112` |
| 2 | `IPC 22` | `25.723` |
| 3 | `IPC 356` | `24.848` |
| 4 | `IPC 381` | `24.848` |
| 5 | `IPC 378` | `21.835` |
| 6 | `IPC 403` | `21.835` |
| 7 | `IPC 97` | `21.835` |
| 8 | `IPC 215` | `17.723` |
| 9 | `IPC 479` | `17.723` |
| 10 | `IPC 481` | `17.723` |

Explanation: no-date behavior is correct for the deterministic gateway. If forced through retrieval, exact `IPC 379` still ranks first.

### Query C

> mobile phone theft on 20 June 2024

Complete pipeline:

- Route: `IPC_ONLY`
- Keywords: `theft`, `mob`
- Section refs: none
- Lexical tokens: `mobile`, `phone`, `theft`, `mob`

Top-10:

| Rank | Provision | Score |
|---:|---|---:|
| 1 | `IPC 356` | `14.112` |
| 2 | `IPC 378` | `14.112` |
| 3 | `IPC 379` | `14.112` |
| 4 | `IPC 380` | `14.112` |
| 5 | `IPC 381` | `14.112` |
| 6 | `IPC 382` | `14.112` |
| 7 | `IPC 439` | `14.112` |
| 8 | `IPC 106` | `8.191` |
| 9 | `IPC 76` | `8.191` |
| 10 | `IPC 103` | `6.112` |

Explanation: `mob` is a false keyword from `mobile`, which pulls in mob-related general/private-defence provisions such as `IPC 106` and `IPC 76`. Theft provisions still dominate because the query contains `theft`.

### Query D

> IPC 379 theft

Complete pipeline:

- Route: `CLARIFY`
- Reason: no offense date
- Top-10: none

Forced `IPC_ONLY` diagnostic:

| Rank | Provision | Score |
|---:|---|---:|
| 1 | `IPC 379` | `64.112` |
| 2 | `IPC 356` | `14.112` |
| 3 | `IPC 378` | `14.112` |
| 4 | `IPC 380` | `14.112` |
| 5 | `IPC 381` | `14.112` |
| 6 | `IPC 382` | `14.112` |
| 7 | `IPC 439` | `14.112` |
| 8 | `IPC 326A` | `7.21` |
| 9 | `IPC 326B` | `7.21` |
| 10 | `IPC 354A` | `7.21` |

Explanation: complete pipeline properly refuses to retrieve without date. If a route is forced, exact `IPC 379` wins.

### Query E

> theft

Complete pipeline:

- Route: `CLARIFY`
- Reason: no offense date
- Top-10: none

Forced `IPC_ONLY` diagnostic:

| Rank | Provision | Score |
|---:|---|---:|
| 1 | `IPC 356` | `14.112` |
| 2 | `IPC 378` | `14.112` |
| 3 | `IPC 379` | `14.112` |
| 4 | `IPC 380` | `14.112` |
| 5 | `IPC 381` | `14.112` |
| 6 | `IPC 382` | `14.112` |
| 7 | `IPC 439` | `14.112` |
| 8 | `IPC 103` | `6.112` |
| 9 | `IPC 104` | `6.112` |
| 10 | `IPC 105` | `6.112` |

Explanation: all theft-title records tie on token and title score. Tie-breaking is currently by `id.localeCompare`, which puts `ipc-356` before `ipc-378` and `ipc-379`. This is a ranking/tie-break weakness for title-only theft queries.

## Component Diagnosis

| Component | Status | Evidence |
|---|---|---|
| Preprocessing | Bug present | `mobile` is tagged as `mob` due substring matching. |
| Query construction | Partly weak | Retrieval query adds `facts.keywords` and `facts.sections`, but numeric section tokens are removed from lexical tokens. Exact refs still carry section data separately. |
| BM25/indexing | Not applicable | There is no BM25/indexing engine. Retrieval is local token overlap plus hand scoring. |
| Ranking | Weakness present | Ties among theft provisions are resolved by lexical ID order; broad title matches can outrank the basic offence section. |
| Field weighting | Weakness present | Title token boost `+8` can overemphasize generic title words like `consent`, `property`, or `without`. |
| Exact-section matching | Working for exact query | `IPC 379` receives `+50` and ranks first. |
| IPC-BNS mapping | Not relevant here | Query routes to `IPC_ONLY`, so mapped BNS references are not needed. |
| Corpus data | Correct for this issue | `IPC 378` and `IPC 379` exist with official source pages. |
| Applicable-law routing | Working | `2024-06-20` routes to `IPC_ONLY`. |

## Root Cause

There are two root causes, one confirmed and one non-reproduced for the exact query:

1. Confirmed root cause for the `mob` message: keyword extraction uses substring matching. The word `mobile` contains `mob`, so `mobile phone theft` is falsely treated as containing a mob/lynching signal.

2. Confirmed root cause for unrelated consent/general-exception retrieval in nearby theft descriptions: the retriever has no phrase-level legal element recognizer for theft. Without a detected explicit section or the word `theft`, broad title matches such as `without consent` can rank `IPC 92`, `IPC 89`, `IPC 88`, or similar general-exception provisions above `IPC 378`.

For the exact query containing both `theft` and `IPC 379`, the reported `IPC 92`, `IPC 89`, `IPC 88` result is not reproducible from the current backend source. The exact query correctly detects `IPC 379` and ranks it first. If that result was seen in the UI, the likely explanations are:

- the typed query contained `mobile` and omitted or malformed `IPC 379`;
- the UI displayed stale results from an earlier query;
- the running server was not the same code version as the source inspected here;
- the API was not running when this trace was attempted, so browser state could not be confirmed live.

## Smallest Safe Fix To Implement Next

The smallest safe production fix should be narrow and deterministic:

1. Change keyword extraction from substring matching to token/phrase-bound matching so `mobile` no longer triggers `mob`.

   Example intended behavior:

   - `mob lynching` should detect `mob`
   - `mobile phone theft` should not detect `mob`
   - `movable property` should detect `movable`

2. Add a high-priority exact-section guard in retrieval ranking so an explicit same-code section reference is always ranked first within the allowed corpus. The current `+50` works for this trace, but a guard is safer than relying on a large additive score.

3. Add a narrow theft element boost for descriptions like:

   `taken/moved` + `property/mobile phone` + `without consent` + `possession`

   Under `IPC_ONLY`, boost `IPC 378` and associated `IPC 379`. Under `BNS_PRIMARY`, boost `BNS 303`.

4. Add regression tests for:

   - exact `IPC 379` query ranks `IPC 379` first
   - `mobile phone theft on 20 June 2024` does not extract `mob`
   - `mobile phone was taken without consent on 20 June 2024` ranks `IPC 378`/`IPC 379` above general-exception consent provisions

These fixes do not weaken the deterministic Applicable Law Check. They only make preprocessing and retrieval ranking more legally precise after the route has already been selected.
