# Marathi Checkpoint Local Consistency Audit

Date: 2026-10-04. Scope: one read-only audit, not a production fix.

## Why

Baseline erroneous words originate in decoder output; observed no-speech skips are zero and seven inspected clips retain every audio sample. Poor recognition does not establish corrupted weights, English prompting or tokenizer incompatibility. Verify existing local checkpoint identities before selecting another experiment.

## Method

Run `.venv-speech/Scripts/python.exe -m scripts.audit_marathi_checkpoint` once. No network, model initialization/inference, conversion, dependency installation or reserved audio submission. Parse setup constants without importing its downloader/converter. Register source/target files, cache metadata, audit/test/plan, relevant installed library source and existing protected evidence hashes before comparisons. Write only a new exclusive `output/public-speech-validation/checkpoint-audit-20261004/` directory.

Compare pinned source weight SHA-256; local cache revision/Git blob identities; union of base and added token IDs; every converted vocabulary index and runtime fast-tokenizer ID; base vocabulary and merge bytes; actual installed feature defaults against source preprocessing; copied generation suppression/language/alignment settings. Verify input hashes again and reserved decoding outputs remain absent. Synthetic tests cover valid special-token overlap, conflicting/non-contiguous IDs, reordered/missing tokens, cache mismatch and exclusive output.

## Boundaries

Local cache records are not independently fetched authenticity evidence. Conversion intent in setup code is not proof of the currently converted weights' numerical fidelity or job history. No source-versus-int8 acoustic/numerical comparison or complete tokenizer-algorithm equivalence is claimed. Publisher model-card training/WER claims are not project training or independently validated legal accuracy. Saved English prompt defaults are not assumed active: production explicitly sets Marathi and prior actual prompts use token50320.

Do not edit this plan/tool/tests after registration; use separate results/documentation. No production, routing, retrieval, translation, UI, model settings, corpus/provenance, sealed/reference/evaluation methodology changes. Historical reports unchanged. Run full existing suites plus new tests, mapping consistency benchmark, separate current resolved replay and protected identity checks after audit. Record findings without guessing a root cause or claiming improved accuracy.
