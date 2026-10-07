"""One preregistered offline beam comparison; never imported by production."""
import argparse
import concurrent.futures
import hashlib
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output/public-speech-validation/beam2-assessment-20261003"
MODEL = ROOT / "models/speech/marathi-small-ct2"
PLAN = ROOT / "Feature-marathi-decoder-assessment.md"
MANIFESTS = {
    "development": ROOT / "output/public-speech-validation/fresh-marathi-20261003/fixtures.json",
    "holdout": ROOT / "output/public-speech-validation/beam2-holdout-20261003/fixtures.json",
}
MODEL_FILES = ["model.bin", "config.json", "tokenizer.json", "vocabulary.json"]


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def save_new(path, value):
    with path.open("x", encoding="utf-8") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write("\n")


def decode_options(beam):
    if beam not in (2, 3):
        raise ValueError("Only the preregistered baseline3/candidate2 are permitted")
    return dict(task="transcribe", language="mr", beam_size=beam, temperature=0,
                vad_filter=True, condition_on_previous_text=False, initial_prompt=None)


def bounded_reply(executor, stream, timeout=120, clock=time.perf_counter):
    started = clock()
    line = executor.submit(stream.readline, 65537).result(timeout=timeout)
    # A completed wait can return after resume; it is not an elapsed-time guarantee.
    if clock() - started > timeout:
        raise TimeoutError("Worker response exceeded elapsed budget")
    if not line.endswith("\n") or len(line) > 65536:
        raise ValueError("Invalid bounded worker response")
    return json.loads(line)


def register():
    stages = {}
    for stage, path in MANIFESTS.items():
        manifest = json.loads(path.read_text(encoding="utf-8"))
        fixtures = manifest["fixtures"]
        if len(fixtures) != 8 or len({f["callId"] for f in fixtures}) != 8:
            raise ValueError("Each split requires8 distinct calls")
        for fixture in fixtures:
            if not re.fullmatch(r"mr-\d+\.wav", fixture["filename"]) or fixture["language"] != "mr":
                raise ValueError("Unexpected fixture identity")
            if digest(path.parent / fixture["filename"]) != fixture["sha256"]:
                raise ValueError("Audio checksum mismatch")
        stages[stage] = {"manifest": path.relative_to(ROOT).as_posix(),
                         "sha256": digest(path), "fixtures": fixtures}
    dev, holdout = stages["development"]["fixtures"], stages["holdout"]["fixtures"]
    for key in ["callId", "utteranceId", "sha256"]:
        if {f[key] for f in dev} & {f[key] for f in holdout}:
            raise ValueError(f"Development/holdout overlap:{key}")
    OUTPUT.mkdir()
    save_new(OUTPUT / "registration.json", {
        "type": "PREREGISTERED_OFFLINE_MARATHI_BEAM_COMPARISON", "planSHA256": digest(PLAN),
        "modelHashes": {name: digest(MODEL / name) for name in MODEL_FILES}, "stages": stages,
        "baselineOptions": decode_options(3), "candidateOptions": decode_options(2),
        "baselineHttpReportSHA256": digest(MANIFESTS["development"].parent / "report.json"),
        "limitations": "Published telephone transcripts, not expert legal labels or physical microphone validation. No fine-tuning or production deployment. Setup excluded; first decode can still include lazy initialization."
    })
    print(json.dumps({"registered": True, "development": len(dev), "holdout": len(holdout)}))


def worker():
    from faster_whisper import WhisperModel
    from faster_whisper.audio import decode_audio
    model = WhisperModel(str(MODEL), device="cpu", compute_type="int8", cpu_threads=4, local_files_only=True)
    print(json.dumps({"ready": True}), flush=True)
    for line in sys.stdin:
        job = json.loads(line)
        try:
            path = (ROOT / job["path"]).resolve()
            if not path.is_relative_to(ROOT / "output/public-speech-validation"):
                raise ValueError("Audio must remain within diagnostic directory")
            if digest(path) != job["sha256"]:
                raise ValueError("Worker audio checksum mismatch")
            audio = decode_audio(str(path), sampling_rate=16000)
            if not 0 < audio.size <= 90 * 16000:
                raise ValueError("Invalid audio duration")
            start = time.perf_counter()
            segments, _ = model.transcribe(audio, **decode_options(job["beam"]))
            text = " ".join(s.text.strip() for s in segments).strip()
            result = {"text": text, "decodeMs": round((time.perf_counter() - start) * 1000)}
        except Exception as error:
            result = {"error": type(error).__name__}
        print(json.dumps(result, ensure_ascii=True), flush=True)


def run(stage):
    registered = json.loads((OUTPUT / "registration.json").read_text(encoding="utf-8"))
    if digest(PLAN) != registered["planSHA256"]:
        raise ValueError("Preregistered plan changed")
    for name, expected in registered["modelHashes"].items():
        if digest(MODEL / name) != expected:
            raise ValueError("Preregistered model changed")
    if stage == "holdout":
        decision = json.loads((OUTPUT / "development-assessment.json").read_text(encoding="utf-8"))
        if not decision["acceptedForNextStage"] or decision["registrationSHA256"] != digest(OUTPUT / "registration.json"):
            raise ValueError("Development failed; do not decode reserved holdout")
    source = registered["stages"][stage]
    manifest_path = ROOT / source["manifest"]
    if digest(manifest_path) != source["sha256"]:
        raise ValueError("Preregistered fixture manifest changed")
    environment = dict(os.environ, HF_HUB_OFFLINE="1", HF_HUB_DISABLE_TELEMETRY="1", PYTHONUTF8="1")
    # A separate bounded worker keeps a stalled C++ decode from hanging the experiment.
    with (OUTPUT / f"{stage}-decoding.jsonl").open("x", encoding="utf-8") as log:
        child = subprocess.Popen([sys.executable, str(Path(__file__).resolve()), "worker"],
                                 stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                 text=True, encoding="utf-8", env=environment,
                                 creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
        executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        def reply():
            return bounded_reply(executor, child.stdout)
        try:
            if reply() != {"ready": True}:
                raise ValueError("Worker failed to initialize")
            for index, fixture in enumerate(source["fixtures"]):
                for beam in ([3, 2] if index % 2 == 0 else [2, 3]):
                    job = {"path": (manifest_path.parent / fixture["filename"]).relative_to(ROOT).as_posix(),
                           "sha256": fixture["sha256"], "beam": beam}
                    child.stdin.write(json.dumps(job) + "\n")
                    child.stdin.flush()
                    result = reply()
                    row = {"filename": fixture["filename"], "beam": beam, **result}
                    log.write(json.dumps(row, ensure_ascii=False) + "\n")
                    log.flush()
                    print(json.dumps({k: v for k, v in row.items() if k != "text"}), flush=True)
                    if row.get("error"):
                        raise ValueError("Decoder error; candidate not eligible")
        finally:
            if child.poll() is None:
                child.kill()
            child.wait(timeout=10)
            executor.shutdown(wait=True, cancel_futures=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["register", "development", "holdout", "worker"])
    args = parser.parse_args()
    if args.mode == "register":
        register()
    elif args.mode == "worker":
        worker()
    else:
        run(args.mode)


if __name__ == "__main__":
    main()
