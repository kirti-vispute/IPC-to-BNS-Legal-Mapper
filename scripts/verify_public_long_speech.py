"""Stress the production HTTP speech endpoint with concatenated licensed human clips."""
import hashlib
import io
import json
import time
import urllib.request
import wave
from pathlib import Path
import numpy as np
from faster_whisper.audio import decode_audio

root = Path(__file__).resolve().parent.parent
directory = root / "output/voice-verification/holdout-speech"
fixtures = [f for f in json.loads((directory / "fixtures.json").read_text(encoding="utf-8"))["fixtures"] if f["language"] == "mr"]
clips = []
references = []
sources = []
for fixture in fixtures:
    path = directory / fixture["filename"]
    if hashlib.sha256(path.read_bytes()).hexdigest() != fixture["sha256"]:
        raise RuntimeError("Public sample checksum mismatch")
    clips.append(decode_audio(str(path), sampling_rate=16000))
    references.append(fixture["transcript"])
    sources.append({key:fixture[key] for key in ["filename", "source", "license", "sha256"]})
parts = []
expected = []
while sum(len(part) for part in parts) < 60 * 16000:
    for clip, reference in zip(clips, references):
        parts.append(clip)
        expected.append(reference)
        if sum(len(part) for part in parts) >= 60 * 16000:
            break
audio = np.concatenate(parts)
buffer = io.BytesIO()
with wave.open(buffer, "wb") as stream:
    stream.setnchannels(1)
    stream.setsampwidth(2)
    stream.setframerate(16000)
    stream.writeframes((np.clip(audio, -1, 1) * 32767).astype("<i2").tobytes())
start = time.perf_counter()
request = urllib.request.Request("http://127.0.0.1:3002/api/transcribe?mode=transcribe&language=mr", data=buffer.getvalue(), headers={"Content-Type":"audio/wav"}, method="POST")
try:
    with urllib.request.urlopen(request, timeout=185) as response:
        result = json.loads(response.read())
    report = {"type":"CONCATENATED_PUBLIC_SPEECH_STRESS_TEST", "durationSeconds":len(audio)/16000,
        "elapsedSeconds":time.perf_counter()-start, "reference":" ".join(expected), "response":result, "sources":sources,
        "limitations":"Artificial concatenation of read-speech clips, not spontaneous long sentences, legal-date speech, physical microphone validation or ASR accuracy certification."}
except Exception as error:
    report = {"type":"CONCATENATED_PUBLIC_SPEECH_STRESS_TEST", "error":str(error), "elapsedSeconds":time.perf_counter()-start}
(root / "output/project-completion/long-public-speech.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({key:value for key, value in report.items() if key not in ["reference", "sources", "response"]}), flush=True)
if "error" in report:
    raise SystemExit(1)
