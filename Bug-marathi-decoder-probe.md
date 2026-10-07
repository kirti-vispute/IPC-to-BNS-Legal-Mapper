# Bug: Offline Decoder Probe Assumptions

## Follow-up: Matched Budget And EOS Comparison Completed (2026-10-05)

New separately registered tool corrects only offline comparison: converted cap384 matches nominal source192 budget, source outputs reused and terminal EOS normalized. All8 converted rows complete, no192 cap hit; old98-token rows extend107/116/134. Agreement1/8 ->2/8, with mr-79/mr-148 new matches and mr-458 former match lost. No generic accuracy improvement or conversion diagnosis. Added3 synthetic EOS/identity/budget tests; full48 Python/231 JS pass, mapping104/104 each/current replay5/5, protected83/144 registered commitments stable. Old failed/cap-limited reports remain frozen. See `Feature-marathi-matched-cap-results.md`; next read-only production cap/continuation audit.

Date: 2026-10-05. Diagnostic issue only; app unchanged.

Problem: optional converted vocabulary storage was treated as readable; cap and hypothesis assumptions prevented saving converted evidence. Prior eight-clip comparison also used different effective caps and EOS conventions.

Investigation: local binding docs, raw16 conditions and versioned primary decoder source. NULL optional storage caused NumPy failure; short cap can return no hypotheses. Final caps verified one new token after supplied text. Source mask control changes no entire logits on tested prefixes.

Decision: preserve frozen failed attempts and successful source rows; register successor tools rather than rewrite evidence. Optional vocabulary availability and verified continuation length are separate requirements. No speech tuning justified.

Implementation: five `scripts/probe_marathi_decoder*.py` tools, corresponding plans and exclusive output directories. Raw observer flushes nested hypotheses/errors immediately. Final observer verifies supplied text before interpreting continuation; no production imports/dependencies changed.

Tests: eight new synthetic tests in `test_marathi_decoder_probe.py`, `_retry.py`, `_caps.py` cover excluded/nonfinite scores, NULL-pointer metadata, cap arithmetic and invalid lengths. Full45 Python/231 JS pass.16 raw conditions complete without errors; final8 one-token conditions agree with local source winners. Mapping104/104 each/current replay5/5 unchanged; protected83 and121 registered commitments stable.

Result: prefix evidence complete for this clip, no speech fix or conversion-cause finding. Earlier cap/EOS-different parity remains historical. Next matched-effective-cap converted-only comparison against saved source rows. See `Feature-marathi-decoder-probe-results.md`.
