# Production Speech Continuation Audit Plan

2026-10-05. Read-only follow-up to the matched-cap comparison. No Git repository; baseline231 JavaScript/48 Python tests. Marathi recognition fidelity remains unresolved.

Trace frontend recording -> server endpoint -> Node adapter -> Python worker -> installed ordinary faster-whisper generation/segment continuation -> complete transcript. Inspect default token limits without initializing a recognizer. Use only saved eight inspected development-clip observations; do not submit audio or reserved holdout, tune settings, restart services, or modify legal retrieval.

Register this plan, standalone audit/test, production path, installed library/binary identities, protected baseline, prior segment observations/report/registration and matched-cap registration/report before running the audit. Verify protected and registered inputs before/after. Outputs go exclusively into `output/public-speech-validation/continuation-audit-20261005/`; never overwrite evidence.

Call the actual installed timestamp-splitting helper with synthetic tokens for no timestamp pairs, an unfinished tail after a timestamp pair, a single ending timestamp, and complete paired segments. These are control-flow tests, NOT recorded speech or accuracy labels. Derive the nominal bound from installed defaults and the versioned CTranslate24.8.2 implementation previously corroborated by low-cap probes. Distinguish that inference from observed cap exhaustion. Saved short clips cannot validate long-recording coverage.

Run full existing tests, mapping benchmark and separate current resolved replay; check protected hashes/holdout absence. Document evidence, limitations and next single task. No production fix is part of this audit.
