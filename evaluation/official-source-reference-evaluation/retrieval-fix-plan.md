# Retrieval Fix Plan for All Blind Cases

Date: 2026-09-10

Status: Phase 1 and Phase 2 complete. No production code changes are made in this plan.

## Scope and Constraints

This plan diagnoses the current retrieval behavior across all 10 blind/reference cases using the current production code.

The following artifacts remain immutable:

- `evaluation/runs/blind-predictions.json`
- `evaluation/official-source-reference-evaluation/official-source-reference-labels.json`
- existing sealed evaluation artifacts
- `backend/data/statutes.json`
- `legal-sources/manifest.json`

This plan does not fabricate legal answers, labels, citations, statutory text, or expert validation. It does not change the deterministic Applicable Law Check in `backend/core/gateway.js`.

## Current Pipeline Summary

Runtime flow:

1. `backend/core/pipeline.js` calls `extractFacts(query)`.
2. `backend/core/dateExtractor.js` extracts dates, section references, token-bound legal keywords, and preserved legal phrases.
3. `backend/core/gateway.js` applies deterministic date-based routing:
   - `IPC_ONLY`
   - `BNS_PRIMARY`
   - `MULTI_PERIOD_REVIEW`
   - `CLARIFY`
4. `backend/core/retriever.js` filters the corpus by `gate.allowedCodes`, excludes repealed records, builds query tokens, and ranks records using:
   - token overlap
   - title token boost
   - exact section-reference boost
   - official mapping boost
   - narrow theft feature boost
   - narrow cheating feature boost
   - route preference
5. `backend/core/synthesizer.js` generates citation-bound IRAC from retrieved records.
6. `backend/core/verifier.js` checks grounding and review warnings.

## Baseline Evaluation Context

Original sealed official-source evaluation remains historical and unchanged:

| Metric | Sealed value |
|---|---:|
| Applicable-law accuracy | `100%` on 9 eligible cases |
| Provision Top-1 accuracy | `40%` on 5 resolved cases |
| Acceptable Top-3 any-hit | `40%` on 5 resolved cases |
| Acceptable provision recall@3 | `33.33%` |
| Exact Top-1 citation accuracy | `40%` |

Current source replay after the theft and cheating fixes:

| Metric | Current replay |
|---|---:|
| Resolved official-source cases | `5` |
| Top-1 on resolved cases | `5/5` |
| Top-3 any-hit on resolved cases | `5/5` |

This current replay is not a replacement for the sealed blind run.

## Case-by-Case Failure Table

