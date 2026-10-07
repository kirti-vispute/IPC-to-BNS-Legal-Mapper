"""Register and audit one existing long-fixture HTTP/UI smoke; no ASR here."""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/public-speech-validation/long-review-http-20261006"
PRIOR = ROOT / "output/public-speech-validation/frontend-review-20261006"
SAVED = ROOT / "output/public-speech-validation/long-trace-retry-20261005/observation.json"
EXPECTED_BODY = "44ed4a19e50da09a37b5f07e9def964c6958f9a4867d6e285be44b52fb103951"
RESERVED = ROOT / "output/public-speech-validation/beam2-assessment-20261003"


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def save_new(path, value):
    with path.open("x", encoding="utf-8") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write("\n")


def canonical_hashes(hashes):
    result = {}
    for name, expected in hashes.items():
        key = name.replace("\\", "/")
        path = ROOT / key
        if path.is_absolute() and not path.resolve().is_relative_to(ROOT):
            raise ValueError("Input path escapes workspace")
        if key in result and result[key] != expected.lower():
            raise ValueError("Conflicting canonical commitments")
        result[key] = expected.lower()
    return result


def expected_review(observation):
    from backend.speech.review import assess_window, WARNING
    windows = observation["windows"]
    if not windows or len(windows) > 128 or not observation["response"].get("text"):
        raise ValueError("No usable saved speech response")
    assessments = [assess_window(window, observation["transcriptionOptions"], 448, 50364)
                   for window in windows]
    warning = [index for index, item in enumerate(assessments) if item["requiresReview"]]
    return {"version": 1, "status": "assessed", "requiresReview": bool(warning),
            "windowCount": len(windows), "textModified": False,
            "warningCode": WARNING if warning else None, "warningWindows": warning,
            "silenceConfidenceWindows": [index for index, item in enumerate(assessments)
                if item["supportingEvidence"]["contradictorySilenceConfidence"]],
            "compressionWindows": [index for index, item in enumerate(assessments)
                if item["supportingEvidence"]["compressionThresholdExceeded"]]}


def reserved_outputs():
    return [str(path.relative_to(ROOT)) for name in ("holdout-decoding.jsonl", "holdout-assessment.json")
            if (path := RESERVED / name).exists()]


def verify_frozen_assessment(observation, frozen_response):
    from backend.speech.review import assess_window
    saved_review = frozen_response["speechReview"]
    details = [{"windowIndex": index, **assess_window(window, observation["transcriptionOptions"], 448, 50364)}
               for index, window in enumerate(observation["windows"])]
    original = {key: value for key, value in frozen_response.items() if key != "speechReview"}
    if (original != observation["response"] or saved_review["windows"] != details
            or saved_review["requiresReview"] != any(item["requiresReview"] for item in details)
            or saved_review["textModified"] is not False):
        raise ValueError("Current pure rule differs from frozen expected evidence")


def verify(hashes):
    changed = [name for name, expected in hashes.items() if digest(ROOT / name) != expected]
    if changed or reserved_outputs():
        raise ValueError(f"Changed inputs: {changed}; reserved outputs: {reserved_outputs()}")


