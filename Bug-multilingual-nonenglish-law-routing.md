# Bug - Multilingual Non-English Law Routing

Date: 2026-10-01

## Problem

Typed/pasted non-English legal queries could fail before reaching the legal pipeline or could lose the offense date before the Applicable Law Check.

Observed controlled failures:

- Hindi theft text was detected as unsupported and rejected.
- Marathi theft text was detected as unsupported and rejected.
- Telugu date text normalized but translation attached English prose directly to the ISO date, so the date comparison failed.
- Malayalam year-first native date text translated to `2024 June 20`, which the date extractor did not parse.
- A translated stolen-property word order could miss the existing theft feature signal.
- Gujarati remained unsafe because the local translation model added an unmentioned weekday.

## Investigation

Relevant files:

- `backend/core/multilingual.js`
- `backend/core/dateExtractor.js`
- `backend/core/retriever.js`
- `frontend/app.js`
- `frontend/index.html`
- `tests/multilingual.test.js`
- `tests/voiceInput.test.js`

Root causes:

- Automatic language detection can mislabel short Devanagari legal text as an unsupported language.
- There was no written-language selector to let the user override unreliable typed-language detection.
- Native date normalization covered common day-month-year forms, but not localized year-month-day forms.
- Normalized ISO dates could sit adjacent to native suffix/prose and later become attached to translated English text.
- The existing stolen-property cue did not cover `got my ... stolen` word order.

Non-root cause:

- The deterministic Applicable Law Check was not the cause and was not changed.

## Decision

Make a narrow multilingual input-preservation fix:

- Add script fallback only for supported Indian scripts when detector output is unsupported or unreliable.
- Add a written-language selector for typed/pasted input.
- Validate selected written language against the input script.
- Normalize localized year-month-day dates and preserve spacing after normalized dates.
- Extend the existing stolen-property phrase cue to include translated `got my ... stolen` wording.

## Implementation

Production files changed:

- `backend/core/multilingual.js`
- `backend/core/dateExtractor.js`
- `frontend/index.html`
- `frontend/app.js`
- `frontend/style.css`

Tests changed:

- `tests/multilingual.test.js`
- `tests/voiceInput.test.js`

## Tests

Commands run:

```text
npm test -- --test-name-pattern="multilingual|written language|stolen-property|native digits|script fallback|selected written|voice analysis|Marathi model disagreement|original speech language"
npm test
npm run evaluate
node scripts\score_official_source_evaluation.mjs evaluation\runs\blind-predictions.json evaluation\official-source-reference-evaluation\official-source-reference-labels.json output\multilingual-verification\official-source-score-after-multilingual-fix.json
```

Results:

- Focused regression run: 175/175 passed.
- Full suite: 175/175 passed.
- Mapping benchmark: IPC 104/104 and BNS 104/104 Top-1/Top-3.
- Separate official-source scorer preserved the historical sealed metrics because it scores sealed predictions, not the current code.

Real controlled smoke checks:

- Hindi, Marathi, Bengali, Tamil, Telugu, Kannada, Malayalam, Punjabi, and Urdu controlled theft/date inputs routed to `IPC_ONLY` and retrieved IPC 379/378 first.
- Gujarati controlled theft/date input still rejects with `TRANSLATION_FACT_CHANGED` because the translation model inserted an unmentioned weekday.

## Result

The main non-English input path is now more reliable for controlled native-script theft/date examples without changing legal routing, legal corpus, sealed predictions, official-source labels, or evaluation methodology.

Remaining risk:

- This is not a general multilingual legal-accuracy claim.
- Translation quality for arbitrary long legal sentences still needs separate bilingual review and more examples.

## Follow-up Fix: Gujarati Date Connector

Date: 2026-10-01

Additional root cause:

- After date normalization, Gujarati `20 જૂન 2024 ના રોજ ...` became `2024-06-20 ના રોજ ...`.
- The ISO date was correct, but the local translation model translated the remaining date connector `ના રોજ` as `on Sunday`.
- The existing weekday verifier then correctly rejected the result as `TRANSLATION_FACT_CHANGED`.

Fix:

- Remove `ના રોજ` only when it immediately follows a normalized ISO date.
- Keep the ISO date and all legal fact text.
- Keep the weekday fact-change guard unchanged.

Verification:

- Focused regression run: 176/176 passed.
- Live website all-language matrix: 11/11 controlled theft/date inputs returned `2024-06-20`, `IPC_ONLY`, and `IPC 379` Top-1.
- Full suite: 176/176 passed.
- Mapping benchmark: IPC and BNS each 104/104 Top-1 and Top-3.
