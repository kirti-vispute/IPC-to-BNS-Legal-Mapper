"""Fixed public reference baseline using the unchanged production speech CLI."""
import argparse
import base64
import concurrent.futures
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from scripts.study_hindi_beam import ROOT, MODEL, digest, save_new, check, scores

OUT = ROOT / "output/public-speech-validation/hindi-broader-baseline-20261006"
PRIOR = ROOT / "output/public-speech-validation/hindi-cue-study-20261006"
FIXTURES = OUT / "fixtures/fixtures.json"


def preserve(hashes, path):
    name, identity = path.relative_to(ROOT).as_posix(), digest(path)
    if name in hashes and hashes[name] != identity:
        raise ValueError(f"Cannot refresh changed input: {name}")
    hashes[name] = identity


def disjoint(fixtures, previous):
    if len(fixtures) != 12:
        raise ValueError("Twelve fixed recordings required")
    for key in ("datasetId", "sha256"):
        identities = {f[key] for f in fixtures}
        if len(identities) != 12 or identities & {f[key] for f in previous if f["language"] == "hi"}:
            raise ValueError(f"Previously used or duplicate audio: {key}")


def assess(rows, fixtures):
    expected = {f["filename"] for f in fixtures}
    observed = [r["filename"] for r in rows]
    if len(observed) != len(set(observed)) or set(observed) - expected:
        raise ValueError("Duplicate or unregistered result")
    failures = [r["filename"] for r in rows if r.get("error") or not isinstance(r.get("text"), str)]
    missing = sorted(expected - set(observed))
    result = {"expectedClips": len(expected), "observedClips": len(rows), "missing": missing,
              "failed": failures, "complete": not missing and not failures, "wer": None, "cer": None,
              "productionChange": False}
    if result["complete"]:
        by_name = {r["filename"]: r for r in rows}
        per_clip = [{"filename": f["filename"], "rowIndex": f["rowIndex"], "datasetId": f["datasetId"],
                     "genderCode": f["genderCode"], "speakerId": None, "durationSeconds": f["numSamples"] / 16000,
                     "requestMs": by_name[f["filename"]]["requestMs"],
                     **scores(f["transcript"], by_name[f["filename"]]["text"])} for f in fixtures]
        total = {k: sum(r[k] for r in per_clip) for k in ("wordEdits", "words", "characterEdits", "characters")}
        result.update(perClip=per_clip, totals=total, wer=total["wordEdits"] / total["words"],
                      cer=total["characterEdits"] / total["characters"],
                      speechSeconds=sum(r["durationSeconds"] for r in per_clip),
                      requestMs=sum(r["requestMs"] for r in rows),
                      emptyClips=[r["filename"] for r in rows if not r["text"].strip()])
    return result


def audit(hashes):
    check(hashes)
    if any((PRIOR / name).exists() for name in ("confirmation", "confirmation-observations.jsonl")):
        raise ValueError("Rejected cue confirmation must remain unused")


def register(stage):
    if stage == "acquisition":
        hashes = dict(json.loads((PRIOR / "development-registration.json").read_text(encoding="utf-8"))["hashes"])
        audit(hashes)
        OUT.mkdir()
        for name in ("Feature-hindi-broader-baseline-plan.md", "scripts/obtain_hindi_baseline.mjs",
                     "scripts/validate_hindi_baseline.py", "tests/test_hindi_baseline.py", "tests/hindiBaselineAcquisition.test.js",
                     "output/voice-verification/real-speech/fixtures.json", "output/voice-verification/holdout-speech/fixtures.json",
                     "output/public-speech-validation/hindi-cue-study-20261006/development-registration.json",
                     "output/public-speech-validation/hindi-cue-study-20261006/development-report.json",
                     "output/public-speech-validation/hindi-cue-study-20261006/development-integrity.json"):
            preserve(hashes, ROOT / name)
    else:
        from faster_whisper.audio import decode_audio
        hashes = dict(json.loads((OUT / "pre-acquisition-registration.json").read_text(encoding="utf-8"))["hashes"])
        audit(hashes)
        fixtures = json.loads(FIXTURES.read_text(encoding="utf-8"))["fixtures"]
        previous = []
        for name in ("real-speech", "holdout-speech"):
            previous += json.loads((ROOT / f"output/voice-verification/{name}/fixtures.json").read_text(encoding="utf-8"))["fixtures"]
        disjoint(fixtures, previous)
        card = FIXTURES.parent / "source-card.md"
        for path in (FIXTURES, card, FIXTURES.parent / "selection.json"):
            preserve(hashes, path)
        for f in fixtures:
            if Path(f["filename"]).name != f["filename"]:
                raise ValueError("Invalid audio filename")
            path = FIXTURES.parent / f["filename"]
            if f["language"] != "hi" or f["license"] != "CC BY 4.0" or digest(path) != f["sha256"] or digest(card) != f["sourceCardSHA256"]:
                raise ValueError("Audio provenance mismatch")
            audio = decode_audio(str(path), sampling_rate=16000)
            if audio.size != f["numSamples"] or not 0 < audio.size <= 90 * 16000:
                raise ValueError("Audio duration/sample metadata mismatch")
            preserve(hashes, path)
    save_new(OUT / ("pre-acquisition-registration.json" if stage == "acquisition" else "recognition-registration.json"),
             {"hashes": hashes, "stage": stage, "productionChange": False})
    print(json.dumps({"stage": stage, "registeredInputs": len(hashes)}), flush=True)


