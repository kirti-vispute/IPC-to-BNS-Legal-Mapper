# Expert Review Package

Give `IPC_BNS_Blind_Expert_Review_Packet.pdf` to the lawyer or law professor for the initial review. It contains all 10 fact patterns, instructions, independent gold-label fields, and later citation and IRAC review fields. It contains no model predictions or suggested legal answers.

Ask the reviewer to complete Phase A for every case without viewing any model output. Collect and preserve the completed Phase A packet before disclosing any prediction excerpt. Only then ask the same reviewer, or a second qualified reviewer, to complete Phase B citation, grounding, and IRAC ratings.

The editable Word version is `IPC_BNS_Blind_Expert_Review_Packet.docx`. Use it if the reviewer prefers typing rather than handwriting.

After the review, transfer the answers exactly into:

- `gold-labels.review-form.jsonl`
- `irac-reviews.review-form.jsonl`

Do not change any `caseId`. Each JSON object must remain on one line. The completed files can then be passed to the existing automated scorer described in `../README.md`.

The sealed prediction file is intentionally not included in this directory.
