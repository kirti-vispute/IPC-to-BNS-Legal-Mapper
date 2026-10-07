# Long Speech Review Wiring Results

2026-10-06. One diagnostic completed; no production change. No Git branch/commit.

## Question And Evidence

The backend/adapter/frontend advisory was already implemented. This task checks
the actual running path, not another recognizer improvement. Reconstructed the
four already inspected public Marathi read-speech clips with the frozen recipe:
960737 samples/60.0460625s/1921518 WAV bytes, SHA256
`44ed4a19e50da09a37b5f07e9def964c6958f9a4867d6e285be44b52fb103951`.
Original source attribution/license remains in `output/voice-verification/holdout-speech/fixtures.json`;
the four Marathi clips are CC BY-NC4.0, local research only. This older inspected
manifest is NOT the reserved eight-call telephony holdout. No download or training.

Original30s evidence has224/224/75 generated tokens. The current pure rule exactly
matches the frozen offline per-window assessments. Expected production summary:
assessed/3 windows/requiresReview:true/warningWindows:[0,1], compression:[0,1],
silence-confidence:[], textModified:false. This is risk, not missed-word labels.

## Execution And Preserved Failures

- A draft preregistration guard initially compared the detailed offline review
  object against the bounded production summary. It aborted before creating a
  registration or inference. Inspection identified the schema difference; the
  guard now compares full saved assessments separately and derives the summary.
  A regression rejects a changed saved assessment. No frozen input was edited.
- Registered312 current inputs before first live request. The original browser
  attempt returned actual HTTP200, exact historical text and expected summary,
  then failed because Playwright supplied null for Blob request postDataBuffer.
  Raw response/failed report/source/registration/audit are preserved in
  `output/public-speech-validation/long-review-http-20261006/`.
- A separately registered324-input retry observes the SAME Blob at the fetch
  boundary, then delegates native fetch with unchanged arguments. No response
  mock, audio alteration, decoder tuning or frozen tool rewrite. Network body
  access remains honestly recorded as unavailable. One request per attempt.
- Successful retry evidence:
  `output/public-speech-validation/long-review-upload-20261006/`.
  Actual HTTP200, exact saved native transcript/summary and textarea parity.
  Client upload checksum matches reconstructed WAV. This is not an independently
  hashed server-side body. Served app.js equals registered current source.
- Desktop1280x900/mobile390x844 checks2/2 and screenshots visually inspected:
  native Marathi live warning visible, text editable, controls restored, assets
  loaded, no horizontal overflow or warning/Analyze overlap. No automatic Analyze
  or legal request for the nonlegal audio. Original malformed character/word errors
  are preserved, not repaired. Browser uses synthetic capture, NOT physical mic.
- Original and retry elapsed19.646s/19.322s include browser/startup/checks. Both
  clocks coherent; Windows sleep/resume records available and empty. No latency
  comparison or speed improvement claim. Existing site/PID29660 reused, no restart.

## Tests And Legal Evaluation

Four new diagnostic contracts: canonical aliases/conflict rejection, unchanged
saved evidence/risk summary, empty evidence rejection, detailed-offline/summary
schema distinction. Full JS245/245 and Python92/92,0 failures/skips. Logs in retry
output. JS sources/tests unchanged; Python count increases88->92.

Same-crosswalk benchmark: IPC104/104 and BNS104/104 Top-1/Top-3, unchanged.
Separate current resolved-reference replay:5/5 Top-1 and5/5 Top-3 any-hit,
`output/project-completion/long-speech-review-replay-20261006.json`, unchanged.
Historical sealed40% and official report/labels/methodology were NOT overwritten.
These are different checks, NOT independent lawyer validation/general accuracy.

Final streaming audit checks327 committed identities:0 changes, reserved outputs
absent, no sleep events, usable:true. Includes production/frontend/backend,
statutes/legal sources/evaluation, current model/runtime, old evidence and all new
registered tools/tests/plans. Prior authorized frontend changes are applied only
in memory to the historical271-file snapshot; the original snapshot stays intact.

## Files And Reasons

| File | Reason |
|---|---|
| `scripts/validate_long_speech_review.py` | Streaming preregistration, unchanged fixture reconstruction, expected summary, integrity audit. |
| `scripts/validate_long_speech_review_ui.mjs` | Original actual HTTP/browser attempt, frozen with its inspection failure. |
| `scripts/validate_long_review_upload.py` | Separate retry registration/audit preserving failed inputs and outputs. |
| `scripts/validate_long_review_upload_ui.mjs` | Same-Blob upload observer and actual desktop/mobile checks. |
| `tests/test_long_speech_review_validation.py` | Four diagnostic integrity/evidence contracts. |
| Two frozen plan documents | Record original acceptance and narrow retry before inference. |
| This results document / `Bug-speech-blob-inspection.md` | Explain evidence, failures, limitations and exact change scope. |
| Engineering docs / long-speech and Marathi bug notes | Update actual flow, test status, rollback, remaining work and handover. |

No production rollback needed. Do not rerun into occupied paths or edit registered
tools/plans/failed results. Website remains healthy at http://localhost:3002/.

## Remaining Work

Warning wiring is verified, NOT improved Marathi acoustic fidelity. Natural legal
speech, spoken date/section preservation, physical microphone input, multilingual
meaning and independent bilingual/legal/IRAC review remain unverified/open. Clear
metadata never proves correct words. No general accuracy or completion claim.

Next single action: a physical microphone acceptance check with a naturally spoken
Marathi legal question and the exact intended words, comparing transcript/date/
section manually. This needs a voluntary recording and reference words; the
current public nonlegal stress fixture cannot establish those facts. Do not infer
answers, decode the reserved holdout, add retrieval compensation or start another
model/settings experiment automatically.
