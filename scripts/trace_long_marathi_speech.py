"""Trace one reconstructed public stress recording; never imported by production."""
import argparse
import concurrent.futures
import hashlib
import io
import json
import logging
import math
import os
import subprocess
import sys
import time
import wave
from dataclasses import asdict
from pathlib import Path
from unittest.mock import patch

from scripts import audit_speech_continuation as audit
from scripts import profile_marathi_baseline as baseline
from scripts.audit_marathi_vad import interval_summary, options as vad_options, versions
from scripts.inspect_marathi_segments import Capture, observed_model_class

ROOT, base = audit.ROOT, baseline.base
OUT = ROOT / "output/public-speech-validation/long-trace-20261005"
MANIFEST = ROOT / "output/voice-verification/holdout-speech/fixtures.json"
HISTORICAL = ROOT / "output/project-completion/long-public-speech.json"


def assemble(clips, texts, target=960000):
    import numpy as np
    if not clips or len(clips) != len(texts) or type(target) is not int or target <= 0:
        raise ValueError("Valid clips, texts and positive sample target required")
    if any(clip.ndim != 1 or clip.size == 0 or not np.isfinite(clip).all() for clip in clips):
        raise ValueError("Invalid decoded audio")
    parts, reference, spans, total = [], [], [], 0
    while total < target:
        for index, (clip, text) in enumerate(zip(clips, texts)):
            parts.append(clip)
            reference.append(text)
            spans.append({"clipIndex": index, "startSample": total, "endSample": total + int(clip.size)})
            total += int(clip.size)
            if total >= target:
                break
    audio = np.concatenate(parts)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as stream:
        stream.setnchannels(1)
        stream.setsampwidth(2)
        stream.setframerate(16000)
        stream.writeframes((np.clip(audio, -1, 1) * 32767).astype("<i2").tobytes())
    body = buffer.getvalue()
    return body, {"bodySHA256": hashlib.sha256(body).hexdigest(), "samples": total,
                  "durationSeconds": total / 16000, "reference": " ".join(reference), "repetitions": spans}


def audio_input():
    from faster_whisper.audio import decode_audio
    fixtures = [item for item in audit.read(MANIFEST)["fixtures"] if item["language"] == "mr"]
    old = audit.read(HISTORICAL)
    if [item["filename"] for item in fixtures] != [item["filename"] for item in old["sources"]]:
        raise ValueError("Historical clip order differs")
    clips = []
    for item, source in zip(fixtures, old["sources"]):
        path = MANIFEST.parent / item["filename"]
        if path.resolve().parent != MANIFEST.parent or base.digest(path) != item["sha256"]:
            raise ValueError("Unexpected audio identity")
        if any(item[key] != source[key] for key in ("sha256", "source", "license")):
            raise ValueError("Historical provenance differs")
        clips.append(decode_audio(str(path), sampling_rate=16000))
    body, info = assemble(clips, [item["transcript"] for item in fixtures])
    if info["durationSeconds"] != old["durationSeconds"] or info["reference"] != old["reference"]:
        raise ValueError("Reconstructed recipe differs from historical report")
    return body, info, fixtures


