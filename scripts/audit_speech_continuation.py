"""Inspect saved production-style evidence and real continuation code without ASR."""
import argparse
import ast
import inspect
import json
from importlib.metadata import version
from pathlib import Path
from types import SimpleNamespace

from scripts.assess_marathi_decoder import ROOT, digest, save_new

OUT = ROOT / "output/public-speech-validation/continuation-audit-20261005"
PRIOR = ROOT / "output/public-speech-validation/segment-diagnostic-20261004"
PROTECTED = ROOT / "output/translation-model-assessment/before-hashes.json"
TIMESTAMP_BEGIN = 50364


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def verify(hashes):
    changed = [name for name, expected in hashes.items() if digest(ROOT / name) != expected]
    if changed:
        raise ValueError(f"Registered inputs changed: {changed}")


def settings():
    from faster_whisper import WhisperModel
    versions = {name: version(name) for name in ("faster-whisper", "ctranslate2")}
    if versions != {"faster-whisper": "1.2.1", "ctranslate2": "4.8.2"}:
        raise ValueError("Runtime differs from the versioned bound/continuation evidence")
    tree = ast.parse(inspect.getsource(WhisperModel))
    init = next(node for node in tree.body[0].body if isinstance(node, ast.FunctionDef) and node.name == "__init__")
    constants = {}
    for node in ast.walk(init):
        if isinstance(node, ast.Assign) and isinstance(node.value, ast.Constant):
            for target in node.targets:
                if isinstance(target, ast.Attribute) and isinstance(target.value, ast.Name) and target.value.id == "self":
                    constants[target.attr] = node.value.value
    signature = inspect.signature(WhisperModel.transcribe)
    defaults = {key: signature.parameters[key].default for key in (
        "max_new_tokens", "without_timestamps", "word_timestamps", "chunk_length")}
    worker = ast.parse((ROOT / "backend/speech/transcribe.py").read_text(encoding="utf-8"))
    calls = [node for node in ast.walk(worker) if isinstance(node, ast.Call)
             and isinstance(node.func, ast.Attribute) and node.func.attr == "transcribe"]
    if len(calls) != 1:
        raise ValueError("Production transcription path changed")
    kwargs = {item.arg: item.value for item in calls[0].keywords}
    if any(key in kwargs for key in defaults):
        raise ValueError("Production now overrides audited library defaults")
    expected = {"task": "transcribe", "beam_size": 3, "temperature": 0,
                "vad_filter": True, "condition_on_previous_text": False}
    if any(ast.literal_eval(kwargs[key]) != value for key, value in expected.items()):
        raise ValueError("Production decoding settings changed")
    cap = constants["max_length"]
    return {**defaults, **expected, "packageVersions": versions, "max_length": cap,
            "input_stride": constants["input_stride"], "time_precision": constants["time_precision"],
            "selectedMarathiPrompt": [50258, 50320, 50359],
            "sourceDerivedStepBound": min(cap // 2, cap - 2)}


def split(tokens, seek=0, size=3000):
    from faster_whisper import WhisperModel
    current = settings()
    model = SimpleNamespace(input_stride=current["input_stride"], time_precision=current["time_precision"])
    tokenizer = SimpleNamespace(timestamp_begin=TIMESTAMP_BEGIN)
    return WhisperModel._split_segments_by_timestamps(
        model, tokenizer, list(tokens), seek / 100, size, size / 100, seek)


def summarize(report, cap):
    if report.get("diagnosticUsable") is not True:
        raise ValueError("Unusable prior evidence")
    rows = report["rows"]
    if len(rows) != 8 or len({row["filename"] for row in rows}) != 8:
        raise ValueError("Expected eight distinct inspected development clips")
    result = []
    for row in rows:
        options = row["transcriptionOptions"]
        if (options["max_new_tokens"] is not None or options["without_timestamps"] is not False
                or options["word_timestamps"] is not False or options["condition_on_previous_text"] is not False):
            raise ValueError("Saved evidence differs from production-style defaults")
        windows = row["generationWindows"]
        if not windows or any(window["promptTokens"] != [50258, 50320, 50359] for window in windows):
            raise ValueError("Unexpected generation prompt")
        lengths = [len(window["tokens"]) for window in windows]
        result.append({"filename": row["filename"], "duration": row["duration"],
                       "durationAfterVad": row["durationAfterVad"], "tokenLengths": lengths,
                       "windows": len(windows), "segments": len(row["segments"]),
                       "atStepBound": any(length >= cap for length in lengths),
                       "baselineTextParity": row["baselineTextParity"],
                       "skippedWindows": row["actualSkipLogCount"]})
    return result


def register():
    from faster_whisper import transcribe
    verify(read(PROTECTED))
    verify(read(PRIOR / "registration.json")["hashes"])
    matched = ROOT / "output/public-speech-validation/marathi-matched-cap-20261005"
    verify(read(matched / "registration.json")["hashes"])
    package = Path(transcribe.__file__).parent
    paths = [Path(__file__), ROOT / "tests/test_speech_continuation.py",
             ROOT / "Feature-speech-continuation-audit-plan.md", PROTECTED,
             ROOT / "backend/speech/transcribe.py", ROOT / "backend/core/transcriber.js",
             ROOT / "backend/server.js", ROOT / "frontend/app.js",
             PRIOR / "registration.json", PRIOR / "observations.jsonl", PRIOR / "report.json",
             matched / "registration.json", matched / "report.json",
             package / "transcribe.py", package / "tokenizer.py", package / "feature_extractor.py",
             package.parent / "ctranslate2/version.py", package.parent / "ctranslate2/ctranslate2.dll",
             package.parent / "ctranslate2/_ext.cp312-win_amd64.pyd"]
    OUT.mkdir(exist_ok=False)
    save_new(OUT / "registration.json", {"type": "READ_ONLY_SPEECH_CONTINUATION_AUDIT",
                                          "hashes": {str(path.relative_to(ROOT)): digest(path) for path in paths}})
    print(json.dumps({"registered": len(paths)}))


def run():
    registered = read(OUT / "registration.json")
    verify(registered["hashes"])
    current = settings()
    cap = current["sourceDerivedStepBound"]
    tb = TIMESTAMP_BEGIN
    patterns = {"no_timestamp_pairs_at_bound": [tb] + [100] * (cap - 1),
                "single_ending_timestamp_at_bound": [tb] + [100] * (cap - 2) + [tb + 50],
                "unfinished_tail_after_pair": [tb, 100, tb + 100, tb + 100, 101],
                "complete_paired_segments": [tb, 100, tb + 100, tb + 100, 101, tb + 200]}
    synthetic = {}
    for name, tokens in patterns.items():
        segments, seek, ending = split(tokens)
        synthetic[name] = {"syntheticNotSpeech": True, "inputTokens": len(tokens),
                           "nextSeekFrame": seek, "singleTimestampEnding": ending,
                           "segments": [{key: segment[key] for key in ("start", "end")} for segment in segments]}
    rows = summarize(read(PRIOR / "report.json"), cap)
    verify(registered["hashes"])
    protected = read(PROTECTED)
    verify(protected)
    holdout = ROOT / "output/public-speech-validation/beam2-assessment-20261003"
    absent = all(not (holdout / name).exists() for name in ("holdout-decoding.jsonl", "holdout-assessment.json"))
    if not absent:
        raise ValueError("Reserved holdout output unexpectedly exists")
    save_new(OUT / "report.json", {"type": "READ_ONLY_SPEECH_CONTINUATION_AUDIT", "settings": current,
                                   "savedDevelopmentObservations": rows, "syntheticControlFlow": synthetic,
                                   "observedBoundHits": sum(row["atStepBound"] for row in rows),
                                   "protectedFilesUnchanged": len(protected), "registeredInputsUnchanged": True,
                                   "reservedHoldoutOutputsAbsent": absent, "newAsrInference": False,
                                   "productionChanged": False,
                                   "limitations": "Short saved Marathi clips; no observed cap exhaustion or long-recording acoustic coverage. Synthetic seek behavior is not speech accuracy."})
    print(json.dumps({"savedClips": len(rows), "observedBoundHits": sum(row["atStepBound"] for row in rows),
                      "protectedUnchanged": len(protected), "newAsrInference": False}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["register", "run"])
    args = parser.parse_args()
    register() if args.mode == "register" else run()
