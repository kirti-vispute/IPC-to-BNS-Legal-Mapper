# Public Hindi Baseline Results

Date: 2026-10-06. Diagnostic complete; generalized recognition bug remains OPEN. No Git branch/commit. User original recording unavailable; public-only continuation authorized. No personal audio requested, model trained/downloaded/switched, decoder tuned, transcript corrected, UI edited or legal pipeline changed.

## Investigation And Decision

Earlier beam5 and neutral-context candidates worsened four-clip reference scores and were rejected. Before another recognizer comparison, establish a broader current-model baseline using a selection rule frozen BEFORE acquisition and inference. This avoids choosing only easy clips or repairing the supplied example. The present task measures existing behavior, not a production implementation of a fix.

Source: [official FLEURS dataset](https://huggingface.co/datasets/google/fleurs), hi_in/validation, CC BY 4.0 verified in saved source-card frontmatter. These are public read-speech annotations, NOT legal training data or expert labels. Dataset row IDs are recording indexes; dataset IDs are sentence identities, not unique speakers. Metadata exposes gender: eight male-coded/four female-coded recordings, no unique speaker identifiers. No speaker-diversity or demographic representativeness claim.

All 12 preregistered primary rows were selected, no skips/reserve substitutions: 0,7,14,21,28,35,42,49,56,70,77,98. Sentence IDs and audio SHA-256 are all distinct and disjoint from BOTH earlier Hindi development and holdout sets. Real decoded sample counts match published counts at 16000 Hz. Unmodified clips span5.52-19.86 seconds, total140.70 seconds. No rejected-cue confirmation or reserved Marathi holdout acquired/decoded.

## Actual Execution

New scripts/obtain_hindi_baseline.mjs owns exclusive public acquisition/license/overlap metadata. New scripts/validate_hindi_baseline.py registers identities, verifies audio, drives the ACTUAL backend.speech.transcribe streaming main and scores separately. No diagnostic adapter between production and model. Current local whisper-medium, CPU/int8/four threads, explicit Hindi/task transcribe/beam3/temperature0/VADtrue/previous-contextfalse/promptNone. Worker receives only audio bytes, never annotations, user's example or legal vocabulary. Raw replies written immediately, before scoring.

Registration:359 identities before acquisition,374 before recognition. Entire previous351 commitments retained, no refreshed/authorized source exceptions needed. No production source, dependency, model or runtime bytes changed.

## Reference Measurements

Every selected recording returned nonempty native text; no worker error codes, timeouts or omitted clips. All twelve have nonzero word edits. Frozen scorer uses NFC/lowercase/punctuation removal/whitespace collapse, then exact word/character Levenshtein. It has NO spelling normalization, synonyms, phonetic repair or number substitution. Word boundaries and diacritics affect scores; reported counts are against published annotations, not independently adjudicated spoken meaning.

| Clip | Audio Seconds | Word Edits/Reference Words | Character Edits/Reference Characters | Request Seconds |
|---|---:|---:|---:|---:|
| hi-0.wav | 12.24 | 14/30 | 17/144 | 21.674 |
| hi-7.wav | 14.16 | 11/29 | 32/148 | 14.604 |
| hi-14.wav | 10.20 | 10/19 | 18/111 | 24.073 |
| hi-21.wav | 5.94 | 7/15 | 8/83 | 20.649 |
| hi-28.wav | 11.58 | 10/35 | 24/166 | 35.222 |
| hi-35.wav | 10.44 | 5/24 | 7/105 | 24.455 |
| hi-42.wav | 15.60 | 16/35 | 28/188 | 42.146 |
| hi-49.wav | 5.52 | 6/13 | 6/64 | 21.426 |
| hi-56.wav | 8.46 | 3/16 | 8/84 | 15.990 |
| hi-70.wav | 18.06 | 13/33 | 21/152 | 16.675 |
| hi-77.wav | 8.64 | 7/18 | 11/98 | 13.145 |
| hi-98.wav | 19.86 | 9/30 | 13/154 | 18.845 |
| Total | 140.70 | 111/297 | 193/1497 | 268.904 |

Micro WER **37.37%**, micro CER **12.89%**. These are ERROR RATES, not percentage of correctly answered legal questions. Do not convert to a website accuracy claim. Earlier four-clip baseline24.44% WER/8.16% CER uses a DIFFERENT set; neither gain nor regression can be inferred from that cross-set difference.

Examples of annotation/output mismatches (not correction rules): hi35 reference year1767 -> output1766; hi7 reference `क्षेत्रों में` omitted and `सूरज क्षितिज से ऊपर नहीं उगता` -> `सूर्च शिति अप नहीं उपता`; hi98 reference `नई` -> `नही`. Full references and original outputs remain separately saved; none injected into inference or applied to textarea. A script-compatible response is not necessarily a faithful transcript.

Request times include audio framing/decode and worker inference; first includes model initialization. Observed total268.904 seconds, range13.145-42.146 seconds, no190-second diagnostic deadline reached. Workstation load was uncontrolled; software tests/benchmark ran during part of collection. NOT an isolated latency benchmark, HTTP/UI measurement, or speed improvement. No assertion that latency scales with duration.

## Tests And Legal Integrity

Three new JS acquisition contracts and five Python baseline contracts all pass: fixed selection/excluded rows/license frontmatter/sentence-or-audio overlap; complete scoring/empty deletion counts/error-or-missing rejection/duplicate identities/disjointness. Full suites:257/257 JS and107/107 Python, zero failures/skips. Project TEMP/TMP/PYTHONUTF8 used for full suites; approved localhost test-server execution. These are software contracts, not speech-quality acceptance.

Official mapping benchmark:104/104 Top-1 and Top-3 for EACH IPC/BNS, unchanged; expected pairs come from same crosswalk, not independent legal validation. New current resolved replay:5/5 Top-1 and5/5 Top-3, unchanged, explicitly NOT independent lawyer validation. Historical sealed report40%/predictions/official references/report/methodology remain untouched. Final374 registered inputs unchanged, including production/frontend/backend/gateway/corpus/provenance/evaluation/model/runtime; reserved Marathi and rejected-cue confirmation outputs absent. Final post-documentation audit is separately saved.

## Files And Reproduction

New frozen plan: Feature-hindi-broader-baseline-plan.md. Tools: scripts/obtain_hindi_baseline.mjs and scripts/validate_hindi_baseline.py. Tests: tests/hindiBaselineAcquisition.test.js and tests/test_hindi_baseline.py. This result document and engineering/Hindi bug records explain outcomes; no production rollback necessary.

Evidence root: output/public-speech-validation/hindi-broader-baseline-20261006/ contains pre-acquisition-registration.json, acquisition.log, fixtures/{source-card.md,selection.json,fixtures.json,12 WAVs}, recognition-registration.json, observations.jsonl, recognition.log, report.json, recognition-integrity.json, javascript-tests.log, python-tests.log, mapping-benchmark.json and final-integrity.json. Separate replay: output/project-completion/hindi-broader-baseline-replay-20261006.json. Preserve all existing evidence and frozen tools/tests/plan; NEVER rerun into occupied destinations. Audio remains ignored/local, not added to legal corpus or redistributed.

Original order (already executed, NOT safe to rerun here): python -m scripts.validate_hindi_baseline register-acquisition -> node scripts/obtain_hindi_baseline.mjs -> python -m scripts.validate_hindi_baseline register-recognition -> python -m scripts.validate_hindi_baseline run. Full suites: npm test; .venv-speech/Scripts/python.exe -m unittest discover -s tests -p 'test_*.py' -v. Mapping: node scripts/evaluate_retrieval.mjs. Replay: node scripts/project_completion_validation.mjs replay UNIQUE-NEW-NAME.json, verify destination absent first.

## Conclusion And Next Single Step

Errors generalize beyond the supplied Hindi example on this small fixed public sample; current explicit medium path produces them before translation. This does NOT identify the user's exact acoustic cause, validate every microphone/accent, or show that an alternative model will solve them. No speculative production correction.

Next SINGLE task: separately preregister one evidence-supported alternative Hindi recognizer comparison against these12 frozen development references, with explicit per-clip/aggregate quality, numeric fidelity, silence and latency criteria and a separately reserved fresh confirmation gate. Select/pin/license-check candidate before inference; do not tune on outcomes or deploy before confirmation. Hindi legal/date/section fidelity, long natural speech and Marathi robustness remain unvalidated; no expert labels invented.
