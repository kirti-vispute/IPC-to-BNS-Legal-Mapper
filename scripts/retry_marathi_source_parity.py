"""One exclusive source-only retry after the registered comparison was interrupted by sleep."""
import argparse
import json
import time
from datetime import datetime, timezone
from pathlib import Path

from scripts import assess_marathi_decoder as base
from scripts import compare_marathi_checkpoints as prior

ROOT = base.ROOT
OLD = prior.OUTPUT
OUT = ROOT / "output/public-speech-validation/source-parity-retry-20261004"
PLAN = ROOT / "Feature-marathi-source-parity-retry-plan.md"


def utc():
    return datetime.now(timezone.utc).isoformat()


def inputs():
    registration = json.loads((OLD / "registration.json").read_text(encoding="utf-8"))
    previous = json.loads((OLD / "report.json").read_text(encoding="utf-8"))
    if previous["usable"] or previous["comparison"] is not None or previous["failure"]["type"] != "TimeoutError":
        raise ValueError("Original run is not the expected failed attempt")
    if previous["registeredInputsChanged"] or len(registration["fixtures"]) != 8:
        raise ValueError("Original registration is invalid")
    if base.digest(OLD / "registration.json") != previous["registrationSHA256"]:
        raise ValueError("Original registration changed")
    if base.digest(OLD / "features.json") != previous["featuresSHA256"] or base.digest(OLD / "ct2-worker.jsonl") != previous["convertedRowsSHA256"]:
        raise ValueError("Original shared features or converted outputs changed")
    if any(base.digest(ROOT / name) != expected for name, expected in registration["hashes"].items()):
        raise ValueError("Original preregistered source/model inputs changed")
    features = json.loads((OLD / "features.json").read_text(encoding="utf-8"))
    converted = [json.loads(line) for line in (OLD / "ct2-worker.jsonl").read_text(encoding="utf-8").splitlines()]
    if len(features) != 8 or len(converted) != 8 or any(
            base.digest(ROOT / item["featureFile"]) != item["featureSHA256"] for item in features):
        raise ValueError("Incomplete or changed shared features")
    return features, converted


def register():
    features, _ = inputs()
    paths = [PLAN, Path(__file__), OLD / "registration.json", OLD / "report.json",
             OLD / "features.json", OLD / "ct2-worker.jsonl", OLD / "ct2-worker.stderr.txt",
             OLD / "source-worker.jsonl", OLD / "source-worker.stderr.txt"]
    paths += [ROOT / item["featureFile"] for item in features]
    OUT.mkdir(exist_ok=False)
    base.save_new(OUT / "registration.json", {"type": "SLEEP_INTERRUPTED_SOURCE_ONLY_RETRY",
                  "oldRegistrationSHA256": base.digest(OLD / "registration.json"),
                  "hashes": {str(path.relative_to(ROOT)): base.digest(path) for path in paths},
                  "sourceWorker": "unchanged scripts.compare_marathi_checkpoints source-worker",
                  "convertedReused": True, "reservedHoldoutSubmitted": False})
    print(json.dumps({"registered": True, "clips": len(features), "files": len(paths)}))


def verified():
    reg = json.loads((OUT / "registration.json").read_text(encoding="utf-8"))
    if any(base.digest(ROOT / name) != expected for name, expected in reg["hashes"].items()):
        raise ValueError("Retry input changed")
    return reg


def run():
    reg = verified()
    features, converted = inputs()
    began, clock = utc(), time.perf_counter()
    source, comparison, failure = [], None, None
    try:
        # The child keeps reading OLD/features.json; only the parent output directory is redirected.
        prior.OUTPUT = OUT
        source = prior.run_worker("source-worker", ROOT / ".venv-translation/Scripts/python.exe", features)
        comparison = prior.summarize(converted, source)
    except Exception as error:
        failure = {"type": type(error).__name__, "message": str(error)[:300]}
    finally:
        prior.OUTPUT = OLD
    changed = [name for name, expected in reg["hashes"].items() if base.digest(ROOT / name) != expected]
    report = {"type": "SOURCE_ONLY_RETRY_WITH_SAVED_CONVERTED_ROWS", "startedUtc": began,
              "finishedUtc": utc(), "elapsedMs": (time.perf_counter() - clock) * 1000,
              "usable": comparison is not None and not changed, "failure": failure,
              "comparison": comparison, "registeredInputsChanged": changed,
              "registrationSHA256": base.digest(OUT / "registration.json"),
              "sourceRowsSHA256": base.digest(OUT / "source-worker.jsonl") if (OUT / "source-worker.jsonl").exists() else None,
              "originalConvertedRowsSHA256": base.digest(OLD / "ct2-worker.jsonl"),
              "productionChanged": False, "reservedHoldoutSubmitted": False,
              "limitations": "Inspected eight-clip same-feature comparison only; different decoders and precisions. Separate no-timestamp diagnostic, not website accuracy or conversion-cause proof."}
    base.save_new(OUT / "report.json", report)
    print(json.dumps({"usable": report["usable"], "failure": failure,
                      "sameTokens": comparison["sameTokens"] if comparison else None,
                      "sameText": comparison["sameText"] if comparison else None}), flush=True)
    if not report["usable"]:
        raise SystemExit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("register", "run"))
    {"register": register, "run": run}[parser.parse_args().mode]()
