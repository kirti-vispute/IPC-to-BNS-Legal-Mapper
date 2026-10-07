# IPC to BNS Deterministic Mapping System

This project implements a neuro-symbolic legal retrieval prototype for mapping Indian Penal Code (IPC) issues to Bharatiya Nyaya Sanhita (BNS) provisions while enforcing the July 1, 2024 transition as deterministic program logic.

The system intentionally separates:

- factual parsing
- temporal routing
- statutory retrieval
- IRAC answer synthesis
- faithfulness review

No student, author, or supervisor names from the reference documents are included in this project.

## Features

For a Hindi or Marathi recording, choose the spoken language before pressing Start recording. Auto detect remains available. The chosen language guides local native-script transcription; review/correct the transcript, then press Analyze. Analysis translates text locally to English and displays the result in the selected language. This is not direct audio translation or a guarantee of exact words, dates, or legal sections. Clear the textarea to start a new typed query in another language. Evidence and limitations: [Bug-selected-speech-language.md](Bug-selected-speech-language.md).

Multilingual input/output: automatically detects supported Indian-language text, translates locally to English for the unchanged legal pipeline, and displays explanations in the original language. No paid API/key/cloud runtime dependency. English skips translation. Setup, verified examples and limitations: [Feature-multilingual-input-output.md](Feature-multilingual-input-output.md). NLLB is restricted to noncommercial use; this feature is an academic prototype, not certified legal translation.

- Deterministic Applicable Law Check using the statutory commencement date
- Rule-based offense date extraction
- Split-period review path for continuing offenses
- Section-level retrieval over official IPC and BNS texts
- Official BPR&D IPC-to-BNS comparison mappings
- Source authority, file, page, URL, and SHA-256 provenance on every record
- IRAC output structure
- Citation-bound synthesis from local corpus text only
- Review flags when the answer needs human verification
- Static frontend served by the backend
- Free local faster-whisper native voice transcription with optional Hindi/Marathi language selection
- Dependency-free Node.js backend

## Project Structure

```text
backend/
  core/
    dateExtractor.js
    gateway.js
    retriever.js
    synthesizer.js
    verifier.js
    transcriber.js
  data/
    statutes.json
    ipc-bns-mappings.json
  server.js
frontend/
  app.js
  index.html
  style.css
models/
  MODEL_CARD.md
legal-sources/
  manifest.json
  *.pdf
scripts/
  build_legal_corpus.py
tests/
  gateway.test.js
  retriever.test.js
ARCHITECTURE.md
README.md
```

## Run

No API key, payment method, subscription, or cloud speech service is required.

For voice input, install Python 3.12 x64 and run this one-time setup from the project root:

```powershell
py -3.12 -m venv .venv-speech
.\.venv-speech\Scripts\python.exe -m pip install -r backend/speech/requirements.txt
.\.venv-speech\Scripts\python.exe scripts/setup_local_speech.py
```

Setup installs the free [faster-whisper engine](https://github.com/SYSTRAN/faster-whisper) and downloads pinned [tiny](https://huggingface.co/Systran/faster-whisper-tiny), [small](https://huggingface.co/Systran/faster-whisper-small), and [medium](https://huggingface.co/Systran/faster-whisper-medium) multilingual models into local `models/speech/` folders. Auto uses tiny and selected Hindi uses medium. Selected Marathi prefers the optional Marathi-tuned small model below and falls back to multilingual small when it is absent. Internet is needed only for setup, not inference. The medium model adds about 1.53 GB on disk and makes Hindi transcription slower. No virtual-environment activation or separate FFmpeg installation is needed.

For the Marathi-tuned model, run this one-time pinned download and checksum-verified conversion (about 967 MB source and 248 MB converted weights):

```powershell
py -3.12 -m venv .venv-translation
.\.venv-translation\Scripts\python.exe -m pip install -r backend/translation/requirements.txt
.\.venv-translation\Scripts\python.exe scripts/setup_marathi_speech.py
```

This machine has the converted model installed. The speech model and test audio are not part of the legal corpus.

```bash
node backend/server.js
```

Then open:

```text
http://localhost:3000
```

The browser records up to 90 seconds. The local backend passes audio in memory to a local CPU/int8 speech worker, then inserts its transcript into the editable query box. Review dates and section numbers before clicking Analyze; analysis never starts automatically. Audio is not uploaded to any cloud speech provider or saved by the transcription service. Use the app on localhost, not a remotely hosted server.

Selected Hindi and Marathi share one reusable local speech worker; switching languages replaces the loaded model. Auto still detects language separately. Complete spoken Hindi/Marathi day-month-year forms such as `बीस जून दो हजार चौबीस` and `वीस जून दोन हजार चोवीस` are normalized only when recognized and calendar-valid; otherwise the app still asks for the offence date. Long multi-date text is translated in bounded chunks with strict date preservation. A mistranscribed spoken word cannot be reconstructed from text alone: correct the editable transcript before Analyze. The short public-sample checks do not establish general voice or legal accuracy.

See `Feature-whisper-voice-input.md` for model paths, limits, troubleshooting, verification evidence, and manual microphone checks. Optional `LOCAL_SPEECH_PYTHON`, `LOCAL_SPEECH_MODEL` (Auto), `LOCAL_SPEECH_MARATHI_MODEL` (preferred Marathi), `LOCAL_SPEECH_INDIC_MODEL` (legacy Marathi override/fallback), and `LOCAL_SPEECH_HINDI_MODEL` (Hindi) variables select alternate local paths; no speech credentials are used.

## Test and Evaluate

```bash
node --test tests/*.test.js
node scripts/evaluate_retrieval.mjs
```

The evaluation command reports Top-1 accuracy and Top-3 recall on query cases generated from the official BPR&D comparison rows. It measures retrieval consistency with that source, not independent legal correctness.

Current reproducible benchmark: 104/104 Top-1 matches for pre-commencement IPC retrieval and 104/104 Top-1 matches for post-commencement BNS retrieval. Because the expected pairs come from the same official crosswalk used by the system, this result must not be presented as real-world legal accuracy.

## Rebuild the Legal Corpus

The corpus builder accepts only the legal files declared in the script and records their checksums. It requires Python with `pdfplumber`.

```bash
python scripts/build_legal_corpus.py
```

The approved sources are official Government of India publications from the Ministry of Home Affairs, the Gazette of India, and the Bureau of Police Research and Development. No proposal text, blogs, student material, or synthetic statute summaries are indexed.

## Example Queries

```text
The alleged act happened on 2024-06-20 and concerns theft of movable property under IPC 379.
```

```text
The offense took place on 2024-07-12 and concerns organized crime with continuing unlawful activity.
```

```text
The conduct started on 2024-06-15 and continued until 2024-07-08, involving threats against the state.
```

## Important Note

This is an academic software prototype and not legal advice. Official source text improves coverage and traceability but does not establish legal correctness; outputs still require review by a qualified legal professional.
