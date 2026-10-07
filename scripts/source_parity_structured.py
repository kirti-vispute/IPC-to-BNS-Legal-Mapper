"""Source-only same-feature diagnostic using Whisper's structured full sequence."""
import argparse
import concurrent.futures
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from scripts import assess_marathi_decoder as base
from scripts import compare_marathi_checkpoints as prior
from scripts import retry_marathi_source_parity as previous

ROOT = base.ROOT
OLD = prior.OUTPUT
OUT = ROOT / "output/public-speech-validation/source-parity-structured-20261004"
PLAN = ROOT / "Feature-marathi-source-parity-structured-plan.md"


def utc():
    return datetime.now(timezone.utc).isoformat()


def register():
    features, converted = previous.inputs()
    old_retry = json.loads((previous.OUT / "report.json").read_text(encoding="utf-8"))
    if old_retry["usable"] or old_retry["failure"]["type"] != "ValueError" or len(converted) != 8:
        raise ValueError("Earlier source retry is not the expected failed prefix check")
    old_row = json.loads((previous.OUT / "source-worker.jsonl").read_text(encoding="utf-8").splitlines()[0])
    if old_row.get("detail") != "Source did not generate from the registered Marathi prompt":
        raise ValueError("Earlier source error differs from inspected parser issue")
    paths = [PLAN, Path(__file__), ROOT / "tests/test_marathi_parity_structured.py",
             OLD / "registration.json", OLD / "report.json", OLD / "features.json",
             OLD / "ct2-worker.jsonl", previous.OUT / "registration.json",
             previous.OUT / "report.json", previous.OUT / "source-worker.jsonl",
             ROOT / "scripts/compare_marathi_checkpoints.py",
             ROOT / "scripts/retry_marathi_source_parity.py"]
    paths += [ROOT / item["featureFile"] for item in features]
    OUT.mkdir(exist_ok=False)
    base.save_new(OUT / "registration.json", {
        "type": "STRUCTURED_OUTPUT_SOURCE_ONLY_PARITY", "prompt": prior.PROMPT,
        "hashes": {str(path.relative_to(ROOT)): base.digest(path) for path in paths},
        "oldRegistrationSHA256": base.digest(OLD / "registration.json"),
        "convertedReused": True, "reservedHoldoutSubmitted": False})
    print(json.dumps({"registered": True, "clips": len(features), "files": len(paths)}))


def verified():
    reg = json.loads((OUT / "registration.json").read_text(encoding="utf-8"))
    if reg["prompt"] != prior.PROMPT or any(base.digest(ROOT / name) != expected for name, expected in reg["hashes"].items()):
        raise ValueError("Registered structured retry changed")
    prior.verified_registration()
    return reg


def worker():
    import numpy as np
    import torch
    from tokenizers import Tokenizer
    from transformers import WhisperForConditionalGeneration

    verified()
    registered = json.loads((OLD / "registration.json").read_text(encoding="utf-8"))
    features = json.loads((OLD / "features.json").read_text(encoding="utf-8"))
    tokenizer = Tokenizer.from_file(str(prior.TARGET / "tokenizer.json"))
    torch.set_num_threads(4)
    torch.set_num_interop_threads(1)
    model = WhisperForConditionalGeneration.from_pretrained(
        str(prior.SOURCE), local_files_only=True, use_safetensors=True,
        dtype=torch.float32, attn_implementation="eager")
    model.eval()
    model.generation_config.suppress_tokens = registered["suppressTokens"]
    model.generation_config.begin_suppress_tokens = [220, 50257]
    print(json.dumps({"ready": True}), flush=True)
    for index, line in enumerate(sys.stdin):
        started = time.perf_counter()
        job = None
        try:
            job = json.loads(line)
            feature = features[index]
            if job != {"filename": feature["filename"], "featureSHA256": feature["featureSHA256"]}:
                raise ValueError("Unexpected feature job")
            path = ROOT / feature["featureFile"]
            if base.digest(path) != feature["featureSHA256"]:
                raise ValueError("Shared feature changed")
            array = np.load(path, allow_pickle=False)
            if array.shape != (80, 3000) or array.dtype != np.float32 or prior.sample_digest(array) != feature["featureDataSHA256"]:
                raise ValueError("Invalid feature array")
            with torch.inference_mode():
                output = model.generate(
                    input_features=torch.from_numpy(array).unsqueeze(0),
                    language="mr", task="transcribe", return_timestamps=False,
                    num_beams=3, do_sample=False, max_new_tokens=prior.MAX_NEW_TOKENS,
                    length_penalty=1, early_stopping=False, return_dict_in_generate=True)
            sequence = output.sequences[0].tolist()
            tokens = prior.source_generated_tokens(sequence)
            result = {"filename": feature["filename"], "prefix": sequence[:len(prior.PROMPT)],
                      "tokens": tokens, "text": prior.text_from_tokens(tokenizer, tokens),
                      "elapsedMs": (time.perf_counter() - started) * 1000}
        except Exception as error:
            result = {"filename": job.get("filename") if isinstance(job, dict) else None,
                      "error": type(error).__name__, "detail": str(error)[:300],
                      "elapsedMs": (time.perf_counter() - started) * 1000}
        print(json.dumps(result, ensure_ascii=True, allow_nan=False), flush=True)


