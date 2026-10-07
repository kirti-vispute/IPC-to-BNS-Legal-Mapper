"""Record actual converted decoder cap semantics without optional score buffers."""
import argparse
import json
from pathlib import Path

from scripts import probe_marathi_decoder as first
from scripts import probe_marathi_decoder_retry as retry

ROOT, base, prior = first.ROOT, first.base, first.prior
OUT = ROOT / "output/public-speech-validation/marathi-decoder-length-20261005"


def register():
    retry.verified()
    paths = [ROOT / "Feature-marathi-decoder-length-plan.md", Path(__file__),
             retry.OUT / "registration.json", retry.OUT / "failure.json",
             first.OUT / "source.json", first.OUT / "registration.json"]
    OUT.mkdir(exist_ok=False)
    base.save_new(OUT / "registration.json", {"type": "CONVERTED_LENGTH_SEMANTICS",
        "hashes": {str(path.relative_to(ROOT)): base.digest(path) for path in paths},
        "sourceReused": True, "reservedHoldoutSubmitted": False, "productionChanged": False})
    print(json.dumps({"registered": True, "files": len(paths)}))


def verified():
    retry.verified()
    reg = json.loads((OUT / "registration.json").read_text(encoding="utf-8"))
    if any(base.digest(ROOT / name) != expected for name, expected in reg["hashes"].items()):
        raise ValueError("Registered length probe input changed")
    return reg


def run():
    from faster_whisper import WhisperModel
    verified()
    reg = first.verified()
    model = WhisperModel(str(prior.TARGET), device="cpu", compute_type="int8", cpu_threads=4,
                         local_files_only=True)
    encoded = model.encode(first.shared_feature(reg))
    rows = []
    for label, prefix in first.PROMPTS.items():
        for cap in (1, len(prefix) + 1):
            for beam in (1, 3):
                for suppression in ("observed", "none"):
                    row = {"prefix": label, "maxLength": cap, "beam": beam, "suppression": suppression}
                    try:
                        result = model.model.generate(encoded, [prefix], beam_size=beam, patience=1,
                            length_penalty=1, max_length=cap, suppress_blank=True,
                            suppress_tokens=reg["suppressTokens"] if suppression == "observed" else [],
                            return_scores=True, return_logits_vocab=False)[0]
                        row["generated"] = [int(i) for i in result.sequences_ids[0]]
                        row["scores"] = [float(i) for i in result.scores]
                        row["generatedCount"] = len(row["generated"])
                    except (ValueError, RuntimeError) as error:
                        row["error"] = {"type": type(error).__name__, "detail": str(error)}
                    rows.append(row)
                    print(json.dumps(row), flush=True)
    verified()
    base.save_new(OUT / "converted.json", {"rows": rows, "computeType": "int8", "suppressBlankRetained": True})
    source = json.loads((first.OUT / "source.json").read_text(encoding="utf-8"))
    base.save_new(OUT / "report.json", {"type": "CONVERTED_LENGTH_AND_PREFIX_DIAGNOSTIC",
        "registrationSHA256": base.digest(OUT / "registration.json"),
        "sourceSHA256": base.digest(first.OUT / "source.json"), "convertedSHA256": base.digest(OUT / "converted.json"),
        "sourceMaskDifferences": source["maskDifferences"], "convertedRows": len(rows),
        "oneTokenRows": sum(row.get("generatedCount") == 1 for row in rows),
        "errorRows": sum("error" in row for row in rows),
        "productionChanged": False, "reservedHoldoutSubmitted": False,
        "limitations": "One inspected telephone clip; optional converted vocabulary distribution unavailable; one-token beam truncation differs from full-sequence search. No speech/legal accuracy, speed or conversion-cause claim."})


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("register", "run"))
    {"register": register, "run": run}[parser.parse_args().mode]()