def run():
    registration = OUT / "recognition-registration.json"
    hashes = json.loads(registration.read_text(encoding="utf-8"))["hashes"]
    audit(hashes)
    fixtures = json.loads(FIXTURES.read_text(encoding="utf-8"))["fixtures"]
    environment = dict(os.environ, HF_HUB_OFFLINE="1", HF_HUB_DISABLE_TELEMETRY="1", PYTHONUTF8="1")
    rows, failure = [], None
    with (OUT / "observations.jsonl").open("x", encoding="utf-8") as log:
        child = subprocess.Popen([sys.executable, "-m", "backend.speech.transcribe", "--model", str(MODEL),
                                  "--mode", "transcribe", "--language", "hi", "--stream"], cwd=ROOT,
                                 stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                 text=True, encoding="utf-8", env=environment,
                                 creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
        executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        try:
            for index, fixture in enumerate(fixtures):
                payload = {"audio": base64.b64encode((FIXTURES.parent / fixture["filename"]).read_bytes()).decode("ascii")}
                started = time.perf_counter()
                child.stdin.write(json.dumps(payload) + "\n")
                child.stdin.flush()
                line = executor.submit(child.stdout.readline, 65537).result(timeout=190)
                elapsed = round((time.perf_counter() - started) * 1000)
                if not line.endswith("\n") or len(line) > 65536 or elapsed > 190000:
                    raise ValueError("Invalid or late worker reply")
                raw = json.loads(line)
                row = {**raw, "filename": fixture["filename"], "requestMs": elapsed, "includesModelInitialization": index == 0}
                log.write(json.dumps(row, ensure_ascii=False) + "\n")
                log.flush()
                rows.append(row)
                print(json.dumps({"filename": fixture["filename"], "requestMs": elapsed, "error": raw.get("error")}), flush=True)
        except Exception as error:
            failure = {"type": type(error).__name__, "message": str(error)}
        finally:
            if child.poll() is None:
                child.kill()
            child.wait(timeout=10)
            executor.shutdown(wait=True, cancel_futures=True)
    report = {"failure": failure, "assessment": assess(rows, fixtures), "registrationSHA256": digest(registration),
              "limitations": "Fixed public read-speech baseline, not user's recording, distinct-speaker, legal, microphone or all-language validation. Different set from earlier four-clip studies; no improvement claim."}
    save_new(OUT / "report.json", report)
    audit(hashes)
    save_new(OUT / "recognition-integrity.json", {"checkedInputs": len(hashes), "changedInputs": [],
             "productionChange": False, "reservedOutputsPresent": [], "usable": not failure and report["assessment"]["complete"]})
    print(json.dumps({"failure": failure, "assessment": {k: v for k, v in report["assessment"].items() if k != "perClip"}}), flush=True)
    if failure or not report["assessment"]["complete"]:
        raise SystemExit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("register-acquisition", "register-recognition", "run"))
    mode = parser.parse_args().mode
    if mode == "run":
        run()
    else:
        register(mode.removeprefix("register-"))
