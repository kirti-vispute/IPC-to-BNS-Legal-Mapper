"""Offline worker: one-shot raw audio or line-framed selected-language audio, no saved files."""
import argparse
import base64
import io
import json
import os
import sys
from pathlib import Path

try:
    from backend.speech.review import SpeechReviewObserver, review_model_class, supported_runtime
except ModuleNotFoundError as error:
    if error.name not in ("backend", "backend.speech", "backend.speech.review"):
        raise
    from review import SpeechReviewObserver, review_model_class, supported_runtime


SELECTED_LANGUAGES = ("en", "hi", "mr", "ur", "gu")
INDIC_LANGUAGES = ("hi", "mr", "ur", "gu")


def fail(code):
    print(json.dumps({"error": code}))
    sys.exit(1)


def recognize(data, model, selected_language, decode_audio, decoded_audio=None):
    observed = isinstance(model, SpeechReviewObserver)
    if observed:
        model.reset_speech_review()
    try:
        result = _recognize(data, model, selected_language, decode_audio, decoded_audio)
        if observed and selected_language == "mr" and result.get("text"):
            result["speechReview"] = model.speech_review()
        return result
    finally:
        if observed:
            model.reset_speech_review()


def _recognize(data, model, selected_language, decode_audio, decoded_audio=None):
    try:
        audio = decoded_audio if decoded_audio is not None else decode_audio(io.BytesIO(data), sampling_rate=16000)
        if not audio.size:
            return {"error": "INVALID_AUDIO"}
        if audio.size > 90 * 16000:
            return {"error": "AUDIO_TOO_LONG"}
    except Exception:
        return {"error": "INVALID_AUDIO"}
    try:
        if selected_language:
            detected_language, probability = None, None
        else:
            detected_language, probability, _ = model.detect_language(audio=audio, vad_filter=True)
        segments, _ = model.transcribe(
            audio, task="transcribe", language=selected_language or detected_language,
            beam_size=3, temperature=0, vad_filter=True, condition_on_previous_text=False,
            initial_prompt=None if selected_language in INDIC_LANGUAGES else "IPC, BNS, section, theft, cheating, movable property, without consent, dishonest intention",
        )
        text = " ".join(segment.text.strip() for segment in segments).strip()
        return {"text": text, "originalLanguage": detected_language, "languageProbability": probability}
    except Exception:
        return {"error": "SPEECH_PROCESS_ERROR"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--mode", choices=["transcribe"], required=True)
    parser.add_argument("--language", choices=SELECTED_LANGUAGES)
    parser.add_argument("--stream", action="store_true")
    args = parser.parse_args()
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
    try:
        from faster_whisper import WhisperModel
        from faster_whisper.audio import decode_audio
    except (ImportError, OSError):
        fail("RECOGNIZER_UNAVAILABLE")
    model_path = Path(args.model)
    if not all((model_path / name).is_file() for name in ["model.bin", "config.json", "tokenizer.json"]) or not any(
        (model_path / name).is_file() for name in ["vocabulary.txt", "vocabulary.json"]
    ):
        fail("MODEL_MISSING")
    if not args.stream:
        data = sys.stdin.buffer.read(10 * 1024 * 1024 + 1)
        try:
            audio = decode_audio(io.BytesIO(data), sampling_rate=16000)
            if not audio.size:
                fail("INVALID_AUDIO")
            if audio.size > 90 * 16000:
                fail("AUDIO_TOO_LONG")
        except Exception:
            fail("INVALID_AUDIO")
    try:
        model_class = review_model_class(WhisperModel, supported_runtime()) if args.language == "mr" else WhisperModel
        model = model_class(str(model_path), device="cpu", compute_type="int8", cpu_threads=4, local_files_only=True)
    except Exception:
        fail("MODEL_LOAD_FAILED")
    if args.stream:
        if args.language not in SELECTED_LANGUAGES:
            fail("UNSUPPORTED_SPEECH_LANGUAGE")
        for raw in iter(lambda: sys.stdin.buffer.readline(14 * 1024 * 1024 + 1), b""):
            try:
                payload = json.loads(raw)
                data = base64.b64decode(payload["audio"], validate=True)
                result = recognize(data, model, args.language, decode_audio)
            except Exception:
                result = {"error": "INVALID_AUDIO"}
            print(json.dumps(result, ensure_ascii=True), flush=True)
    else:
        result = recognize(data, model, args.language, decode_audio, decoded_audio=audio)
        if result.get("error"):
            fail(result["error"])
        print(json.dumps(result, ensure_ascii=True))


if __name__ == "__main__":
    main()
