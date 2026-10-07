# Frontend Marathi Transcript Review Notices

2026-10-06. One frontend-only logical change. No Git repository/branch/commit. Starting tests236 JavaScript/88 Python. Status: implemented, desktop/mobile tested, running at `http://localhost:3002/`. This advisory feature does NOT correct speech recognition.

## Problem And Investigation

Read Handover/Constraints, actual frontend voice/status/localization/control lifecycle, relevant full tests, CSS and backend response contract. The Python worker/Node adapter already return optional `speechReview`; `handleRecordingStopped()` previously ignored it. It always displayed a generic language/transcript-review message. Its `finally` calls `setVoiceBusy()`, which clears status attributes, so simply setting warning styling inside the success branch would lose it.

No changes to server, speech observer, decoding/model, translation, date extraction, Applicable Law Check, corpus, retrieval, citations or IRAC are necessary. Only selected Marathi currently has this backend assessment. Legacy absent metadata must not be called verified speech.

## Decision And Implementation

- `frontend/app.js:getSpeechReviewNotice()` consumes optional metadata ONLY for explicitly selected Marathi. Valid version1 assessed/boolean/unmodified/bounded-window metadata produces a possible-incompleteness notice when flagged. Present unavailable/invalid metadata produces an unchecked-completeness notice. An assessed false flag or absent legacy metadata leaves the usual review-before-analysis message, never an accuracy/success badge.
- Notices use controlled Marathi UI copy with `lang=mr`, in the existing `#voice-state` polite status area; no new panels, controls or page structure. They advise checking text/dates/sections and optionally recording again, not changing legal facts.
- `handleRecordingStopped()` passes the notice into the existing final busy-state cleanup. `setVoiceBusy()` preserves warning styling for that response, while subsequent recording/error/cancellation uses its original control behavior and clears obsolete notice metadata. Manual transcript edits/localized result rendering keep the advisory; empty query/demo replacement clears it.
- Original `data.text` is still assigned verbatim to the editable textarea. `voiceInput` construction and Analyze request remain unchanged; review metadata is NEVER sent to legal analysis. No automatic Analyze, generated words, invented dates/sections, altered language confidence or decoding requests.
- `frontend/style.css` adds a warning color using existing amber, ordinary wrapping/line height and a zero minimum width for the existing voice grid. No palette/layout/control redesign. Browser geometry verifies no horizontal overflow or overlap with Analyze.

## Files And Reasons

| File | Reason |
|---|---|
| `frontend/app.js` | Read/display/reset optional review notice through existing voice lifecycle. |
| `frontend/style.css` | Existing warning tone and responsive text wrapping. |
| `tests/voiceReviewUi.test.js` | Nine real-app VM regression contracts without editing frozen old tests. |
| `scripts/validate_speech_review_ui.mjs` | Separate preregistered controlled browser check; failed missing bundled browser, retained. |
| `scripts/validate_speech_review_ui_edge.mjs` | Separate registered retry using installed Edge; original failure untouched. |
| `scripts/verify_frontend_speech_review.ps1` | Streaming current-file/registered-input/backup integrity verification. |
| Engineering docs/long-speech bug follow-up | Record current flow, rationale, tests, rollback, limits and next step. |

## Verification And Evaluation

- New nine tests cover incomplete notice/cleanup/text preservation, unavailable/malformed metadata, legacy/clear absence of accuracy claims, unchanged manual analysis payload, localization persistence, new-record/cancellation and subsequent-response reset, failed-response recovery, empty/demo reset and Hindi/Auto compatibility.
- Focused existing voice plus new tests36/36. Full JavaScript245/245, Python88/88; no failures/skips. Project-local TEMP/TMP and approved temporary localhost test access. Logs in the separate output directory.
- Browser first attempt failed because the bundled Chromium executable was missing: no browser cases ran and `usable:false` is preserved in `browser/report.json`. No browser install/download or frozen tool rewrite. Separately registered Edge retry8/8: four incomplete/unavailable/clear/legacy states across1280x900 desktop and390x844 mobile. Live status role, native notice language, editable text, manual Analyze, enabled controls, assets, wrapping and nonoverlap checks pass. Desktop/mobile warning screenshots visually inspected. These are controlled API responses/synthetic recorder, NOT physical microphone or speech accuracy tests.
- Same-crosswalk mapping benchmark remains IPC104/104 and BNS104/104 Top-1/Top-3. Current resolved official-source replay remains5/5 Top-1/Top-3, saved ONLY as `output/project-completion/frontend-speech-review-replay-20261006.json`. Historical sealed40% and official reports/labels/methodology remain untouched. Not independent lawyer validation or general website accuracy.
- Existing service was stopped: bounded health timeout and no port listener observed. Started the unchanged backend on free3002, hidden, without stopping unrelated processes; PID29660/startup health/logs recorded. Translation warmup ready. Purposeful website service remains running; temporary browser servers/contexts closed.
- Real running `/api/transcribe?mode=transcribe&language=mr` smoke on ONE previously inspected public `mr-30.wav`: HTTP200, original historical text parity, assessed one-window/no-warning metadata. The served `/app.js` exactly matches edited source. Native recognition errors remain unchanged. This verifies current service wiring, not unseen/long speech, language accuracy or speed. No physical microphone or reserved holdout use.

## Integrity And Rollback

Exclusive evidence: `output/public-speech-validation/frontend-review-20261006/`. Before edits verify271 current canonical identities and save app/CSS copies. Final streaming `integrity.json` reports EXACTLY two authorized normal-source changes, no unexpected changes, no registered browser-input differences, verified before copies and absent reserved holdout outputs. All backend source/data/decoding, legal files/provenance, dates/gateway/retrieval, sealed predictions, reference labels/reports and prior frozen tools/registrations remain unchanged in this task. Preserve old source commitments as historical; do not rewrite them to match new frontend.

Before source copies: `app.js.before`, `style.css.before`; exact old/new SHA identities in integrity report. See `Rollback.md` for scoped revert. Do not rerun scripts into occupied output paths, alter frozen browser tools or replace failed reports with the successful retry.

## Limits And Next Step

A warning is a conservative generation-layout risk, not proof of missing words or an acoustic correction. Absence of warning is not a correct-transcript verdict. This frontend change has no claimed recognition, legal accuracy or latency improvement. Native warning copy is controlled UI text, not expert-reviewed legal material. Natural long legal speech/date-section fidelity, short-word errors, physical mic, human-gated translator readiness and independent bilingual/legal/IRAC reviews remain open.

Next SINGLE task: preregister a real long-recording HTTP/UI wiring smoke using the already inspected assembled stress fixture and unchanged decoder settings, compare native text/review windows against saved evidence. Do not introduce new tuning, reserved holdout decoding, legal retrieval compensation or expert labels. This next task is not performed here.
