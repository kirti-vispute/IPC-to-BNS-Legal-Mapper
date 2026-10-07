"""Preserve token evidence when optional CTranslate2 scores have no buffer."""
import argparse
import json
from pathlib import Path

from scripts import probe_marathi_decoder as first

ROOT, base, prior = first.ROOT, first.base, first.prior
OUT = ROOT / "output/public-speech-validation/marathi-decoder-probe-retry-20261005"


def buffer_available(interface):
    data = interface.get("data") if isinstance(interface, dict) else None
    return isinstance(data, (tuple, list)) and len(data) > 0 and isinstance(data[0], int) and data[0] != 0


def register():
    first.verified()
    paths = [ROOT / "Feature-marathi-decoder-retry-plan.md", Path(__file__),
             ROOT / "tests/test_marathi_decoder_retry.py", first.OUT / "registration.json",
             first.OUT / "source.json", first.OUT / "failed-converted-attempt.json"]
    OUT.mkdir(exist_ok=False)
    base.save_new(OUT / "registration.json", {"type": "CONVERTED_PREFIX_PROBE_RETRY",
        "hashes": {str(path.relative_to(ROOT)): base.digest(path) for path in paths},
        "sourceReused": True, "reservedHoldoutSubmitted": False, "productionChanged": False})
    print(json.dumps({"registered": True, "files": len(paths)}))


def verified():
    reg = json.loads((OUT / "registration.json").read_text(encoding="utf-8"))
    first.verified()
    if any(base.digest(ROOT / name) != expected for name, expected in reg["hashes"].items()):
        raise ValueError("Retry input changed")
    return reg


def run():
    import numpy as np
    from faster_whisper import WhisperModel

    verified()
    reg = first.verified()
    model = WhisperModel(str(prior.TARGET), device="cpu", compute_type="int8", cpu_threads=4,
                         local_files_only=True)
    encoded = model.encode(first.shared_feature(reg))
    rows = []
    for label, prefix in first.PROMPTS.items():
        for beam in (1, 3):
            for suppression in ("observed", "none"):
                result = model.model.generate(encoded, [prefix], beam_size=beam, patience=1,
                    length_penalty=1, max_length=len(prefix) + 1, suppress_blank=True,
                    suppress_tokens=reg["suppressTokens"] if suppression == "observed" else [],
                    return_scores=True, return_logits_vocab=True)[0]
                row = {"prefix": label, "beam": beam, "suppression": suppression,
                       "generated": [int(i) for i in result.sequences_ids[0]],
                       "scores": [float(i) for i in result.scores]}
                if len(row["generated"]) > 1:
                    raise ValueError("One-token probe generated more than one token")
                storage = result.logits
                row["logitsShape"] = list(storage.shape)
                row["logitsBufferAvailable"] = buffer_available(storage.__array_interface__)
                if row["logitsBufferAvailable"]:
                    try:
                        values = np.asarray(storage)
                        if values.size and values.shape[-1] == 51865:
                            row["vocabularyTop10"] = [first.top_indices(v, allow_negative_infinity=True)
                                                       for v in values.reshape(-1, 51865)]
                    except (ValueError, TypeError) as error:
                        row["optionalLogitsError"] = str(error)
                else:
                    row["optionalLogitsError"] = "No readable vocabulary buffer returned"
                rows.append(row)
                print(json.dumps({k: row[k] for k in ("prefix", "beam", "suppression", "generated", "logitsBufferAvailable")}), flush=True)
    verified()
    base.save_new(OUT / "converted.json", {"rows": rows, "computeType": "int8", "suppressBlankRetained": True})
    source = json.loads((first.OUT / "source.json").read_text(encoding="utf-8"))
    base.save_new(OUT / "report.json", {"type": "COMPLETED_PREFIX_PROBE_RETRY",
        "registrationSHA256": base.digest(OUT / "registration.json"),
        "sourceSHA256": base.digest(first.OUT / "source.json"), "convertedSHA256": base.digest(OUT / "converted.json"),
        "sourceMaskDifferences": source["maskDifferences"], "convertedRows": len(rows),
        "convertedVocabularyRows": sum("vocabularyTop10" in row for row in rows),
        "productionChanged": False, "reservedHoldoutSubmitted": False,
        "limitations": "One inspected telephone clip; one-token beam truncation differs from full-sequence beam search. Optional vocabulary scores can be unavailable. No recognition/legal accuracy, speed or conversion-cause claim."})


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("register", "run"))
    {"register": register, "run": run}[parser.parse_args().mode]()
