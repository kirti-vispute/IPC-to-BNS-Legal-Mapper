# Real Hindi/Marathi Speech Reproduction (2026-09-29)

## Problem and scope

Previous controlled transcript tests passed, but Hindi/Marathi *acoustic* recognition had not been tested. This session used eight real human-speech recordings. It did not change production code, models, routing, retrieval, corpus, evaluation data, or sealed predictions. The exact earlier Greek/Japanese/Chinese *final output* report was not reproduced.

## Licensed sources and local fixtures

| Source | Language | License verified at source | Local clips | Use |
|---|---|---|---|---|
| [Google FLEURS](https://huggingface.co/datasets/google/fleurs) validation `hi_in` | Hindi | CC BY 4.0; attribution required | `hi-29.wav`, `hi-44.wav`, `hi-53.wav`, `hi-82.wav` | Temporary local research only |
| [Adaption Low-Resource Audio](https://huggingface.co/datasets/Reubencf/Adaption-low-resource-audio) / [PolyglotAudio](https://huggingface.co/datasets/Reubencf/PolyglotAudio) / Tatoeba | Marathi | Each chosen row lists CC BY-NC 4.0; noncommercial and attribution restrictions | `mr-3.mp3`, `mr-8.mp3`, `mr-42.mp3`, `mr-56.mp3` | Temporary local research only |

These are read sentences, not synthesized speech. The four Marathi clips are attributed in the local manifest to Tatoeba recorder `sabretou`; sentence IDs, audio IDs, dataset row IDs, source links and per-file SHA-256 are in ignored `output/voice-verification/real-speech/fixtures.json`. Audio is under ignored `output/voice-verification/real-speech/`, not a checked-in fixture. The source licenses permit use subject to their terms, but this project deliberately does not redistribute the recordings. Mozilla Common Voice [offers CC0 Hindi and Marathi datasets](https://commonvoice.mozilla.org/en/datasets), but current releases are large and its [terms ask users not to mirror datasets](https://commonvoice.mozilla.org/oc/terms); none were downloaded. [OpenSLR SLR64](https://www.openslr.org/64/) has CC BY-SA 4.0 Marathi recordings, but its 712 MB archive was unnecessary. A gated sample dataset was not accessed.

Reproduce: run `node scripts/obtain_real_speech_fixtures.mjs` (network access), then `node scripts/verify_real_speech.mjs` (local speech and translation models). The latter writes per-clip native transcript, confidence, English processing input, legal route, retrieved IDs/citations, IRAC presence, typed-reference comparison and errors to ignored `output/voice-verification/real-speech/observations.json`. The fixture downloader checks each selected row's language and Marathi per-row license before download. FLEURS license is documented on its dataset card.

## Actual observations

Durations measured locally: Hindi `13.92, 4.98, 10.62, 22.68` seconds; Marathi `3.03, 2.80, 3.32, 2.43` seconds in filename order. The reference transcripts are dataset annotations, not expert legal labels.

| Clip | Expected speech language | Whisper code / probability | Whisper text observation | Voice analysis | Typed reference text |
|---|---|---:|---|---|---|
| `hi-29.wav` | `hi` | `hi / .518` | Repeated English-government sentence unrelated to the annotated robbery report | `LANGUAGE_UNCERTAIN` | `hi`, CLARIFY |
| `hi-44.wav` | `hi` | `hi / .908` | `police sayag is sharp lumbag a1dmp`, not faithful Devanagari | `hi`, CLARIFY | `hi`, CLARIFY |
| `hi-53.wav` | `hi` | `hi / .943` | Romanized, partially recognizable police/photographer terms; important wording distorted | `hi`, CLARIFY | `hi`, CLARIFY |
| `hi-82.wav` | `hi` | `hi / .849` | Romanized satellite/mobile-phone terms followed by a repeated English phrase | `hi`, CLARIFY | `hi`, CLARIFY |
| `mr-3.mp3` | `mr` | `id / .619` | Romanized approximate words, not Marathi script | `UNSUPPORTED_LANGUAGE` | `mr`, CLARIFY |
| `mr-8.mp3` | `mr` | `es / .597` | Spanish-like words unrelated to source | `UNSUPPORTED_LANGUAGE` | `hi`, CLARIFY |
| `mr-42.mp3` | `mr` | `hi / .277` | Romanized approximate words | `LANGUAGE_UNCERTAIN` | `hi`, CLARIFY |
| `mr-56.mp3` | `mr` | `si / .246` | Romanized approximate words | `UNSUPPORTED_LANGUAGE` | `hi`, CLARIFY |

All eight clips had **no offence date or section reference in their source transcripts**, so CLARIFY/no IRAC is the expected *workflow state*, not a legal-correctness score. Their legal candidate rankings are not ground truth. The typed text path completed 8/8, but three short Marathi texts were classified as Hindi; this is a distinct short-text language-identification limitation. Voice reached analysis on three Hindi clips and preserved Hindi output language; those analyses received corrupted transcription. None of the four Marathi voice clips reached translation or legal analysis, so no claim about downstream Marathi voice translation can be drawn. The API check on `localhost:3001` reproduced `hi-44.wav -> hi -> hi output` and `mr-3.mp3 -> id -> UNSUPPORTED_LANGUAGE` through the actual `/api/transcribe` then `/api/analyze` endpoints. Browser physical microphone capture was **not verified** because no live Hindi/Marathi speaker recording was available.

## Boundary and root cause

First wrong value for Marathi is in `backend/speech/transcribe.py`'s local `WhisperModel.detect_language(...)` response; `backend/core/transcriber.js` passes it unchanged; `backend/core/languages.js` and `backend/core/multilingual.js` then conservatively reject unsupported/low-confidence speech. The backend/API and frontend handoff do not invent `es`, `id`, or `si`. In Hindi, the code is usually correct but the local tiny model's decoded text is not reliable. A standalone tiny-model run **without** the legal initial prompt still classified Marathi clips as `id`/`hi`/`si` and produced approximate Romanized output. Removing the prompt shortened Hindi repetition but did not restore faithful transcripts. This rules out the prompt as the sole cause and does not prove a safe prompt-only fix. MP3 decoding succeeded and the same decoded waveform was used by both tests; there is no evidence of a file-format failure.

The immediate failure is acoustic language identification/transcription on these clips, before translation target choice or final rendering. Short Marathi duration and tiny-model capacity are plausible contributors, not separately established causal factors. The source clips are not controlled dated legal utterances, so they cannot determine real legal-query speech accuracy or the exact previously reported Greek/Japanese/Chinese final-language behavior.

## Decision, tests, and next step

No production fix made. Forcing `mr`, lowering the 0.8 confidence gate, or mapping unsupported speech codes to Marathi would conceal evidence and could route unrelated languages into incorrect legal analysis. A model/prompt replacement is not justified without comparing representative spoken legal utterances under the same hardware and checking transcript/date/section fidelity. Obtain consensually recorded Hindi/Marathi legal sentences (pre/post date, missing date, explicit IPC 379), then compare current tiny model against an offline candidate recognizer on the *same* recordings before one bounded production change.

Regression: full suite 148/148; dedicated multilingual/voice suite 107/107; official mapping consistency IPC and BNS 104/104 each Top-1 and Top-3; no-write resolved official-source replay 5/5 Top-1 and 5/5 acceptable Top-3. These do not measure audio accuracy. Nine documented protected checksum baselines (sealed prediction, labels, report, corpus/manifest, four official PDFs) match; no evaluation result was regenerated. No Git branch/commit exists, so there is no Git diff baseline. Only two new diagnostic scripts, this report, and workflow documentation were edited.
