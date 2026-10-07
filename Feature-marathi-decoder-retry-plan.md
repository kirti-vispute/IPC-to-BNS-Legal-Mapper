# Converted Prefix Probe Retry

Date: 2026-10-05. Preserve frozen first tool/plan/registration and successful source rows. First converted attempt returned from generation but NumPy rejected the optional `result.logits` view because its data pointer was NULL. No converted rows were saved. This is a diagnostic buffer-handling issue.

Register this retry tool/test/plan and earlier registration/source/failure hashes before running. Same previously inspected mr-30 shared features, two prefixes, CPU int8/four threads, beam1/3, observed/empty general suppression list, blank suppression retained, one-token maximum. Check buffer metadata before NumPy conversion; report absent/unreadable optional scores instead of losing generated token evidence. Never interpret a missing distribution as numerical parity. Source rows reused, no source inference rerun. Exclusive output `output/public-speech-validation/marathi-decoder-probe-retry-20261005/`. No production change, holdout or speed/accuracy claim.
