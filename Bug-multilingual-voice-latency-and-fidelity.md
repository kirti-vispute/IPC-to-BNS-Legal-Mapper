# Bug: Multilingual voice latency, date and offence fidelity

Date: 2026-09-30. No Git repository/branch/commit exists in this workspace.

## Problem and investigation

The exact user recording reportedly yielding murder for spoken `चोरी` was not available, so that acoustic misrecognition cannot be reproduced or claimed fixed. A real controlled text reproduction did identify a downstream error: `२० जून २०२४ रोजी माझा मोबाईल फोन चोरीला गेला.` became `2024-06-20 My cell phone was stolen on the day.` The Applicable Law Check returned IPC_ONLY, but retrieval ranked IPC 215/410/411 above theft. The retriever required the English word `theft` or a stronger theft-element cluster; victim-reported `was stolen` did not qualify. A possession-of-stolen-property query must retain its separate ranking.

Spoken `वीस जून दोन हजार चोवीस` and Hindi `बीस जून दो हजार चौबीस` had no extracted date, while native digits already worked. A 706-character, two-date Marathi query damaged `__LEGAL_1__` in NLLB output; the previous validation safely refused it. A distinct `DATE1` marker survived on that same query. Selected Marathi also launched a fresh Python worker and detected language again despite an explicit `mr` choice. Earlier live short-clip transcription took about 20.8 seconds; a local stage profile measured about 2.6 seconds for redundant detection, in addition to startup/decoding. These timings are environment-dependent.

## Decision and implementation

- Add only a short victim-owned `... was/were/got stolen` phrase as a theft retrieval cue; do not equate every mention of stolen goods with committing theft. Keep the existing date gateway and corpus filtering untouched.
- Reject an English homicide concept when explicit native theft is present and no native homicide term supports it. This prevents a wrong-law response for a translation contradiction; it cannot correct an ASR transcript that already misheard the spoken word.
- Normalize complete recognized Hindi/Marathi spoken day-month-year forms, validating the calendar date. Incomplete or unsupported forms do not acquire a guessed date.
- Translate long inputs in bounded chunks. On a long multi-date marker mismatch, try one alternate marker form, then still require exact ordered markers and reject new numeric/legal identifiers. Do not accept a damaged date.
- Reuse a local selected-Marathi recognizer process, skip redundant selected-language detection and keep beam-3/VAD unchanged. Crash/timeout kills that worker; the next request can start a new one. Auto, Hindi, editable transcript/manual Analyze and UI remain unchanged.

Changed production: `backend/core/dateExtractor.js`, `retriever.js`, `multilingual.js`, `transcriber.js`, `backend/speech/transcribe.py`. Regression tests: `tests/retriever.test.js`, `multilingual.test.js`, `transcriber.test.js`.

## Tests and result

Focused 81/81; full serialized suite 167/167. Mapping benchmark IPC/BNS each 104/104 Top-1/Top-3; no-write resolved official-source replay 5/5 Top-1 and acceptable Top-3. Nine protected hashes matched and historical sealed predictions/results were not regenerated. The live port-3001 HTTP path transcribed the same public Marathi clip in 4.6 then 3.8 seconds, and a selected-Marathi spoken-date text query returned IPC_ONLY, date 2024-06-20 and IPC 379/378 before unrelated sections. A controlled 706-character two-date query completed with both original dates and MULTI_PERIOD_REVIEW. These are narrow functional checks, not general speech or legal accuracy. The source speech model still makes word errors; no actual recording of the user's phrase, long spontaneous legal speech, or independent legal review was available.
