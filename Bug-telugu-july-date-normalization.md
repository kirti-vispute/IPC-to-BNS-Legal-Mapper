# Bug: Telugu July Date Is Not Normalized After Translation

## Problem

In the all-language matrix run on 2026-10-01, Telugu pre-transition theft passed, but Telugu post-transition July cases failed date extraction.

Passing Telugu June example:

`20 జూన్ 2024న నా మొబైల్ ఫోన్ దొంగిలించబడింది.`

Failing Telugu July examples translated into English like:

- `10 July 2024On my mobile phone was stolen.`
- `10 July 2024The accused seriously injured another person.`
- `10 July 2024On one occasion, a man was deceived and deceived into giving property.`

Because there is no space after `2024`, the English date extractor does not match the date and the route becomes `CLARIFY`.

## Root Cause

This is a date-preservation formatting issue in the Telugu translation/normalization boundary. The original native date is present, but after translation it can become attached to the following English word (`2024On`, `2024The`), preventing normal English date extraction.

## Constraints

- Do not guess or invent dates.
- Do not alter the deterministic Applicable Law Check.
- Do not weaken date verification.
- Do not modify sealed predictions, official labels, corpus, or evaluation methodology.

## Recommended Next Step

Add a narrow spacing repair after translation only when a valid preserved written date is immediately followed by an ASCII letter, for example:

`10 July 2024On` -> `10 July 2024 On`

Then add regression tests for Telugu July theft, injury, and cheating date preservation.

## Resolution - 2026-10-01

Implemented two bounded fixes in `backend/core/multilingual.js`:

- Added the Telugu long-vowel month alias `జూలై` so Telugu July dates normalize before translation.
- Added a narrow post-translation spacing repair for valid English written dates glued to the next ASCII word.

Regression coverage was added in `tests/multilingual.test.js` for a Telugu July input whose translated text glues the date to the next word.

Validation:

- Full test suite: `186/186` passed.
- All-language matrix: Telugu post-transition theft, injury, and cheating now route to `BNS_PRIMARY`; full matrix result `44/44`.
- Mapping benchmark remained `104/104` IPC and `104/104` BNS Top-1/Top-3.
- Sealed predictions, official-source labels, official report, corpus, manifest, evaluation methodology, and Applicable Law Check were not changed.