def run():
    reg = verified()
    features, converted = previous.inputs()
    environment = dict(os.environ, HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1",
                       HF_HUB_DISABLE_TELEMETRY="1", PYTHONUTF8="1", TOKENIZERS_PARALLELISM="false")
    began, clock = utc(), time.perf_counter()
    source, comparison, failure = [], None, None
    with (OUT / "source-worker.jsonl").open("x", encoding="utf-8") as log, (OUT / "source-worker.stderr.txt").open("xb") as errors:
        child = subprocess.Popen([str(ROOT / ".venv-translation/Scripts/python.exe"),
                                  "-m", "scripts.source_parity_structured", "worker"],
                                 cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=errors,
                                 text=True, encoding="utf-8", env=environment,
                                 creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
        executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        try:
            if base.bounded_reply(executor, child.stdout, timeout=180) != {"ready": True}:
                raise ValueError("Source worker did not initialize")
            for item in features:
                child.stdin.write(json.dumps({key: item[key] for key in ("filename", "featureSHA256")}) + "\n")
                child.stdin.flush()
                row = base.bounded_reply(executor, child.stdout, timeout=180)
                if row.get("filename") != item["filename"]:
                    raise ValueError("Unexpected worker response")
                source.append(row)
                log.write(json.dumps(row, ensure_ascii=False, allow_nan=False) + "\n")
                log.flush()
                print(json.dumps({"filename": row["filename"], "elapsedMs": row.get("elapsedMs"),
                                  "error": row.get("error")}), flush=True)
                if row.get("error") or row["elapsedMs"] > 180000:
                    raise ValueError("Source worker error or elapsed limit")
            comparison = prior.summarize(converted, source)
        except Exception as error:
            failure = {"type": type(error).__name__, "message": str(error)[:300]}
        finally:
            if child.poll() is None:
                child.kill()
            child.wait(timeout=10)
            executor.shutdown(wait=True, cancel_futures=True)
    changed = [name for name, expected in reg["hashes"].items() if base.digest(ROOT / name) != expected]
    report = {"type": "STRUCTURED_SOURCE_SAME_FEATURE_PARITY", "startedUtc": began,
              "finishedUtc": utc(), "elapsedMs": (time.perf_counter() - clock) * 1000,
              "usable": comparison is not None and not changed, "failure": failure,
              "comparison": comparison, "registeredInputsChanged": changed,
              "registrationSHA256": base.digest(OUT / "registration.json"),
              "sourceRowsSHA256": base.digest(OUT / "source-worker.jsonl"),
              "convertedRowsSHA256": base.digest(OLD / "ct2-worker.jsonl"),
              "productionChanged": False, "reservedHoldoutSubmitted": False,
              "limitations": "Eight inspected calls, shared features/prefix but separate beam decoders and precisions. No-timestamp single-window diagnostic. No speech/legal accuracy or conversion-cause claim."}
    base.save_new(OUT / "report.json", report)
    print(json.dumps({"usable": report["usable"], "failure": failure,
                      "sameTokens": comparison["sameTokens"] if comparison else None,
                      "sameText": comparison["sameText"] if comparison else None}), flush=True)
    if not report["usable"]:
        raise SystemExit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("register", "run", "worker"))
    {"register": register, "run": run, "worker": worker}[parser.parse_args().mode]()