| Case | Query summary | Date / route | Allowed corpus | Current Top-3 | Official reference / acceptable | Classification | Root cause | Generalizable fix possible |
|---|---|---|---|---|---|---|---|---|
| `blind-001` | Theft-like movement of property without consent | `2024-06-20`, `IPC_ONLY` | `IPC` | `IPC-378`, `IPC-379`, `IPC-92` | Top-1 `IPC-378`; acceptable `IPC-378`, `IPC-379` | No current failure | Previous theft phrase gap is fixed. `IPC-378` now gets theft feature boost and strong token overlap. | No further fix needed. |
| `blind-002` | Post-commencement theft of movable property | `2024-07-12`, `BNS_PRIMARY` | `BNS`, `IPC` | `BNS-303`, `BNS-314`, `BNS-129` | Top-1 `BNS-303` | No current failure | Previous theft phrase gap is fixed. `BNS-303` now gets theft feature boost. | No further fix needed. |
| `blind-003` | Intentional causing of death | `2024-06-18`, `IPC_ONLY` | `IPC` | `IPC-88`, `IPC-225`, `IPC-314` | No unique Top-1; acceptable review references `IPC-299`, `IPC-300` | D. Genuinely ambiguous case with retrieval-support weakness | The case lacks facts needed to choose murder vs culpable homicide. Retrieval also under-ranks `IPC-299` and `IPC-300` because title matches for generic words like `death/person` lift unrelated provisions such as `IPC-88`; no homicide feature group exists. | Yes, but only as review-support retrieval: surface `IPC-299` and `IPC-300` together, not as a forced legal answer. |
| `blind-004` | Deception and dishonest inducement to deliver property | `2024-07-12`, `BNS_PRIMARY` | `BNS`, `IPC` | `BNS-318`, `BNS-314`, `BNS-320` | Top-1 `BNS-318` | No current failure | Previous cheating element extraction gap is fixed. | No further fix needed. |
| `blind-005` | Deceptive continuing conduct across commencement causing delivery of property | two dates, `MULTI_PERIOD_REVIEW` | `IPC`, `BNS` | `IPC-420`, `BNS-101`, `IPC-239` | No unique Top-1; acceptable review references `IPC-415`, `IPC-420`, `BNS-318` | D. Genuinely ambiguous cross-period case with retrieval-support weakness | Routing is correct and review is required. Retrieval returns one acceptable IPC provision, but the BNS representative is wrong because `deceptive` and `delivery of property` do not trigger the current cheating feature group. Multi-period diversification selects the highest BNS record, currently `BNS-101`, from generic `caused/property` overlap. | Yes, but only as review-support retrieval: improve cheating element detection for `deceptive` + `delivery of property` so `BNS-318` can appear as the BNS-side candidate. |
| `blind-006` | Dishonest inducement and delivery of property, date missing | no date, `CLARIFY` | none | none | `CLARIFY`; no acceptable provision | E. Missing-date case | Correct behavior. The date is legally material for IPC/BNS selection. | No retrieval fix. Preserve clarification behavior. |
| `blind-007` | Organised crime syndicate / continuing unlawful activity | `2024-07-12`, `BNS_PRIMARY` | `BNS`, `IPC` | `BNS-111`, `BNS-146`, `BNS-189` | Top-1 `BNS-111` | No current failure | Strong token and title matches for `crime`, `syndicate`, `continuing`, `unlawful`, `activity`. | No further fix needed. |
| `blind-008` | Rash/negligent driving death and failure to report | `2024-07-12`, `BNS_PRIMARY` | `BNS`, `IPC` | `BNS-106`, `BNS-281`, `BNS-282` | No unique applicable-law / Top-1 label; acceptable textually relevant `BNS-106` | D / C. Commencement exception and corpus limitation | Retrieval is textually correct, and verifier flags that `BNS 106(2)` is not commenced. The approved sources do not resolve the resulting charging question or external law. | No retrieval fix. Preserve warning/review behavior. |
| `blind-009` | Repeated unwanted following / electronic monitoring causing fear | `2024-06-20`, `IPC_ONLY` | `IPC` | `IPC-385`, `IPC-386`, `IPC-387` | No unique Top-1; acceptable review reference `IPC-354D` | C. Corpus limitation with retrieval-support weakness | `IPC-354D` exists only as a mapping-reference record from the official comparative chart. Its local text is only `Stalking`, so fact words like `following`, `electronic`, `monitoring`, and `fear` do not match it. The mapped BNS counterpart `BNS-78` has relevant official text, but BNS is blocked as charging law for pre-commencement conduct. | Possible, but requires careful policy: use mapped BNS text only as retrieval-support evidence for mapping-reference IPC records while clearly citing the IPC mapping-reference limitation. Do not pretend primary IPC text exists. |
| `blind-010` | Wrongful confinement | `2024-07-12`, `BNS_PRIMARY` | `BNS`, `IPC` | `BNS-127`, `BNS-126`, `BNS-142` | Top-1 `BNS-127` | No current failure | Strong lexical match for `wrongfully`, `prevented`, `confined`. | No further fix needed. |

## Ranking Signal Findings

### `blind-003`

Expected review-support provisions `IPC-299` and `IPC-300` exist in the corpus.

Current ranking problem:

- `IPC-88` receives title boost from `death`, `person`, and related generic terms.
- `IPC-299` and `IPC-300` match body text but do not get title boost from the query because the query does not say `homicide` or `murder`.
- There is no homicide/death feature group to distinguish intentional death-causing facts from consent/general-exception provisions.

