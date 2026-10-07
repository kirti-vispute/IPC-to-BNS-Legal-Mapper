"""One pinned offline Hindi model comparison; no production imports of this tool."""
import argparse
import base64
import concurrent.futures
import io
import json
import os
import re
import subprocess
import sys
import time
import unicodedata
import wave
from pathlib import Path
from scripts.study_hindi_beam import ROOT, MODEL, digest, save_new, scores, distance
from scripts.validate_hindi_baseline import audit, preserve

PRIOR = ROOT / "output/public-speech-validation/hindi-broader-baseline-20261006"
OUT = ROOT / "output/public-speech-validation/hindi-turbo-study-20261006"
CANDIDATE = OUT / "candidate-model"
MODEL_SHA = "e76620f83d5f5b69efd3d87e3dc180c1bd21df9fbebacfd4335e5e1efcc018da"


def numeric(text):
    return ["".join(str(unicodedata.digit(c)) for c in run) for run in re.findall(r"\d+", text)]


def assess(baseline, candidate, fixtures):
    expected = {f["filename"] for f in fixtures} | {"synthetic-silence"}
    for rows in (baseline, candidate):
        names = [r["filename"] for r in rows]
        if len(names) != len(expected) or set(names) != expected:
            raise ValueError("Complete unique registered speech and silence required")
    if any(r.get("error") or not isinstance(r.get("text"), str) for r in baseline + candidate):
        return {"passed": False, "reason": "Recognition error", "productionDeployment": False}
    by_arm = [{r["filename"]: r for r in rows} for rows in (baseline, candidate)]
    regressions, numeric_failures, script_failures, totals = [], [], [], []
    for records in by_arm:
        total = {key: 0 for key in ("wordEdits", "words", "characterEdits", "characters", "requestMs")}
        for f in fixtures:
            score = scores(f["transcript"], records[f["filename"]]["text"])
            for key in ("wordEdits", "words", "characterEdits", "characters"):
                total[key] += score[key]
            total["requestMs"] += records[f["filename"]]["requestMs"]
        total.update(wer=total["wordEdits"] / total["words"], cer=total["characterEdits"] / total["characters"])
        totals.append(total)
    per_clip = []
    for f in fixtures:
        old, new = [records[f["filename"]] for records in by_arm]
        old_score, new_score = [scores(f["transcript"], row["text"]) for row in (old, new)]
        if any(new_score[key] > old_score[key] for key in ("wordEdits", "characterEdits")):
            regressions.append(f["filename"])
        reference_nums, old_nums, new_nums = [numeric(text) for text in (f["transcript"], old["text"], new["text"])]
        if (reference_nums and new_nums != reference_nums) or distance(reference_nums, new_nums) > distance(reference_nums, old_nums):
            numeric_failures.append(f["filename"])
        if re.search(r"[A-Za-z]", new["text"]):
            script_failures.append(f["filename"])
        per_clip.append({"filename": f["filename"], "baseline": old_score, "candidate": new_score,
                         "referenceNumerals": reference_nums, "baselineNumerals": old_nums, "candidateNumerals": new_nums})
    old, new = totals
    quality = all(new[k] <= 0.8 * old[k] for k in ("wordEdits", "characterEdits")) and not regressions
    safe = not numeric_failures and not script_failures and all(r["text"].strip() for r in candidate if r["filename"] != "synthetic-silence")
    silence = all(not records["synthetic-silence"]["text"].strip() for records in by_arm)
    latency = new["requestMs"] <= 1.25 * old["requestMs"] and all(r["requestMs"] < 180000 for r in candidate)
    return {"passed": quality and safe and silence and latency, "qualityGate": quality, "safetyGate": safe,
            "silenceGate": silence, "latencyGate": latency, "regressions": regressions,
            "numericFailures": numeric_failures, "scriptFailures": script_failures,
            "baseline": old, "candidate": new, "perClip": per_clip, "productionDeployment": False}


