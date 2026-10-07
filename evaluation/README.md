# Blind Lawyer/Expert Evaluation Guide

This evaluation has two independent expert stages. Do not edit `evaluation/runs/blind-predictions.json`; it is the sealed system output being evaluated.

## Files

- `cases/candidate-cases.jsonl`: the 10 unlabeled fact patterns.
- `gold-labels.template.jsonl`: blank applicable-law and provision labels.
- `irac-reviews.template.jsonl`: blank citation, IRAC, and grounding review fields.
- `schemas/`: JSON Schemas for completed records.
- `runs/blind-predictions.json`: sealed predictions. Keep this hidden during Stage 1.

JSONL means one complete JSON object per line. Keep every `caseId` unchanged, do not add trailing commas, and do not split one record over several lines.

## Stage 1: Gold Labels

Give the lawyer `cases/candidate-cases.jsonl`, `gold-labels.template.jsonl`, and the official legal documents. Do not give them the sealed predictions yet.

Save the completed copy as `gold-labels.completed.jsonl`. For each case, fill:

- `applicableLaw`: exactly one of `IPC_ONLY`, `BNS_PRIMARY`, `MULTI_PERIOD_REVIEW`, or `CLARIFY`.
- `correctTop1Provision`: the single best provision as an object with `code` (`IPC` or `BNS`) and `section` (a string).
- `correctTop3Provisions`: one to three acceptable ranked-retrieval targets using the same provision-object format. Include the Top-1 provision in this array.
- `expertComments`: reasoning, ambiguity, assumptions, or an empty string if no comment is needed.

If the legally correct result is `CLARIFY` and no provision should be retrieved, leave `correctTop1Provision` as `null` and `correctTop3Provisions` as `[]`. Null/empty provision fields are rejected for every other applicable-law choice.

Finish and preserve this file before the lawyer sees the predictions. This prevents the system output from influencing the gold answers.

## Stage 2: Output Review

After Stage 1 is locked, give the lawyer the sealed predictions and `irac-reviews.template.jsonl`. Save the completed copy as `irac-reviews.completed.jsonl`.

For each case, fill:

- `citationCorrectness`: `CORRECT`, `PARTIALLY_CORRECT`, or `INCORRECT`. Check the cited document, page, provision, and whether the citation supports the generated statement.
- `iracAccuracy.issue`, `.rule`, `.application`, and `.conclusion`: use `0` for incorrect or unsupported, `1` for partly correct/incomplete, and `2` for correct and sufficiently supported.
- `grounding`: `GROUNDED`, `PARTIALLY_GROUNDED`, or `UNGROUNDED`, based on whether the answer stays within and is supported by the cited official source text.
- `expertComments`: explain errors, material omissions, ambiguities, or an empty string if no comment is needed.

Do not alter the system predictions while reviewing them.

## Produce The Report

Run:

```powershell
npm run evaluate:score -- evaluation/runs/blind-predictions.json evaluation/gold-labels.completed.jsonl evaluation/irac-reviews.completed.jsonl evaluation/runs/final-accuracy-report.json
```

The scorer first verifies the prediction seal and exact case-ID coverage. It refuses incomplete placeholders, invalid categories, out-of-range IRAC scores, duplicate provisions, and a Top-1 provision missing from the Top-3 list.

The final report contains applicable-law accuracy, Top-1 accuracy, Top-3 recall, the percentage of cases containing every expert-accepted Top-3 target, citation correctness, expert grounding, overall IRAC accuracy, component-level IRAC accuracy, per-case comparisons, and SHA-256 checksums for all three input files.

The templates contain no legal answers. Their current nulls and empty arrays are intentionally unscorable until a qualified expert completes them.
