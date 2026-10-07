"""Replay saved speech decisions through installed controls, without ASR inference."""
import argparse
import copy
import json
import logging
from dataclasses import asdict
from pathlib import Path
from types import SimpleNamespace

import numpy as np
from faster_whisper import WhisperModel
from faster_whisper.tokenizer import Tokenizer
from tokenizers import Tokenizer as NativeTokenizer

from scripts import audit_speech_continuation as audit
from scripts import trace_long_marathi_speech as trace
from scripts.inspect_marathi_segments import Capture

ROOT, base = audit.ROOT, trace.base
OUT = ROOT / "output/public-speech-validation/tail-audit-20261006"
CANDIDATE = OUT.parent / "short-window-20261005"
BASELINE = OUT.parent / "long-trace-retry-20261005"


def replay_window(window, options, tokenizer, frame_limit):
    if (window["tokenCount"] != len(window["tokens"]) or not window["tokens"]
            or window["inputEndFrame"] != window["seekBeforeFrame"] + window["segmentFrames"]
            or not 0 < window["segmentFrames"] <= frame_limit <= 3000):
        raise ValueError("Invalid saved window")
    original = copy.deepcopy(window)
    opts = SimpleNamespace(**copy.deepcopy(options))
    if opts.temperatures != [0] or opts.word_timestamps or opts.multilingual:
        raise ValueError("Only the saved single-temperature timestamped path is audited")
    opts.clip_timestamps = [window["seekBeforeFrame"] / 100]
    capture = Capture()

    class SavedResult:
        def __init__(self):
            self.calls = []

        def generate(self, encoder, prompts, **kwargs):
            self.calls.append({"prompts": prompts, "options": kwargs})
            count = len(window["tokens"])
            score = window["avgLogprob"] * (count + 1) / count ** opts.length_penalty
            return [SimpleNamespace(sequences_ids=[list(window["tokens"])], scores=[score],
                                    no_speech_prob=window["noSpeechProbability"])]

    class ReplayModel(WhisperModel):
        def __init__(self):
            # Only the original control methods run; no neural runtime is constructed.
            self.model = SavedResult()
            self.logger = logging.Logger("saved-window-replay", level=logging.DEBUG)
            self.logger.handlers = [capture]
            self.feature_extractor = SimpleNamespace(nb_max_frames=frame_limit, time_per_frame=0.01)
            self.max_length, self.input_stride, self.frames_per_second, self.time_precision = 448, 2, 100, 0.02
            self.encodings, self.splits = [], []

        def encode(self, features):
            real = window["segmentFrames"]
            self.encodings.append({"shape": list(features.shape), "realFrames": real,
                                   "zeroPaddedFrames": features.shape[-1] - real,
                                   "zeroPaddingFraction": (features.shape[-1] - real) / features.shape[-1],
                                   "paddingIsZero": bool(np.all(features[:, real:] == 0))})
            return object()

        def _split_segments_by_timestamps(self, *args, **kwargs):
            result = super()._split_segments_by_timestamps(*args, **kwargs)
            self.splits.append({"segments": result[0], "seekAfterFrame": result[1], "singleTimestampEnding": result[2]})
            return result

    features = np.zeros((80, window["inputEndFrame"] + 1), dtype=np.float32)
    features[:, window["seekBeforeFrame"]:window["inputEndFrame"]] = 1
    model = ReplayModel()
    segments = [asdict(segment) for segment in model.generate_segments(features, tokenizer, opts, False)]
    if len(model.model.calls) != 1 or model.model.calls[0]["prompts"] != [window["promptTokens"]]:
        raise ValueError("Replay generation count/prompt differs")
    if window != original:
        raise ValueError("Replay mutated saved input")
    if any(abs(segment["avg_logprob"] - window["avgLogprob"]) > 1e-9 for segment in segments):
        raise ValueError("Reconstructed score differs")
    return {"window": window["window"], "stubGenerationCalls": len(model.model.calls),
            "encodings": model.encodings, "splits": model.splits, "segments": segments, "logs": capture.records,
            "generationOptions": model.model.calls[0]["options"], "tokensUnchanged": True,
            "actualText": tokenizer.decode(window["tokens"]), "savedText": window["decodedText"]}