This should not become a forced unique answer because the reference file marks the case as requiring expert review.

### `blind-005`

Current Top-3 contains `IPC-420`, which is acceptable for review support, but the BNS-side diversified result is `BNS-101`.

Current ranking problem:

- The query uses `deceptive` and `delivery of property`, not the exact current cues `deceived person`, `dishonestly induced`, or `deliver property`.
- The current cheating boost therefore does not trigger.
- In multi-period retrieval, diversification chooses one IPC and one BNS candidate. The best BNS candidate becomes `BNS-101` because generic `caused/property` overlap beats `BNS-318`.

This should remain `MULTI_PERIOD_REVIEW`; the system must not choose a final charging law.

### `blind-009`

The acceptable review-support provision `IPC-354D` exists, but only as a mapping-reference record:

```text
Official comparative-chart reference: IPC Section 354D - Stalking.
```

Current ranking problem:

- The query does not say `stalking`.
- `IPC-354D` has no primary IPC text in the approved local corpus.
- Extortion provisions win because they match `fear`.
- The mapped BNS counterpart `BNS-78` contains the relevant factual language, but BNS is not allowed as the charging corpus for pre-commencement conduct.

This is primarily a corpus/provenance limitation. Any retrieval improvement must be transparent about using BNS text only to support matching a mapping-reference IPC record.

## Phase 2 Classification

### A. Confirmed Retrieval Bugs

No unresolved provision-eligible case currently fails.

Potential review-support retrieval weaknesses exist in:

- `blind-003`: homicide provisions should be surfaced for review.
- `blind-005`: BNS cheating counterpart should be surfaced for multi-period review.

These are not provision-accuracy failures under the official-source methodology because their Top-1/Top-3 fields are ineligible.

### B. Confirmed Routing / Applicability Bugs

None found.

The Applicable Law Check behaves correctly for:

- pre-commencement IPC-only cases
- post-commencement BNS-primary cases
- multi-period review
- missing-date clarification

Do not modify `backend/core/gateway.js`.

### C. Corpus Limitations

- `blind-009`: primary IPC 354D text is not available in `backend/data/statutes.json`; the record is a mapping-reference derived from the official comparative chart.
- `blind-008`: BNS 106(2) is textually relevant but not commenced by the available notification; the approved corpus does not resolve the charging question.

### D. Genuinely Ambiguous Cases

- `blind-003`: official-source text alone does not choose uniquely between IPC 299 and IPC 300.
- `blind-005`: cross-commencement treatment requires expert analysis of continuing conduct.
- `blind-008`: commencement exception prevents a unique applicable-law answer from local official sources.
- `blind-009`: material statutory facts and primary IPC 354D text are missing.

### E. Missing-Date Cases

- `blind-006`: correct `CLARIFY` behavior. No retrieval should run until the date is supplied.

## Phase 3 Proposed Generalizable Fixes

These are proposed for later implementation only after this plan is accepted.

## Phase 4 Production Theft/Mobile Failure Diagnosis

Status: Implemented on 2026-09-10 as a scoped theft/mobile paraphrase fix.

### Exact Reproduction

The reported UI failure is reproducible through the production backend pipeline, not only through the browser.

Raw query:

```text
On 20 June 2024, A took B's mobile phone from his possession without B's consent with the intention of keeping it. Which law and section apply?
```

Production path:

1. `frontend/app.js` sends the textarea value to `POST /api/analyze`.
2. `backend/server.js` calls `analyzeQuery(query)`.
3. `backend/core/pipeline.js` calls `extractFacts`, `routeByTemporalGate`, `retrieveStatutes`, `synthesizeIrac`, and `verifyGrounding`.
4. `backend/core/retriever.js` ranks IPC-only candidates because the gateway route is `IPC_ONLY`.

Extracted facts:

```json
{
  "offenseDate": "2024-06-20",
  "keywords": [],
  "legalPhrases": ["mobile phone"],
  "sectionRefs": [],
  "continuingSignal": true
}
```

