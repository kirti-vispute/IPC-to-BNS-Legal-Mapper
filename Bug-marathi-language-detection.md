# Bug: Marathi/Hindi Language Identification

Date: 2026-09-26. Local free stack retained; no legal pipeline/model/corpus changes.

## Problem and Investigation

Input: `फसवणुकीचे कृत्य 20 जून 2024 रोजी सुरू झाले आणि 10 जुलै 2024 पर्यंत सुरू राहिले.`

Before: real py3langid returned Hindi 0.926573, Marathi second 0.072292, Nepali third 0.001135. Removing digits/Latin characters did not change that ranking. Code used actual local statistical identification, not Devanagari -> Hindi. Taking the single model winner above0.8 caused wrong input/output language selection.

## Decision and Implementation

Keep full-language py3langid rankings. `backend/translation/worker.py resolve_detection()` uses independent grammatical families: temporal connectors, conjunctions, inflected verbs, pronouns and taking/consent forms. A safeguard requires Hindi first <0.98, Marathi second >=0.05, at least three Marathi families and no Hindi family. Single-word/script/strong-Hindi/unsupported-language overrides are not allowed. Report language_code, detected_language, actual selected-language confidence, detection_method, original model winner/probability and evidence-group counts. `multilingual.js` stores language/method diagnostics, not unnecessary UI debug logs. Marathi probability remains0.072292 for this consensus-resolved example; it is not relabelled as92.7% Marathi confidence.

Real translation then exposed an additional acceptance blocker: the isolated fragment `रोजी सुरू झाले आणि` generated "It started on July 1st,". Numerical safeguards rejected it. `translateInputQuery()` retains multi-date sentence context using literal markers, exact count/order/restoration and rejection of new numerals/statute identifiers. Existing date-set and weekday checks remain. Ordinary inputs/output use field/literal-span translation. No date, continuing signal or law is guessed/forced.

## Tests and Result

tests/languageDetection.test.js runs the real detector for eight supplied/related HI/MR inputs plus a pure resolver boundary check. It separately uses controlled translations for routing contracts, explicitly not translation-quality claims. tests/multilingual.test.js covers method/probability, contextual literal restoration and missing/altered/duplicated/reordered markers/invented numbers. Real NLLB input/output acceptance is run separately by scripts/verify_multilingual_bugs.mjs.

Real corrected range -> Marathi; English query "The fraud started on 2024-06-20 and continued till 2024-07-10." -> MULTI_PERIOD_REVIEW; both dates exact; Marathi display narrative returned. Canonical retrieval/citation/IRAC objects equal unchanged English pipeline output. This does not imply its loosely specified fraud provisions are legally correct. Remaining generated wording and retrieval failures are recorded in Bug-multilingual-formatting.md and the ignored raw observations. Final overall results are in Handover.md/TestChecklist.md.

Final: full suite104/104; dedicated multilingual/detector38/38; actual NLLB eight-case completion and Hindi protected-format check passed. Mapping104/104 per code and resolved replay5/5 each unchanged. All38 protected files unchanged. No independent legal/translation validation claimed.

## Risks and Rollback

The consensus is a bounded heuristic, not independently validated language accuracy; short/romanized/mixed-language inputs can still fail. Marker corruption fails closed; long multi-date queries may exceed the existing400-token model cap. Translation can alter actors/intention or other semantics undetected. Reversal is described in Rollback.md with matching pre-change backups. No new dependency, paid service or training.
