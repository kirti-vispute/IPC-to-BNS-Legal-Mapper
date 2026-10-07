"""Inspect default VAD sample retention only; never imported by production."""
import argparse
import hashlib
import importlib.metadata
import json
import math
import os
import time
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

from scripts import profile_marathi_baseline as baseline

ROOT = baseline.ROOT
OUTPUT = ROOT / "output/public-speech-validation/vad-retention-20261004"
PLAN = ROOT / "Feature-marathi-vad-retention-plan.md"
PACKAGES = ("faster-whisper", "onnxruntime", "numpy", "av", "ctranslate2")


def utc():
    return datetime.now(timezone.utc).isoformat()


def interval_summary(total_samples, intervals):
    if type(total_samples) is not int or total_samples <= 0 or not isinstance(intervals, list):
        raise ValueError("Positive integer sample count and interval list required")
    cursor, kept, discarded = 0, 0, []
    for interval in intervals:
        start, end = interval["start"], interval["end"]
        if type(start) is not int or type(end) is not int or not cursor <= start < end <= total_samples:
            raise ValueError("Invalid, unordered or overlapping sample interval")
        if start > cursor:
            discarded.append({"start": cursor, "end": start})
        kept += end - start
        cursor = end
    if cursor < total_samples:
        discarded.append({"start": cursor, "end": total_samples})
    return {"originalSamples": total_samples, "retainedSamples": kept,
            "discardedSamples": total_samples - kept, "retainedFraction": kept / total_samples,
            "retainedIntervals": intervals, "discardedIntervals": discarded}


def options():
    from faster_whisper.vad import VadOptions
    result = asdict(VadOptions())
    result["max_speech_duration_s"] = "unbounded" if math.isinf(result["max_speech_duration_s"]) else result["max_speech_duration_s"]
    return result


def versions():
    return {name: importlib.metadata.version(name) for name in PACKAGES}


def register():
    from faster_whisper import vad
    from faster_whisper.utils import get_assets_path
    prior = baseline.verified_registration()
    paths = [ROOT / name for name in prior["hashes"]]
    package = Path(vad.__file__).parent
    paths += [PLAN, ROOT / "scripts/audit_marathi_vad.py", ROOT / "tests/test_marathi_vad.py",
              ROOT / "backend/speech/transcribe.py", baseline.OUTPUT / "registration.json",
              baseline.OUTPUT / "observations.jsonl", baseline.OUTPUT / "report.json"]
    paths += [package / name for name in ("vad.py", "audio.py", "transcribe.py", "utils.py")]
    paths += [Path(get_assets_path()) / "silero_vad_v6.onnx"]
    OUTPUT.mkdir()
    baseline.base.save_new(OUTPUT / "registration.json", {
        "type": "DEFAULT_VAD_RETENTION_ONLY", "createdAt": utc(), "fixtures": prior["fixtures"],
        "vadOptions": options(), "packageVersions": versions(),
        "hashes": {str(path.relative_to(ROOT)): baseline.base.digest(path) for path in paths},
        "recognizerInference": False, "reservedHoldoutSubmitted": False})
    print(json.dumps({"registered": True, "clips": 8, "recognizerInference": False}))


def verified_registration():
    registered = json.loads((OUTPUT / "registration.json").read_text(encoding="utf-8"))
    if registered["vadOptions"] != options() or registered["packageVersions"] != versions():
        raise ValueError("Registered default VAD/runtime changed")
    if any(baseline.base.digest(ROOT / name) != value for name, value in registered["hashes"].items()):
        raise ValueError("Registered input changed")
    if len(registered["fixtures"]) != 8:
        raise ValueError("Expected only eight registered development calls")
    return registered