def register():
    audit.verify(audit.read(audit.PROTECTED))
    hashes = {}
    for directory in (CANDIDATE, BASELINE):
        prior = audit.read(directory / "registration.json")["hashes"]
        audit.verify(prior)
        if any(path in hashes and hashes[path] != value for path, value in prior.items()):
            raise ValueError("Prior identity conflict")
        hashes.update(prior)
    from faster_whisper import transcribe
    package = ROOT / ".venv-speech/Lib/site-packages/faster_whisper"
    if package / "transcribe.py" != Path(transcribe.__file__):
        raise ValueError("Unexpected installed runtime")
    paths = [ROOT / "scripts/audit_final_speech_window.py", ROOT / "tests/test_final_speech_window.py",
             ROOT / "Feature-speech-tail-audit-plan.md", audit.PROTECTED, package / "audio.py",
             package / "feature_extractor.py", package / "transcribe.py", package / "tokenizer.py"]
    for directory in (CANDIDATE, BASELINE):
        paths += [directory / name for name in ("registration.json", "report.json", "events.jsonl")]
    paths += [CANDIDATE / "observations.jsonl", BASELINE / "observation.json"]
    hashes.update({str(path.relative_to(ROOT)): base.digest(path) for path in paths})
    OUT.mkdir(exist_ok=False)
    base.save_new(OUT / "registration.json", {"type": "READ_ONLY_SAVED_WINDOW_CONTROL_REPLAY",
                  "createdAt": trace.baseline.utc(), "hashes": hashes, "settings": audit.settings()})
    print(json.dumps({"registeredInputs": len(hashes), "inference": False}))


def run():
    registered = audit.read(OUT / "registration.json")
    audit.verify(registered["hashes"])
    if registered["settings"] != audit.settings():
        raise ValueError("Production defaults changed")
    if not audit.read(CANDIDATE / "report.json")["comparisonUsable"] or not audit.read(BASELINE / "report.json")["traceUsable"]:
        raise ValueError("Unusable saved evidence")
    candidate = [json.loads(line) for line in (CANDIDATE / "observations.jsonl").read_text(encoding="utf-8").splitlines()]
    stress = [row for row in candidate if row["caseId"] == "long-stress"]
    if len(stress) != 1:
        raise ValueError("Expected one saved stress identity")
    baseline = audit.read(BASELINE / "observation.json")
    tokenizer = Tokenizer(NativeTokenizer.from_file(str(base.MODEL / "tokenizer.json")), True, task="transcribe", language="mr")
    all_rows = []
    for label, row, limit, directory in (("candidate15s", stress[0], 1500, CANDIDATE), ("baseline30s", baseline, 3000, BASELINE)):
        events = [json.loads(line) for line in (directory / "events.jsonl").read_text(encoding="utf-8").splitlines()]
        split_events = [item for item in events if item["kind"] == "split" and item.get("caseId", "long-stress") == "long-stress"]
        for window in row["windows"]:
            result = replay_window(window, row["transcriptionOptions"], tokenizer, limit)
            event = next(item for item in split_events if item["window"] == window["window"])
            split = result["splits"][0]
            segments = [{key: segment[key] for key in ("start", "end", "tokens")} for segment in split["segments"]]
            result["splitEventParity"] = (segments == event["segments"]
                and split["seekAfterFrame"] == event["seekAfterFrame"]
                and split["singleTimestampEnding"] == event["singleTimestampEnding"])
            result["path"] = label
            result["sameDecodedText"] = result["actualText"] == result["savedText"]
            result["sameSeek"] = split["seekAfterFrame"] == window["seekAfterFrame"]
            all_rows.append(result)
    usable = len(all_rows) == 8 and all(row["splitEventParity"] and row["sameDecodedText"] and row["sameSeek"] for row in all_rows)
    audit.verify(registered["hashes"])
    report = {"type": "READ_ONLY_SAVED_WINDOW_CONTROL_REPLAY", "auditUsable": usable, "rows": all_rows,
              "productionChanged": False, "modelInitialized": False, "neuralInference": False,
              "reservedHoldoutSubmitted": False, "inputsUnchanged": True,
              "limitations": "Saved-result stubs and dummy features reproduce library control paths only, not the neural/acoustic cause of tokens or actual feature values. Raw splits precede VAD timestamp restoration.",
              "registrationSHA256": base.digest(OUT / "registration.json")}
    base.save_new(OUT / "report.json", report)
    print(json.dumps({"auditUsable": usable, "windows": len(all_rows), "inference": False}))
    if not usable:
        raise SystemExit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["register", "run"])
    {"register": register, "run": run}[parser.parse_args().mode]()
