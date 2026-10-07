# Translation Role Inversion

Date: 2026-10-03. Status: narrow safety-check fix implemented; general translation errors remain unresolved.

## Problem And Investigation

The existing `translationMeaningIssue()` counted extra English accused/defendant roles but did not reject an explicit native accused becoming solely `accuser`. The distinction changes the party in the facts. It could return null even with the wrong role, allowing the shared adapter to proceed to legal analysis.

Read current `backend/core/multilingual.js`, `translationChecks.js`, `backend/translation/worker.py`, `local_tokenizer.py`, tests and root constraints/handover. No Git repository/branch/commit exists. Baseline215/215 tests, current resolved replay5/5, mappingIPC/BNS104/104 each.

Continued the earlier investigation with `scripts/diagnose_translation_context.py`:22 synthetic probes and60 decoding executions, using the installed local model. Two original GU/KN intent failures, four generated context/permission probes, ten whole repeated paragraphs, six Kannada actor variants. These are exploratory software probes, NOT bilingual/expert translations or legal labels.

The beam8 first hypothesis for the known Kannada intent query was `The accuser tricked a man into giving property dishonestly.` The next hypothesis retained `accused`. The unchanged guard accepted the first because it contained no extra accused and did contain dishonesty. Direct invocation reproduced null; the new integration tests reproduced analysis proceeding after one attempt. This confirms a safety-check gap, NOT that the current beam2 HTTP decoder regularly produces this exact error. Six additional actor inputs at current beam2/beam4 retained accused. Do not misreport the experimental error as an observed default UI failure.

Wider search does not solve the other defects: Gujarati candidates introduced Beiman/Behmani/bank/believer parties or lost intent; a Kannada contextual paragraph omitted its second sentence. Intact repeated paragraphs of87-127 input tokens also lost statements, well below the existing400-token limit. Beam4 sometimes improved Hindi, but regressed Marathi/other paragraphs. Coverage penalty produced very negative scores (below the production -5 threshold) and did not prevent omissions. Neither new chunking, token budget, decoding settings nor hypothesis selection was deployed.

Raw diagnostic files: `output/translation-context-search/intent.json`, `long.json`, `actors.json`. No user audio, expert labels, law answers or sealed predictions generated/changed.

## Decision And Implementation

Make one conservative safety-check improvement, not a guessed correction. In `backend/core/translationChecks.js`, if the existing native accused cue is present, English has zero accused/defendant tokens, and English contains the word `accuser`, return `TRANSLATION_ROLE_CHANGED`.

The existing `analyzeMultilingualQuery()` automatically performs one beam4 retry. If the problem remains, return the existing review/rephrase error before date routing, retrieval or IRAC. The guard does not replace words, insert facts, choose a section, change sources or change any model setting. `accuser` is not globally banned: source without an explicit accused cue and output retaining both accused and accuser remain outside this narrow inversion rule. This is not a full semantic/role validator.

Production diff reviewed using `git diff --no-index` against `output/translation-role-fix/translationChecks.before.js`:four added lines only, including a WHY comment. No other production file changed. New regression coverage: two tests in `tests/translationMeaning.test.js`, covering all ten configured native cue families, valid defendant/mixed-party controls, bounded retry/correction, persistent-error rejection, and retained date/explicitBNS318 on mocked corrected output. Mocked English corrections are software behavior fixtures, not fabricated legal gold labels.

## Tests And Result

- New regressions red before fix (2 failures); green after (4/4 focused tests).
- Full suite before215/215; after217/217, no failures/skips.
- Crosswalk-derived mapping benchmarkIPC104/104 andBNS104/104 Top1/Top3, unchanged. Not independent legal accuracy.
- Current resolved official-source replay5/5 Top1/Top3; byte-identical to pre-change replay. Historical sealed40% and original reference/report/methodology untouched.
- Real local model matrix before53/55, after53/55; same GU/KN cheating fixtures reject `TRANSLATION_INTENT_CHANGED`. No new matrix failure. Matrix checks family retrieval/routing/source preservation/native labels, not complete meaning or legal truth.
- Live HTTP after restarting owned backend on3002:EN/HI/MR phone-taking samples returnIPC_ONLY,2024-06-20, IPC378/379 first two. GU/KN intent samples return422, not a fabricated answer. Health endpointok. No new physical microphone test.
- Protected snapshot60 files: only intended normal source `backend/core/translationChecks.js` changed;59 unchanged, including routing/retrieval/IRAC, original and supplemental corpus/provenance, sealed predictions, official references/reports and frontend/speech/runtime. Adapter/server unchanged. See `output/translation-role-fix/integrity.json`, `comparison.json`, `http-check.json`.

## Rollback And Remaining Risks

No Git commit. Safely revert only the four-line inversion branch/comment after comparing with the saved before copy; preserve all existing actor/intent guards and later/user edits. Remove only the two new regression tests if rolling back intentionally; rerun full suite/mapping/separate replay and restart. Never regenerate predictions or edit references to accommodate rollback.

The rule can require review of an ambiguous mixed-party passage if the model omits accused/defendant wording while retaining accuser; it deliberately abstains rather than inventing the party. It does not detect every omitted actor, ownership, negation, action, party-count or dishonest-intent change. Long text, GU/KN intent, natural legal speech, physical microphone and independent bilingual/legal/IRAC validation remain unfinished.

Next single step: evaluate the suitability of a different local translation model on disjoint contrast probes, including memory/latency/license and meaning-preservation risks, before any replacement. More beam/chunk tuning of the current model alone is not justified by these results. Human-reviewed validation cannot be completed without actual reviewers; do not fabricate it.