def run():
    import numpy as np
    from faster_whisper.audio import decode_audio
    from faster_whisper.vad import VadOptions, collect_chunks, get_speech_timestamps
    registered = verified_registration()
    rows, failure = [], None
    started = utc()
    with (OUTPUT / "observations.jsonl").open("x", encoding="utf-8") as log:
        try:
            for fixture in registered["fixtures"]:
                began, clock, cpu = utc(), time.perf_counter(), time.process_time()
                path = baseline.MANIFEST.parent / fixture["filename"]
                if path.resolve().parent != baseline.MANIFEST.parent or baseline.base.digest(path) != fixture["sha256"]:
                    raise ValueError("Unexpected development audio")
                audio = decode_audio(str(path), sampling_rate=16000)
                if audio.ndim != 1 or not 0 < audio.size <= 90 * 16000 or not np.isfinite(audio).all():
                    raise ValueError("Invalid decoded audio")
                intervals = get_speech_timestamps(audio, VadOptions())
                summary = interval_summary(int(audio.size), intervals)
                chunks, _ = collect_chunks(audio, intervals)
                retained = np.concatenate(chunks)
                expected = np.concatenate([audio[item["start"]:item["end"]] for item in intervals]) if intervals else audio[:0]
                if not np.array_equal(retained, expected) or retained.size != summary["retainedSamples"]:
                    raise ValueError("Library retained-audio mismatch")
                discarded = [audio[item["start"]:item["end"]] for item in summary["discardedIntervals"]]
                full_energy = float(np.sum(audio.astype(np.float64) ** 2))
                removed_energy = sum(float(np.sum(part.astype(np.float64) ** 2)) for part in discarded)
                removed_stats = [{"start": span["start"], "end": span["end"],
                                  "rms": float(np.sqrt(np.mean(part.astype(np.float64) ** 2))),
                                  "peak": float(np.max(np.abs(part)))}
                                 for span, part in zip(summary["discardedIntervals"], discarded)]
                ended, elapsed = utc(), (time.perf_counter() - clock) * 1000
                drift = abs((baseline.timestamp(ended) - baseline.timestamp(began)) * 1000 - elapsed)
                row = {"filename": fixture["filename"], **summary,
                       "durationSeconds": audio.size / 16000, "retainedSeconds": retained.size / 16000,
                       "librarySampleParity": True, "discardedSignal": removed_stats,
                       "discardedEnergyFraction": removed_energy / full_energy if full_energy else None,
                       "decodedSampleSHA256": hashlib.sha256(audio.tobytes()).hexdigest(),
                       "retainedSampleSHA256": hashlib.sha256(retained.tobytes()).hexdigest(),
                       "startUtc": began, "endUtc": ended, "elapsedMs": elapsed,
                       "cpuMs": (time.process_time() - cpu) * 1000, "utcElapsedDriftMs": drift}
                rows.append(row)
                log.write(json.dumps(row, allow_nan=False) + "\n")
                log.flush()
                print(json.dumps({key: row[key] for key in ("filename", "retainedFraction", "discardedSamples", "elapsedMs")}), flush=True)
                if elapsed > 120000 or drift > 1000:
                    raise ValueError("Interrupted or over-budget VAD audit")
        except Exception as error:
            failure = {"type": type(error).__name__, "message": str(error)}
    ended = utc()
    power = baseline.read_power_window(baseline.timestamp(started), baseline.timestamp(ended))
    unchanged = all(baseline.base.digest(ROOT / name) == value for name, value in registered["hashes"].items())
    usable = len(rows) == 8 and failure is None and unchanged and power["available"] and not power["events"]
    report = {"type": "DEFAULT_VAD_RETENTION_ONLY", "startUtc": started, "endUtc": ended,
              "auditUsable": bool(usable), "failure": failure, "powerEvidence": power,
              "registeredInputsUnchanged": unchanged, "rows": rows,
              "fullRetentionClips": sum(row["discardedSamples"] == 0 for row in rows),
              "totalDiscardedSamples": sum(row["discardedSamples"] for row in rows),
              "registrationSHA256": baseline.base.digest(OUTPUT / "registration.json"),
              "rawSHA256": baseline.base.digest(OUTPUT / "observations.jsonl"),
              "recognizerInference": False, "productionChanged": False, "reservedHoldoutSubmitted": False,
              "limitations": "Default VAD on eight inspected development clips only. Signal energy is not speech or word annotation. No recognition candidate, speed gain, legal/microphone/expert validation or generalization claim."}
    baseline.base.save_new(OUTPUT / "report.json", report)
    print(json.dumps({key: report[key] for key in ("auditUsable", "fullRetentionClips", "totalDiscardedSamples", "failure")}))
    if not usable:
        raise SystemExit(1)


if __name__ == "__main__":
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["register", "run"])
    {"register": register, "run": run}[parser.parse_args().mode]()
