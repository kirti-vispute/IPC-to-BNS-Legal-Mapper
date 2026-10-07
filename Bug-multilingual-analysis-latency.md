# Bug: Multilingual Analysis Latency

Current update (2026-10-02): output translation was later restored by default for eight languages to meet the user-facing language requirement. A reusable local translation worker now addresses repeated process/model loading while retaining localized output. Measurements, tests and memory tradeoff are in `Feature-fast-local-translation.md`. The older skip-output decision below is historical, not the current default for those eight languages.

## Problem

Non-English typed analysis took too long because the backend translated the user input into English for legal processing and then translated selected output presentation text back into the native language. The second pass delayed the answer even though the legal decision, retrieved provisions, citations and IRAC had already been computed.

## Investigation

Measured local runs before the fix showed:

- Gujarati: about 29.9 seconds total, with about 18.1 seconds spent on output presentation translation.
- Tamil: about 30.1 seconds total, with about 18.0 seconds spent on output presentation translation.
- Marathi: about 23.5 seconds total, with about 11.8 seconds spent on output presentation translation.

The legal pipeline itself was not the bottleneck. The expensive part was the second English-to-native model call.

## Decision

Skip output machine translation by default and keep only input translation for legal analysis. Keep the old output-translation path available behind `LOCAL_OUTPUT_TRANSLATION=1` for manual demonstrations where slower translated titles/prose are desired.

## Implementation

Changed `backend/core/multilingual.js`:

- Added `OUTPUT_TRANSLATION_ENABLED` from `LOCAL_OUTPUT_TRANSLATION`.
- When disabled, `createLegalPresentation()` is returned without calling `translateTexts()` for English-to-native output.
- The presentation marks this as `outputTranslation: "disabled-fast-path"`.
- The title label changes to the original-source-title wording so English legal source titles are not presented as machine-translated titles.

Updated tests:

- `tests/legalPresentation.test.js`
- `tests/multilingualVoice.test.js`

The tests now assert that non-English analysis still translates input to English but does not call the output translator by default.

## Tests

- Focused multilingual/presentation/voice regression run: 176 passed, 0 failed.
- Full test suite: 176 passed, 0 failed.
- `npm run evaluate`: IPC 104/104 and BNS 104/104 Top-1/Top-3.
- `npm run evaluate:official`: historical sealed metrics unchanged.
- Protected hashes for sealed predictions, official-source labels/report, legal-source manifest and statute corpus matched baselines.

## Result

Controlled all-language theft/date replay after the fix:

- English: 69 ms.
- Hindi, Marathi, Gujarati, Bengali, Tamil, Telugu, Kannada, Malayalam, Punjabi and Urdu: about 11.1-12.1 seconds each.
- Every sample returned `IPC_ONLY` with `IPC 379` as Top-1.

This is a latency improvement. It is not an independent legal-validation result and does not prove general translation accuracy for every possible legal sentence.

## Remaining Risk

For languages other than Hindi and Marathi, some system prose/source titles may remain in English by default. This is intentional for speed and source safety. Re-enable output translation only when the slower behavior is acceptable.
