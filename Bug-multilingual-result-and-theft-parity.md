# Bug: Multilingual Result and Theft Parity

Date: 2026-10-01

## Problem

Gujarati, Bengali, Tamil, Telugu, Kannada, Malayalam, Punjabi and Urdu queries reached the legal pipeline, but the visible result/system prose stayed English. A native Kannada theft input with an ISO date was rejected. New fact-only Bengali/Telugu BNS theft examples returned unrelated BNS sections.

## Investigation

- `LOCAL_OUTPUT_TRANSLATION` was opt-in, and `frontend/legalPresentation.js` had controlled text only for EN/HI/MR, so the eight other languages fell back to English by default.
- Kannada `2024-06-20 ರಂದು ...` translated to `2024-06-20 On Monday ...`; the existing unmentioned-weekday check correctly rejected it. Translating the same text without date-adjacent `ರಂದು` did not invent a weekday.
- Bengali/Telugu input translated to English theft facts using `stole`/`stolen` and `without permission`. `dateExtractor.js` and `retriever.js` recognized neither active `stole` nor the permission phrase as a theft feature. Both fact-only BNS examples ranked `BNS 232`, `BNS 351`, `BNS 129` ahead of `BNS 303` before the change.

## Decision and Implementation

- Enable the existing local, allowlisted output translation for the eight languages by default; HI/MR stay on their controlled fast path. Add allowlisted interface text, apply it after analysis, and restore English defaults for an English result. The original source/citation/law fields remain literal.
- Remove only Kannada `ರಂದು` following a normalized ISO date before input translation. Keep rejecting any later invented weekday.
- Recognize active `steal`/`stole` inflections and `without permission` in the narrow theft feature. Active stealing verbs require a property cue; `stolen` by itself still does not trigger this new path, preserving receiving-stolen-property behavior.

## Tests and Result

- Full suite: 190/190 passed. New tests cover eight-language output/source isolation, UI language reset, Kannada connector preservation, and IPC/BNS theft wording plus existing negative cases.
- Official mapping benchmark: IPC 104/104 and BNS 104/104 Top-1/Top-3, unchanged.
- Real local input/output smoke: eight affected languages returned `IPC_ONLY`, `IPC 379` Top-1 with unchanged source/citations for the controlled pre-transition mobile-phone case after the Kannada connector fix.
- Real fact-only Bengali and Telugu BNS theft examples: before `BNS 232` Top-1; after `BNS 303` Top-1. These are diagnostic examples, not expert labels.
- Current no-write resolved official-source replay: 5/5 Top-1 and 5/5 acceptable Top-3; historical sealed results remain historical.

## Limits

The local model adds substantial time (roughly 27-48 seconds for observed eight-language checks) and its output can still be awkward or leave individual terms in English. The controlled cases do not establish general legal accuracy or independent lawyer validation. Original statutory source blocks remain in English and should be checked before relying on a result.
