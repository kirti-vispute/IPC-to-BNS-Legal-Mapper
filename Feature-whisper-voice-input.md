# Feature: Free Local Voice Input

## Selected Hindi speed update (2026-09-30)

Explicitly selected Hindi now shares the existing reusable offline speech-worker slot with selected Marathi. A language switch replaces the worker, so only one selected-language model stays loaded. Selected Hindi no longer pays for an unused language-detection pass; Auto still detects language. The model, beam/VAD settings, transcript review, separate Analyze action, UI and legal processing are unchanged. Two live HTTP runs of the same public Hindi clip took 41.9/41.9 seconds before and 23.5/20.6 seconds after on this machine, with the same transcript. These observations are not general latency or legal-speech accuracy guarantees. See `Bug-selected-hindi-transcription-latency.md`.

## Selected Marathi speed and factual-safety update (2026-09-30)

Selected Marathi now reuses one offline recognizer process between recordings and does not rerun language detection after an explicit `mr` choice; Auto and Hindi retain their original one-shot paths and beam/VAD settings. Live same-public-clip HTTP checks took 4.6 seconds then 3.8 seconds, compared with an earlier approximately 20.8-second observation under uncontrolled machine conditions. The transcript remains editable and Analyze remains separate. The multilingual adapter accepts complete spoken Hindi/Marathi dates only after calendar validation, rejects an unsupported theft-to-homicide translation, and preserves exact dates across bounded long-query translation. The retrieval layer now recognizes narrow victim-reported stolen-property wording. None of this proves correct ASR on the user's unavailable recording or general legal accuracy. See `Bug-multilingual-voice-latency-and-fidelity.md`.

## Selected Marathi quality update (2026-09-30)

Selected Marathi now prefers a pinned, locally converted Marathi-tuned Whisper small model (`422f5ad4f5356d3dcd413ee862f09a7a389bebd7`, Apache 2.0 source model). `scripts/setup_marathi_speech.py` verifies the published source-weight SHA-256 before CPU/int8 conversion and saves a local tokenizer. If that model is not installed, the existing multilingual small model is retained as a fallback and the response identifies the actual model used. Auto and Hindi remain tiny and medium, respectively. Same-clip public read/telephone samples improved, but no legal-date or section-number recording was evaluated. The editable transcript and manual Analyze step remain necessary. The sections below describe historical stages of the voice feature.

## Selected Hindi quality update (2026-09-29)

Only user-selected Hindi now uses pinned local faster-whisper medium (revision `4d9f76bb96174a5625e9ed85e89be563d98d528c`, CPU/int8). Selected Marathi stays on small; Auto stays on tiny. The same `backend/speech/transcribe.py` and editable transcript/Analyze flow apply. Hindi alone has a 180-second local worker and 190-second browser deadline because an 86-second performance clip took 116.8 seconds with medium. `scripts/setup_local_speech.py` installs all three pinned models; `LOCAL_SPEECH_HINDI_MODEL` optionally selects a different local medium directory. The model is a pretrained ASR model, not trained on legal PDFs or these test recordings. Eight Hindi read-speech clips (four development, four held-out) improved relative to small, but no spoken legal date/section accuracy is established. See Bug-hindi-speech-quality.md; the older small-for-both description below is historical.

## Current Hindi/Marathi recording path (2026-09-29)

The recording UI now offers Auto detect, Hindi, and Marathi. Auto retains tiny-model detection and the existing confidence guard. An explicitly selected Hindi/Marathi recording uses pinned local faster-whisper small (`Systran/faster-whisper-small`, revision `536b0662742c02347bc0e980a01041f333bce120`, CPU/int8) and the chosen decoding language without the English legal prompt. The detected code remains diagnostic only; selection has no fabricated model confidence. Both models are installed by `scripts/setup_local_speech.py`; `LOCAL_SPEECH_INDIC_MODEL` optionally overrides the small path. The transcript remains editable and Analyze remains separate. The shared text translator, date routing, retrieval, sources and IRAC are unchanged. Eight ordinary human clips yielded recognizable Devanagari but had word errors; they contain no legal dates or section references, and do not establish legal-speech accuracy. See Bug-selected-speech-language.md. Historical descriptions below of a translate checkbox or tiny-only setup are superseded.

