# Bug: Diagnostic Cannot Inspect Blob Request Body

2026-10-06. Diagnostic harness issue; not a production speech failure.

## Problem

The first registered real long-recording browser check fails on upload-checksum
assertion. The real backend response already matches saved transcript/metadata.
Playwright request.postDataBuffer returns null for this Blob upload, so a network
body checksum cannot be established through that API. Null is unknown, not proof
that uploaded bytes changed.

## Investigation

Original report/request lists audio/wav, null bodySHA256, no page errors, exact text
and review parity. Raw HTTP response200 preserved. Its streaming audit checks315
identities unchanged; usable:false because the browser assertion
failed. No sleep events. Do not relabel this attempt as successful.

## Decision And Implementation

Keep frozen original tool/results unchanged. Separate retry tool/plan/registration
measure the original Blob via arrayBuffer/WebCrypto before native fetch, passing
the original arguments through unchanged. No request rewrite/mock/server change.
Explicitly record client-boundary observation versus missing network/server-body
inspection. Retry uses the same audio/model/settings, not a tuned candidate.

## Tests And Result

Retry HTTP200/text/review parity, verified1921518-byte client Blob, two real
desktop/mobile layouts pass. Full245 JS/92 Python, mapping104/104 each/current
resolved replay5/5 unchanged. Final retry327 identities unchanged/usable:true;
reserved holdout outputs absent. Original failed evidence retained. A draft
pre-registration offline-summary schema mismatch was separately corrected before
registration/inference, with a new rejection regression; no frozen file changed.

See `Feature-long-speech-review-validation-results.md`. No acoustic/speed/legal
accuracy claim or production rollback. Never overwrite the original failure or
rerun these frozen tools into occupied directories.