Applicable Law Check:

```json
{
  "route": "IPC_ONLY",
  "allowedCodes": ["IPC"]
}
```

Normalized query tokens used for retrieval:

```text
b, s, mobile, phone, his, possession, without, consent, intention, keeping, it, which, law, section, apply
```

Candidate generation:

- IPC candidates before ranking: `538`
- `IPC 378` present: yes
- `IPC 379` present: yes
- Theft feature boost active: no

Top-10 scoring breakdown:

| Rank | Candidate | Title | Base lexical | Title score | Exact-match | Mapping | Offence-element | Negative | Route | Final | Main matching tokens |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | `IPC 92` | Act done in good faith for benefit of a person without consent | `24.975` | `16` | `0` | `0` | `0` | `0` | `2` | `42.975` | `b`, `s`, `his`, `without`, `consent`, `it`, `which`, `apply` |
| 2 | `IPC 474` | Having possession of document described in section 466 or 467... | `14.395` | `24` | `0` | `0` | `0` | `0` | `2` | `40.395` | `s`, `his`, `possession`, `it`, `which`, `section` |
| 3 | `IPC 119` | Public servant concealing design to commit offence which it is his duty to prevent | `13.892` | `24` | `0` | `0` | `0` | `0` | `2` | `39.892` | `b`, `s`, `his`, `it`, `which`, `section` |
| 4 | `IPC 313` | Causing miscarriage without woman's consent | `13.644` | `24` | `0` | `0` | `0` | `0` | `2` | `39.644` | `s`, `without`, `consent`, `which`, `section` |
| 5 | `IPC 378` | Theft | `31.050` | `0` | `0` | `0` | `0` | `0` | `2` | `33.050` | `b`, `s`, `his`, `possession`, `without`, `consent`, `intention`, `keeping`, `it`, `which` |
| 6 | `IPC 403` | Dishonest misappropriation of property | `28.225` | `0` | `0` | `0` | `0` | `0` | `2` | `30.225` | `b`, `s`, `his`, `possession`, `without`, `consent`, `intention`, `it`, `which`, `section` |
| 7 | `IPC 108` | Abettor | `27.206` | `0` | `0` | `0` | `0` | `0` | `2` | `29.206` | `b`, `s`, `his`, `possession`, `without`, `intention`, `it`, `which`, `law`, `section` |
| 8 | `IPC 88` | Act not intended to cause death, done by consent in good faith... | `10.127` | `16` | `0` | `0` | `0` | `0` | `2` | `28.127` | `s`, `consent`, `it`, `which` |
| 9 | `IPC 81` | Act likely to cause harm, but done without criminal intent... | `18.047` | `8` | `0` | `0` | `0` | `0` | `2` | `28.047` | `b`, `s`, `his`, `without`, `intention`, `it`, `which` |
| 10 | `IPC 300` | Murder | `25.424` | `0` | `0` | `0` | `0` | `0` | `2` | `27.424` | `b`, `s`, `his`, `without`, `consent`, `intention`, `it`, `which`, `law` |

Additional selected candidate:

| Candidate | Rank | Base lexical | Title score | Offence-element | Final | Reason |
|---|---:|---:|---:|---:|---:|---|
| `IPC 379` | `427` | `1.169` | `0` | `0` | `3.169` | Short punishment provision only matches generic `which`; no explicit `IPC 379` reference and no theft boost. |

### Root Cause

The previous theft/mobile fix is present in the production path, but the failing wording falls outside its narrow feature extraction.

Specific causes:

- `mobile` does not trigger `mob`; the prior token-bound keyword fix is working.
- The query does not contain an explicit section reference, so the same-code explicit section-reference guard is not involved.
- `took` is treated as a stopword in `backend/core/retriever.js` tokenization and is not part of the `extractKeywords` vocabulary in `backend/core/dateExtractor.js`.
- `without B's consent` does not match the current `without consent` legal phrase pattern, which only supports `without consent` and `without that person's consent`.
- `from his possession` does not match the current `from possession` legal phrase pattern, which only supports `from possession` and `from another person's possession`.
- `intention of keeping it` is not represented as a theft/dishonest-intent cue.
- Because the theft feature boost does not activate, generic lexical/title signals dominate. `IPC 92`, `IPC 474`, and `IPC 119` receive large title boosts for generic words such as `without`, `consent`, `possession`, `which`, `section`, and possessive artifacts `b`/`s`.