def silence_bytes():
    output = io.BytesIO()
    with wave.open(output, "wb") as writer:
        writer.setnchannels(1)
        writer.setsampwidth(2)
        writer.setframerate(16000)
        writer.writeframes(b"\0" * 32000)
    return output.getvalue()


def register(stage):
    if stage == "acquisition":
        hashes = dict(json.loads((PRIOR / "recognition-registration.json").read_text(encoding="utf-8"))["hashes"])
        audit(hashes)
        OUT.mkdir()
        for name in ("Feature-hindi-turbo-study-plan.md", "scripts/study_hindi_turbo.py", "scripts/obtain_hindi_turbo.mjs",
                     "tests/test_hindi_turbo_study.py", "tests/hindiTurboAcquisition.test.js",
                     ".venv-speech/Lib/site-packages/faster_whisper/utils.py", "Feature-hindi-broader-baseline-results.md",
                     "output/public-speech-validation/hindi-broader-baseline-20261006/final-integrity.json",
                     "output/public-speech-validation/hindi-broader-baseline-20261006/recognition-registration.json",
                     "output/public-speech-validation/hindi-broader-baseline-20261006/observations.jsonl",
                     "output/public-speech-validation/hindi-broader-baseline-20261006/report.json",
                     "output/public-speech-validation/hindi-broader-baseline-20261006/recognition-integrity.json"):
            preserve(hashes, ROOT / name)
    else:
        base = OUT / ("acquisition-registration.json" if stage == "development" else "development-registration.json")
        hashes = dict(json.loads(base.read_text(encoding="utf-8"))["hashes"])
        audit(hashes)
        preserve(hashes, base)
        if stage == "development":
            if digest(CANDIDATE / "model.bin") != MODEL_SHA:
                raise ValueError("Pinned candidate weights changed")
            for path in list(CANDIDATE.iterdir()) + [OUT / "model-metadata.json", OUT / "model-download-complete.json"]:
                preserve(hashes, path)
        else:
            if not json.loads((OUT / "development-report.json").read_text(encoding="utf-8"))["assessment"]["passed"]:
                raise ValueError("Failed development forbids confirmation")
            from faster_whisper.audio import decode_audio
            fixtures = json.loads((OUT / "confirmation/fixtures.json").read_text(encoding="utf-8"))["fixtures"]
            previous = []
            for path in (PRIOR / "fixtures/fixtures.json", ROOT / "output/voice-verification/real-speech/fixtures.json",
                         ROOT / "output/voice-verification/holdout-speech/fixtures.json"):
                previous += [f for f in json.loads(path.read_text(encoding="utf-8"))["fixtures"] if f["language"] == "hi"]
            if len(fixtures) != 4:
                raise ValueError("Four confirmation recordings required")
            for key in ("sha256", "datasetId"):
                if len({f[key] for f in fixtures}) != 4 or {f[key] for f in fixtures} & {f[key] for f in previous}:
                    raise ValueError("Confirmation overlaps earlier audio")
            for f in fixtures:
                path = OUT / "confirmation" / f["filename"]
                if Path(f["filename"]).name != f["filename"] or f["license"] != "CC BY 4.0" or f["language"] != "hi" or digest(path) != f["sha256"]:
                    raise ValueError("Confirmation provenance mismatch")
                if digest(OUT / "confirmation/source-card.md") != f["sourceCardSHA256"] or decode_audio(str(path), sampling_rate=16000).size != f["numSamples"]:
                    raise ValueError("Confirmation source or sample count mismatch")
            for path in list((OUT / "confirmation").iterdir()) + [OUT / "development-report.json", OUT / "development-observations.jsonl"]:
                preserve(hashes, path)
    save_new(OUT / f"{stage}-registration.json", {"hashes": hashes, "stage": stage, "productionChange": False})
    print(json.dumps({"stage": stage, "registeredInputs": len(hashes)}), flush=True)


