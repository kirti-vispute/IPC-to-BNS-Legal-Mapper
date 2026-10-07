"""Compare local selected-language decoding settings on licensed, ignored audio fixtures."""
import argparse
import io
import json
import re
import time
import unicodedata
from pathlib import Path

from faster_whisper import WhisperModel
from faster_whisper.audio import decode_audio


def normalize(text):
    text = unicodedata.normalize("NFKC", text).casefold()
    text = "".join(" " if unicodedata.category(char)[0] in "PS" else char for char in text)
    return re.sub(r"\s+", " ", text).strip()


def distance(left, right):
    previous = list(range(len(right) + 1))
    for index, item in enumerate(left, 1):
        current = [index]
        for column, other in enumerate(right, 1):
            current.append(min(previous[column] + 1, current[-1] + 1,
                               previous[column - 1] + (item != other)))
        previous = current
    return previous[-1]


def score(reference, hypothesis):
    reference, hypothesis = normalize(reference), normalize(hypothesis)
    return {
        "cer": round(distance(reference, hypothesis) / max(1, len(reference)), 4),
        "wer": round(distance(reference.split(), hypothesis.split()) / max(1, len(reference.split())), 4),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixtures", default="output/voice-verification/real-speech/fixtures.json")
    parser.add_argument("--model", default="models/speech/whisper-small")
    parser.add_argument("--output", default="output/voice-verification/decode-benchmark.json")
    parser.add_argument("--profiles", default="current,beam5,beam5_no_vad")
    parser.add_argument("--language", choices=["hi", "mr"])
    args = parser.parse_args()
    fixture_path = Path(args.fixtures)
    fixtures = json.loads(fixture_path.read_text(encoding="utf-8"))["fixtures"]
    if args.language:
        fixtures = [fixture for fixture in fixtures if fixture["language"] == args.language]
    model = WhisperModel(args.model, device="cpu", compute_type="int8", cpu_threads=4, local_files_only=True)
    available = {"current": (3, True, None), "beam5": (5, True, None),
                 "beam5_no_vad": (5, False, None),
                 "marathi_cue": (3, True, "ही मराठी भाषेतील ध्वनिमुद्रिका आहे.")}
    profiles = [(name, *available[name]) for name in args.profiles.split(",")]
    rows = []
    for fixture in fixtures:
        audio = decode_audio(io.BytesIO((fixture_path.parent / fixture["filename"]).read_bytes()), sampling_rate=16000)
        for name, beam, vad, prompt in profiles:
            start = time.monotonic()
            segments, _ = model.transcribe(
                audio, task="transcribe", language=fixture["language"], beam_size=beam,
                temperature=0, vad_filter=vad, condition_on_previous_text=False, initial_prompt=prompt,
            )
            text = " ".join(segment.text.strip() for segment in segments).strip()
            row = {"file": fixture["filename"], "language": fixture["language"], "profile": name,
                   "seconds": round(time.monotonic() - start, 2), "text": text,
                   **score(fixture["transcript"], text)}
            rows.append(row)
            print(json.dumps(row, ensure_ascii=True), flush=True)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({"note": "Read-speech diagnostics only; not legal or general ASR accuracy.",
                                  "rows": rows}, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