Root-cause classification:

| Code | Applies? | Evidence |
|---|---|---|
| A. Production path is not using the previous retrieval fix | No | `/api/analyze` and direct `analyzeQuery` use the same `backend/core/retriever.js`; `mobile` does not become `mob`. |
| B. Candidate generation excludes the correct section | No | `IPC 378` and `IPC 379` are present in the `IPC_ONLY` candidate set. |
| C. Candidate generation is too broad | Partly | All non-repealed IPC records are candidates by design, so weak feature extraction lets generic records compete. |
| D. Generic lexical terms dominate scoring | Yes | `IPC 92`, `IPC 474`, and `IPC 119` win mainly through generic token overlap and title boosts. |
| E. Theft-specific features are not being generated | Yes | Extracted keywords are empty; only `mobile phone` is preserved. |
| F. Theft-specific features are generated but not weighted correctly | Partly | `mobile phone` is generated, but it is insufficient by itself to activate the theft boost. |
| G. Title/body matching is mis-weighted | Partly | Title boosts for generic `without/consent/possession/section/which` outrank the body-only theft definition. |
| H. Wrong corpus/index data | No | `IPC 378` and `IPC 379` exist correctly with official-source citations. |
| I. Section-number/title parsing problem | No | Section records and titles for `IPC 378`, `IPC 379`, `IPC 92`, `IPC 474`, and `IPC 119` are parsed. |
| J. Other | Yes | Possessive initials create noisy tokens: `B's` becomes `b`, `s`, and both can match statutory illustrations. |

### Implemented Smallest Generalizable Fix

The Applicable Law Check, corpus, sealed predictions, labels, and evaluation methodology were not intentionally changed.

Implemented retrieval/query-representation change:

1. Preserve legally meaningful theft variants in `backend/core/dateExtractor.js`:
   - recognize token-bound taking variants: `take`, `took`, `taking`, in addition to existing `taken`, `takes`, `moved`, `moves`, `stolen`
   - recognize possession phrases with ordinary pronouns/names: `from his possession`, `from her possession`, `from their possession`, `from B's possession`, and equivalent possessive forms
   - recognize consent phrases with ordinary possessives: `without B's consent`, `without his consent`, `without her consent`, `without their consent`, while keeping the existing exact `without consent`
2. Keep the theft boost narrow in `backend/core/retriever.js`:
   - continue requiring a property cue such as `mobile phone`, `movable property`, or `property`
   - continue requiring a consent cue
   - require at least one taking/possession/dishonest-intent cue before boosting `IPC 378`, `IPC 379`, or `BNS 303`
3. Reduced query noise by adding obvious non-legal pronoun/question tokens to retrieval stopwords and filtering single-letter party artifacts such as `b` and `s`.

Why this generalizes:

- It expands legal fact extraction around statutory theft elements rather than hard-coding this query or a blind case.
- It applies to unseen theft wording using common verbs and possessives.
- It preserves routing and corpus isolation.
- It does not globally demote valid consent/good-faith provisions such as `IPC 88`, `IPC 89`, or `IPC 92`.

Regression risks:

- Over-triggering theft for benign possession/consent stories if the cue group becomes too loose.
- Suppressing valid consent/general-exception provisions if title boosts are broadly penalized.
- Accidentally affecting legal examples that use party initials such as `A`, `B`, and `Z`.

Regression tests added:

