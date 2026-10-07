"""One registered native Hindi context candidate, separate from production."""
import argparse
import concurrent.futures
import importlib.util
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from scripts.study_hindi_beam import ROOT, MODEL, MANIFEST, NAMES, digest, save_new, check, scores, normalize

OUT = ROOT / "output/public-speech-validation/hindi-cue-study-20261006"
PLAN = ROOT / "Feature-hindi-cue-study-plan.md"
PRIOR = ROOT / "output/public-speech-validation/hindi-beam-study-20261006"
CUE = "यह हिंदी में कही गई बात है।"
ARMS = ("baseline", "cue")


class CueAdapter:
    def __init__(self, model, arm):
        if arm not in ARMS:
            raise ValueError("Unregistered candidate")
        self.model, self.arm = model, arm

    def transcribe(self, audio, **options):
        if options.get("language") != "hi" or options.get("initial_prompt") is not None or options.get("beam_size") != 3:
            raise ValueError("Production Hindi baseline changed")
        return self.model.transcribe(audio, **{**options, "initial_prompt": CUE if self.arm == "cue" else None})


def assessment(rows, names):
    expected = {(name, arm) for name in names for arm in ARMS}
    speech = [r for r in rows if r.get("filename") != "synthetic-silence"]
    if len(speech) != len(expected) or {(r.get("filename"), r.get("arm")) for r in speech} != expected:
        raise ValueError("Incomplete or duplicated speech results")
    silence = [r for r in rows if r.get("filename") == "synthetic-silence"]
    if len(silence) != 2 or {r.get("arm") for r in silence} != set(ARMS):
        raise ValueError("Both silence controls required")
    if any(r.get("error") for r in rows) or any(not r.get("text", "").strip() for r in speech):
        return {"passed": False, "reason": "Recognition error or empty speech", "productionDeployment": False}
    totals = {}
    for arm in ARMS:
        group = [r for r in speech if r["arm"] == arm]
        value = {key: sum(r["score"][key] for r in group) for key in ("wordEdits", "words", "characterEdits", "characters")}
        value.update(wer=value["wordEdits"] / value["words"], cer=value["characterEdits"] / value["characters"],
                     decodeMs=sum(r["decodeMs"] for r in group))
        totals[arm] = value
    regressions = []
    for name in names:
        pair = {r["arm"]: r for r in speech if r["filename"] == name}
        if any(pair["cue"]["score"][key] > pair["baseline"]["score"][key] for key in ("wordEdits", "characterEdits")):
            regressions.append(name)
    old, new = totals["baseline"], totals["cue"]
    quality = not regressions and all(new[key] < old[key] for key in ("wordEdits", "characterEdits"))
    safe = not any(r.get("text", "").strip() for r in silence) and not any(normalize(CUE) in normalize(r["text"]) for r in speech)
    latency = new["decodeMs"] <= 1.25 * old["decodeMs"] and all(r["decodeMs"] < 180000 for r in rows)
    return {"totals": totals, "regressions": regressions, "qualityGate": quality, "silenceAndCueGate": safe,
            "latencyGate": latency, "passed": quality and safe and latency, "productionDeployment": False}


def register(stage):
    if stage == "development":
        previous = json.loads((PRIOR / "registration.json").read_text(encoding="utf-8"))
        hashes, fixtures = dict(previous["hashes"]), previous["fixtures"]
        OUT.mkdir()
    else:
        if not json.loads((OUT / "development-report.json").read_text(encoding="utf-8"))["assessment"]["passed"]:
            raise ValueError("Development failed; confirmation forbidden")
        previous = json.loads((OUT / "development-registration.json").read_text(encoding="utf-8"))
        hashes = dict(previous["hashes"])
        manifest = OUT / "confirmation/fixtures.json"
        fixtures = json.loads(manifest.read_text(encoding="utf-8"))["fixtures"]
        old = previous["fixtures"] + json.loads((ROOT / "output/voice-verification/holdout-speech/fixtures.json").read_text(encoding="utf-8"))["fixtures"]
        if len(fixtures) != 4 or [f["rowIndex"] for f in fixtures] != [60, 61, 62, 63]:
            raise ValueError("Confirmation rows changed")
        for key in ("sha256", "datasetId"):
            existing = {f[key] for f in old if f["language"] == "hi"}
            if len({f[key] for f in fixtures}) != 4 or existing & {f[key] for f in fixtures}:
                raise ValueError("Previously used confirmation speech")
        hashes[manifest.relative_to(ROOT).as_posix()] = digest(manifest)
        card = manifest.parent / "source-card.md"
        hashes[card.relative_to(ROOT).as_posix()] = digest(card)
        for f in fixtures:
            path = manifest.parent / f["filename"]
            if f["language"] != "hi" or f["license"] != "CC BY 4.0" or digest(path) != f["sha256"] or f["sourceCardSHA256"] != digest(card):
                raise ValueError("Confirmation provenance mismatch")
            hashes[path.relative_to(ROOT).as_posix()] = f["sha256"]
    check(hashes)
    for path in [Path(__file__), PLAN, ROOT / "tests/test_hindi_cue_study.py", PRIOR / "registration.json",
                 PRIOR / "report.json", PRIOR / "integrity.json", ROOT / "scripts/obtain_hindi_cue_confirmation.mjs",
                 ROOT / "output/voice-verification/holdout-speech/fixtures.json"]:
        name, identity = path.relative_to(ROOT).as_posix(), digest(path)
        if name in hashes and hashes[name] != identity:
            raise ValueError("Cannot refresh changed input")
        hashes[name] = identity
    save_new(OUT / f"{stage}-registration.json", {"hashes": hashes, "fixtures": fixtures, "stage": stage,
             "candidatePrompt": CUE, "productionChange": False, "physicalMicrophone": False})
    print(json.dumps({"stage": stage, "registeredInputs": len(hashes), "clips": len(fixtures)}), flush=True)


