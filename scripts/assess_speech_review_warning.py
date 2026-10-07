"""Offline risk metadata for saved speech output, never a transcript correction."""
import argparse
import copy
import json
from pathlib import Path

from scripts import audit_speech_continuation as audit
from scripts import trace_long_marathi_speech as trace
from scripts.inspect_marathi_segments import finite, skip_decision

ROOT, base = audit.ROOT, trace.base
OUT = ROOT / "output/public-speech-validation/review-warning-20261006"
TAIL = OUT.parent / "tail-audit-first-window-20261006"
LONG = OUT.parent / "long-trace-retry-20261005"
CANDIDATE = OUT.parent / "short-window-20261005"
SHORT = OUT.parent / "segment-diagnostic-20261004"


def assess_window(window, options, max_length, timestamp_begin):
    if type(max_length) is not int or max_length <= 0 or type(timestamp_begin) is not int or timestamp_begin <= 0:
        raise ValueError("Invalid pinned decoder limits")
    if options["max_new_tokens"] is not None or options["without_timestamps"] is not False:
        raise ValueError("Only the audited timestamped/default-budget path is supported")
    tokens, prompt = window["tokens"], window["promptTokens"]
    if any(not isinstance(values, list) or not values or any(type(token) is not int or token < 0 for token in values)
           for values in (tokens, prompt)) or len(prompt) >= max_length:
        raise ValueError("Invalid saved tokens/prompt")
    if "tokenCount" in window and window["tokenCount"] != len(tokens):
        raise ValueError("Saved token count differs")
    bound = min(max_length // 2, max_length - len(prompt) + 1)
    decision = skip_decision(window["noSpeechProbability"], window["avgLogprob"],
                             options["no_speech_threshold"], options["log_prob_threshold"])
    compression, threshold = window["compressionRatio"], options["compression_ratio_threshold"]
    if not finite(compression) or compression < 0 or threshold is not None and not finite(threshold):
        raise ValueError("Invalid saved compression metadata")
    ending = len(tokens) >= 2 and tokens[-2] < timestamp_begin <= tokens[-1]
    at_bound = len(tokens) >= bound
    return {"tokenCount": len(tokens), "sourceDerivedStepBound": bound, "atStepBound": at_bound,
            "completedEndingTimestamp": ending, "requiresReview": at_bound and not ending,
            "warningCode": "REVIEW_SATURATED_UNFINISHED_WINDOW" if at_bound and not ending else None,
            "supportingEvidence": {**decision, "contradictorySilenceConfidence": decision["highNoSpeech"] and decision["logprobOverride"],
                "compressionThresholdExceeded": threshold is not None and compression > threshold,
                "noSpeechProbability": window["noSpeechProbability"], "avgLogprob": window["avgLogprob"],
                "compressionRatio": compression, "noSpeechThreshold": options["no_speech_threshold"],
                "logProbThreshold": options["log_prob_threshold"], "compressionThreshold": threshold}}


def add_review_metadata(response, windows, options, runtime):
    if response.get("error") or not isinstance(response.get("text"), str) or not response["text"] or not windows or "speechReview" in response:
        raise ValueError("Incomplete or already-assessed response")
    assessments = [{"windowIndex": index, **assess_window(window, options, runtime["max_length"], audit.TIMESTAMP_BEGIN)}
                   for index, window in enumerate(windows)]
    result = copy.deepcopy(response)
    result["speechReview"] = {"requiresReview": any(row["requiresReview"] for row in assessments),
                             "windows": assessments, "textModified": False,
                             "scope": "Offline incomplete-window indicator, not a speech accuracy verdict"}
    return result


def register():
    audit.verify(audit.read(audit.PROTECTED))
    hashes = dict(audit.read(TAIL / "registration.json")["hashes"])
    audit.verify(hashes)
    paths = [Path(__file__), ROOT / "tests/test_speech_review_warning.py", ROOT / "Feature-speech-review-warning-plan.md",
             TAIL / "registration.json", TAIL / "report.json", TAIL / "integrity.json",
             SHORT / "registration.json", SHORT / "report.json", SHORT / "observations.jsonl"]
    hashes.update({str(path.relative_to(ROOT)): base.digest(path) for path in paths})
    OUT.mkdir(exist_ok=False)
    base.save_new(OUT / "registration.json", {"type": "OFFLINE_UNFINISHED_SPEECH_REVIEW_WARNING",
                  "createdAt": trace.baseline.utc(), "hashes": hashes, "runtime": audit.settings()})
    print(json.dumps({"registeredInputs": len(hashes), "productionChanged": False, "inference": False}))


def saved_cases():
    if not audit.read(TAIL / "report.json")["auditUsable"] or not audit.read(LONG / "report.json")["traceUsable"]:
        raise ValueError("Unusable saved long evidence")
    if not audit.read(CANDIDATE / "report.json")["comparisonUsable"] or not audit.read(SHORT / "report.json")["diagnosticUsable"]:
        raise ValueError("Unusable saved candidate/short evidence")
    baseline = audit.read(LONG / "observation.json")
    candidates = [json.loads(line) for line in (CANDIDATE / "observations.jsonl").read_text(encoding="utf-8").splitlines()]
    candidates = [row for row in candidates if row["caseId"] == "long-stress"]
    shorts = audit.read(SHORT / "report.json")["rows"]
    if len(candidates) != 1 or len(shorts) != 8 or len({row["filename"] for row in shorts}) != 8:
        raise ValueError("Unexpected saved identity count")
    yield "saved-production30s-stress", baseline["response"], baseline["windows"], baseline["transcriptionOptions"]
    yield "rejected-offline15s-stress", candidates[0]["response"], candidates[0]["windows"], candidates[0]["transcriptionOptions"]
    for row in shorts:
        yield row["filename"], {"text": row["text"]}, row["generationWindows"], row["transcriptionOptions"]


def run():
    registered = audit.read(OUT / "registration.json")
    audit.verify(registered["hashes"])
    if registered["runtime"] != audit.settings():
        raise ValueError("Pinned runtime changed")
    rows = []
    for case_id, response, windows, options in saved_cases():
        original = copy.deepcopy((response, windows, options))
        result = add_review_metadata(response, windows, options, registered["runtime"])
        restored = {key: value for key, value in result.items() if key != "speechReview"}
        if original != (response, windows, options) or restored != response:
            raise ValueError("Original response/input was modified")
        rows.append({"caseId": case_id, "originalResponsePreserved": True, "responseWithOfflineReview": result})
    audit.verify(registered["hashes"])
    report = {"type": "OFFLINE_UNFINISHED_SPEECH_REVIEW_WARNING", "rows": rows,
              "assessedCases": len(rows), "responsePreservation": all(row["originalResponsePreserved"] for row in rows),
              "productionChanged": False, "neuralInference": False, "reservedHoldoutSubmitted": False,
              "inputsUnchanged": True, "recognitionAccuracyImproved": False,
              "limitations": "Inspected saved Marathi development/stress outputs and synthetic controls only. Warning indicates a bound-length window without this helper's ending predicate, not actual omission or incorrect words; recovered unfinished paired tails can warn too. No precision, recall, accuracy or latency claim.",
              "registrationSHA256": base.digest(OUT / "registration.json")}
    base.save_new(OUT / "report.json", report)
    print(json.dumps({"cases": len(rows), "responsesPreserved": True,
                      "warningsByCase": {row["caseId"]: [item["windowIndex"] for item in row["responseWithOfflineReview"]["speechReview"]["windows"] if item["requiresReview"]] for row in rows}}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["register", "run"])
    {"register": register, "run": run}[parser.parse_args().mode]()