- Exact reproduced query retrieves `IPC 378`/`IPC 379` above `IPC 92`, `IPC 474`, and `IPC 119`.
- `mobile` still does not trigger `mob`.
- Existing explicit `IPC 379` query still returns `IPC 379` first.
- Existing strong mobile-phone theft query still returns `IPC 378`/`IPC 379`.
- A good-faith medical/no-consent query still retrieves consent/general-exception provisions.
- A forged-document possession query still retrieves `IPC 474`.
- A public-servant concealment query still retrieves `IPC 119`.

### Fix 1: Homicide Review-Support Feature Group

Target cases:

- `blind-003`

General rule:

When an IPC-routed query contains death-causing language such as `caused death`, `intentionally caused death`, `intention of causing death`, or equivalent token-bound variants, boost homicide review-support provisions:

- `IPC 299`
- `IPC 300`

For BNS-routed or multi-period cases, the equivalent BNS homicide provisions may be considered only if supported by official mappings/corpus and separately validated.

Guardrails:

- Do not suppress general exception sections globally.
- Do not force a unique murder vs culpable homicide conclusion.
- Add review wording in tests/documentation: this surfaces candidates for review.

Regression tests to add:

- Pre-commencement intentional death query includes `IPC 299` and `IPC 300` in Top-3.
- Consent/good-faith queries still retrieve `IPC 88/89/92` where appropriate.

### Fix 2: Broaden Cheating Cues for Multi-Period Review Support

Target cases:

- `blind-005`

General rule:

Extend the existing cheating feature group to include narrow variants:

- `deceptive`
- `deception`
- `delivery of property`
- `caused delivery of property`

When these appear with property-delivery facts, boost the existing cheating candidates:

- `IPC 415`
- `IPC 420`
- `BNS 318`

Guardrails:

- Do not treat delivery alone as cheating.
- Do not choose a final law for multi-period cases.
- Preserve `MULTI_PERIOD_REVIEW`.
- Keep the existing delivery-only non-cheating regression test.

Regression tests to add:

- Multi-period deceptive delivery-of-property query includes `IPC 420` and `BNS 318`.
- Delivery-only/courier/counterfeit-coin queries do not get forced to cheating.

### Fix 3: Mapping-Reference Retrieval Support for Missing IPC Text

Target cases:

- `blind-009`

General rule:

For IPC mapping-reference records only, allow retrieval scoring to consult the mapped BNS counterpart's official text and keywords as auxiliary matching evidence, while returning the IPC mapping-reference record and preserving its citation limitation.

Example:

- `IPC 354D` is a mapping-reference record.
- It maps to `BNS 78`.
- If the query is `IPC_ONLY`, retrieval may use `BNS 78` terms like `follows`, `monitors`, `electronic communication`, and `stalking` to score `IPC 354D`.
- The returned record must still be clearly identified as a comparative-chart mapping-reference, not primary IPC text.

Guardrails:

- Only apply to `recordType: "mapping-reference"` records.
- Only use mappings already present in `mapsTo`.
- Do not add unofficial text to the corpus.
- Do not modify `backend/data/statutes.json` unless a separate corpus-generation decision is made.
- Do not claim primary IPC text exists.

Regression tests to add:

- Pre-commencement stalking-like facts surface `IPC 354D` as a mapping-reference candidate.
- A generic fear/extortion query still retrieves extortion provisions, not stalking.

## Fixes Not Recommended

- Do not change `backend/core/gateway.js`.
- Do not use `requiresExpertReview` cases as official provision-accuracy denominators.
- Do not add blind-case IDs, exact blind strings, or hard-coded expected sections.
- Do not globally demote `IPC 88/89/92`; they are valid for good-faith/consent queries.
- Do not insert unofficial IPC 354D statutory text into the corpus.
- Do not overwrite sealed evaluation reports.

## Implementation Gate

Production implementation should begin only after this plan is reviewed.

Recommended next implementation order:

1. Fix 2: broaden cheating cues for multi-period review support.
2. Fix 1: homicide review-support feature group.
3. Fix 3: mapping-reference auxiliary scoring, only if the citation limitation is acceptable.

Each fix should be implemented as a separate logical change with regression tests and documentation updates.
