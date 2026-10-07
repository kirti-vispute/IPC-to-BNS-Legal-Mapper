"""Instrument the existing decoder only; never imported by production."""
import argparse
import concurrent.futures
import json
import math
import os
import statistics
import subprocess
import sys
import time
from datetime import datetime, timezone

from scripts import assess_marathi_decoder as base
from scripts.audit_speech_deadlines import validate_power_events

ROOT = base.ROOT
OUTPUT = ROOT / "output/public-speech-validation/baseline-timing-20261004"
PLAN = ROOT / "Feature-marathi-baseline-timing-plan.md"
MANIFEST = base.MANIFESTS["development"]
HTTP_REPORT = MANIFEST.parent / "report.json"


def utc():
    return datetime.now(timezone.utc).isoformat()


def timestamp(value):
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        raise ValueError("Timezone-aware timestamps required")
    return parsed.timestamp()


def register():
    fixtures = json.loads(MANIFEST.read_text(encoding="utf-8"))["fixtures"]
    if len(fixtures) != 8 or len({item["callId"] for item in fixtures}) != 8:
        raise ValueError("Expected existing eight development calls")
    paths = [PLAN, ROOT / "scripts/profile_marathi_baseline.py",
             ROOT / "scripts/assess_marathi_decoder.py", ROOT / "scripts/audit_speech_deadlines.py",
             MANIFEST, HTTP_REPORT] + [base.MODEL / name for name in base.MODEL_FILES]
    for fixture in fixtures:
        if fixture["language"] != "mr" or (MANIFEST.parent / fixture["filename"]).resolve().parent != MANIFEST.parent:
            raise ValueError("Unexpected development fixture")
        path = MANIFEST.parent / fixture["filename"]
        if base.digest(path) != fixture["sha256"]:
            raise ValueError("Development audio changed")
        paths.append(path)
    OUTPUT.mkdir()
    base.save_new(OUTPUT / "registration.json", {"type": "BASELINE_ONLY_TIMING_REGISTRATION",
                  "createdAt": utc(), "options": base.decode_options(3), "fixtures": fixtures,
                  "hashes": {str(path.relative_to(ROOT)): base.digest(path) for path in paths}})
    print(json.dumps({"registered": True, "clips": 8, "candidate": False}))


def verified_registration():
    registered = json.loads((OUTPUT / "registration.json").read_text(encoding="utf-8"))
    if registered["options"] != base.decode_options(3):
        raise ValueError("Baseline options changed")
    if any(base.digest(ROOT / name) != expected for name, expected in registered["hashes"].items()):
        raise ValueError("Registered input changed")
    return registered


def worker():
    from faster_whisper import WhisperModel
    from faster_whisper.audio import decode_audio
    registered = verified_registration()
    began, elapsed, cpu = utc(), time.perf_counter(), time.process_time()
    model = WhisperModel(str(base.MODEL), device="cpu", compute_type="int8", cpu_threads=4, local_files_only=True)
    ready = {"ready": True, "startUtc": began, "endUtc": utc(),
             "loadMs": (time.perf_counter() - elapsed) * 1000, "cpuMs": (time.process_time() - cpu) * 1000}
    print(json.dumps(ready), flush=True)
    for index, line in enumerate(sys.stdin):
        started, elapsed = utc(), time.perf_counter()
        try:
            job = json.loads(line)
            fixture = registered["fixtures"][index]
            if job != {"filename": fixture["filename"]}:
                raise ValueError("Only preregistered development order allowed")
            path = MANIFEST.parent / fixture["filename"]
            if base.digest(path) != fixture["sha256"]:
                raise ValueError("Audio hash mismatch")
            audio = decode_audio(str(path), sampling_rate=16000)
            if not 0 < audio.size <= 90 * 16000:
                raise ValueError("Invalid audio duration")
            prep_ms = (time.perf_counter() - elapsed) * 1000
            infer_utc, infer_start, cpu_start = utc(), time.perf_counter(), time.process_time()
            segments, _ = model.transcribe(audio, **registered["options"])
            text = " ".join(segment.text.strip() for segment in segments).strip()
            result = {"text": text, "workerStartUtc": started, "inferenceStartUtc": infer_utc,
                      "workerEndUtc": utc(), "audioPreparationMs": prep_ms,
                      "decodeMs": (time.perf_counter() - infer_start) * 1000,
                      "decodeCpuMs": (time.process_time() - cpu_start) * 1000,
                      "workerRequestMs": (time.perf_counter() - elapsed) * 1000}
        except Exception as error:
            result = {"error": type(error).__name__, "workerStartUtc": started, "workerEndUtc": utc()}
        print(json.dumps(result, ensure_ascii=True), flush=True)


def read_power_window(start, end):
    if os.name != "nt":
        return {"available": False, "events": []}
    command = (
        "[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(); "
        f"$start=[DateTimeOffset]::FromUnixTimeSeconds({int(start)}).LocalDateTime; "
        f"$end=[DateTimeOffset]::FromUnixTimeSeconds({math.ceil(end)}).LocalDateTime; "
        "try {$events=@(Get-WinEvent -FilterHashtable @{LogName='System';ProviderName='Microsoft-Windows-Kernel-Power';"
        "Id=506,507;StartTime=$start;EndTime=$end} -MaxEvents 128 -ErrorAction Stop | ForEach-Object {"
        "[pscustomobject]@{utc=$_.TimeCreated.ToUniversalTime().ToString('o');id=$_.Id}})} "
        "catch {if ($_.FullyQualifiedErrorId -like 'NoMatchingEventsFound*') {$events=@()} else {exit 2}}; "
        "ConvertTo-Json -InputObject $events -Depth 3"
    )
    try:
        result = subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command],
                                capture_output=True, encoding="utf-8", timeout=15,
                                creationflags=subprocess.CREATE_NO_WINDOW)
        if result.returncode or len(result.stdout) > 65536:
            return {"available": False, "events": []}
        events = validate_power_events(json.loads(result.stdout.lstrip("\ufeff")), int(start), math.ceil(end))
        return {"available": True, "events": events}
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return {"available": False, "events": []}


