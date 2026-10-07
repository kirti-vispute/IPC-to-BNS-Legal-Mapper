# Native Sentence Translation Investigation

Date: 2026-10-02. Status: confirmed defects; experimental fixes rejected, no production change.

## Problem

Long Hindi, Bengali, Punjabi and Urdu inputs can lose actions/clauses during local native-to-English translation, even when dates, section numbers and retrieval checks pass. Gujarati and Kannada cheating examples also lose explicit dishonest intent and are rejected by the existing guard. No bilingual expert reviewed these examples; this investigation does not supply legal or expert labels.

## Investigation

Read `backend/core/multilingual.js`, `backend/translation/worker.py`, the multilingual/date/meaning tests, constraints and handover. No Git repository/branch/commit is available. Baseline full suite: 207/207.

`translateInputQuery()` uses `translateTexts()` for fewer than two dates. `translationParts()` protects literal identifiers/dates, separates ASCII sentence punctuation, then cuts longer spans at spaces within 320 characters. It does not recognize U+0964/U+0965/U+06D4 as sentence punctuation. The real-model trace shows mid-clause cuts in four repeated native fixtures. Multi-date input separately uses `translateMultiDateQuery()` and `splitTranslationInput()`; that path was not changed.

The local NLLB CPU/int8 worker has an independent 400-token input guard, maximum decoding length 400, beam2 default and a bounded beam4 intent/role retry. Token-count and literal checks do not establish semantic completeness. There is no evidence that the observed losses are actual input/output token truncation; the current character splitter and model behavior are distinct concerns.

`scripts/verify_sentence_translation.mjs` exercised the real local model on 15 synthetic probes: repeated taking/retention text in 11 configured languages and four new distinct three-sentence passages (HI/BN/PA/UR). The repeated probes use an explicit IPC379 identifier; their retrieval success is NOT evidence that all facts survived. The English probe deliberately calls translation directly to isolate chunking; the production English path still bypasses translation.

## Observations

Counts below are direct English-output observations, not a multilingual semantic-accuracy score. Source repeated passages each contain five taking/retention statements.

| Probe | Current output | Sentence-by-sentence prototype | Whole-sentence-group prototype |
|---|---|---|---|
| Hindi repeated | Five taking statements, only four retention phrases | Five taking/retention statements | Only four taking/retention statements |
| Bengali repeated | Five taking statements; only last includes retention-like `left it with him` | Five taking and `left it with him` phrases; wording remains ambiguous | Four retention statements; taking disappears, IPC378 absent from Top3 |
| Punjabi repeated | One taking action omitted | Five taking/retention statements | Only four taking/retention statements |
| Urdu repeated | Only four statements | Five statements | Only three statements |
| Urdu distinct, short | `took the phone`; IPC378 first | `called without permission`; IPC403 first | Original complete short passage preserved; IPC378 first |

Other period-separated repeated fixtures produced identical current/prototype English output. Ownership/pronoun ambiguity remains in several languages; identical output does not mean correct translation. The four short distinct probes retained their current outputs with whole-sentence grouping, but that prototype regressed long inputs.

Real full-adapter recheck of GU/KN dishonest-property fixtures: both still reject with `TRANSLATION_INTENT_CHANGED` after the existing bounded retry. No guard bypassed, no missing intent inserted.

## Decision

Do not deploy either prototype. Missing native punctuation is a real representation defect, but changing boundaries alone is not a safely validated semantic fix. Isolating a sentence introduces contextual ambiguity; grouping complete sentences can still trigger omissions. Do not select a strategy by known case ID/language answer, force theft/dishonesty terms, alter ranking to hide translation loss, or claim all long/multilingual cases solved.

## Implementation

Production implementation: none. Added a diagnostic script and eight invariant tests in `tests/sentenceTranslation.test.js`. Tests verify lossless source reconstruction, literal isolation, bounded worker input, order, unchanged short context and ASCII/output literal protection. They do NOT verify real-model semantic accuracy or require the rejected chunking strategy. Provisional whole-sentence-boundary assertions were red (4/8) before any production edit; their source is preserved only as an experiment under ignored `output/sentence-translation/provisional-regressions.test.js`, not deployed as a failing normal test suite.

Evidence: `output/sentence-translation/before.json` (current versus sentence-by-sentence), `context.json` (current versus whole-sentence grouping), `intent-guards.json`, `protected-before.json`, `multilingual.before.js`, `integrity.json`. Native case text is synthetic; no user recordings or benchmark gold answers added. Existing evaluation files were not written.

## Tests And Result

- Before full suite: 207/207; new invariants: 8/8; final full suite: 215/215, no failures/skips.
- Mapping benchmark: IPC104/104 and BNS104/104 Top1/Top3, unchanged; derived from the same crosswalk, not independent accuracy.
- Separate current resolved official-source replay: 5/5 Top1 and Top3, unchanged. Historical sealed result remains40% on five eligible cases; neither predictions nor reference labels/report regenerated.
- Protected audit: 58 evaluation/legal-data/provenance/frontend/legal-core/speech/translation-runtime files unchanged; production multilingual adapter byte-identical to before copy.
- Live site health: http://localhost:3002/api/health returned ok. No frontend, layout, recording or server production edits; no restart required.

## Remaining Work

Next single task: use a disjoint, independently bilingual-checked long-text contrast set (taking versus calling, owner versus actor, permission versus no permission, explicit intent, offence versus reporting dates) to test a context-preserving translation strategy. Current public/synthetic evidence cannot certify general legal meaning. If expert access remains unavailable, report probes only as diagnostics and keep failure guards; do not fabricate validation. Physical microphone and natural long legal-speech accuracy remain unverified.
