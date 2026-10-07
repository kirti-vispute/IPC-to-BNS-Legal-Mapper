"""Separately register a Blob-upload observation retry; preserve the original failure."""
import argparse
from datetime import datetime, timezone
from scripts import validate_long_speech_review as original

ROOT = original.ROOT
OUT = ROOT / "output/public-speech-validation/long-review-upload-20261006"


def register():
    prior = original.OUT
    registered = original.read(prior / "registration.json")
    hashes = {**registered["hashes"], **original.read(prior / "prepared.json")["hashes"]}
    for path in [prior / name for name in ("prepared.json", "response.json", "http.json", "report.json", "health.json", "integrity.json")] + [
        ROOT / "Feature-long-speech-review-upload-plan.md", ROOT / "scripts/validate_long_review_upload.py",
        ROOT / "scripts/validate_long_review_upload_ui.mjs"]:
        hashes[path.relative_to(ROOT).as_posix()] = original.digest(path)
    original.verify(hashes)
    failed = original.read(prior / "report.json")
    if failed["usable"] or not failed["responseTextParity"] or not failed["reviewParity"]:
        raise ValueError("Unexpected original failure evidence")
    OUT.mkdir(exist_ok=False)
    original.save_new(OUT / "registration.json", {**registered,
        "type": "LONG_MARATHI_REAL_HTTP_UI_UPLOAD_OBSERVER_RETRY", "hashes": hashes,
        "createdAt": datetime.now(timezone.utc).isoformat(), "originalFailurePreserved": True})
    for name in ("stress.wav", "expected.json"):
        with (OUT / name).open("xb") as stream:
            stream.write((prior / name).read_bytes())
    original.save_new(OUT / "prepared.json", {"hashes": {path.relative_to(ROOT).as_posix(): original.digest(path)
        for path in (OUT / "registration.json", OUT / "stress.wav", OUT / "expected.json")}})
    print(f"Registered {len(hashes)} retry input identities; original failure unchanged")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("stage", choices=("register", "audit"))
    args = parser.parse_args()
    if args.stage == "register":
        register()
    else:
        # Reuse the read-only streaming audit, targeting only this new evidence directory.
        original.OUT = OUT
        original.audit()
