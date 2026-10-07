# Feature: Pretrained local speech models for English, Hindi, Marathi, Urdu and Gujarati

Date: 2026-10-07. Scope: speech-to-text only. Legal retrieval, date routing, translation and IRAC are unchanged. Transcripts stay editable and Analyze stays a separate manual step.

## What changed

| Spoken language | Local model used | Source / licence | Notes |
|---|---|---|---|
| English (new selector entry) | Cactus Whistle, 16.9 MB | `Cactus-Compute/whistle`, Apache-2.0 | Falls back to faster-whisper tiny if not installed |
| Hindi | `hindi-medium-ct2` (required) | `vasista22/whisper-hindi-medium`, Apache-2.0, converted to CTranslate2 int8 | No generic fallback; `LOCAL_SPEECH_HINDI_MODEL` can point to another folder explicitly |
| Marathi | unchanged (Marathi-tuned Whisper small) | `durgesh10/whisper-small-marathi` | Not re-evaluated here |
| Urdu (new) | `urdu-large-v3-ct2` | `kingabzpro/whisper-large-v3-urdu-ct2`, Apache-2.0 | No generic fallback; missing model returns a setup message |
| Gujarati (new) | `gujarati-medium-ct2` | `vasista22/whisper-gujarati-medium`, Apache-2.0, converted to CTranslate2 int8 | No generic fallback; missing model returns a setup message |
| Auto detect | unchanged (tiny) | | Whistle cannot detect Hindi/Marathi/Urdu/Gujarati |

**Whistle supports only English, German, French, Spanish, Italian, Dutch and Polish.** It cannot transcribe the four Indian languages, so it is used for English only. Hindi, Marathi, Urdu and Gujarati use fine-tuned Whisper models, which the existing faster-whisper worker runs unchanged.

Rejected: `ai4bharat/indic-conformer-600m-multilingual` covers all four languages but is gated (Hugging Face login and terms acceptance) and needs `trust_remote_code`, which does not fit a clean offline setup. `vasista22/whisper-hindi-large-v2` needs a 6 GB source download.

## Setup

```powershell
.\.venv-speech\Scripts\python.exe -m pip install -r backend/speech/requirements.txt
.\.venv-speech\Scripts\python.exe scripts/setup_local_speech.py                         # tiny and small (generic medium is no longer installed or used)
.\.venv-speech\Scripts\python.exe scripts/setup_indic_speech.py --only whistle urdu     # about 0.8 GB
.\.venv-translation\Scripts\python.exe scripts/setup_indic_speech.py --only hindi gujarati   # about 3 GB download each
```

All revisions are pinned and every weight file is SHA-256 verified before use (the Whistle engine library too). Inference is offline. `requirements.txt` pins `cactus-needle==3.1.2` (pure-Python wheel; engine 3.2.0 `libneedle.dll` is copied into `models/speech/whistle/`). Sizes on disk: Whistle 18 MB, Urdu 786 MB, Hindi 745 MB, Gujarati about 750 MB.

## Privacy and offline behaviour

`cactus-needle` sends anonymous usage counts by default and caches its engine under `~/.cache`. The worker sets `NEEDLE_TELEMETRY=0`, `DO_NOT_TRACK=1`, `HF_HUB_OFFLINE=1` and pins `NEEDLE3_LIB_PATH` / `NEEDLE_WHISTLE_WEIGHTS` to the project folder. Verified by running the worker with an empty home directory: it transcribed correctly and created nothing there.

## How it is wired

