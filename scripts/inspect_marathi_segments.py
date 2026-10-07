"""Observe unchanged decoder decisions in an offline child, not production."""
import argparse
import concurrent.futures
import json
import logging
import math
import os
import subprocess
import sys
import time
from dataclasses import asdict
from pathlib import Path

from scripts import audit_marathi_vad as vad
from scripts import profile_marathi_baseline as baseline

ROOT = baseline.ROOT
OUTPUT = ROOT / "output/public-speech-validation/segment-diagnostic-20261004"
PLAN = ROOT / "Feature-marathi-segment-diagnostic-plan.md"


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def skip_decision(probability, avg_logprob, no_speech_threshold, log_prob_threshold):
    if not finite(probability) or not 0 <= probability <= 1 or not finite(avg_logprob):
        raise ValueError("Invalid generation metrics")
    for threshold in (no_speech_threshold, log_prob_threshold):
        if threshold is not None and not finite(threshold):
            raise ValueError("Invalid diagnostic threshold")
    high_no_speech = no_speech_threshold is not None and probability > no_speech_threshold
    logprob_override = log_prob_threshold is not None and avg_logprob > log_prob_threshold
    return {"highNoSpeech": high_no_speech, "logprobOverride": logprob_override,
            "expectedWindowSkip": high_no_speech and not logprob_override}


def observed_model_class(base_class):
    class ObservedModel(base_class):
        def __init__(self, *args, **kwargs):
            self.decisions = []
            super().__init__(*args, **kwargs)

        def generate_with_fallback(self, encoder_output, prompt, tokenizer, options):
            decoded = super().generate_with_fallback(encoder_output, prompt, tokenizer, options)
            result, logprob, temperature, compression = decoded
            if not finite(temperature) or not finite(compression):
                raise ValueError("Invalid generation metrics")
            self.decisions.append({"tokens": list(result.sequences_ids[0]),
                                   "decodedText": tokenizer.decode(result.sequences_ids[0]),
                                   "promptTokens": list(prompt), "languageToken": tokenizer.language,
                                   "taskToken": tokenizer.task, "languageCode": tokenizer.language_code,
                                   "avgLogprob": logprob, "noSpeechProbability": result.no_speech_prob,
                                   "temperature": temperature, "compressionRatio": compression,
                                   "noSpeechThreshold": options.no_speech_threshold,
                                   "logProbThreshold": options.log_prob_threshold,
                                   **skip_decision(result.no_speech_prob, logprob,
                                                   options.no_speech_threshold, options.log_prob_threshold)})
            return decoded
    return ObservedModel


class Capture(logging.Handler):
    def __init__(self):
        super().__init__()
        self.reset()

    def reset(self):
        self.records, self.truncated = [], False

    def emit(self, record):
        message = record.getMessage()
        if len(self.records) >= 128 or len(message) > 512:
            self.truncated = True
        if len(self.records) < 128:
            self.records.append({"level": record.levelname, "message": message[:512]})


def register():
    from faster_whisper import transcribe
    prior = vad.verified_registration()
    paths = [ROOT / name for name in prior["hashes"]]
    paths += [PLAN, ROOT / "scripts/inspect_marathi_segments.py", ROOT / "tests/test_marathi_segments.py",
              vad.OUTPUT / "registration.json", vad.OUTPUT / "observations.jsonl", vad.OUTPUT / "report.json",
              vad.OUTPUT / "power-evidence.json"]
    package = Path(transcribe.__file__).parent
    paths += [package / "tokenizer.py", package / "feature_extractor.py"]
    OUTPUT.mkdir()
    baseline.base.save_new(OUTPUT / "registration.json", {
        "type": "UNCHANGED_MARATHI_SEGMENT_DIAGNOSTIC", "createdAt": baseline.utc(),
        "fixtures": prior["fixtures"], "options": baseline.base.decode_options(3),
        "packageVersions": vad.versions(),
        "hashes": {str(path.relative_to(ROOT)): baseline.base.digest(path) for path in paths}})
    print(json.dumps({"registered": True, "clips": 8, "candidate": False}))


def verified_registration():
    registered = json.loads((OUTPUT / "registration.json").read_text(encoding="utf-8"))
    if registered["packageVersions"] != vad.versions() or registered["options"] != baseline.base.decode_options(3):
        raise ValueError("Registered runtime/options changed")
    if any(baseline.base.digest(ROOT / name) != expected for name, expected in registered["hashes"].items()):
        raise ValueError("Registered input changed")
    if len(registered["fixtures"]) != 8:
        raise ValueError("Expected eight development clips")
    return registered


def worker():
    from faster_whisper import WhisperModel
    from faster_whisper.audio import decode_audio
    registered = verified_registration()
    model = observed_model_class(WhisperModel)(str(baseline.base.MODEL), device="cpu", compute_type="int8",
                                              cpu_threads=4, local_files_only=True)
    capture = Capture()
    model.logger.handlers = [capture]
    model.logger.propagate = False
    model.logger.setLevel(logging.DEBUG)
    print(json.dumps({"ready": True}), flush=True)
    for index, line in enumerate(sys.stdin):
        began, clock = baseline.utc(), time.perf_counter()
        try:
            fixture = registered["fixtures"][index]
            if json.loads(line) != {"filename": fixture["filename"]}:
                raise ValueError("Only registered development order allowed")
            path = baseline.MANIFEST.parent / fixture["filename"]
            if path.resolve().parent != baseline.MANIFEST.parent or baseline.base.digest(path) != fixture["sha256"]:
                raise ValueError("Unexpected audio identity")
            audio = decode_audio(str(path), sampling_rate=16000)
            if not 0 < audio.size <= 90 * 16000:
                raise ValueError("Invalid audio")
            model.decisions.clear()
            capture.reset()
            segments, info = model.transcribe(audio, **registered["options"])
            emitted = [asdict(segment) for segment in segments]
            actual_skips = sum(item["message"].startswith("No speech threshold is met") for item in capture.records)
            result = {"text": " ".join(segment["text"].strip() for segment in emitted).strip(),
                      "segments": emitted, "generationWindows": model.decisions,
                      "logs": capture.records, "logsTruncated": capture.truncated,
                      "actualSkipLogCount": actual_skips,
                      "expectedSkipCount": sum(item["expectedWindowSkip"] for item in model.decisions),
                      "duration": info.duration, "durationAfterVad": info.duration_after_vad,
                      "language": info.language, "languageForcedNotDetected": True,
                      "transcriptionOptions": asdict(info.transcription_options),
                      "workerStartUtc": began, "workerEndUtc": baseline.utc(),
                      "workerRequestMs": (time.perf_counter() - clock) * 1000}
        except Exception as error:
            result = {"error": type(error).__name__, "workerStartUtc": began, "workerEndUtc": baseline.utc()}
        print(json.dumps(result, ensure_ascii=True, allow_nan=False), flush=True)


