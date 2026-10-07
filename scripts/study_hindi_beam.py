"""Registered offline Hindi beam study; never imported by production."""
import argparse
import concurrent.futures
import hashlib
import importlib.util
import json
import os
import subprocess
import sys
import time
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/public-speech-validation/hindi-beam-study-20261006"
MODEL = ROOT / "models/speech/whisper-medium"
MANIFEST = ROOT / "output/voice-verification/real-speech/fixtures.json"
PLAN = ROOT / "Feature-hindi-beam-study-plan.md"
NAMES = ("hi-29.wav", "hi-44.wav", "hi-53.wav", "hi-82.wav")
PRIOR = ROOT / "output/public-speech-validation/voice-selection-20261006"


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def save_new(path, value):
    with path.open("x", encoding="utf-8") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write("\n")


def normalize(text):
    text = unicodedata.normalize("NFC", text).lower()
    return " ".join("".join(c for c in text if not unicodedata.category(c).startswith("P")).split())


def distance(expected, actual):
    previous = list(range(len(actual) + 1))
    for i, left in enumerate(expected, 1):
        current = [i]
        for j, right in enumerate(actual, 1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j - 1] + (left != right)))
        previous = current
    return previous[-1]


def scores(reference, hypothesis):
    expected, actual = normalize(reference), normalize(hypothesis)
    if not expected:
        raise ValueError("Reference must be nonempty")
    return {"wordEdits": distance(expected.split(), actual.split()), "words": len(expected.split()),
            "characterEdits": distance(expected, actual), "characters": len(expected)}


def assessment(rows):
    if len(rows) != 8 or {(r["filename"], r["beam"]) for r in rows} != {(name, beam) for name in NAMES for beam in (3, 5)}:
        raise ValueError("All eight unique registered results required")
    if any(r.get("error") or not r.get("text", "").strip() for r in rows):
        return {"developmentPass": False, "reason": "Failed or empty recognition"}
    totals = {}
    for beam in (3, 5):
        group = [r for r in rows if r["beam"] == beam]
        total = {key: sum(r["score"][key] for r in group) for key in ("wordEdits", "words", "characterEdits", "characters")}
        total.update(wer=total["wordEdits"] / total["words"], cer=total["characterEdits"] / total["characters"],
                     decodeMs=sum(r["decodeMs"] for r in group))
        totals[str(beam)] = total
    regressions = []
    for name in NAMES:
        pair = {r["beam"]: r for r in rows if r["filename"] == name}
        if any(pair[5]["score"][k] > pair[3]["score"][k] for k in ("wordEdits", "characterEdits")):
            regressions.append(name)
    old, new = totals["3"], totals["5"]
    quality = all(new[key] < old[key] for key in ("wordEdits", "characterEdits")) and not regressions
    latency = new["decodeMs"] <= old["decodeMs"] * 1.25 and all(r["decodeMs"] < 180000 for r in rows)
    return {"totals": totals, "regressions": regressions, "qualityGate": quality, "latencyGate": latency,
            "developmentPass": quality and latency, "productionDeployment": False,
            "limitations": "Previously inspected public development speech only; no legal accuracy, user's recording, microphone or unseen-query validation."}


def check(hashes):
    changed = [name for name, expected in hashes.items() if digest(ROOT / name) != expected]
    if changed:
        raise ValueError(f"Registered inputs changed: {changed}")
    reserved = ROOT / "output/public-speech-validation/beam2-assessment-20261003"
    if any((reserved / name).exists() for name in ("holdout-decoding.jsonl", "holdout-assessment.json")):
        raise ValueError("Reserved Marathi outputs unexpectedly present")


def register():
    hashes = json.loads((PRIOR / "before.json").read_text(encoding="utf-8"))["hashes"]
    prior = json.loads((PRIOR / "integrity.json").read_text(encoding="utf-8"))
    if not prior["usable"] or len(prior["authorizedProductionChanges"]) != 1:
        raise ValueError("Previous current source audit unavailable")
    change = prior["authorizedProductionChanges"][0]
    if change["file"] != "frontend/app.js" or hashes[change["file"]] != change["beforeSHA256"]:
        raise ValueError("Unexpected previous source change")
    hashes[change["file"]] = change["afterSHA256"]
    check(hashes)
    files = [Path(__file__), PLAN, ROOT / "tests/test_hindi_beam_study.py", MANIFEST,
             PRIOR / "before.json", PRIOR / "integrity.json", PRIOR / "live/registration.json",
             ROOT / "tests/voiceLanguageSelection.test.js", ROOT / "backend/speech/transcribe.py"]
    files += list(MODEL.glob("*"))
    files += [ROOT / ".venv-speech/Lib/site-packages/faster_whisper/transcribe.py"]
    fixtures = json.loads(MANIFEST.read_text(encoding="utf-8"))["fixtures"]
    selected = [next(f for f in fixtures if f["filename"] == name and f["language"] == "hi") for name in NAMES]
    for fixture in selected:
        path = MANIFEST.parent / fixture["filename"]
        if fixture["license"] != "CC BY 4.0" or digest(path) != fixture["sha256"]:
            raise ValueError("Fixture provenance/checksum mismatch")
        files.append(path)
    for path in files:
        if path.is_file():
            name, identity = path.relative_to(ROOT).as_posix(), digest(path)
            if name in hashes and hashes[name] != identity:
                raise ValueError("Cannot refresh a changed protected identity")
            hashes[name] = identity
    OUT.mkdir()
    save_new(OUT / "registration.json", {"hashes": hashes, "fixtures": selected,
             "priorAuthorizedChange": change, "baselineBeam": 3, "candidateBeam": 5,
             "productionChange": False, "audioMissingForUserExample": True})
    print(json.dumps({"registeredInputs": len(hashes), "fixtures": len(selected)}), flush=True)


