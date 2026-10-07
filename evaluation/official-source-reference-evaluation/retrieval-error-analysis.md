# Retrieval Error Analysis for Resolved Official-Source Reference Cases

## Scope and Method

This analysis covers only the 5 blind cases that were resolved for Top-1, Top-3, and citation scoring in the official-source reference evaluation:

- `blind-001`
- `blind-002`
- `blind-004`
- `blind-007`
- `blind-010`

This is not independent lawyer validation. The reference provisions are official-source reference labels derived from the local government/legal corpus. They are not expert labels, legal advice, or a real-case charging opinion.

The sealed predictions were used only for post-hoc error analysis after the official-source reference labels and report already existed. The prediction file was not modified. Observed sealed prediction file SHA-256:

`869C7F716261A2080592BA53F06F2E5E86C9907E78309607D5661E645252E91D`

The current evaluated result remains unchanged:

- Applicable-law accuracy: `100%` on 9 eligible cases
- Top-1 provision accuracy: `40%` on 5 resolved cases
- Acceptable Top-3 any-hit accuracy: `40%` on 5 resolved cases
- Exact Top-1 citation accuracy: `40%` on 5 resolved cases

## Pipeline Behavior Relevant to Retrieval

The deterministic applicable-law check correctly routed all 5 resolved cases:

| Case | Reference route | Predicted route | Route correct |
|---|---:|---:|---:|
| `blind-001` | `IPC_ONLY` | `IPC_ONLY` | Yes |
| `blind-002` | `BNS_PRIMARY` | `BNS_PRIMARY` | Yes |
| `blind-004` | `BNS_PRIMARY` | `BNS_PRIMARY` | Yes |
| `blind-007` | `BNS_PRIMARY` | `BNS_PRIMARY` | Yes |
| `blind-010` | `BNS_PRIMARY` | `BNS_PRIMARY` | Yes |

The observed retrieval misses therefore come after date extraction and corpus routing. The retriever uses token overlap, IDF, title-token boost, exact section-reference boost, mapped-reference boost, and primary-code ordering. For fact-only questions with no explicit section number and no offence title, the ranking depends heavily on which tokens are extracted and which corpus records share those tokens.

## Case Analysis

### `blind-001`

**Query/case**

> On 20 June 2024, property was dishonestly moved out of another person's possession without consent.

**Legal facts needing a reference answer**

- Date of alleged conduct: `20 June 2024`
- Dishonest intention
- Movable property
- Movement from another person's possession
- Absence of consent

**Official reference provision**

| Field | Value |
|---|---|
| Applicable law | `IPC_ONLY` |
| Reference Top-1 | `IPC 378`, Theft |
| Acceptable provisions | `IPC 378`, `IPC 379` |
| Authoritative source | The Indian Penal Code, 1860, Ministry of Home Affairs, Government of India |
| PDF/page/section | `ipc-1860-mha.pdf`, p. 152, `IPC 378`; p. 154, `IPC 379` |

**System Top-3 retrieved provisions**

| Rank | Provision | Title | Source |
|---:|---|---|---|
| 1 | `IPC 403` | Dishonest misappropriation of property | `ipc-1860-mha.pdf`, p. 161 |
| 2 | `IPC 404` | Dishonest misappropriation of property possessed by deceased person at the time of his death | `ipc-1860-mha.pdf`, p. 163 |
| 3 | `IPC 92` | Act done in good faith for benefit of a person without consent | `ipc-1860-mha.pdf`, p. 31 |

**Why the correct provision was missed**

The applicable-law route was correct. The retrieval failure came from weak offence-phrase recognition. The extracted keywords were only `dishonest` and `property`; the system did not preserve the full theft-defining phrase: movable property, out of possession, without consent, moved/taken. Because `IPC 403` has a title containing both `dishonest` and `property`, it received stronger lexical/title support than `IPC 378`, whose title is only `Theft`. The query also did not explicitly say "theft" or "IPC 378", so exact-section and title matching could not rescue the correct record.

**Failure classification**

- `query/entity extraction`: extracted too few legally meaningful elements
- `lexical matching`: broad words matched misappropriation more strongly than theft
- `title matching`: title boost favored "Dishonest misappropriation of property"
- `ranking`: `IPC 378` did not enter Top-3

Not implicated: `applicable-law routing`, `IPC-BNS mapping`, `corpus/provenance`.

**Can this be fixed without weakening the Applicable Law Check?**

Yes. The date route should remain unchanged. The fix belongs inside retrieval feature extraction/ranking after the route has already selected `IPC_ONLY`.

**Smallest safe retrieval improvement**

Add a narrow deterministic theft-element phrase boost when the query contains a high-confidence combination such as:

