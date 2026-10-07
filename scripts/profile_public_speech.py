"""Compare timestamp decoding on licensed public development and holdout audio."""
import gc
import hashlib
import json
import re
import time
import sys
from pathlib import Path

from faster_whisper import WhisperModel
from faster_whisper.audio import decode_audio

root = Path(__file__).resolve().parent.parent
telephony = "--telephony" in sys.argv
out = root / "output/project-completion" / ("public-telephony-comparison.json" if telephony else "public-speech-comparison.json")


def normalized(text):
    return re.sub(r"[^\w\s]", "", text.lower()).strip()


def distance(a, b):
    previous = list(range(len(b) + 1))
    for i, left in enumerate(a, 1):
        current = [i]
        for j, right in enumerate(b, 1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j-1] + (left != right)))
        previous = current
    return previous[-1]


def errors(reference, text):
    ref, actual = normalized(reference), normalized(text)
    return {"cer":distance(ref, actual) / max(1, len(ref)), "wer":distance(ref.split(), actual.split()) / max(1, len(ref.split()))}


rows = []
for language, model_path in ([("mr", "marathi-small-ct2")] if telephony else [("hi", "whisper-medium"), ("mr", "marathi-small-ct2")]):
    model = WhisperModel(str(root / "models/speech" / model_path), device="cpu", compute_type="int8", cpu_threads=4, local_files_only=True)
    for split, folder in ([("mixed", "marathi-telephony")] if telephony else [("development", "real-speech"), ("holdout", "holdout-speech")]):
        directory = root / "output/voice-verification" / folder
        fixtures = json.loads((directory / "fixtures.json").read_text(encoding="utf-8"))["fixtures"]
        for index, fixture in enumerate([f for f in fixtures if f["language"] == language]):
            actual_split = ("development" if index < 4 else "holdout") if telephony else split
            path = directory / fixture["filename"]
            if hashlib.sha256(path.read_bytes()).hexdigest() != fixture["sha256"]:
                raise RuntimeError(f"Audio checksum mismatch: {path.name}")
            audio = decode_audio(str(path), sampling_rate=16000)
            for profile, no_timestamps in [("existing", False), ("text_only", True)]:
                start = time.perf_counter()
                segments, _ = model.transcribe(audio, task="transcribe", language=language, beam_size=3,
                    temperature=0, vad_filter=True, condition_on_previous_text=False, initial_prompt=None,
                    without_timestamps=no_timestamps)
                text = " ".join(segment.text.strip() for segment in segments).strip()
                row = {"language":language, "split":actual_split, "file":path.name, "license":fixture["license"],
                    "source":fixture["source"], "sha256":fixture["sha256"], "reference":fixture["transcript"],
                    "profile":profile, "seconds":round(time.perf_counter()-start, 3), "text":text,
                    **errors(fixture["transcript"], text)}
                rows.append(row)
                out.write_text(json.dumps({"type":"PUBLIC_READ_SPEECH_DIAGNOSTIC", "limitations":"Dataset transcripts are not legal or microphone validation. No model training or expert review performed.", "rows":rows}, ensure_ascii=False, indent=2), encoding="utf-8")
                print(json.dumps({key:row[key] for key in ["language", "split", "file", "profile", "seconds", "cer", "wer"]}), flush=True)
    del model
    gc.collect()
