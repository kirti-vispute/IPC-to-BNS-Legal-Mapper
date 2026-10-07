"""Capture raw hypotheses including empty returns, with no output-length assumption."""
import argparse
import json
from pathlib import Path

from scripts import probe_marathi_decoder_length as previous

ROOT, base, prior = previous.ROOT, previous.base, previous.prior
first = previous.first
OUT = ROOT / "output/public-speech-validation/marathi-decoder-observe-20261005"


def register():
    previous.verified()
    paths = [ROOT / "Feature-marathi-decoder-observe-plan.md", Path(__file__),
             previous.OUT / "registration.json", previous.OUT / "failure.json"]
    OUT.mkdir(exist_ok=False)
    base.save_new(OUT / "registration.json", {"type": "RAW_CONVERTED_PREFIX_OBSERVATION",
        "hashes": {str(path.relative_to(ROOT)): base.digest(path) for path in paths},
        "productionChanged": False, "reservedHoldoutSubmitted": False})
    print(json.dumps({"registered": True, "files": len(paths)}))


def verified():
    previous.verified()
    reg = json.loads((OUT / "registration.json").read_text(encoding="utf-8"))
    if any(base.digest(ROOT / name) != expected for name, expected in reg["hashes"].items()):
        raise ValueError("Registered raw-observer input changed")
    return reg


def run():
    from faster_whisper import WhisperModel
    verified()
    reg = first.verified()
    model = WhisperModel(str(prior.TARGET), device="cpu", compute_type="int8", cpu_threads=4,
                         local_files_only=True)
    encoded = model.encode(first.shared_feature(reg))
    rows = []
    with (OUT / "observations.jsonl").open("x", encoding="utf-8") as log:
        for label, prefix in first.PROMPTS.items():
            for cap in (1, len(prefix) + 1):
                for beam in (1, 3):
                    for suppression in ("observed", "none"):
                        row = {"prefix": label, "prompt": prefix, "maxLength": cap,
                               "beam": beam, "suppression": suppression}
                        try:
                            result = model.model.generate(encoded, [prefix], beam_size=beam, patience=1,
                                length_penalty=1, max_length=cap, suppress_blank=True,
                                suppress_tokens=reg["suppressTokens"] if suppression == "observed" else [],
                                return_scores=True, return_logits_vocab=False)[0]
                            row["sequencesIds"] = [[int(i) for i in seq] for seq in result.sequences_ids]
                            row["scores"] = [float(i) for i in result.scores]
                        except Exception as error:
                            row["error"] = {"type": type(error).__name__, "detail": str(error)}
                        rows.append(row)
                        value = json.dumps(row, allow_nan=False)
                        log.write(value + "\n")
                        log.flush()
                        print(value, flush=True)
    verified()
    base.save_new(OUT / "report.json", {"type": "RAW_CONVERTED_PREFIX_OBSERVATION",
        "registrationSHA256": base.digest(OUT / "registration.json"),
        "sourceSHA256": base.digest(first.OUT / "source.json"), "rowsSHA256": base.digest(OUT / "observations.jsonl"),
        "rows": len(rows), "errors": sum("error" in row for row in rows),
        "productionChanged": False, "reservedHoldoutSubmitted": False,
        "limitations": "One inspected clip, raw hypotheses, no converted vocabulary distribution; no full-sequence/accuracy/speed/conversion-cause claim."})


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("register", "run"))
    {"register": register, "run": run}[parser.parse_args().mode]()