`dishonest/dishonestly` + `property` + `possession` + `without consent` + `move/moved/take/taken`

Within an `IPC_ONLY` route, that should boost `IPC 378` and optionally its punishment companion `IPC 379`. This is safer than changing law routing or using model-generated labels.

### `blind-002`

**Query/case**

> On 12 July 2024, movable property was dishonestly taken from another person's possession without consent.

**Legal facts needing a reference answer**

- Date of alleged conduct: `12 July 2024`
- Dishonest intention
- Movable property
- Taking from another person's possession
- Absence of consent

**Official reference provision**

| Field | Value |
|---|---|
| Applicable law | `BNS_PRIMARY` |
| Reference Top-1 | `BNS 303`, Theft |
| Acceptable provisions | `BNS 303` |
| Authoritative source | The Bharatiya Nyaya Sanhita, 2023, Gazette of India, Ministry of Law and Justice |
| PDF/page/section | `bns-2023-official-gazette.pdf`, p. 78, `BNS 303` |

**System Top-3 retrieved provisions**

| Rank | Provision | Title | Source |
|---:|---|---|---|
| 1 | `BNS 314` | Dishonest misappropriation of property | `bns-2023-official-gazette.pdf`, p. 83 |
| 2 | `BNS 129` | Criminal force | `bns-2023-official-gazette.pdf`, p. 43 |
| 3 | `BNS 320` | Dishonest or fraudulent removal or concealment of property | `bns-2023-official-gazette.pdf`, p. 87 |

**Why the correct provision was missed**

The route was correct: post-commencement conduct was sent to BNS-primary retrieval. The failure is the BNS version of the theft miss in `blind-001`. The extracted keywords were `movable`, `dishonest`, and `property`, but not the complete statutory element chain. `BNS 314` has a noisy extracted title that includes "dishonestly", "movable", and "property", so it outranked `BNS 303`, even though `BNS 303` contains the exact theft definition in its text. The query did not include the title word "theft" or a section number.

There is also a harmless extractor artifact: `continuingSignal` was true because the regex treats the word "from" as a possible continuing-period signal. Since the case had only one date, this did not change the route and did not cause the provision miss.

**Failure classification**

- `query/entity extraction`: statutory theft elements were not converted into a strong offence cue
- `lexical matching`: broad overlap favored misappropriation
- `title matching`: title boost favored `BNS 314`
- `ranking`: `BNS 303` did not enter Top-3

Not implicated: `applicable-law routing`, `IPC-BNS mapping`, `corpus/provenance`.

**Can this be fixed without weakening the Applicable Law Check?**

Yes. The applicable-law check should continue to select BNS for post-1 July 2024 conduct. The retrieval improvement should only boost theft candidates inside the already allowed corpus.

**Smallest safe retrieval improvement**

Reuse the same high-confidence theft-element phrase boost across the selected framework:

`dishonest/dishonestly` + `movable property/property` + `possession` + `without consent` + `take/taken/move/moved`

When the route is `BNS_PRIMARY`, this should boost `BNS 303`; when the route is `IPC_ONLY`, it should boost `IPC 378`.

### `blind-004`

**Query/case**

> On 12 July 2024, a person was deceived and dishonestly induced to deliver property.

**Legal facts needing a reference answer**

- Date of alleged conduct: `12 July 2024`
- Deception
- Dishonest inducement
- Delivery of property

**Official reference provision**

| Field | Value |
|---|---|
| Applicable law | `BNS_PRIMARY` |
| Reference Top-1 | `BNS 318`, Cheating |
| Acceptable provisions | `BNS 318` |
| Authoritative source | The Bharatiya Nyaya Sanhita, 2023, Gazette of India, Ministry of Law and Justice |
| PDF/page/section | `bns-2023-official-gazette.pdf`, p. 86, `BNS 318` |

**System Top-3 retrieved provisions**

| Rank | Provision | Title | Source |
|---:|---|---|---|
| 1 | `BNS 314` | Dishonest misappropriation of property | `bns-2023-official-gazette.pdf`, p. 83 |
| 2 | `BNS 320` | Dishonest or fraudulent removal or concealment of property | `bns-2023-official-gazette.pdf`, p. 87 |
| 3 | `BNS 322` | Dishonest or fraudulent execution of deed of transfer | `bns-2023-official-gazette.pdf`, p. 87 |

**Why the correct provision was missed**

The applicable-law route was correct. This is the strongest evidence of a retrieval feature gap because the query closely tracks the statutory language for cheating: deceiving a person, dishonestly inducing, and delivery of property. However, the extracted keywords were only `dishonest` and `property`; the vocabulary does not include `deceived`, `deceiving`, `induced`, `induces`, or `deliver`. The title "Cheating" did not match because the query did not use the word "cheating". As a result, sections with noisy titles containing "dishonestly" and "property" outranked `BNS 318`.