def assess(rows, power, parity, unchanged):
    valid = len(rows) == 8 and parity and unchanged and power["available"] and not power["events"]
    for row in rows:
        keys = ["parentRequestMs", "workerRequestMs", "decodeMs", "audioPreparationMs", "decodeCpuMs"]
        valid = valid and not row.get("error") and bool(row.get("text", "").strip())
        if row.get("error"):
            continue
        numbers = all(type(row.get(key)) in (int, float) and math.isfinite(row[key]) and row[key] > 0 for key in keys)
        drift = abs((timestamp(row["workerEndUtc"]) - timestamp(row["workerStartUtc"])) * 1000 - row["workerRequestMs"])
        valid = valid and numbers and drift <= 1000 and max(row["parentRequestMs"], row["workerRequestMs"], row["decodeMs"]) <= 120000
    return {"measurementUsable": bool(valid), "completed": sum(not row.get("error") for row in rows),
            "baselineHttpParity": parity, "inputsUnchanged": unchanged,
            "parentMedianMs": statistics.median(row["parentRequestMs"] for row in rows) if rows else None,
            "decodeMedianMs": statistics.median(row["decodeMs"] for row in rows) if rows and all("decodeMs" in row for row in rows) else None,
            "remainingSevenDecodeMedianMs": statistics.median(row["decodeMs"] for row in rows[1:]) if len(rows) == 8 and all("decodeMs" in row for row in rows) else None,
            "speedImprovementClaim": False, "generalAccuracyClaim": False}


def run():
    registered = verified_registration()
    http = json.loads(HTTP_REPORT.read_text(encoding="utf-8"))
    rows, failure, ready = [], None, None
    started = utc()
    environment = dict(os.environ, HF_HUB_OFFLINE="1", HF_HUB_DISABLE_TELEMETRY="1", PYTHONUTF8="1")
    with (OUTPUT / "observations.jsonl").open("x", encoding="utf-8") as log:
        child = subprocess.Popen([sys.executable, "-m", "scripts.profile_marathi_baseline", "worker"], cwd=ROOT,
                                 stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                 text=True, encoding="utf-8", env=environment,
                                 creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
        executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        try:
            ready = base.bounded_reply(executor, child.stdout)
            if not ready.get("ready"):
                raise ValueError("Worker not ready")
            for index, fixture in enumerate(registered["fixtures"]):
                parent_utc, parent_clock = utc(), time.perf_counter()
                try:
                    child.stdin.write(json.dumps({"filename": fixture["filename"]}) + "\n")
                    child.stdin.flush()
                    result = base.bounded_reply(executor, child.stdout)
                except Exception as error:
                    result = {"error": type(error).__name__}
                row = {"filename": fixture["filename"], "firstDecode": index == 0,
                       "parentStartUtc": parent_utc, "parentEndUtc": utc(),
                       "parentRequestMs": (time.perf_counter() - parent_clock) * 1000, **result}
                rows.append(row)
                log.write(json.dumps(row, ensure_ascii=False) + "\n")
                log.flush()
                print(json.dumps({key: value for key, value in row.items() if key != "text"}), flush=True)
                if row.get("error") or row["parentRequestMs"] > 120000:
                    raise ValueError("Interrupted or over-budget baseline")
        except Exception as error:
            failure = type(error).__name__
        finally:
            if child.poll() is None:
                child.kill()
            child.wait(timeout=10)
            executor.shutdown(wait=True, cancel_futures=True)
    ended = utc()
    power = read_power_window(timestamp(started), timestamp(ended))
    unchanged = all(base.digest(ROOT / name) == expected for name, expected in registered["hashes"].items())
    parity = len(rows) == 8 and all(row.get("text") == next(item["speech"]["text"] for item in http["rows"] if item["filename"] == row["filename"]) for row in rows)
    report = {"type": "INSTRUMENTED_BASELINE_ONLY", "startUtc": started, "endUtc": ended,
              "modelLoad": ready, "failure": failure, "powerEvidence": power, "rows": rows,
              **assess(rows, power, parity, unchanged), "registrationSHA256": base.digest(OUTPUT / "registration.json"),
              "rawSHA256": base.digest(OUTPUT / "observations.jsonl"),
              "limitations": "One pass on previously inspected public telephone audio, not HTTP/browser latency, candidate improvement, host isolation, general speech/legal accuracy or independent validation. CPU includes all worker threads. No power-policy changes."}
    report["measurementUsable"] = report["measurementUsable"] and failure is None
    base.save_new(OUTPUT / "report.json", report)
    print(json.dumps({key: report[key] for key in ["measurementUsable", "completed", "baselineHttpParity", "inputsUnchanged", "parentMedianMs", "decodeMedianMs", "failure"]}))
    if not report["measurementUsable"]:
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["register", "run", "worker"])
    mode = parser.parse_args().mode
    {"register": register, "run": run, "worker": worker}[mode]()