def collect(arm, fixtures, folder, log, rows):
    environment = dict(os.environ, HF_HUB_OFFLINE="1", HF_HUB_DISABLE_TELEMETRY="1", PYTHONUTF8="1")
    model = MODEL if arm == "baseline" else CANDIDATE
    child = subprocess.Popen([sys.executable, "-m", "backend.speech.transcribe", "--model", str(model),
                              "--mode", "transcribe", "--language", "hi", "--stream"], cwd=ROOT,
                             stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                             text=True, encoding="utf-8", env=environment,
                             creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    try:
        for index, fixture in enumerate(fixtures + [{"filename": "synthetic-silence"}]):
            data = silence_bytes() if fixture["filename"] == "synthetic-silence" else (folder / fixture["filename"]).read_bytes()
            started = time.perf_counter()
            child.stdin.write(json.dumps({"audio": base64.b64encode(data).decode("ascii")}) + "\n")
            child.stdin.flush()
            line = executor.submit(child.stdout.readline, 65537).result(timeout=190)
            elapsed = round((time.perf_counter() - started) * 1000)
            if not line.endswith("\n") or len(line) > 65536 or elapsed > 190000:
                raise ValueError("Invalid or late reply")
            raw = json.loads(line)
            row = {**raw, "filename": fixture["filename"], "arm": arm, "requestMs": elapsed, "includesModelInitialization": index == 0}
            log.write(json.dumps(row, ensure_ascii=False) + "\n")
            log.flush()
            rows.append(row)
            print(json.dumps({k: row[k] for k in ("filename", "arm", "requestMs")}), flush=True)
    finally:
        if child.poll() is None:
            child.kill()
        child.wait(timeout=10)
        executor.shutdown(wait=True, cancel_futures=True)


def run(stage):
    hashes = json.loads((OUT / f"{stage}-registration.json").read_text(encoding="utf-8"))["hashes"]
    audit(hashes)
    folder = PRIOR / "fixtures" if stage == "development" else OUT / "confirmation"
    fixtures = json.loads((folder / "fixtures.json").read_text(encoding="utf-8"))["fixtures"]
    rows, failure = [], None
    with (OUT / f"{stage}-observations.jsonl").open("x", encoding="utf-8") as log:
        try:
            if stage == "confirmation":
                collect("baseline", fixtures, folder, log, rows)
            collect("candidate", fixtures, folder, log, rows)
            baseline = [r for r in rows if r["arm"] == "baseline"] if stage == "confirmation" else [
                json.loads(line) for line in (PRIOR / "observations.jsonl").read_text(encoding="utf-8").splitlines()]
            if stage == "development":
                # No earlier silence test for this set; measure current baseline separately without re-decoding speech.
                collect("baseline", [], folder, log, rows)
                baseline += [r for r in rows if r["arm"] == "baseline"]
            result = assess(baseline, [r for r in rows if r["arm"] == "candidate"], fixtures)
        except Exception as error:
            failure = {"type": type(error).__name__, "message": str(error)}
            result = None
    report = {"failure": failure, "assessment": result, "registrationSHA256": digest(OUT / f"{stage}-registration.json"),
              "limitations": "Public read-speech comparison, not user's audio, mic, long legal speech, all languages or independently unseen model-training data. No production deployment."}
    save_new(OUT / f"{stage}-report.json", report)
    audit(hashes)
    save_new(OUT / f"{stage}-integrity.json", {"checkedInputs": len(hashes), "changedInputs": [], "productionChange": False,
             "reservedOutputsPresent": [], "usable": not failure})
    print(json.dumps({"failure": failure, "assessment": None if result is None else {k: v for k, v in result.items() if k != "perClip"}}), flush=True)
    if failure:
        raise SystemExit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("register", "run"))
    parser.add_argument("stage", choices=("acquisition", "development", "confirmation"))
    args = parser.parse_args()
    if args.mode == "run" and args.stage == "acquisition":
        parser.error("Acquisition is a separate public download")
    {"register": register, "run": run}[args.mode](args.stage)