def tracing_model(base_class, emit):
    class Observed(observed_model_class(base_class)):
        def generate_segments(self, features, *args, **kwargs):
            self.trace_seek = 0
            self.trace_frames = features.shape[-1] - 1
            self.trace_windows = []
            emit("features", {"contentFrames": self.trace_frames,
                              "framesPerSecond": self.frames_per_second})
            yield from super().generate_segments(features, *args, **kwargs)

        def generate_with_fallback(self, encoder_output, prompt, tokenizer, options):
            clock = time.perf_counter()
            decoded = super().generate_with_fallback(encoder_output, prompt, tokenizer, options)
            size = min(self.feature_extractor.nb_max_frames, self.trace_frames - self.trace_seek)
            window = {**self.decisions[-1], "window": len(self.trace_windows),
                      "seekBeforeFrame": self.trace_seek, "segmentFrames": size,
                      "inputEndFrame": self.trace_seek + size,
                      "tokenCount": len(decoded[0].sequences_ids[0]),
                      "generationMs": (time.perf_counter() - clock) * 1000,
                      "sourceDerivedStepBound": min(self.max_length // 2, self.max_length - len(prompt) + 1),
                      "decoderStopReason": "not exposed by installed result"}
            window["atStepBound"] = window["tokenCount"] >= window["sourceDerivedStepBound"]
            if window["expectedWindowSkip"]:
                self.trace_seek += size
                window["seekAfterFrame"] = self.trace_seek
            self.trace_windows.append(window)
            emit("generation", window)
            return decoded

        def _split_segments_by_timestamps(self, *args, **kwargs):
            result = super()._split_segments_by_timestamps(*args, **kwargs)
            window = self.trace_windows[-1]
            if kwargs["seek"] != window["seekBeforeFrame"] or kwargs["segment_size"] != window["segmentFrames"]:
                raise ValueError("Observer seek reconstruction differs from original helper")
            segments, seek, ending = result
            window["seekAfterFrame"] = seek
            self.trace_seek = seek
            emit("split", {"window": window["window"], "seekBeforeFrame": kwargs["seek"],
                           "seekAfterFrame": seek, "singleTimestampEnding": ending,
                           "segments": [{key: segment[key] for key in ("start", "end", "tokens")} for segment in segments]})
            return result

        def transcribe(self, *args, **kwargs):
            segments, self.trace_info = super().transcribe(*args, **kwargs)
            self.trace_emitted = []
            def observe():
                for segment in segments:
                    self.trace_emitted.append(asdict(segment))
                    emit("emitted", asdict(segment))
                    yield segment
            return observe(), self.trace_info
    return Observed


def verified():
    registered = audit.read(OUT / "registration.json")
    audit.verify(registered["hashes"])
    if registered["versions"] != versions() or registered["settings"] != audit.settings():
        raise ValueError("Registered runtime changed")
    return registered


def register():
    from faster_whisper import transcribe
    from faster_whisper.utils import get_assets_path
    audit.verify(audit.read(audit.PROTECTED))
    audit.verify(audit.read(audit.OUT / "registration.json")["hashes"])
    _, assembly, fixtures = audio_input()
    package = Path(transcribe.__file__).parent
    paths = [Path(__file__), ROOT / "tests/test_long_speech_trace.py", ROOT / "Feature-long-speech-trace-plan.md",
             ROOT / "scripts/verify_public_long_speech.py", MANIFEST, HISTORICAL, audit.PROTECTED,
             ROOT / "scripts/audit_speech_continuation.py", ROOT / "scripts/audit_marathi_vad.py",
             ROOT / "scripts/inspect_marathi_segments.py", ROOT / "scripts/profile_marathi_baseline.py",
             ROOT / "scripts/assess_marathi_decoder.py", ROOT / "scripts/audit_speech_deadlines.py",
             ROOT / "backend/speech/transcribe.py", ROOT / "backend/core/transcriber.js",
             audit.OUT / "registration.json", audit.OUT / "report.json", audit.OUT / "integrity.json"]
    paths += [base.MODEL / name for name in base.MODEL_FILES]
    paths += [MANIFEST.parent / item["filename"] for item in fixtures]
    paths += [package / name for name in ("transcribe.py", "tokenizer.py", "feature_extractor.py", "audio.py", "vad.py")]
    paths += [Path(get_assets_path()) / "silero_vad_v6.onnx",
              package.parent / "ctranslate2/ctranslate2.dll", package.parent / "ctranslate2/_ext.cp312-win_amd64.pyd"]
    OUT.mkdir(exist_ok=False)
    base.save_new(OUT / "registration.json", {"type": "UNCHANGED_LONG_MARATHI_WINDOW_TRACE",
                  "createdAt": baseline.utc(), "hashes": {str(path.relative_to(ROOT)): base.digest(path) for path in paths},
                  "versions": versions(), "settings": audit.settings(), "assembly": assembly,
                  "fixtures": [{key: item[key] for key in ("filename", "sha256", "source", "license")} for item in fixtures]})
    print(json.dumps({"registeredInputs": len(paths), "duration": assembly["durationSeconds"]}))


def worker():
    from faster_whisper import WhisperModel, transcribe
    from faster_whisper.audio import decode_audio
    from backend.speech.transcribe import recognize
    registered = verified()
    body, assembly, _ = audio_input()
    if assembly != registered["assembly"]:
        raise ValueError("Reconstructed body changed")
    with (OUT / "events.jsonl").open("x", encoding="utf-8") as log:
        request_clock = None
        def emit(kind, value):
            elapsed = None if request_clock is None else (time.perf_counter() - request_clock) * 1000
            log.write(json.dumps({"kind": kind, "utc": baseline.utc(), "requestElapsedMs": elapsed, **value},
                                 ensure_ascii=False, allow_nan=False) + "\n")
            log.flush()
        model = tracing_model(WhisperModel, emit)(str(base.MODEL), device="cpu", compute_type="int8",
                                                  cpu_threads=4, local_files_only=True)
        capture = Capture()
        model.logger.handlers, model.logger.propagate = [capture], False
        model.logger.setLevel(logging.DEBUG)
        print(json.dumps({"ready": True}), flush=True)
        if json.loads(sys.stdin.readline()) != {"recording": "registered-long-stress"}:
            raise ValueError("Unexpected recording request")
        start, clock = baseline.utc(), time.perf_counter()
        request_clock = clock
        retained = []
        original_vad = transcribe.get_speech_timestamps
        def observe_vad(audio, options, *args, **kwargs):
            spans = original_vad(audio, options, *args, **kwargs)
            summary = interval_summary(int(audio.size), spans)
            retained.append(summary)
            emit("vad", summary)
            return spans
        with patch.object(transcribe, "get_speech_timestamps", observe_vad):
            response = recognize(body, model, "mr", decode_audio)
        result = {"workerStartUtc": start, "workerEndUtc": baseline.utc(),
                  "workerRequestMs": (time.perf_counter() - clock) * 1000, "response": response,
                  "windows": getattr(model, "trace_windows", []), "vad": retained,
                  "contentFrames": getattr(model, "trace_frames", None),
                  "segments": getattr(model, "trace_emitted", []), "logs": capture.records,
                  "logsTruncated": capture.truncated}
        if not response.get("error"):
            result["durationAfterVad"] = model.trace_info.duration_after_vad
            result["transcriptionOptions"] = asdict(model.trace_info.transcription_options)
            result["vadOptions"] = vad_options()
        print(json.dumps(result, ensure_ascii=True, allow_nan=False), flush=True)


def assess(result, power, unchanged):
    timings = [result.get("parentRequestMs"), result.get("workerRequestMs")]
    valid = all(type(value) in (int, float) and math.isfinite(value) and 0 < value <= 120000 for value in timings)
    windows = result.get("windows", [])
    full = bool(windows) and all("seekAfterFrame" in window for window in windows)
    if full:
        full = windows[0]["seekBeforeFrame"] == 0 and windows[-1]["seekAfterFrame"] == result.get("contentFrames")
        full = full and all(0 < window["segmentFrames"] <= 3000
                            and window["seekBeforeFrame"] < window["seekAfterFrame"] <= window["inputEndFrame"]
                            for window in windows)
        full = full and all(left["seekAfterFrame"] == right["seekBeforeFrame"]
                            for left, right in zip(windows, windows[1:]))
    response = result.get("response", {})
    if result.get("workerStartUtc") and result.get("workerEndUtc") and valid:
        drift = abs((baseline.timestamp(result["workerEndUtc"]) - baseline.timestamp(result["workerStartUtc"])) * 1000 - timings[1])
        valid = valid and drift <= 1000
    else:
        drift = None
        valid = False
    return {"traceUsable": bool(valid and full and unchanged and power["available"] and not power["events"]
                                and not result.get("error") and not response.get("error") and response.get("text")
                                and len(result.get("vad", [])) == 1 and not result.get("logsTruncated", True)),
            "utcElapsedDriftMs": drift, "boundLengthWindows": sum(window.get("atStepBound", False) for window in windows),
            "generalSpeechAccuracyClaim": False}


def run():
    registered = verified()
    started, result, failure = baseline.utc(), {}, None
    child = subprocess.Popen([sys.executable, "-m", "scripts.trace_long_marathi_speech", "worker"], cwd=ROOT,
                             stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                             text=True, encoding="utf-8", env=dict(os.environ, HF_HUB_OFFLINE="1", PYTHONUTF8="1",
                                                                  HF_HUB_DISABLE_TELEMETRY="1"),
                             creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    try:
        if base.bounded_reply(executor, child.stdout) != {"ready": True}:
            raise ValueError("Worker not ready")
        began, clock = baseline.utc(), time.perf_counter()
        child.stdin.write(json.dumps({"recording": "registered-long-stress"}) + "\n")
        child.stdin.flush()
        result = base.bounded_reply(executor, child.stdout)
        result.update(parentStartUtc=began, parentEndUtc=baseline.utc(), parentRequestMs=(time.perf_counter() - clock) * 1000)
    except Exception as error:
        failure = {"type": type(error).__name__, "message": str(error)}
        result["error"] = failure
    finally:
        if child.poll() is None:
            child.kill()
        child.wait(timeout=10)
        executor.shutdown(wait=True, cancel_futures=True)
    ended = baseline.utc()
    base.save_new(OUT / "observation.json", result)
    power = baseline.read_power_window(baseline.timestamp(started), baseline.timestamp(ended))
    unchanged = all(base.digest(ROOT / name) == expected for name, expected in registered["hashes"].items())
    report = {"type": "UNCHANGED_LONG_MARATHI_WINDOW_TRACE", "startUtc": started, "endUtc": ended,
              "failure": failure, "powerEvidence": power, "inputsUnchanged": unchanged,
              **assess(result, power, unchanged), "historicalTextParity": result.get("response", {}).get("text") == audit.read(HISTORICAL)["response"]["text"],
              "registrationSHA256": base.digest(OUT / "registration.json"),
              "observationSHA256": base.digest(OUT / "observation.json"),
              "eventsSHA256": base.digest(OUT / "events.jsonl") if (OUT / "events.jsonl").exists() else None,
              "productionChanged": False, "reservedHoldoutSubmitted": False,
              "limitations": "Reconstructed artificial repeated read speech, not natural legal speech or microphone validation. CT2 stop reason unavailable. Power check covers506/507 only; no speed improvement claim."}
    base.save_new(OUT / "report.json", report)
    print(json.dumps({key: report[key] for key in ("traceUsable", "boundLengthWindows", "historicalTextParity", "failure")}))
    if not report["traceUsable"]:
        raise SystemExit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["register", "worker", "run"])
    {"register": register, "worker": worker, "run": run}[parser.parse_args().mode]()