This is not a corpus availability issue. `BNS 318` exists in the corpus with the correct official source page, and its text contains the relevant concepts. The retriever simply did not give those concepts enough searchable weight from the query.

**Failure classification**

- `query/entity extraction`: missed `deceived`, `induced`, and `deliver`
- `lexical matching`: over-weighted generic `dishonest` and `property`
- `title matching`: could not connect the statutory elements to the offence title "Cheating"
- `ranking`: `BNS 318` did not enter Top-3

Not implicated: `applicable-law routing`, `IPC-BNS mapping`, `corpus/provenance`.

**Can this be fixed without weakening the Applicable Law Check?**

Yes. The route should remain `BNS_PRIMARY`. The fix is a deterministic legal-element recognizer for cheating that boosts `BNS 318` only after the applicable-law route has already selected the allowed corpus.

**Smallest safe retrieval improvement**

Add a narrow cheating-element phrase boost:

`deceived/deceiving/deception` + `dishonest/dishonestly/fraudulent/fraudulently` + `induced/induces/inducement` + `deliver/delivery/property`

Within `BNS_PRIMARY`, boost `BNS 318`. Within `IPC_ONLY`, the equivalent boost should point to IPC cheating provisions only where the route allows IPC. Add regression tests using this blind-style case wording so the fix is evidence-driven.

### `blind-007`

**Query/case**

> On 12 July 2024, a crime syndicate carried out continuing unlawful activity involving repeated serious offences.

**Legal facts needing a reference answer**

- Date of alleged conduct: `12 July 2024`
- Organised crime syndicate
- Continuing unlawful activity
- Serious predicate offences
- Remaining statutory elements

**Official reference provision**

| Field | Value |
|---|---|
| Applicable law | `BNS_PRIMARY` |
| Reference Top-1 | `BNS 111`, Organised crime |
| Acceptable provisions | `BNS 111` |
| Authoritative source | The Bharatiya Nyaya Sanhita, 2023, Gazette of India, Ministry of Law and Justice |
| PDF/page/section | `bns-2023-official-gazette.pdf`, p. 35, `BNS 111` |

**System Top-3 retrieved provisions**

| Rank | Provision | Title | Source |
|---:|---|---|---|
| 1 | `BNS 111` | Organised crime / continuing unlawful activity | `bns-2023-official-gazette.pdf`, p. 35 |
| 2 | `BNS 146` | Unlawful compulsory labour | `bns-2023-official-gazette.pdf`, p. 47 |
| 3 | `BNS 189` | Unlawful assembly | `bns-2023-official-gazette.pdf`, p. 54 |

**Why the correct provision was ranked correctly**

There was no retrieval error. The extracted keywords were `crime`, `syndicate`, `continuing`, and `unlawful`, which are strong signals for `BNS 111`. The reference section also contains the distinctive phrase "continuing unlawful activity" and the syndicate concept, so token matching was sufficiently discriminative.

The lower-ranked results show expected residual lexical overlap on the word `unlawful`, but the correct provision remained Top-1 because it matched multiple distinctive terms, not just a generic word.

**Failure classification**

- `other`: no retrieval failure in this case

Not implicated: `query/entity extraction`, `applicable-law routing`, `lexical matching`, `title matching`, `exact-section matching`, `IPC-BNS mapping`, `ranking`, `corpus/provenance`.

**Can this be fixed without weakening the Applicable Law Check?**

No fix is needed. This case supports keeping the current deterministic routing and source-bounded retrieval structure.

**Smallest safe retrieval improvement**

No case-specific change. This should remain a regression/control case to verify that future retrieval changes do not demote `BNS 111` when the query contains `crime syndicate` and `continuing unlawful activity`.

### `blind-010`

**Query/case**

> On 12 July 2024, a person was wrongfully prevented from leaving a confined place.

**Legal facts needing a reference answer**

- Date of alleged conduct: `12 July 2024`
- Wrongful prevention from leaving
- Circumscribed limits
- Duration or aggravating purpose, if any

**Official reference provision**

| Field | Value |
|---|---|
| Applicable law | `BNS_PRIMARY` |
| Reference Top-1 | `BNS 127`, Wrongful confinement |
| Acceptable provisions | `BNS 127` |
| Authoritative source | The Bharatiya Nyaya Sanhita, 2023, Gazette of India, Ministry of Law and Justice |
| PDF/page/section | `bns-2023-official-gazette.pdf`, p. 41, `BNS 127` |

**System Top-3 retrieved provisions**

