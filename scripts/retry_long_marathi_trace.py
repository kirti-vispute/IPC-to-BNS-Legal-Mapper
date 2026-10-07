"""One separately registered retry, retaining the frozen original trace unchanged."""
import argparse
import sys
from pathlib import Path
from unittest.mock import patch

from scripts import trace_long_marathi_speech as trace

ORIGINAL = trace.OUT
trace.OUT = trace.ROOT / "output/public-speech-validation/long-trace-retry-20261005"


def retry_launcher(original):
    def spawn(argv, *args, **kwargs):
        # Redirect just the frozen parent's worker; event-log subprocesses remain unchanged.
        if argv == [sys.executable, "-m", "scripts.trace_long_marathi_speech", "worker"]:
            argv = [sys.executable, "-m", "scripts.retry_long_marathi_trace", "worker"]
        return original(argv, *args, **kwargs)
    return spawn


def register():
    prior = trace.audit.read(ORIGINAL / "registration.json")
    trace.audit.verify(prior["hashes"])
    if trace.audio_input()[1] != prior["assembly"]:
        raise ValueError("Retry assembly differs")
    paths = [Path(__file__), trace.ROOT / "tests/test_long_speech_retry.py",
             trace.ROOT / "Feature-long-speech-trace-retry-plan.md"]
    paths += [ORIGINAL / name for name in ("registration.json", "events.jsonl", "observation.json", "report.json")]
    trace.OUT.mkdir(exist_ok=False)
    hashes = {**prior["hashes"], **{str(path.relative_to(trace.ROOT)): trace.base.digest(path) for path in paths}}
    trace.base.save_new(trace.OUT / "registration.json", {**prior, "hashes": hashes,
                        "createdAt": trace.baseline.utc(), "priorAttempt": str(ORIGINAL.relative_to(trace.ROOT)),
                        "retryReason": "Recorded sleep/resume interrupted original trace; no settings change"})
    print(f"Registered {len(hashes)} retry input commitments", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["register", "worker", "run"])
    mode = parser.parse_args().mode
    if mode == "register":
        register()
    elif mode == "worker":
        trace.worker()
    else:
        with patch.object(trace.subprocess, "Popen", retry_launcher(trace.subprocess.Popen)):
            trace.run()
