# Bug: Integrity Audit Uses Whole-File Model Reads

2026-10-06. Diagnostic issue, no recognition/legal behavior change.

Problem/investigation: registered `validate_backend_speech_review.mjs audit` failed with `ERR_FS_FILE_TOO_LARGE` while reading a2,460,457,927-byte historical model for SHA hashing. This failure produces no valid integrity verdict; actual nine-response smoke had already succeeded and remains separate.

Decision/implementation: preserve the registered original tool and smoke outputs. New standalone `scripts/verify_backend_speech_review.ps1` uses streaming native `Get-FileHash`, preregisters five inputs into exclusive retry output, verifies all historical/protected/smoke identities plus before copies and records only two authorized production differences. Do not load multi-GiB models into Node buffers or rewrite old commitments to force a clean result.

Second investigation: streaming retry checked everything with no protected/unexpected change, but `usable:false` because four change rows represent two files twice. Historical keys include both forward/backslash aliases for worker/adapter/server/frontend; no hash conflicts. Preserve that registered retry/report too.

Final decision/implementation: separately registered `scripts/assess_backend_review_integrity.ps1` normalizes path separators, rejects conflicting duplicate commitments, hashes257 canonical files from261 historical keys, rechecks37 legal-pipeline files/17 frozen registrations/16 smoke inputs/retry and own registrations/before copies/holdout absence. Final real-file regression verifies exactly two authorized changes, no unexpected/protected difference and `usable:true`. No files or original hash commitments are rewritten. Both streaming tools are frozen after registration.

Evidence: original `backend-review-20261006/audit-failure.json`, failed criterion `backend-review-audit-retry-20261006/{registration.json,integrity.json}`, final usable `backend-review-normalized-audit-20261006/{registration.json,integrity.json}`. Whole-model streaming and duplicate-alias checks are exercised against actual local files, not accuracy benchmarks. This is a diagnostic hash-implementation correction, not neural inference or another production fix. Frozen original Node audit remains unsuitable for large historical models; frozen first streaming retry has a duplicate-count limitation. Future snapshots need a fresh output and canonical streaming verification, not edits to these tools/evidence.
