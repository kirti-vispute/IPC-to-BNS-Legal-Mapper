# Long Speech Review Upload-Observer Retry

Frozen before retry inference: 2026-10-06. No production change or tuning.

The original registered live request returned HTTP200, exact historical text and
exact expected review metadata, but its browser harness failed: Playwright
`request.postDataBuffer()` returned null for the Blob-backed upload. That is
missing browser inspection data, not a changed audio body or speech failure.
Preserve the original tool, registration, raw response, failed report and audit.

Register a separate retry against all original current-input commitments and
failed outputs. Copy the same verified WAV/expected evidence into a new exclusive
`output/public-speech-validation/long-review-upload-20261006/` directory. Submit
one request for this retry, with unchanged production settings and same service.

The replacement harness measures the original Blob's bytes/hash immediately before
calling the native fetch with the SAME arguments. No body/response substitution,
request rewriting, model/date/retrieval change or decoded-text correction. Network
inspection still records that request body access was unavailable. This observes
the client upload boundary, not independently hashed bytes inside the server.

Require actual HTTP200, saved transcript/metadata parity, original textarea text,
desktop/mobile native live warning, restored controls, no automatic analysis,
loaded assets, no overflow/overlap, coherent bounded timing and no sleep events.
Save actual response before assertions. Never overwrite any prior evidence or
edit registered tools; any failure remains a failure. No physical microphone,
unseen audio/holdout, accuracy or speed claim. Stop after this diagnostic.