def register():
    from scripts.audit_speech_continuation import settings
    from scripts.trace_long_marathi_speech import audio_input, MANIFEST, HISTORICAL
    hashes = canonical_hashes(read(PRIOR / "before.json")["hashes"])
    integrity = read(PRIOR / "integrity.json")
    if not integrity["usable"] or len(integrity["authorizedFrontendChanges"]) != 2:
        raise ValueError("Prior authorized change evidence is incomplete")
    for change in integrity["authorizedFrontendChanges"]:
        name = change["file"]
        if name not in ("frontend/app.js", "frontend/style.css") or hashes[name] != change["beforeSHA256"]:
            raise ValueError("Unrecognized prior source change")
        hashes[name] = change["afterSHA256"]
    verify(hashes)
    paths = [Path(__file__), ROOT / "scripts/validate_long_speech_review_ui.mjs",
             ROOT / "tests/test_long_speech_review_validation.py",
             ROOT / "Feature-long-speech-review-validation-plan.md", MANIFEST, HISTORICAL, SAVED,
             PRIOR / "before.json", PRIOR / "integrity.json",
             ROOT / "output/public-speech-validation/review-warning-20261006/report.json"]
    for directory in ("backend", "frontend", "tests", "legal-sources", "evaluation"):
        paths += [path for path in (ROOT / directory).rglob("*") if path.is_file()
                  and "__pycache__" not in path.parts]
    paths += [ROOT / "scripts/project_completion_validation.mjs", ROOT / "scripts/evaluate_retrieval.mjs"]
    for group in ("browser", "browser-edge"):
        paths += [PRIOR / group / name for name in ("registration.json", "report.json")]
    for item in read(MANIFEST)["fixtures"]:
        if item["language"] == "mr":
            paths.append(MANIFEST.parent / item["filename"])
    for path in paths:
        key, actual = path.relative_to(ROOT).as_posix(), digest(path)
        if key in hashes and hashes[key] != actual:
            raise ValueError(f"Input conflict: {key}")
        hashes[key] = actual
    observation = read(SAVED)
    review = expected_review(observation)
    frozen = read(ROOT / "output/public-speech-validation/review-warning-20261006/report.json")
    row = next(item for item in frozen["rows"] if item["caseId"] == "saved-production30s-stress")
    # The offline report has detailed windows; production deliberately exposes only a bounded summary.
    verify_frozen_assessment(observation, row["responseWithOfflineReview"])
    options = settings()
    OUT.mkdir(exist_ok=False)
    save_new(OUT / "registration.json", {"type": "LONG_MARATHI_REAL_HTTP_UI_WIRING",
        "createdAt": datetime.now(timezone.utc).isoformat(), "hashes": hashes,
        "settings": options, "expectedBodySHA256": EXPECTED_BODY,
        "expectedTextSHA256": hashlib.sha256(observation["response"]["text"].encode()).hexdigest(),
        "expectedReview": review, "physicalMicrophone": False, "accuracyEvaluation": False,
        "productionChangesAllowed": [], "reservedHoldoutSubmitted": False})
    body, assembly, fixtures = audio_input()
    if (assembly["bodySHA256"] != EXPECTED_BODY or assembly["samples"] != 960737
            or assembly["durationSeconds"] != 60.0460625):
        raise ValueError("Existing fixture reconstruction differs")
    with (OUT / "stress.wav").open("xb") as stream:
        stream.write(body)
    save_new(OUT / "expected.json", {"text": observation["response"]["text"],
        "speechReview": review, "bodySHA256": EXPECTED_BODY, "assembly": assembly,
        "sources": [{key: item[key] for key in ("filename", "source", "license", "sha256")}
                    for item in fixtures]})
    save_new(OUT / "prepared.json", {"hashes": {path.relative_to(ROOT).as_posix(): digest(path)
        for path in (OUT / "registration.json", OUT / "stress.wav", OUT / "expected.json")}})
    print(json.dumps({"registeredInputs": len(hashes), "samples": assembly["samples"], "review": review}))


def audit():
    from scripts.profile_marathi_baseline import read_power_window
    registered, prepared = read(OUT / "registration.json"), read(OUT / "prepared.json")
    commitments = canonical_hashes({**registered["hashes"], **prepared["hashes"]})
    changed = [name for name, expected in commitments.items() if digest(ROOT / name) != expected]
    report = read(OUT / "report.json")
    power = read_power_window(report["startEpoch"], report["endEpoch"])
    result = {"checkedInputs": len(commitments), "changedInputs": changed,
              "reservedOutputsPresent": reserved_outputs(), "powerWindow": power,
              "usable": not changed and not reserved_outputs() and report["usable"]
                  and power["available"] and not power["events"],
              "productionChanged": False, "legalEvaluationChanged": False}
    save_new(OUT / "integrity.json", result)
    print(json.dumps(result))
    if not result["usable"]:
        raise SystemExit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("stage", choices=("register", "audit"))
    args = parser.parse_args()
    register() if args.stage == "register" else audit()
