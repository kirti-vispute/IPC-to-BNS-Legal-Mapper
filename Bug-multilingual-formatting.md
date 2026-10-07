# Bug: Translated Legal Structure and Source Fidelity

Date: 2026-09-26.

## Problem and Investigation

Reported Hindi output: `1. **IPC 378Relevance 46.121**` and long hyphen runs. Current frontend does not build or translate this Markdown string: code/section and relevance are separate canonical HTML fields. Exact concatenation was not reproduced from the current renderer. Its adjacent fields had no literal separator; whitespace/text extraction could join them. Do not attribute an unobserved path to the translator.

Confirmed adapter issues: translationParts trimmed/split prose and translateTexts joined all fragments with spaces, destroying original newlines/Markdown layout. PDF page/Relevance/authority phrases were not fully protected in free text. The adapter translated statutory excerpts both in retrieved display fields and inside the whole IRAC Rule; UI presented those machine-translated sources without distinguishing original wording. Existing parsed excerpt strings contain PDF separators/footnotes, which explain observed long hyphen runs; those are not evidence that the translator invented every hyphen.

## Decision and Implementation

- backend/core/multilingual.js preserves literal identifiers (including lettered subsections), dates, numbers, Relevance/PDF page phrases, route/corpus identifiers, filenames, URLs and runtime source identities. Whitespace, newline/list/heading/bold delimiters remain outside model inference; newly injected Markdown is rejected.
- Translate titles/narrative/warnings field-by-field; omit excerpt presentation. Translate only Rule explanatory prefix, retaining canonical rule material unchanged.
- frontend/app.js renders exact canonical excerpts/Rule material under expandable "Original statutory source" labels. Bound citations/authority/file/pages/scores use original structured data directly. Add a literal separator before Relevance. No Markdown renderer, giant-response translation or corpus cleanup introduced.
- frontend/style.css allows heading wrapping and preserves original source whitespace. Long original PDF artifacts are retained in expandable source blocks, not silently edited from the official text.

## Tests and Result

Added assertions for exact Markdown/newlines/protected metadata, source identity/hash, subsections/day-first dates, model-injected structure rejection, no source replacement, and HTML section/score separation with IPC378/46.121/PDFpage152/authority intact. Real NLLB Hindi metadata check keeps all protected lines exact while translating only the heading. Canonical result/source/citation equality is checked on every real native acceptance fixture; no labels or reports are created in protected evaluation paths.

The complete suite, mapping benchmark and resolved-source replay results are recorded in Handover.md/TestChecklist.md. Full production/test diffs were reviewed against .voice-rollback/multilingual-bugs copies. No legal module, corpus, mapping, reference label or sealed output changes.

Final:104/104 tests,38/38 dedicated multilingual/detector tests; real8/8 native language/date/route/canonical-preservation checks plus Hindi metadata round-trip; mapping104/104 per code and resolved replay5/5 each unchanged. All38 protected files hash-identical. Live Hindi text shows `IPC 378 · Relevance 49.004`, original PDFpage152/authority, and separately labelled exact statutory wording; no source is silently replaced by machine translation.

## Remaining Issues

Do not equate successful language/routing/format checks with multilingual legal accuracy. Actual August HI/MR fixtures use "without his permission" in English and retrieve weak BNS232/351/129 candidates instead of theft candidates. The loosely specified continuing-fraud input retrieves IPC105/BNS303/BNS43. Ranking was not changed to hide these issues. Marathi explanations still have awkward charging/filing-date or multi-period wording. Protected structural checks do not certify actor/ownership/intent/negation or faithful legal meaning. No bilingual expert validation exists.

Local speech code is unchanged; existing ASR tests pass. A synthetic English WebM run in this session returned22June rather than the previously recorded20June on a different connection/execution path. No date substitution was performed; the returned text correctly routed IPC_ONLY/IPC379. Tiny ASR accuracy/physical native microphone use remains unverified. This is an existing diagnostic variability limitation, not proof of new multilingual speech accuracy.

Safe scoped reversal: Rollback.md. Exact production files are the four named above, plus worker.py for the separate language issue; no dependencies/models changed.