| Rank | Provision | Title | Source |
|---:|---|---|---|
| 1 | `BNS 127` | Wrongful confinement | `bns-2023-official-gazette.pdf`, p. 41 |
| 2 | `BNS 126` | Wrongful restraint | `bns-2023-official-gazette.pdf`, p. 41 |
| 3 | `BNS 142` | Concealing or wrongfully keeping a kidnapped or abducted person in confinement | `bns-2023-official-gazette.pdf`, p. 46 |

**Why the correct provision was ranked correctly**

There was no retrieval error. The wording "wrongfully prevented from leaving a confined place" aligned strongly with `BNS 127`, whose text addresses wrongful confinement and prevention from proceeding beyond circumscribing limits. `BNS 126` was a reasonable second result because wrongful restraint is adjacent and textually related, but the more specific confinement provision was correctly ranked first.

There is a harmless extractor artifact here too: `continuingSignal` was true because the query contains "from". Since the case had only one date, this did not affect routing.

**Failure classification**

- `other`: no retrieval failure in this case

Not implicated: `query/entity extraction`, `applicable-law routing`, `lexical matching`, `title matching`, `exact-section matching`, `IPC-BNS mapping`, `ranking`, `corpus/provenance`.

**Can this be fixed without weakening the Applicable Law Check?**

No fix is needed. The current retrieval behavior is appropriate for this case.

**Smallest safe retrieval improvement**

No case-specific retrieval change. A minor non-scoring cleanup could make `continuingSignal` less sensitive to standalone "from", but this should be tested carefully because the multi-period route depends on detecting genuine date spans.

## Main Failure Patterns

1. The Applicable Law Check is working for the resolved set. All 5 resolved cases were routed to the same legal framework as the official-source references.

2. Failed cases are fact-only prompts without explicit offence names or section numbers. The misses occur when the query describes the legal elements but does not say "theft", "cheating", `IPC 378`, `BNS 303`, or `BNS 318`.

3. The extractor captures broad legal words but misses multi-word statutory element patterns. Examples: `without consent`, `out of possession`, `taken from possession`, `deceived`, `induced`, and `deliver property`.

4. Generic property/dishonesty overlap is too influential. `IPC 403`, `BNS 314`, `BNS 320`, and `BNS 322` were ranked because they share high-frequency legal words such as dishonest/dishonestly and property.

5. Title matching helps when the query uses distinctive title-like terms, as in `crime syndicate` and `wrongfully/confined`, but it fails when the query gives statutory elements and the title is short, such as `Theft` or `Cheating`.

6. Corpus/provenance is not the main problem in these 5 resolved cases. The correct official sections are present in the corpus with official PDF/page citations.

## Fixes Justified by the Evidence

- Add deterministic offence-element phrase boosts for high-confidence theft and cheating patterns.
- Expand keyword/entity extraction to include legally meaningful variants such as `deceived`, `deceiving`, `induced`, `induces`, `inducement`, `deliver`, `delivery`, `consent`, `possession`, `move`, `moved`, `take`, and `taken`.
- Prefer bounded phrase matching over broad semantic guessing. The evidence supports narrow rules tied to statutory element combinations.
- Add regression tests for the resolved failed cases before changing production retrieval.
- Keep official source citations and provenance checks exactly as they are.

## Fixes That Should Not Be Made

- Do not weaken, bypass, or replace the deterministic Applicable Law Check. The routing result is already correct on the resolved set.
- Do not use unresolved `requiresExpertReview` cases to tune Top-1/Top-3 provision accuracy.
- Do not fabricate lawyer labels or present official-source reference labels as expert validation.
- Do not change `blind-predictions.json` or the official evaluation result to make the metric look better.
- Do not add broad cross-code retrieval that allows BNS provisions to dominate pre-commencement IPC-only cases.
- Do not rely on an LLM to override the route or provision answer without citation-bound retrieval evidence.

## Architecture Assessment

The current `40%` Top-1 and Top-3 provision result does not show a deterministic applicable-law architecture problem. It shows a retrieval ranking problem on a very small resolved set, especially for fact-only prompts that describe offence elements without using offence titles or section numbers.

The evidence is mixed but useful:

- `blind-007` and `blind-010` show that the architecture can retrieve the correct provision when the query contains distinctive statutory concepts.
- `blind-001`, `blind-002`, and `blind-004` show that the current lexical retriever is too shallow for element-level legal descriptions.
- `blind-004` is the most important miss because the query is close to the statutory wording for cheating, yet `BNS 318` did not enter Top-3. That indicates a real phrase/entity extraction gap, not just an underspecified test case.

So the result is best described as mostly a targeted retrieval feature problem, amplified by difficult synthetic cases and a small evaluation denominator. It does not justify replacing the whole architecture. It does justify narrow, deterministic legal phrase matching and regression tests while preserving the Applicable Law Check.