Updated: 2026-09-26. The filename is retained for existing references; the paid API implementation is retired.

Current multilingual voice contract: native transcription only; direct audio translation/checkbox retired. Automatic Whisper language/probability enters the shared local text-translation adapter, English legal processing, then same-language structured output. Corrections retain voice metadata and the original transcript; clear the textarea for a new typed query. Unknown/unsupported/low-confidence speech preserves text and asks for clarification, never silently English. No OpenAI key or paid/cloud API. Real Indian-language acoustic accuracy is not verified. See Bug-multilingual-voice-handoff.md for tests, known translation/retrieval failures and exact manual verification.

## Problem and Investigation

The old backend sent recordings to a paid Whisper API and rejected requests without its server key. Recording controls already worked independently of that key. Inspected frontend HTML/CSS/JS, server, transcriber, tests, package and engineering docs. Only the speech adapter needed replacement; legal analysis must not change.

## Decision

Use [faster-whisper](https://github.com/SYSTRAN/faster-whisper) 1.2.1 with the maintainer's [tiny multilingual conversion](https://huggingface.co/Systran/faster-whisper-tiny). The engine and weights are freely available under MIT licenses. CPU/int8 avoids a GPU requirement. PyAV bundles audio-decoding libraries, so browser WebM/Opus does not need a separate FFmpeg executable. whisper.cpp requires native runtime/build and browser audio decoding setup; standard Python Whisper adds heavier runtime/FFmpeg setup. Tiny is a practical small default, not a claim of optimal legal-speech accuracy.

## Windows Setup

Install Python 3.12 x64 and Node 20+. From the project root:

```powershell
py -3.12 -m venv .venv-speech
.\.venv-speech\Scripts\python.exe -m pip install -r backend/speech/requirements.txt
.\.venv-speech\Scripts\python.exe scripts/setup_local_speech.py
npm start
```

Open http://localhost:3000. Setup is already complete on this machine. The available Python used here was the desktop application's bundled Python 3.12.14; a normal Python install and the commands above work without relying on that bundled path.

One-time setup requires internet for PyPI and the maintainer's Hugging Face model repository; no account/token or paid service is required. Setup pins model revision `d90ca5fe260221311c53c58e660288d3deb8d356`. Model files live at `models/speech/whisper-tiny/`: model.bin (75,538,270 bytes), config.json, tokenizer.json, vocabulary.txt. Model.bin SHA-256: `dcb76c6586fc06cbdac6dd21f14cfd129cc4cdd9dce19bf4ffa62e59cbe6e6d1`.

The local environment and large model files are ignored by Git. Optional `LOCAL_SPEECH_PYTHON` and `LOCAL_SPEECH_MODEL` select alternate local executable/directory paths. Otherwise the backend uses `.venv-speech/Scripts/python.exe` on Windows and `.venv-speech/bin/python` on Linux/macOS. Only Windows was verified; unavailable Python/native wheels return recognizer errors. Health readiness checks files, not package imports or full model integrity.

## Actual Execution

Multilingual integration verification (latest): full suite now86 passed; actual old/current recognizers match the synthetic English fixture's 20June date, and verified host127.0.0.1 voice->Analyze returns IPC379/PASSED. Three direct current-worker repeats also matched. Other isolated localhost diagnostics differed; their connection-path difference is unresolved. Native Indian speech accuracy has not been measured. The verification counts below describe the preceding free-speech replacement session, not the latest multilingual change.

Browser microphone -> existing MediaRecorder -> Blob -> POST /api/transcribe -> input validation -> local Python subprocess -> PyAV memory decode -> local tiny model CPU/int8 -> JSON text -> existing editable textarea -> user reviews -> manual Analyze -> unchanged legal pipeline.

The translate checkbox explicitly runs the same multilingual model's English translation task. Default transcription now automatically detects the spoken language and returns originalLanguage/languageProbability along with the text. The multilingual adapter translates native text to English for unchanged legal processing and returns explanations in the original language. An unchanged English-translated voice transcript retains its spoken-language hint; editing it invalidates that hint. No project-specific ASR fine-tuning or legal dataset training is performed. Audio stays in memory and is not permanently stored by the endpoint; the worker exits after each request and releases its memory. Offline flags and local_files_only prevent model downloads during inference. No cloud transcription fallback exists. Use the app's local server on this laptop to keep recordings on the machine, not a remotely hosted deployment. Indian-language human speech accuracy is not measured; see Feature-multilingual-input-output.md for translation limits.

## Limits and Recovery

- Accepted: WebM/Opus, OGG, WAV, MP3/MPEG, MP4/M4A, FLAC; the actual decoder validates contents.
- Limits: 10 MiB, 90 seconds; one concurrent inference job (additional requests receive 429).
- Model load/process deadline: 120 seconds; browser request deadline: 130 seconds.
- Existing capture permission deadline: 20 seconds; capture cancellation/late-stream release retained.
- Empty upload 400; unsupported MIME 415; undecodable/no-speech 422; excessive duration/size 413; runtime/model/load error 503; process failure 502; timeout 504.
- A loading status is shown during the request. Both success/failure restore controls. Transcript never automatically invokes legal analysis.

Troubleshooting: missing recognizer -> rerun the dependency installation/check Python path; missing/corrupt model -> rerun setup/check local directory; model loading failure -> check available memory and complete files; timeout -> shorten recording; permission denied -> allow microphone for localhost in a supporting browser and check Windows microphone privacy/device settings yourself. Ordinary typed input remains available.

## Tests and Observed Results

- Full suite: 54 passed, 0 failed, including local process mocks and real frontend code under controlled browser API mocks.
- Mapping benchmark unchanged: IPC and BNS each 104/104 Top-1 and Top-3.
- Current resolved reference replay unchanged: 5/5 Top-1 and 5/5 Top-3 any-hit. Historical sealed official-source result remains 40%; no evaluation is regenerated.
- Real local model inference on generated Windows offline speech, not human microphone audio: WAV and WebM/Opus both HTTP 200. The WebM transcript was: "The alleged act happened on 20 June 2024 and concerns theft of movable property under IPC section 379".
- That actual transcript passed the unchanged legal pipeline: 2024-06-20, IPC_ONLY, IPC 379 Top-1, grounding PASSED. WAV punctuation differed slightly without changing these outputs.
- Observed elapsed: initial cold direct inference about 40 seconds, subsequent HTTP WAV about 1.6 seconds, WebM about 1.9 seconds. These are local observations, not latency guarantees.
- Actual silent WAV -> no-speech 422; invalid WebM -> decoding 422; unsupported type -> 415; empty upload -> 400.
- Real browser Start requested microphone access, then reported permission denied; controls recovered. Successful live Start -> speak -> Stop -> insertion could NOT be verified in this browser. Controlled frontend tests verify insertion/no auto-analysis/manual Analyze, not acoustic recognition.
- Typed browser regression passed with date, IPC 379 first, and grounding Passed.
- All 37 protected-file baseline hashes unchanged, including all evaluation files, legal PDFs/data/manifest, legal modules and mapping benchmark script.

The generated verification fixtures are in ignored output/voice-verification/, not corpus/training/evaluation data. No ASR accuracy percentage, multilingual quality, or performance on natural speech is claimed from this limited verification.

## Manual Real Microphone Verification

1. Open localhost in a supporting browser with a working microphone; permit capture for this local site.
2. Click Start recording; verify Recording/Stop recording appears.
3. Say: "The alleged act happened on 20 June 2024 and concerns theft of movable property under IPC section 379."
4. Click Stop recording; wait for local transcription. Verify text appears in the existing textarea and results remain awaiting analysis.
5. Review/correct the transcript, especially date and section numbers. Click Analyze; check 2024-06-20, IPC applies, IPC 379 first, grounding Passed.
6. Test cancellation, silence and permission denial. Record observations honestly; do not alter legal logic to compensate for speech errors.

## Cost Verification

OpenAI API key: NO. Cloud speech API: NO. Payment method: NO. Subscription: NO. Per-minute transcription charge: NO. API/cloud cost: INR 0. Uses the laptop's compute/storage and normal one-time download connectivity.

## Rollback

See Rollback.md for pre-change copies and scoped reversal. No paid fallback is retained in production. No legal/corpus/evaluation modifications were required.