def run():
    registered = verified_registration()
    http = json.loads(baseline.HTTP_REPORT.read_text(encoding="utf-8"))
    retention = json.loads((vad.OUTPUT / "report.json").read_text(encoding="utf-8"))
    rows, failure = [], None
    started = baseline.utc()
    environment = dict(os.environ, HF_HUB_OFFLINE="1", HF_HUB_DISABLE_TELEMETRY="1", PYTHONUTF8="1")
    with (OUTPUT / "observations.jsonl").open("x", encoding="utf-8") as log:
        child = subprocess.Popen([sys.executable, "-m", "scripts.inspect_marathi_segments", "worker"], cwd=ROOT,
                                 stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                 text=True, encoding="utf-8", env=environment,
                                 creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
        executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        try:
            if baseline.base.bounded_reply(executor, child.stdout) != {"ready": True}:
                raise ValueError("Worker not ready")
            for fixture in registered["fixtures"]:
                began, clock = baseline.utc(), time.perf_counter()
                child.stdin.write(json.dumps({"filename": fixture["filename"]}) + "\n")
                child.stdin.flush()
                result = baseline.base.bounded_reply(executor, child.stdout)
                row = {"filename": fixture["filename"], "parentStartUtc": began,
                       "parentEndUtc": baseline.utc(), "parentRequestMs": (time.perf_counter() - clock) * 1000, **result}
                if not row.get("error"):
                    row["baselineTextParity"] = row["text"] == next(item["speech"]["text"] for item in http["rows"] if item["filename"] == fixture["filename"])
                    row["vadDurationParity"] = abs(row["durationAfterVad"] - next(item["retainedSeconds"] for item in retention["rows"] if item["filename"] == fixture["filename"])) <= 1 / 16000
                    row["utcElapsedDriftMs"] = abs((baseline.timestamp(row["workerEndUtc"]) - baseline.timestamp(row["workerStartUtc"])) * 1000 - row["workerRequestMs"])
                rows.append(row)
                log.write(json.dumps(row, ensure_ascii=False, allow_nan=False) + "\n")
                log.flush()
                print(json.dumps({key: row.get(key) for key in ("filename", "baselineTextParity", "expectedSkipCount", "actualSkipLogCount", "parentRequestMs", "error")}), flush=True)
                if row.get("error") or not row["text"] or not row["baselineTextParity"] or not row["vadDurationParity"]:
                    raise ValueError("Diagnostic error or baseline mismatch")
                if row["logsTruncated"] or row["actualSkipLogCount"] != row["expectedSkipCount"] or not row["generationWindows"]:
                    raise ValueError("Incomplete or inconsistent observation")
                if max(row["parentRequestMs"], row["workerRequestMs"]) > 120000 or row["utcElapsedDriftMs"] > 1000:
                    raise ValueError("Interrupted or over-budget observation")
        except Exception as error:
            failure = {"type": type(error).__name__, "message": str(error)}
        finally:
            if child.poll() is None:
                child.kill()
            child.wait(timeout=10)
            executor.shutdown(wait=True, cancel_futures=True)
    ended = baseline.utc()
    power = baseline.read_power_window(baseline.timestamp(started), baseline.timestamp(ended))
    unchanged = all(baseline.base.digest(ROOT / name) == expected for name, expected in registered["hashes"].items())
    report = {"type": "UNCHANGED_MARATHI_SEGMENT_DIAGNOSTIC", "startUtc": started, "endUtc": ended,
              "diagnosticUsable": len(rows) == 8 and failure is None and unchanged and power["available"] and not power["events"],
              "failure": failure, "powerEvidence": power, "registeredInputsUnchanged": unchanged,
              "rows": rows, "skipCount": sum(row.get("actualSkipLogCount", 0) for row in rows),
              "registrationSHA256": baseline.base.digest(OUTPUT / "registration.json"),
              "rawSHA256": baseline.base.digest(OUTPUT / "observations.jsonl"),
              "productionChanged": False, "candidateAssessed": False, "reservedHoldoutSubmitted": False,
              "limitations": "Inspected public telephone audio only. Diagnostic probabilities are not accuracy/confidence. No calibrated meaning, legal/microphone accuracy, causal model/checkpoint diagnosis or speed improvement."}
    baseline.base.save_new(OUTPUT / "report.json", report)
    print(json.dumps({key: report[key] for key in ("diagnosticUsable", "skipCount", "failure")}))
    if not report["diagnosticUsable"]:
        raise SystemExit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["register", "run", "worker"])
    {"register": register, "run": run, "worker": worker}[parser.parse_args().mode]()
