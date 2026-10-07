"""Streaming scoped-source audit; never refresh historical commitments."""
from pathlib import Path
from scripts.validate_long_speech_review import read, digest, save_new, canonical_hashes, reserved_outputs

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/public-speech-validation/voice-selection-20261006"

if __name__ == "__main__":
    inputs = [Path(__file__), OUT / "before.json", OUT / "live/registration.json", OUT / "live/report.json"]
    save_new(OUT / "integrity-registration.json", {"hashes": {path.relative_to(ROOT).as_posix(): digest(path) for path in inputs}})
    before = read(OUT / "before.json")
    changes, unexpected = [], []
    for name, expected in canonical_hashes(before["hashes"]).items():
        actual = digest(ROOT / name)
        if actual != expected:
            row = {"file": name, "beforeSHA256": expected, "afterSHA256": actual}
            (changes if name in before["allowedProductionChanges"] else unexpected).append(row)
    live = read(OUT / "live/registration.json")
    registered_changes = [name for name, expected in live["hashes"].items() if digest(ROOT / name) != expected]
    backup_verified = digest(OUT / "app.js.before") == before["hashes"]["frontend/app.js"]
    result = {"checkedBeforeInputs": len(before["hashes"]), "authorizedProductionChanges": changes,
        "unexpectedChanges": unexpected, "registeredInputChanges": registered_changes,
        "beforeCopyVerified": backup_verified, "reservedOutputsPresent": reserved_outputs(),
        "usable": len(changes) == 1 and changes[0]["file"] == "frontend/app.js" and not unexpected
            and not registered_changes and backup_verified and not reserved_outputs()}
    save_new(OUT / "integrity.json", result)
    print(result)
    if not result["usable"]:
        raise SystemExit(1)
