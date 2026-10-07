"""One15s offline candidate against frozen30s evidence, not a website change."""
import argparse
import concurrent.futures
import json
import logging
import os
import subprocess
import sys
import time
from dataclasses import asdict
from pathlib import Path
from unittest.mock import patch

from scripts import trace_long_marathi_speech as trace
from scripts.benchmark_speech_decode import normalize, score
from scripts.audit_marathi_vad import interval_summary, versions
from scripts.inspect_marathi_segments import Capture

ROOT, base, audit = trace.ROOT, trace.base, trace.audit
OUT = ROOT / "output/public-speech-validation/short-window-20261005"
LONG = ROOT / "output/public-speech-validation/long-trace-retry-20261005"
SHORT = ROOT / "output/public-speech-validation/segment-diagnostic-20261004"
MANIFEST = ROOT / "output/public-speech-validation/fresh-marathi-20261003/fixtures.json"
CASE = "long-stress"


def candidate_model(base_class):
    class Candidate(base_class):
        def transcribe(self, *args, **kwargs):
            if "chunk_length" in kwargs:
                raise ValueError("Candidate window length cannot be overridden")
            return super().transcribe(*args, **kwargs, chunk_length=15)
    return Candidate


def baselines():
    if audit.read(LONG / "report.json")["traceUsable"] is not True or audit.read(SHORT / "report.json")["diagnosticUsable"] is not True:
        raise ValueError("Only usable baseline evidence allowed")
    long = audit.read(LONG / "observation.json")
    rows = audit.read(SHORT / "report.json")["rows"]
    fixtures = audit.read(MANIFEST)["fixtures"]
    if len(rows) != 8 or [row["filename"] for row in rows] != [item["filename"] for item in fixtures]:
        raise ValueError("Short baseline/manifest identities differ")
    return {CASE: {"text": long["response"]["text"], "windows": long["windows"],
                   "durationAfterVad": long["durationAfterVad"], "options": long["transcriptionOptions"]},
            **{row["filename"]: {"text": row["text"], "windows": row["generationWindows"],
                                 "durationAfterVad": row["durationAfterVad"], "options": row["transcriptionOptions"]} for row in rows}}, fixtures


def phrase_counts(text, phrases):
    words = normalize(text).split()
    result = []
    for phrase in phrases:
        tokens = normalize(phrase).split()
        if not tokens:
            raise ValueError("Empty phrase")
        result.append(sum(words[index:index + len(tokens)] == tokens for index in range(len(words) - len(tokens) + 1)))
    return result


def metrics(text, windows):
    return {"boundHits": sum(len(window["tokens"]) >= 224 for window in windows),
            "generatedReplacementCharacters": sum(window["decodedText"].count("\ufffd") for window in windows),
            "emittedReplacementCharacters": text.count("\ufffd"), "windows": len(windows)}


def compare_case(row, baseline):
    if row.get("error") or row.get("response", {}).get("error") or not row.get("windows"):
        raise ValueError("Incomplete candidate cannot be compared")
    text = row["response"]["text"]
    return {"caseId": row["caseId"], "sameText": text == baseline["text"],
            "sameOptions": row["transcriptionOptions"] == baseline["options"],
            "sameVadDuration": abs(row["durationAfterVad"] - baseline["durationAfterVad"]) <= 1 / 16000,
            "baseline": metrics(baseline["text"], baseline["windows"]), "candidate": metrics(text, row["windows"])}


def verified():
    registered = audit.read(OUT / "registration.json")
    audit.verify(registered["hashes"])
    if registered["versions"] != versions() or registered["productionSettings"] != audit.settings():
        raise ValueError("Runtime/production defaults changed")
    return registered


