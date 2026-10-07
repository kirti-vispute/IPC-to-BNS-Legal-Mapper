"""Read-only audit of saved decoder timings; no audio/model inference."""
import argparse
import hashlib
import json
import math
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "output/public-speech-validation/beam2-assessment-20261003"
BUDGET_MS = 120_000


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def write_new(path, value):
    with path.open("x", encoding="utf-8") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write("\n")


def audit_rows(rows, budget_ms=BUDGET_MS):
    if type(budget_ms) not in (int, float) or not math.isfinite(budget_ms) or budget_ms <= 0:
        raise ValueError("A positive finite budget is required")
    violations = []
    for row in rows:
        elapsed = row.get("decodeMs")
        valid = type(elapsed) in (int, float) and math.isfinite(elapsed) and elapsed > 0
        reason = "invalid-timing" if not valid else "elapsed-budget-exceeded" if elapsed > budget_ms else None
        if row.get("error"):
            reason = "worker-error"
        if reason:
            violations.append({"filename": row.get("filename"), "beam": row.get("beam"),
                               "decodeMs": elapsed, "reason": reason})
    return {"rows": len(rows), "budgetMs": budget_ms, "violations": violations,
            "recordedDecodeBudgetSatisfied": bool(rows) and not violations,
            "controlledLatencyClaimSupported": False,
            "limitation": "Saved decode times exclude parent/setup/audio work; even in-budget rows do not prove a controlled latency experiment."}


def standby_intervals(events):
    intervals, start = [], None
    for event in sorted(events, key=lambda item: item["utc"]):
        timestamp = datetime.fromisoformat(event["utc"].replace("Z", "+00:00"))
        if event["id"] == 506:
            start = timestamp
        elif event["id"] == 507 and start is not None:
            intervals.append({"startUtc": start.isoformat(), "endUtc": timestamp.isoformat(),
                              "seconds": (timestamp - start).total_seconds()})
            start = None
    return intervals


def validate_power_events(events, start, end):
    if not isinstance(events, list) or len(events) > 128:
        raise ValueError("Unexpected event array")
    for event in events:
        timestamp = datetime.fromisoformat(event["utc"].replace("Z", "+00:00"))
        if timestamp.tzinfo is None or event["id"] not in (506, 507) or not start <= timestamp.timestamp() <= end:
            raise ValueError("Power event outside requested absolute window")
    return events


def power_events(start, end):
    if os.name != "nt":
        return {"available": False, "reason": "Windows event log unavailable", "events": []}
    command = (
        "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); "
        # Get-WinEvent interprets this filter as local time; validate UTC results below.
        f"$start=[DateTimeOffset]::FromUnixTimeSeconds({int(start)}).LocalDateTime; "
        f"$end=[DateTimeOffset]::FromUnixTimeSeconds({int(end)}).LocalDateTime; "
        "$events=@(Get-WinEvent -FilterHashtable @{LogName='System';"
        "ProviderName='Microsoft-Windows-Kernel-Power';Id=506,507;StartTime=$start;EndTime=$end} "
        "-MaxEvents 128 -ErrorAction Stop | ForEach-Object {"
        "[pscustomobject]@{utc=$_.TimeCreated.ToUniversalTime().ToString('o');id=$_.Id;message=$_.Message}}); "
        "ConvertTo-Json -InputObject $events -Depth 3"
    )
    try:
        result = subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command],
                                capture_output=True, encoding="utf-8", timeout=15,
                                creationflags=subprocess.CREATE_NO_WINDOW)
        if result.returncode or len(result.stdout) > 65536:
            return {"available": False, "reason": "Event query failed or exceeded limit", "events": []}
        events = validate_power_events(json.loads(result.stdout.lstrip("\ufeff")), int(start), int(end))
        return {"available": True, "events": events}
    except (OSError, subprocess.TimeoutExpired, ValueError):
        return {"available": False, "reason": "Event query unavailable", "events": []}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-name", default="deadline-audit-20261003-corrected")
    name = parser.parse_args().output_name
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", name):
        raise ValueError("Use a fresh simple output name")
    output = ROOT / "output/public-speech-validation" / name
    raw_path, assessment_path = SOURCE / "development-decoding.jsonl", SOURCE / "development-assessment.json"
    paths = [raw_path, assessment_path, SOURCE / "registration.json",
             ROOT / "Feature-marathi-decoder-assessment.md",
             ROOT / "scripts/assess_marathi_decoder.py", ROOT / "scripts/score_marathi_decoder.mjs"]
    before = {str(path.relative_to(ROOT)): digest(path) for path in paths}
    assessment = json.loads(assessment_path.read_text(encoding="utf-8"))
    if assessment["rawSHA256"] != digest(raw_path) or assessment["registrationSHA256"] != digest(SOURCE / "registration.json"):
        raise ValueError("Saved assessment identity mismatch")
    registration = json.loads((SOURCE / "registration.json").read_text(encoding="utf-8"))
    if registration["planSHA256"] != digest(ROOT / "Feature-marathi-decoder-assessment.md"):
        raise ValueError("Frozen plan changed")
    rows = [json.loads(line) for line in raw_path.read_text(encoding="utf-8").splitlines()]
    if len(rows) != 16 or {(row["filename"], row["beam"]) for row in rows} != {
        (fixture["filename"], beam) for fixture in registration["stages"]["development"]["fixtures"] for beam in [2, 3]
    }:
        raise ValueError("Unexpected saved pair identities")
    metadata = raw_path.stat()
    events = power_events(metadata.st_ctime - 120, metadata.st_mtime + 120)
    report = {"type": "READ_ONLY_SAVED_SPEECH_DEADLINE_AUDIT", "createdAt": datetime.now(timezone.utc).isoformat(),
              "inputHashes": before, **audit_rows(rows), "powerEvidence": events,
              "standbyIntervals": standby_intervals(events["events"]),
              "eventWindowUtc": {"start": datetime.fromtimestamp(int(metadata.st_ctime - 120), timezone.utc).isoformat(),
                                 "end": datetime.fromtimestamp(int(metadata.st_mtime + 120), timezone.utc).isoformat()},
              "windowBasis": "Windows file creation/last-write metadata plus120s, not per-request UTC timestamps; no exact row-to-sleep attribution.",
              "clock": vars(time.get_clock_info("perf_counter")), "pythonVersion": sys.version,
              "historicalCandidateAccepted": assessment["acceptedForNextStage"],
              "inferencePerformed": False, "productionChanged": False,
              "reservedHoldoutUndecoded": not any((SOURCE / name).exists() for name in ["holdout-decoding.jsonl", "holdout-assessment.json"])}
    report["inputsUnchanged"] = all(digest(ROOT / name) == expected for name, expected in before.items())
    if not report["inputsUnchanged"]:
        raise ValueError("Input changed during read-only audit")
    output.mkdir()
    write_new(output / "report.json", report)
    print(json.dumps({key: report[key] for key in ["rows", "violations", "standbyIntervals", "inputsUnchanged", "reservedHoldoutUndecoded"]}))


if __name__ == "__main__":
    main()
