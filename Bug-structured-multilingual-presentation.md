# Bug: Multilingual Presentation Boundary

Date: 2026-09-26. No Git repository/commit. This is one presentation/translation change, not a retrieval/legal-model improvement.

## Problem and Investigation

User reported inconsistent HI/MR terminology, corrupted translated statutory footnotes and adjacent identifier/Relevance text. Inspected server, adapter, worker, legal modules, frontend and existing tests. Actual detection: worker.py py3langid/resolve_detection(); query translation: multilingual.js normalizeInputDates()/translateInputQuery(); structured legal result: pipeline.js analyzeQuery(); IRAC: synthesizer.js synthesizeIrac(); output translation: multilingual.js selected display-field batch; HTML: app.js renderResult(). The current code did not translate an entire rendered Markdown page. Prior corrections already kept excerpts original and resolved the supplied Marathi detection ambiguity. The remaining confirmed architectural issue was unrestricted output translation of system narratives plus flat field names/Rule delimiter parsing. Exact reported adjacency was not reproduced; separate elements with explicit spacing are required regardless.

## Decision and Implementation

Shared frontend/legalPresentation.js provides schemaVersion2, controlled EN/HI/MR terminology, structured decision/provisions/original sources/IRAC/citations/warnings, literal/prose nodes and escaped HTML. Read the existing actual route and ranked records; never choose law or new legal answers. Output-model allowlist: HI/MR title prose only; other supported languages explicitly permitted prose nodes/labels. Immutable fields never enter output translation. Persist inputLanguage, processingLanguage=en, outputLanguage throughout. Original excerpts/metadata and canonical IRAC remain unchanged; original title/source are visible separately from machine-translated title. Source-bound exception notes remain original. English retains the existing renderer; old flat contracts fail visibly. Reset English headings and language attributes when leaving a localized result.

Changed production: backend/core/multilingual.js; frontend/legalPresentation.js (new), app.js, index.html, style.css. No detector/input, retrieval/date, source/crosswalk, canonical IRAC/verifier, speech or evaluation change. No dependency/provider installation. WHY comments mark ownership and the translation allowlist, not ordinary assignments.

## Tests and Result

Full suite114/114 (baseline104), dedicated multilingual/presentation46/46. Ten new regressions cover the field boundary, title-only model payload, source/string/HTML fidelity, exact numeric/page display, language-specific controlled terminology, missing/multi-period decisions, English reset and old-schema rejection. Existing tests updated to the structured contract, not weakened legal assertions. Real local-model verification completes all five supplied native acceptance fixtures with expected language/date/route and exact canonical retrieval/IRAC/source equality. Mapping IPC/BNS each104/104 Top-1/Top-3; current five resolved-source replay5/5 each, unchanged. Historical sealed evaluation remains separate. All41 protected baseline files hash-identical. Final browser observations: see Handover.md.

## Limits and Next Step

Software passes are not certified HI/MR translation, lawyer validation or legal accuracy. Controlled terminology is project draft text. Titles still use machine translation and may be awkward or incomplete; original English title/source remains visible. Other supported languages still use prose-only MT for system narrative. Input translation can change meaning despite date/literal guards. Observed Hindi August permission input still retrieves BNS232/351/129; underspecified Marathi continuing fraud still retrieves IPC105/BNS303/BNS43. Do not hide these by fabricated labels or unauthorized ranking changes. Obtain bilingual review of the controlled terms and title translations next. Rollback: Rollback.md/.voice-rollback/structured-presentation, scoped comparison only.