def register():
    audit.verify(audit.read(audit.PROTECTED))
    hashes = {}
    for directory in (LONG, SHORT):
        prior = audit.read(directory / "registration.json")["hashes"]
        audit.verify(prior)
        if any(name in hashes and hashes[name] != value for name, value in prior.items()):
            raise ValueError("Conflicting prior identity")
        hashes.update(prior)
    baseline, fixtures = baselines()
    _, assembly, long_fixtures = trace.audio_input()
    if assembly != audit.read(LONG / "registration.json")["assembly"]:
        raise ValueError("Stress body differs from baseline")
    paths = [Path(__file__), ROOT / "tests/test_short_speech_window.py", ROOT / "Feature-short-speech-window-plan.md",
             ROOT / "scripts/benchmark_speech_decode.py", MANIFEST,
             LONG / "registration.json", LONG / "observation.json", LONG / "events.jsonl", LONG / "report.json",
             SHORT / "registration.json", SHORT / "observations.jsonl", SHORT / "report.json"]
    paths += [MANIFEST.parent / item["filename"] for item in fixtures]
    hashes.update({str(path.relative_to(ROOT)): base.digest(path) for path in paths})
    OUT.mkdir(exist_ok=False)
    base.save_new(OUT / "registration.json", {"type": "OFFLINE15S_WINDOW_CANDIDATE", "hashes": hashes,
                  "createdAt": trace.baseline.utc(), "versions": versions(), "productionSettings": audit.settings(),
                  "candidateChunkLength": 15, "caseOrder": list(baseline), "assembly": assembly,
                  "shortFixtures": fixtures, "phrases": [item["transcript"] for item in long_fixtures]})
    print(json.dumps({"registeredInputs": len(hashes), "cases": len(baseline), "productionChanged": False}))


def worker():
    from faster_whisper import WhisperModel, transcribe
    from faster_whisper.audio import decode_audio
    from backend.speech.transcribe import recognize
    registered = verified()
    body, assembly, _ = trace.audio_input()
    if assembly != registered["assembly"]:
        raise ValueError("Reconstructed input changed")
    with (OUT / "events.jsonl").open("x", encoding="utf-8") as log:
        current, clock = None, None
        def emit(kind, value):
            log.write(json.dumps({"kind": kind, "caseId": current, "utc": trace.baseline.utc(),
                                 "requestElapsedMs": None if clock is None else (time.perf_counter() - clock) * 1000,
                                 **value}, ensure_ascii=False, allow_nan=False) + "\n")
            log.flush()
        model = candidate_model(trace.tracing_model(WhisperModel, emit))(
            str(base.MODEL), device="cpu", compute_type="int8", cpu_threads=4, local_files_only=True)
        capture = Capture()
        model.logger.handlers, model.logger.propagate = [capture], False
        model.logger.setLevel(logging.DEBUG)
        print(json.dumps({"ready": True}), flush=True)
        original_vad = transcribe.get_speech_timestamps
        for index, line in enumerate(sys.stdin):
            current = registered["caseOrder"][index]
            if json.loads(line) != {"caseId": current}:
                raise ValueError("Unexpected case order")
            data = body if current == CASE else (MANIFEST.parent / current).read_bytes()
            model.decisions.clear()
            model.trace_windows, model.trace_emitted, model.trace_frames = [], [], None
            capture.reset()
            retained = []
            def observe_vad(audio, options, *args, **kwargs):
                spans = original_vad(audio, options, *args, **kwargs)
                summary = interval_summary(int(audio.size), spans)
                retained.append(summary)
                emit("vad", summary)
                return spans
            began, clock = trace.baseline.utc(), time.perf_counter()
            with patch.object(transcribe, "get_speech_timestamps", observe_vad):
                response = recognize(data, model, "mr", decode_audio)
            row = {"caseId": current, "workerStartUtc": began, "workerEndUtc": trace.baseline.utc(),
                   "workerRequestMs": (time.perf_counter() - clock) * 1000, "response": response,
                   "windows": model.trace_windows, "segments": model.trace_emitted, "vad": retained,
                   "contentFrames": model.trace_frames, "actualWindowFrameLimit": model.feature_extractor.nb_max_frames,
                   "logsTruncated": capture.truncated}
            if not response.get("error"):
                row.update(durationAfterVad=model.trace_info.duration_after_vad,
                           transcriptionOptions=asdict(model.trace_info.transcription_options))
            print(json.dumps(row, ensure_ascii=True, allow_nan=False), flush=True)


