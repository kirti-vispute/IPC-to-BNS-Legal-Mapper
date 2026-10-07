# Bug: Multilingual Cheating Retrieval Fails After Translation

## Problem

In the all-language matrix run on 2026-10-01, the English post-transition cheating query correctly retrieved `BNS 318`, but every non-English version failed to surface `BNS 318` in the Top-3.

Tested fact pattern:

`On 10 July 2024, a person was deceived and dishonestly induced to deliver property.`

## Evidence

The date and Applicable Law Check were usually correct:

- offence date: `2024-07-10`
- route: `BNS_PRIMARY`

But translated English processing text often lost or weakened one or more cheating elements:

- Hindi: `to deceive a person into giving property dishonestly`
- Marathi: `deceived a person and led him to hand over property in disloyalty`
- Gujarati: `tricked into giving property to a behemoth`
- Bengali: `deceived into giving property unjustly`
- Tamil/Kannada: `deceived and deceived into giving property`
- Malayalam: `made them give him false property`
- Punjabi: `deceived into giving property ... in a dishonest manner`
- Urdu: `seduced into deceiving ... giving him property unfaithfully`

Current retrieval then ranked unrelated provisions above `BNS 318`.

## Root Cause

This appears to be a multilingual translation-to-retrieval concept gap, not a date-routing failure. The current cheating boost expects strong English cues such as deception, dishonest inducement, and property delivery. Non-English translations often preserve the general fraud/deception meaning but do not preserve the exact `dishonestly induced to deliver property` wording.

## Constraints

- Do not fabricate legal labels or citations.
- Do not modify the Applicable Law Check to solve this.
- Do not weaken translation fact-change guards.
- Do not hardcode expected answers for specific languages or test sentences.

## Recommended Next Step

Investigate a narrow concept-level cheating extractor similar to the generalized hurt concept:

- deception/trick/fraud cue
- property/giving/hand-over/delivery cue
- dishonest/unjust/unfaithful/disloyal cue when present

Then add regression tests for translated English processing text variants, plus negative guards for non-cheating delivery and unrelated deception.

## Resolution - 2026-10-01

Implemented a narrow concept-level fix in `backend/core/dateExtractor.js` and `backend/core/retriever.js`.

The extractor now recognizes translated cheating-property-transfer variants that appeared in real local translation output:

- `unfairly transferred property`
- `defrauded ... handed over property`
- `defrauding ... sell property`
- `treasonfully taking property`
- `false property`

The rule remains constrained: deception/fraud wording must appear with property-transfer or dishonest-property evidence. Ordinary sale, transfer, giving, taking, or unrelated deception does not promote `BNS 318`.

Regression tests were added in `tests/retriever.test.js`.

Validation:

- Focused regression: `186/186` passed.
- Full test suite: `186/186` passed.
- All-language matrix: improved from `32/44` pre-fix and `40/44` intermediate to `44/44`.
- Mapping benchmark remained `104/104` IPC and `104/104` BNS Top-1/Top-3.
- Current resolved official-source replay remained `5/5` Top-1 and `5/5` Top-3.
- Sealed predictions, official-source labels, official report, corpus, manifest, evaluation methodology, and Applicable Law Check were not changed.
