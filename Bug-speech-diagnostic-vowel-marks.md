# Bug: Speech Diagnostic Removed Indic Vowel Marks

Date: 2026-10-03. No Git repository/commit. Diagnostic-only correction; production speech and legal evaluation unchanged.

Later continuation: approval recovered; collector/HTTP modes successfully tested8 new calls after explicitly pinning verified new dataset metadata revision. Full225/225,8 diagnostic tests. Fresh microWER64.44% is NOT a quality gain against different old clips. Details:`Feature-public-speech-validation.md` and latest `Bug-marathi-speech-quality.md`. Earlier blockage statements below describe the original rescoring session, not the current access state.

## Problem And Investigation

`scripts/profile_public_speech.py normalized()` removes `[^\w\s]`. Python's `\w` does not include the Devanagari combining vowel marks in the tested word: `चोरी` becomes `चर`. Consequently two different words can become identical before edit-distance scoring. This hides some errors; removing marks can also alter token boundaries and character denominators. The observed rates must not be described as native-word fidelity.

The problem affects the saved timestamp/text-only comparison metrics, not the recorded hypotheses. The older `scripts/benchmark_speech_decode.py normalize()` uses Unicode categories and preserves marks; its separate original model comparisons are not automatically invalidated by this finding.

Read complete current speech worker/adapter, collectors and diagnostic scripts before deciding. Marathi medium had already failed previous tests; do not repeat it as a proposed repair. No reliable new ASR setting was established.

## Decision And Implementation

Add separate `scripts/validate_public_speech.mjs`, not imported by the application. Its `rescore` mode verifies saved references against fixture metadata and local audio SHA-256, then recomputes edit distances into a fresh directory. Normalization uses NFKC, lowercase, punctuation/symbol word boundaries, collapsed whitespace and preserved combining marks. CER counts Unicode code points, not graphemes. Numeral/spoken-number equivalence is not assumed. Differences reflect this whole stated normalization, not solely vowel-mark preservation.

Original diagnostic script, saved metrics, hypotheses, recordings and manifests remain unchanged. Neither normalizer is claimed to be the dataset's official scorer. New reports contain original input hashes and both previous/new group means.

The companion `collect` mode prepares eight metadata-selected new Marathi telephone clips, excluding earlier calls/utterances/audio hashes. `run` uses the actual selected-Marathi HTTP speech endpoint without calling legal analysis. These modes are prepared but NOT successfully exercised: sandbox network denied access, and the escalation approval service failed due to its usage limit. The attempted download was not executed; no workaround or bypass used. Do not claim any fresh audio was collected or recognized.

## Tests And Results

Seven new tests cover vowel signs/negation, substitutions and insertions, empty hypotheses, code-point CER, disjoint-call selection, dataset identity/license/revision, failure accounting and output traversal. Full suite: 217 -> 224 passed, zero failures/skips. Existing separate readiness tests: 7/7. Full new source/tests read after editing.

48 existing saved hypotheses rescored: 16 read-speech clips and eight telephone clips, each with two profiles. Each group below has four clips; values are unweighted mean clip WER, not legal accuracy or representative ASR accuracy.

| Group | Existing: previous -> corrected | Text-only: previous -> corrected |
|---|---|---|
| Hindi read development | 14.22% -> 26.16% | 15.65% -> 28.31% |
| Hindi read original holdout | 23.51% -> 32.29% | 23.45% -> 33.48% |
| Marathi read development | 35.24% -> 50.71% | 31.07% -> 50.71% |
| Marathi read original holdout | 16.67% -> 41.67% | 16.67% -> 41.67% |
| Marathi telephone development | 72.15% -> 77.42% | 71.15% -> 77.42% |
| Marathi telephone original holdout | 76.10% -> 76.10% | 78.37% -> 79.76% |

The previously rejected text-only decoder remains unsupported: corrected Hindi WER worsens, Marathi read WER is unchanged and telephone original-holdout WER worsens. These holdouts have already been inspected; they are not a fresh independent validation set. No new inference, training, production accuracy gain or speed gain occurred.

Evidence: `output/public-speech-validation/vowel-marks-20261003/rescore.json`. All 83 protected/current source/model paths unchanged. Mapping IPC/BNS 104/104 each Top-1/Top-3; separate current resolved-source replay 5/5 each, historical sealed results untouched.

## Remaining Work And Rollback

Obtain the disjoint public clips when approved network access is available, then measure the unchanged production recorder before choosing one candidate setting/model. Spoken legal dates/sections, spontaneous legal speech, physical microphone and independent bilingual/legal review remain unverified. Translation meaning loss/GU-KN intent remain unresolved.

No production rollback needed. New diagnostic/tests/docs can be retired selectively while preserving original and corrected evidence. Do not restore older production source/model files or rewrite historical evaluation results.
