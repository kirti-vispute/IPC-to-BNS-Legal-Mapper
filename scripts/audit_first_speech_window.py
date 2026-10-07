"""Limit saved-result audit consumption to its first actual split window."""
import argparse
import json
from pathlib import Path
from unittest.mock import patch

from faster_whisper import WhisperModel
from scripts import audit_final_speech_window as original

ROOT, base, audit = original.ROOT, original.base, original.audit
PRIOR = original.OUT
OUT = PRIOR.parent / "tail-audit-first-window-20261006"
GENERATE = WhisperModel.generate_segments


def first_window(method):
    def collect(model, features, tokenizer, *args, **kwargs):
        iterator = method(model, features, tokenizer, *args, **kwargs)
        emitted = 0
        try:
            for segment in iterator:
                if len(model.splits) != 1:
                    raise ValueError("Unexpected additional split in first-window collector")
                emitted += 1
                yield segment
                expected = sum(item["start"] != item["end"] and bool(tokenizer.decode(item["tokens"]).strip())
                               for item in model.splits[0]["segments"])
                if emitted == expected:
                    return
        finally:
            iterator.close()
    return collect


def register():
    hashes = dict(audit.read(PRIOR / "registration.json")["hashes"])
    audit.verify(hashes)
    audit.verify(audit.read(audit.PROTECTED))
    paths = [Path(__file__), ROOT / "tests/test_first_speech_window.py", ROOT / "Feature-speech-tail-replay-plan.md",
             PRIOR / "registration.json", PRIOR / "failure.json"]
    hashes.update({str(path.relative_to(ROOT)): base.digest(path) for path in paths})
    OUT.mkdir(exist_ok=False)
    base.save_new(OUT / "registration.json", {"type": "READ_ONLY_FIRST_WINDOW_CONTROL_REPLAY",
                  "createdAt": original.trace.baseline.utc(), "hashes": hashes, "settings": audit.settings()})
    print(json.dumps({"registeredInputs": len(hashes), "inference": False}))


def run():
    original.OUT = OUT
    with patch.object(WhisperModel, "generate_segments", first_window(GENERATE)):
        original.run()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["register", "run"])
    {"register": register, "run": run}[parser.parse_args().mode]()
