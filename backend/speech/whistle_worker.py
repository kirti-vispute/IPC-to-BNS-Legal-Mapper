"""Offline Cactus Whistle worker (English): one-shot raw audio or line-framed audio, no saved files."""
import argparse
import base64
import io
import json
import os
import sys
from pathlib import Path

SAMPLE_RATE = 16000
MAX_AUDIO_SECONDS = 90
# Whistle decodes at most 30 s per pass; stay under it and cut at the quietest nearby frame.
WINDOW_SECONDS = 29.5
SEARCH_SECONDS = 4
MIN_TAIL_SECONDS = 1
FRAME = 1600  # 100 ms energy frames
MAX_KEYWORDS = 200
KEYWORDS_FILE = Path(__file__).with_name("legal_keywords.txt")


def fail(code):
    print(json.dumps({"error": code}))
    sys.exit(1)


def load_keywords(path=KEYWORDS_FILE):
    """Legal vocabulary Whistle should favour; one phrase per line, '#' starts a comment."""
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return []
    words = [line.strip() for line in lines if line.strip() and not line.lstrip().startswith("#")]
    return words[:MAX_KEYWORDS]


def split_windows(audio, window=int(WINDOW_SECONDS * SAMPLE_RATE), search=SEARCH_SECONDS * SAMPLE_RATE,
                  min_tail=MIN_TAIL_SECONDS * SAMPLE_RATE):
    """Split long audio into windows no longer than `window`, cutting at the lowest-energy frame.

    Each cut is searched only in the last `search` samples of a window and leaves at least `min_tail`
    samples after it, so no window is empty and cuts land in pauses rather than inside words when possible.
    """
    windows, start = [], 0
    while audio.size - start > window:
        high = min(start + window, audio.size - min_tail)
        low = max(start + 1, high - search)
        frames = (high - low) // FRAME
        if frames < 1:
            cut = high
        else:
            region = audio[low:low + frames * FRAME].reshape(frames, FRAME)
            cut = low + int((region.astype("float64") ** 2).mean(axis=1).argmin()) * FRAME + FRAME // 2
        windows.append(audio[start:cut])
        start = cut
    windows.append(audio[start:])
    return windows


def recognize(data, whistle, decode_audio, keywords, decoded_audio=None):
    try:
        audio = decoded_audio if decoded_audio is not None else decode_audio(io.BytesIO(data), sampling_rate=SAMPLE_RATE)
        if not audio.size:
            return {"error": "INVALID_AUDIO"}
        if audio.size > MAX_AUDIO_SECONDS * SAMPLE_RATE:
            return {"error": "AUDIO_TOO_LONG"}
    except Exception:
        return {"error": "INVALID_AUDIO"}
    try:
        parts = []
        for window in split_windows(audio):
            result = whistle.transcribe(window, language="en", keywords=keywords or None)
            text = str(result.get("text", "")).strip()
            if text:
                parts.append(text)
        return {"text": " ".join(parts), "originalLanguage": "en", "languageProbability": None}
    except Exception:
        return {"error": "SPEECH_PROCESS_ERROR"}


def locate_engine(model_path):
    for pattern in ("libneedle.dll", "libneedle.so", "libneedle.dylib", "libneedle*"):
        found = sorted(model_path.glob(pattern))
        if found:
            return found[0]
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, help="folder holding whistle.cact and the engine library")
    parser.add_argument("--mode", choices=["transcribe"], required=True)
    parser.add_argument("--language", choices=["en"], default="en")
    parser.add_argument("--stream", action="store_true")
    args = parser.parse_args()
    model_path = Path(args.model)
    weights, engine = model_path / "whistle.cact", locate_engine(model_path)
    if not weights.is_file() or engine is None:
        fail("MODEL_MISSING")
    # Pin the engine/weights to the project folder and keep inference offline and telemetry-free.
    os.environ.update({"HF_HUB_OFFLINE": "1", "HF_HUB_DISABLE_TELEMETRY": "1", "NEEDLE_TELEMETRY": "0",
                       "DO_NOT_TRACK": "1", "NEEDLE3_LIB_PATH": str(engine), "NEEDLE_WHISTLE_WEIGHTS": str(weights)})
    try:
        from faster_whisper.audio import decode_audio
        from needle.agent.whistle import Whistle
    except (ImportError, OSError):
        fail("RECOGNIZER_UNAVAILABLE")
    audio = None
    if not args.stream:
        data = sys.stdin.buffer.read(10 * 1024 * 1024 + 1)
        try:
            audio = decode_audio(io.BytesIO(data), sampling_rate=SAMPLE_RATE)
            if not audio.size:
                fail("INVALID_AUDIO")
            if audio.size > MAX_AUDIO_SECONDS * SAMPLE_RATE:
                fail("AUDIO_TOO_LONG")
        except Exception:
            fail("INVALID_AUDIO")
    try:
        whistle = Whistle(weights=str(weights))
    except Exception:
        fail("MODEL_LOAD_FAILED")
    keywords = load_keywords()
    if args.stream:
        for raw in iter(lambda: sys.stdin.buffer.readline(14 * 1024 * 1024 + 1), b""):
            try:
                payload = json.loads(raw)
                data = base64.b64decode(payload["audio"], validate=True)
                result = recognize(data, whistle, decode_audio, keywords)
            except Exception:
                result = {"error": "INVALID_AUDIO"}
            print(json.dumps(result, ensure_ascii=True), flush=True)
    else:
        result = recognize(data, whistle, decode_audio, keywords, decoded_audio=audio)
        if result.get("error"):
            fail(result["error"])
        print(json.dumps(result, ensure_ascii=True))


if __name__ == "__main__":
    main()
