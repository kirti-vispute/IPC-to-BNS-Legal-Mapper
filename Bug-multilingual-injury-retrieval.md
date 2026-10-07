# Bug: Multilingual Serious-Injury Retrieval Mismatch

## Problem

The English query:

`On 10 July 2024, the accused seriously injured another person.`

and the Hindi query:

`10 जुलाई 2024 को आरोपी ने एक व्यक्ति को गंभीर चोट पहुंचाई।`

both had the same legal facts, but they produced unrelated and different retrieved BNS provisions.

## Reproduction

Before the fix:

- English routed correctly to `BNS_PRIMARY`, but retrieved `BNS 232`, `BNS 351`, and `BNS 319`.
- Hindi translated correctly to `2024-07-10  The accused seriously injured one person.`, routed correctly to `BNS_PRIMARY`, but retrieved `BNS 126`, `BNS 127`, and `BNS 136`.

## Root Cause

This was not an Applicable Law Check problem. It was also not primarily a Hindi translation problem.

The extractor did not preserve `injured`, `seriously injured`, `serious injury`, `hurt`, or `grievous hurt` as legal retrieval features. With no hurt/grievous-hurt feature, retrieval relied on generic lexical overlap such as `person`, `injury`, `causes`, and `another`, causing unrelated sections about threats, obstruction, restraint, and assault to outrank the official hurt provisions.

## Decision

Add a narrow hurt/grievous-hurt feature for fact-only injury descriptions, generalized at the concept level rather than only one sentence:

- `seriously injured`
- `serious injury`
- `grievous hurt`
- `caused hurt`
- `caused injury`
- `physical injury`
- `physical harm`
- `bodily pain`
- wounds and violence causing injury/hurt/pain

Rank official hurt provisions higher only when the query is fact-only. Treat ordinary "seriously injured" wording as a hurt/injury fact pattern, not automatic grievous hurt. Rank grievous-hurt provisions first only when the query explicitly says grievous hurt or contains equivalent grievous wording. Do not treat non-bodily harm, such as economic harm, as hurt. If an explicit section reference is present, do not apply this feature boost, so the existing exact-reference and official IPC-BNS mapping signals remain dominant.

## Implementation

Changed:

- `backend/core/dateExtractor.js`
- `backend/core/retriever.js`
- `tests/retriever.test.js`
- `tests/multilingual.test.js`

The retrieval boost currently promotes:

- BNS ordinary serious-injury facts: `BNS 115`, `BNS 114`, with `BNS 117` retained as a review candidate
- BNS explicit grievous-hurt facts: `BNS 117`, `BNS 116`
- IPC ordinary serious-injury facts: `IPC 321`, `IPC 319`, with grievous-hurt provisions retained as review candidates
- IPC explicit grievous-hurt facts: `IPC 322`, `IPC 320`, `IPC 325`
- A shared `hurt` concept is extracted from several injury/harm phrasings so the Top-3 remains within the hurt family instead of unrelated threat/intimidation sections.

## Tests

- Focused regression run: 183 passed, 0 failed.
- Full suite: 183 passed, 0 failed.
- Mapping benchmark: IPC 104/104 and BNS 104/104 Top-1/Top-3.
- Real local Hindi translation check returned `BNS 115`, `BNS 114`, `BNS 117`.
- Live server check on `http://localhost:3001` returned `BNS 115` Top-1 for the Hindi query.
- Unseen injury phrasings such as wounded, bodily pain, beat/caused injury, hit/physical injury, and attacked/bodily harm keep hurt-family provisions above unrelated threat/intimidation provisions.
- Negative tests confirm economic harm and threat-only wording do not become hurt cases.

## Result

After the fix:

- English query Top-3: `BNS 115`, `BNS 114`, `BNS 117`.
- Hindi query Top-3: `BNS 115`, `BNS 114`, `BNS 117`.
- Explicit grievous-hurt query Top-3: `BNS 117`, `BNS 116`, `BNS 115`.

## Remaining Risk

The phrase "seriously injured" can be legally fact-sensitive. This fix improves retrieval candidates from official-source sections; it does not replace lawyer/expert review or decide final charging correctness.