def worker(stage):
    import numpy as np
    from faster_whisper import WhisperModel
    from faster_whisper.audio import decode_audio
    spec = importlib.util.spec_from_file_location("production_speech", ROOT / "backend/speech/transcribe.py")
    production = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(production)
    model = WhisperModel(str(MODEL), device="cpu", compute_type="int8", cpu_threads=4, local_files_only=True)
    registered = json.loads((OUT / f"{stage}-registration.json").read_text(encoding="utf-8"))
    base = MANIFEST.parent if stage == "development" else OUT / "confirmation"
    allowed = {f["filename"] for f in registered["fixtures"]}
    print(json.dumps({"ready": True}), flush=True)
    for line in sys.stdin:
        job = json.loads(line)
        if job["filename"] not in allowed | {"synthetic-silence"}:
            raise ValueError("Unregistered audio")
        audio = np.zeros(16000, dtype=np.float32) if job["filename"] == "synthetic-silence" else decode_audio(str(base / job["filename"]), sampling_rate=16000)
        for arm in job["order"]:
            started = time.perf_counter()
            result = production.recognize(b"", CueAdapter(model, arm), "hi", None, decoded_audio=audio)
            print(json.dumps({"filename": job["filename"], "arm": arm, **result,
                  "decodeMs": round((time.perf_counter() - started) * 1000)}, ensure_ascii=True), flush=True)


def run(stage):
    registered = json.loads((OUT / f"{stage}-registration.json").read_text(encoding="utf-8"))
    check(registered["hashes"])
    rows, failure = [], None
    environment = dict(os.environ, HF_HUB_OFFLINE="1", HF_HUB_DISABLE_TELEMETRY="1", PYTHONUTF8="1")
    with (OUT / f"{stage}-observations.jsonl").open("x", encoding="utf-8") as log:
        child = subprocess.Popen([sys.executable, "-m", "scripts.study_hindi_cue", "worker", stage], cwd=ROOT,
                                 stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                 text=True, encoding="utf-8", env=environment,
                                 creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
        executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        def reply():
            started = time.perf_counter()
            line = executor.submit(child.stdout.readline, 65537).result(timeout=190)
            if not line.endswith("\n") or len(line) > 65536 or time.perf_counter() - started > 190:
                raise ValueError("Invalid or late reply")
            return json.loads(line)
        try:
            if reply() != {"ready": True}:
                raise ValueError("Worker initialization failed")
            jobs = registered["fixtures"] + [{"filename": "synthetic-silence"}]
            for index, fixture in enumerate(jobs):
                order = list(ARMS) if index % 2 == 0 else list(reversed(ARMS))
                child.stdin.write(json.dumps({"filename": fixture["filename"], "order": order}) + "\n")
                child.stdin.flush()
                for arm in order:
                    row = reply()
                    if row.get("filename") != fixture["filename"] or row.get("arm") != arm:
                        raise ValueError("Reply identity mismatch")
                    if "transcript" in fixture and "text" in row:
                        row["score"] = scores(fixture["transcript"], row["text"])
                    log.write(json.dumps(row, ensure_ascii=False) + "\n")
                    log.flush()
                    rows.append(row)
                    print(json.dumps({k: v for k, v in row.items() if k not in ("text", "score")}), flush=True)
        except Exception as error:
            failure = {"type": type(error).__name__, "message": str(error)}
        finally:
            if child.poll() is None:
                child.kill()
            child.wait(timeout=10)
            executor.shutdown(wait=True, cancel_futures=True)
    report = {"failure": failure, "assessment": None if failure else assessment(rows, [f["filename"] for f in registered["fixtures"]]),
              "registrationSHA256": digest(OUT / f"{stage}-registration.json"),
              "limitations": "Published read-speech development/confirmation, not legal or microphone accuracy; reported user audio unavailable."}
    save_new(OUT / f"{stage}-report.json", report)
    check(registered["hashes"])
    save_new(OUT / f"{stage}-integrity.json", {"checkedInputs": len(registered["hashes"]), "changedInputs": [],
             "productionChange": False, "reservedOutputsPresent": [], "usable": not failure})
    print(json.dumps(report), flush=True)
    if failure:
        raise SystemExit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("register", "run", "worker"))
    parser.add_argument("stage", choices=("development", "confirmation"))
    args = parser.parse_args()
    {"register": register, "run": run, "worker": worker}[args.mode](args.stage)