def run():
    registered = verified()
    baseline, _ = baselines()
    started, rows, failure = trace.baseline.utc(), [], None
    child = subprocess.Popen([sys.executable, "-m", "scripts.compare_short_speech_window", "worker"], cwd=ROOT,
                             stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                             text=True, encoding="utf-8", env=dict(os.environ, HF_HUB_OFFLINE="1", PYTHONUTF8="1",
                                                                  HF_HUB_DISABLE_TELEMETRY="1"),
                             creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    with (OUT / "observations.jsonl").open("x", encoding="utf-8") as log:
        try:
            if base.bounded_reply(executor, child.stdout) != {"ready": True}:
                raise ValueError("Candidate worker not ready")
            for name in registered["caseOrder"]:
                began, clock = trace.baseline.utc(), time.perf_counter()
                child.stdin.write(json.dumps({"caseId": name}) + "\n")
                child.stdin.flush()
                row = base.bounded_reply(executor, child.stdout)
                row.update(parentStartUtc=began, parentEndUtc=trace.baseline.utc(), parentRequestMs=(time.perf_counter() - clock) * 1000)
                if row.get("caseId") != name:
                    raise ValueError("Returned case differs")
                rows.append(row)
                log.write(json.dumps(row, ensure_ascii=False, allow_nan=False) + "\n")
                log.flush()
                print(json.dumps({"caseId": name, "tokens": [len(w["tokens"]) for w in row["windows"]]}), flush=True)
                if row.get("response", {}).get("error"):
                    raise ValueError("Candidate recognition failed")
        except Exception as error:
            failure = {"type": type(error).__name__, "message": str(error)}
        finally:
            if child.poll() is None:
                child.kill()
            child.wait(timeout=10)
            executor.shutdown(wait=True, cancel_futures=True)
    ended = trace.baseline.utc()
    power = trace.baseline.read_power_window(trace.baseline.timestamp(started), trace.baseline.timestamp(ended))
    unchanged = all(base.digest(ROOT / name) == value for name, value in registered["hashes"].items())
    complete = [row.get("caseId") for row in rows] == registered["caseOrder"] and failure is None
    comparisons = []
    for row in rows:
        try:
            comparisons.append(compare_case(row, baseline[row["caseId"]]))
        except (ValueError, KeyError) as error:
            failure = failure or {"type": type(error).__name__, "message": str(error)}
    complete = complete and failure is None
    valid = complete and unchanged and all(trace.assess(row, power, unchanged)["traceUsable"]
                 and row["actualWindowFrameLimit"] == 1500 and max(w["segmentFrames"] for w in row["windows"]) <= 1500
                 and all(w["promptTokens"] == [50258, 50320, 50359] for w in row["windows"]) for row in rows)
    valid = valid and all(item["sameOptions"] and item["sameVadDuration"] for item in comparisons)
    stress = next((row for row in rows if row.get("caseId") == CASE), None)
    extra = {}
    if stress and not stress.get("response", {}).get("error"):
        old, new, reference = baseline[CASE]["text"], stress["response"]["text"], registered["assembly"]["reference"]
        extra = {"baselineScore": score(reference, old), "candidateScore": score(reference, new),
                 "referencePhraseCounts": phrase_counts(reference, registered["phrases"]),
                 "baselinePhraseCounts": phrase_counts(old, registered["phrases"]),
                 "candidatePhraseCounts": phrase_counts(new, registered["phrases"])}
    short_parity = sum(item["sameText"] for item in comparisons if item["caseId"] != CASE)
    long_compare = next((item for item in comparisons if item["caseId"] == CASE), None)
    eligible = bool(valid and short_parity == 8 and long_compare
        and long_compare["candidate"]["boundHits"] < long_compare["baseline"]["boundHits"]
        and long_compare["candidate"]["emittedReplacementCharacters"] < long_compare["baseline"]["emittedReplacementCharacters"]
        and all(old <= new <= expected for old, new, expected in zip(extra["baselinePhraseCounts"], extra["candidatePhraseCounts"], extra["referencePhraseCounts"]))
        and all(extra["candidateScore"][key] <= extra["baselineScore"][key] for key in ("cer", "wer")))
    report = {"type": "OFFLINE15S_WINDOW_COMPARISON", "startUtc": started, "endUtc": ended, "failure": failure,
              "powerEvidence": power, "inputsUnchanged": unchanged, "comparisonUsable": bool(valid),
              "comparisons": comparisons, "stressReferenceDiagnostics": extra, "shortTextParity": short_parity,
              "eligibleForFurtherValidation": eligible, "productionChanged": False, "reservedHoldoutSubmitted": False,
              "limitations": "Saved earlier baselines; no speed comparison. Repeated read-speech dataset reference is not natural legal speech or expert validation. No production deployment.",
              "registrationSHA256": base.digest(OUT / "registration.json"), "rawSHA256": base.digest(OUT / "observations.jsonl")}
    base.save_new(OUT / "report.json", report)
    print(json.dumps({key: report[key] for key in ("comparisonUsable", "shortTextParity", "eligibleForFurtherValidation", "failure")}))
    if not valid:
        raise SystemExit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["register", "worker", "run"])
    {"register": register, "worker": worker, "run": run}[parser.parse_args().mode]()
