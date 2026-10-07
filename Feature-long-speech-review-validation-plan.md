# Long Speech Review Wiring Plan

Frozen before inference: 2026-10-06. Diagnostic only; no production changes.

## Single Question

Does the running selected-Marathi recording path preserve the saved long-fixture
transcript and display the existing generation-risk warning?

## Inputs And Registration

- Reconstruct the already inspected four public Marathi clips using the frozen
  `scripts/trace_long_marathi_speech.py:audio_input()` recipe only. Do not call
  that tool's old registration, worker or inference methods.
- Expected WAV SHA256: `44ed4a19e50da09a37b5f07e9def964c6958f9a4867d6e285be44b52fb103951`;
  960737 samples, 60.0460625 seconds. Keep attribution/license in the manifest.
  Recordings remain ignored/local, not redistributed. This is repeated nonlegal
  read speech, not a natural legal recording or a fresh holdout.
- Derive expected metadata from the saved original 30-second-window observations
  with the current pure review rule; compare with the frozen offline assessment.
  Do not invent a transcript or quality label.
- Verify the 271-file current snapshot using the two recorded, authorized frontend
  changes in memory. Preserve the original snapshot. Register current production,
  legal/evaluation files, model/runtime, tools, tests and saved evidence before
  submitting audio. Streaming digests; reject conflicting canonical path aliases.
- New exclusive evidence directory:
  `output/public-speech-validation/long-review-http-20261006/`.
  Never overwrite an existing registration, response or report. Keep failures.

## Execution

1. Reuse the verified current project service at localhost3002. No service restart
   or model/decoder/temperature/VAD/window/date/retrieval change.
2. Use installed Edge and actual frontend/backend. A synthetic MediaRecorder
   supplies the reconstructed WAV; HTTP responses are NOT mocked or replaced.
   Observe request/response bytes, status, metadata, text and timing. No physical
   microphone and no new audio source. Submit exactly one long request.
3. Save the actual response before assertions. Require HTTP200, exact historical
   transcript and derived metadata, original textarea text, native live warning,
   restored controls, no automatic Analyze and loaded assets.
4. Screenshot desktop1280x900 and mobile390x844 on the same response. Check no
   horizontal overflow or warning/Analyze overlap. Do not Analyze the nonlegal
   fixture. Keep existing frontend130s/backend120s deadlines; record UTC and
   monotonic time and reject interruptions. Timing is observational, not a speed
   comparison. Query Windows sleep/resume events separately.
5. Run full JS/Python tests, official mapping consistency benchmark and separate
   current resolved-reference replay. Do not overwrite any historical result.
6. Verify all registered input hashes again and absent reserved eight-clip
   holdout outputs; update engineering handover/results only.

## Interpretation

Pass means end-to-end warning wiring and text preservation for one already
inspected stress fixture, not corrected speech, a missed-word detector accuracy
score, physical microphone quality, legal date/section accuracy or independent
expert validation. No warning does not mean correct recognition. Preserve any
variation/failure without tuning to make this diagnostic pass. Stop after this
single validation; natural speech and independent review remain open.
