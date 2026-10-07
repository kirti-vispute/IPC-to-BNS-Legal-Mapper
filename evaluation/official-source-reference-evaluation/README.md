# Official Source Reference Evaluation

This is a research evaluation against statutory reference labels derived from the approved local Government of India source corpus. It is not a blind lawyer evaluation, independent expert validation, legal advice, or evidence of accuracy in real legal matters.

## Method

The label builder reads only:

- `evaluation/cases/candidate-cases.jsonl`
- `backend/data/statutes.json`
- `legal-sources/manifest.json`

It does not import or read `blind-predictions.json`. Labels are generated first. The scorer subsequently verifies the prediction seal and compares the already-created references with the sealed output.

Applicable-law references use the alleged occurrence date together with the BNS commencement notification and the repeal-and-savings clause in BNS section 358. Provision references are included only where the case facts identify an objective statutory retrieval target in the approved sources.

Cases `blind-003`, `blind-005`, `blind-006`, `blind-008`, and `blind-009` retain `requiresExpertReview: true`. Their unresolved provision fields are excluded from provision and citation accuracy denominators. The report gives the exact eligible-case count for every metric.

## Files

- `official-source-reference-labels.json`: all 10 source-derived reference records, source pages, justifications, eligibility flags, and unresolved reasons.
- `official-source-reference-report.json`: comparison against the immutable sealed predictions.
- `independence-verification.json`: procedural input-boundary, seal, checksum, and report-linkage checks.

## Reproduce

```powershell
npm run build:official-references
npm run evaluate:official
npm run verify:official-independence
```

The resulting figures support only comparison with these documented official-source references on eligible fields in this small synthetic case set. They do not support a claim of lawyer-validated accuracy, general legal accuracy, or independently validated IRAC quality.