def worker():
    from faster_whisper import WhisperModel
    from faster_whisper.audio import decode_audio
    spec = importlib.util.spec_from_file_location("production_speech", ROOT / "backend/speech/transcribe.py")
    production = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(production)
    model = WhisperModel(str(MODEL), device="cpu", compute_type="int8", cpu_threads=4, local_files_only=True)
    print(json.dumps({"ready": True}), flush=True)
    while line := sys.stdin.readline():
        job = json.loads(line)
        try:
            if job["filename"] not in NAMES:
                raise ValueError("Unregistered fixture")
            audio = decode_audio(str(MANIFEST.parent / job["filename"]), sampling_rate=16000)
            for beam in job["order"]:
                if beam not in (3, 5):
                    raise ValueError("Unregistered beam")
                class Adapter:
                    def transcribe(self, samples, **options):
                        if options["beam_size"] != 3 or options["language"] != "hi":
                            raise ValueError("Production baseline options changed")
                        return model.transcribe(samples, **{**options, "beam_size": beam})
                started = time.perf_counter()
                result = production.recognize(b"", Adapter(), "hi", None, decoded_audio=audio)
                print(json.dumps({"filename": job["filename"], "beam": beam, **result,
                      "decodeMs": round((time.perf_counter() - started) * 1000)}, ensure_ascii=True), flush=True)
        except Exception as error:
            print(json.dumps({"error": type(error).__name__}), flush=True)


def run():
    registered = json.loads((OUT / "registration.json").read_text(encoding="utf-8"))
    check(registered["hashes"])
    rows, failure = [], None
    environment = dict(os.environ, HF_HUB_OFFLINE="1", HF_HUB_DISABLE_TELEMETRY="1", PYTHONUTF8="1")
    with (OUT / "observations.jsonl").open("x", encoding="utf-8") as log:
        child = subprocess.Popen([sys.executable, "-m", "scripts.study_hindi_beam", "worker"], cwd=ROOT,
                                 stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                 text=True, encoding="utf-8", env=environment,
                                 creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
        executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        def reply():
            started = time.perf_counter()
            line = executor.submit(child.stdout.readline, 65537).result(timeout=190)
            if not line.endswith("\n") or len(line) > 65536 or time.perf_counter() - started > 190:
                raise ValueError("Invalid or late worker reply")
            return json.loads(line)
        try:
            if reply() != {"ready": True}:
                raise ValueError("Worker startup failed")
            for index, fixture in enumerate(registered["fixtures"]):
                child.stdin.write(json.dumps({"filename": fixture["filename"], "order": [3, 5] if index % 2 == 0 else [5, 3]}) + "\n")
                child.stdin.flush()
                for _ in range(2):
                    row = reply()
                    if "text" in row:
                        row["score"] = scores(fixture["transcript"], row["text"])
                    log.write(json.dumps(row, ensure_ascii=False) + "\n")
                    log.flush()
                    rows.append(row)
                    print(json.dumps({k: v for k, v in row.items() if k not in ("text", "score")}), flush=True)
                    if row.get("error"):
                        raise ValueError("Recognition failed")
        except Exception as error:
            failure = {"type": type(error).__name__, "message": str(error)}
        finally:
            if child.poll() is None:
                child.kill()
            child.wait(timeout=10)
            executor.shutdown(wait=True, cancel_futures=True)
    report = {"failure": failure, "assessment": assessment(rows) if not failure else None,
              "registrationSHA256": digest(OUT / "registration.json")}
    save_new(OUT / "report.json", report)
    check(registered["hashes"])
    save_new(OUT / "integrity.json", {"checkedInputs": len(registered["hashes"]), "changedInputs": [],
             "reservedOutputsPresent": [], "productionChange": False, "usable": not failure})
    print(json.dumps(report), flush=True)
    if failure:
        raise SystemExit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("register", "run", "worker"))
    mode = parser.parse_args().mode
    {"register": register, "run": run, "worker": worker}[mode]()
