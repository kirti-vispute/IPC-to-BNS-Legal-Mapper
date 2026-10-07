"""Read-only candidate provenance checks; never loads a model or custom code."""
import argparse
import hashlib
import json
import platform
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
METADATA = ROOT / "scripts/translation-candidates/indictrans2-200m.json"


def check_files(folder, metadata):
    required = metadata["requiredFiles"]
    rows = []
    for name, expected in required.items():
        # The pinned manifest is data, never a source of executable paths.
        if Path(name).name != name or name in [".", ".."]:
            raise ValueError("Manifest filenames must be plain basenames")
        path = folder / name if folder else None
        if not path or not path.is_file():
            rows.append({"file": name, "status": "MISSING"})
            continue
        size = path.stat().st_size
        if size != expected["size"]:
            rows.append({"file": name, "status": "SIZE_MISMATCH", "actualBytes": size})
            continue
        sha = hashlib.sha256()
        blob = hashlib.sha1(f"blob {size}\0".encode("ascii"))
        with path.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                sha.update(chunk)
                blob.update(chunk)
        matches = sha.hexdigest() == expected["sha256"] if "sha256" in expected else blob.hexdigest() == expected["gitBlob"]
        rows.append({"file": name, "status": "VERIFIED" if matches else "HASH_MISMATCH", "sha256": sha.hexdigest()})
    extras = sorted(p.name for p in folder.glob("*.py") if p.name not in required) if folder and folder.is_dir() else []
    complete = bool(rows) and all(row["status"] == "VERIFIED" for row in rows)
    return {"type": "OFFLINE_CANDIDATE_PROVENANCE_CHECK", "modelId": metadata["modelId"],
            "revision": metadata["revision"], "folder": str(folder) if folder else None,
            "officialFilesVerified": complete, "extraPythonFiles": extras, "readyForInference": False,
            "status": "FILES_VERIFIED_REVIEW_PENDING" if complete else "LOCAL_FILES_MISSING_OR_INVALID",
            "limitations": ["File identity is not model quality or legal accuracy.",
                            "Custom implementation must be reviewed before any execution.",
                            "Access conditions must be accepted by the account holder, not inferred from file presence.",
                            "The upstream toolkit does not claim Windows support; use an independently validated isolated environment."],
            "platform": platform.system(), "files": rows}


def write_evidence(path, report):
    with path.open("x", encoding="utf-8") as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2)
        stream.write("\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-dir", type=Path, help="Official snapshot downloaded by the account holder")
    parser.add_argument("--output", help="Fresh report basename under output/indictrans2-readiness/")
    args = parser.parse_args()
    if args.output and not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9-]{0,63}\.json", args.output):
        parser.error("Use a plain alphanumeric/hyphen JSON report name")
    metadata = json.loads(METADATA.read_text(encoding="utf-8"))
    report = check_files(args.model_dir.resolve() if args.model_dir else None, metadata)
    if args.output:
        out = ROOT / "output/indictrans2-readiness"
        out.mkdir(parents=True, exist_ok=True)
        write_evidence(out / args.output, report)
    print(json.dumps(report, ensure_ascii=True, indent=2))
    # Successful checks still do not authorize loading the unreviewed implementation.
    return 0 if report["officialFilesVerified"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
