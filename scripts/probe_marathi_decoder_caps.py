"""Verify actual one-new-token output using documented CT2 4.8.2 cap semantics."""
import argparse
import json
from pathlib import Path

from scripts import probe_marathi_decoder_observe as previous

ROOT, base, prior, first = previous.ROOT, previous.base, previous.prior, previous.first
OUT = ROOT / "output/public-speech-validation/marathi-decoder-cap-20261005"


def cap_for_one_token(text_prefix_length):
    if not isinstance(text_prefix_length, int) or text_prefix_length < 0:
        raise ValueError("Invalid supplied text length")
    return max(2 * (text_prefix_length + 1), text_prefix_length + 4)


def register():
    previous.verified()
    paths = [ROOT / "Feature-marathi-decoder-cap-plan.md", Path(__file__),
             ROOT / "tests/test_marathi_decoder_caps.py", previous.OUT / "registration.json",
             previous.OUT / "report.json", previous.OUT / "observations.jsonl"]
    OUT.mkdir(exist_ok=False)
    base.save_new(OUT / "registration.json", {"type": "VERIFIED_ONE_NEW_TOKEN_PROBE",
        "hashes": {str(path.relative_to(ROOT)): base.digest(path) for path in paths},
        "productionChanged": False, "reservedHoldoutSubmitted": False})
    print(json.dumps({"registered": True, "files": len(paths)}))


def verified():
    previous.verified()
    reg = json.loads((OUT / "registration.json").read_text(encoding="utf-8"))
    if any(base.digest(ROOT / name) != expected for name, expected in reg["hashes"].items()):
        raise ValueError("Registered cap probe changed")
    return reg


def run():
    from faster_whisper import WhisperModel
    verified()
    reg = first.verified()
    model = WhisperModel(str(prior.TARGET), device="cpu", compute_type="int8", cpu_threads=4, local_files_only=True)
    encoded = model.encode(first.shared_feature(reg))
    rows = []
    with (OUT / "observations.jsonl").open("x", encoding="utf-8") as log:
        for label, prefix in first.PROMPTS.items():
            supplied = prefix[len(prior.PROMPT):]
            cap = cap_for_one_token(len(supplied))
            for beam in (1, 3):
                for suppression in ("observed", "none"):
                    row = {"prefix": label, "maxLength": cap, "beam": beam, "suppression": suppression}
                    try:
                        result = model.model.generate(encoded, [prefix], beam_size=beam, patience=1,
                            length_penalty=1, max_length=cap, suppress_blank=True,
                            suppress_tokens=reg["suppressTokens"] if suppression == "observed" else [],
                            return_scores=True, return_logits_vocab=False)[0]
                        row["sequencesIds"] = [[int(i) for i in seq] for seq in result.sequences_ids]
                        row["scores"] = [float(i) for i in result.scores]
                        seq = row["sequencesIds"][0] if row["sequencesIds"] else []
                        row["suppliedTextPrefixVerified"] = seq[:len(supplied)] == supplied
                        row["continuation"] = seq[len(supplied):] if row["suppliedTextPrefixVerified"] else None
                        row["oneNewTokenVerified"] = row["continuation"] is not None and len(row["continuation"]) == 1
                    except Exception as error:
                        row["error"] = {"type": type(error).__name__, "detail": str(error)}
                    rows.append(row)
                    value = json.dumps(row, allow_nan=False)
                    log.write(value + "\n")
                    log.flush()
                    print(value, flush=True)
    verified()
    base.save_new(OUT / "report.json", {"type": "VERIFIED_ONE_NEW_TOKEN_PROBE", "rows": len(rows),
        "verifiedOneNewTokenRows": sum(row.get("oneNewTokenVerified", False) for row in rows),
        "errors": sum("error" in row for row in rows),
        "registrationSHA256": base.digest(OUT / "registration.json"),
        "sourceSHA256": base.digest(first.OUT / "source.json"), "rowsSHA256": base.digest(OUT / "observations.jsonl"),
        "productionChanged": False, "reservedHoldoutSubmitted": False})


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("register", "run"))
    {"register": register, "run": run}[parser.parse_args().mode]()