- `backend/core/transcriber.js`: `resolveSelectedModel()` chooses model, label, worker and deadline per language; `speechStatus()` reports `whistleReady`, `hindiTunedModelReady`, `urduModelReady`, `gujaratiModelReady`. Hindi, Urdu and Gujarati get the 180 s worker / 190 s browser deadline.
- `backend/speech/whistle_worker.py`: same line-framed JSON protocol as `transcribe.py`. Whistle decodes at most 30 s, so audio up to the 90 s limit is split into windows of at most 29.5 s, each cut at the quietest 100 ms frame in the last 4 s, and the texts are joined.
- `backend/speech/legal_keywords.txt`: words Whistle should favour (IPC, BNS, section, theft, ...). **Edit this list with real legal vocabulary and re-test**; favouring a word makes it likelier to appear.
- `backend/speech/transcribe.py`: accepts `en|hi|mr|ur|gu`; any selected language skips detection.
- Frontend: spoken-language selector gains English, Urdu, Gujarati; a written Urdu/Gujarati choice with spoken Auto now records in that language, like Hindi/Marathi.
- `backend/core/multilingual.js`: selected spoken languages widened to the same five.

## Evidence (public read speech, not legal speech)

`scripts/evaluate_speech_models.py` runs each model through the real worker on the first 12 clips of the FLEURS **test** split (CC BY 4.0). The tuned candidates list FLEURS train+dev in their training data, so the test split is the held-out one (your earlier Hindi studies used `validation`, which would be contaminated for these models). WER/CER use NFC, lowercase, punctuation/symbol removal and whitespace collapse, with no spelling or digit substitutions. Raw replies are saved before scoring (ignored `output/speech-model-comparison/`).

| Language | Current / generic model | WER / CER | New model | WER / CER |
|---|---|---|---|---|
| English | whisper-tiny | 16.6 / 7.1 | Whistle | 13.6 / 6.4 |
| Hindi | whisper-medium (generic baseline, not used) | 37.9 / 17.1 | hindi-medium-ct2 | **9.7 / 2.8** |
| Gujarati | whisper-medium (generic baseline, not used) | 139.0 / 96.5 | gujarati-medium-ct2 | 44.8 / 33.4 |
| Urdu | whisper-medium (generic baseline, not used) | 30.0 / 10.5 | urdu-large-v3-ct2 | 27.5 / 9.2 |

Read these as direction, not accuracy claims: 12 clips per language, one read-speech corpus, one machine.

- **Hindi** clears the earlier preregistered gates: no clip worse on word or character edits, no Latin letters (the old model emitted English spellings such as "standing supergy"), and the same speed (median about 11-12 s per clip). The tuned model is the only Hindi model; there is no generic fallback. Real error remaining: "100 साल" heard as "10 साल".
- **Gujarati**: generic Whisper is unusable (hallucinated output), the tuned model is far better but still rough (several clips near-perfect, others with spelling variants and a wrong number, "29" heard as "39"). The model card reports 12.3 WER; this stricter scoring did not reproduce that. Treat Gujarati as needing careful transcript review.
- **Urdu**: only a small gain over generic Whisper; do not expect good accuracy.
- **English**: Whistle is somewhat better overall, and on a 38 s synthetic legal clip it got "Bharatiya Nyaya Sanhita" right where tiny produced "Bharati and Ayya Sanhada". But Whistle sometimes writes numbers as words ("twenty five") and once dropped a century ("21 June 24" for 2024) on a synthetic legal sentence; tiny got that one right. Windowing on the 38 s clip lost no sentences but added a stray word at the seam. Always check dates and section numbers.
- Timings with other jobs running on the machine (first Gujarati clip 144 s, cold) are not benchmarks.

## Not done / still open

- Marathi was not re-evaluated; no better ungated Marathi model was adopted.
- No real microphone, long, natural legal speech was tested; all audio is public read speech or Windows TTS.
- Spoken-date normalization exists only for Hindi/Marathi; Urdu/Gujarati spoken dates fall back to asking for the offence date.
- Independent lawyer review, and a deployment test on a machine with no cached models, remain outstanding.

## Rollback

Delete `models/speech/{whistle,urdu-large-v3-ct2,gujarati-medium-ct2,hindi-medium-ct2}`: English falls back to tiny, and Hindi, Urdu and Gujarati return the setup message (they do not fall back to anything). To restore the old UI behaviour revert the files listed in "How it is wired".
