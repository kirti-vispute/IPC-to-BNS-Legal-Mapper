"""Converted-only offline comparison with matched caps and terminal-EOS handling."""
import argparse
import json
import time
from datetime import datetime, timezone
from pathlib import Path

from scripts import probe_marathi_decoder_caps as probe
from scripts import source_parity_structured as structured

ROOT, base, prior = probe.ROOT, probe.base, probe.prior
OUT = ROOT / "output/public-speech-validation/marathi-matched-cap-20261005"
TOKEN_BUDGET = 192
CT2_CAP = 384
EOS = 50257


def normalize_eos(tokens, require_terminal=False):
    values = list(tokens)
    if any(type(token) is not int or not 0 <= token < 51865 for token in values):
        raise ValueError("Invalid token IDs")
    if require_terminal and (not values or values[-1] != EOS):
        raise ValueError("Saved source did not finish with EOS")
    if values and values[-1] == EOS:
        values = values[:-1]
    if EOS in values:
        raise ValueError("Internal EOS cannot be silently removed")
    return values


def compare_rows(converted, source):
    if len(converted) != 8 or len(source) != 8:
        raise ValueError("Expected eight complete rows")
    names = [row["filename"] for row in source]
    if len(set(names)) != 8 or names != [row.get("filename") for row in converted]:
        raise ValueError("Duplicate, reordered or mismatched cases")
    rows = []
    for left, right in zip(converted, source):
        if left.get("error") or right.get("error"):
            raise ValueError("Failed row cannot be counted as parity")
        rows.append({"filename": left["filename"],
                     "sameNormalizedTokens": normalize_eos(left["tokens"]) == normalize_eos(right["tokens"], True),
                     "sameText": left["text"] == right["text"],
                     "convertedTokens": len(normalize_eos(left["tokens"])),
                     "sourceTokens": len(normalize_eos(right["tokens"], True)),
                     "convertedText": left["text"], "sourceText": right["text"]})
    return {"cases": rows, "normalizedTokenMatches": sum(row["sameNormalizedTokens"] for row in rows),
            "textMatches": sum(row["sameText"] for row in rows), "total": 8}


def inputs():
    features = json.loads((prior.OUTPUT / "features.json").read_text(encoding="utf-8"))
    source = prior.rows(structured.OUT / "source-worker.jsonl")
    old = prior.rows(prior.OUTPUT / "ct2-worker.jsonl")
    if len(features) != 8 or [row["filename"] for row in features] != [row["filename"] for row in source]:
        raise ValueError("Feature/source identities differ")
    for item, row in zip(features, source):
        if row.get("prefix") != prior.PROMPT or len(row["tokens"]) > TOKEN_BUDGET:
            raise ValueError("Source prefix or token budget differs")
        normalize_eos(row["tokens"], True)
        if base.digest(ROOT / item["featureFile"]) != item["featureSHA256"]:
            raise ValueError("Saved feature changed")
    compare_rows(old, source)
    return features, source, old


def register():
    probe.verified()
    structured.verified()
    features, _, _ = inputs()
    paths = [ROOT / "Feature-marathi-matched-cap-plan.md", Path(__file__),
             ROOT / "tests/test_marathi_matched_cap.py", probe.OUT / "registration.json",
             probe.OUT / "report.json", structured.OUT / "registration.json",
             structured.OUT / "report.json", structured.OUT / "source-worker.jsonl",
             prior.OUTPUT / "features.json", prior.OUTPUT / "ct2-worker.jsonl",
             prior.TARGET / "tokenizer.json", ROOT / "output/translation-model-assessment/before-hashes.json",
             ROOT / ".venv-speech/Lib/site-packages/ctranslate2/_ext.cp312-win_amd64.pyd",
             ROOT / ".venv-speech/Lib/site-packages/ctranslate2/ctranslate2.dll",
             ROOT / ".venv-speech/Lib/site-packages/ctranslate2/version.py"]
    paths += [ROOT / item["featureFile"] for item in features]
    OUT.mkdir(exist_ok=False)
    base.save_new(OUT / "registration.json", {"type": "MATCHED_CAP_CONVERTED_ONLY_COMPARISON",
        "hashes": {str(path.relative_to(ROOT)): base.digest(path) for path in paths},
        "runtimeVersions": prior.versions(), "sourceBudget": TOKEN_BUDGET, "ct2MaxLength": CT2_CAP,
        "ct2EffectiveBudget": min(CT2_CAP // 2, CT2_CAP - 3), "prompt": prior.PROMPT,
        "sourceReused": True, "productionChanged": False, "reservedHoldoutSubmitted": False})
    print(json.dumps({"registered": True, "files": len(paths), "clips": len(features)}))


def verified():
    reg = json.loads((OUT / "registration.json").read_text(encoding="utf-8"))
    if reg["runtimeVersions"] != prior.versions() or reg["ct2EffectiveBudget"] != TOKEN_BUDGET:
        raise ValueError("Registered runtime/budget changed")
    if any(base.digest(ROOT / name) != expected for name, expected in reg["hashes"].items()):
        raise ValueError("Registered comparison input changed")
    probe.verified()
    structured.verified()
    return reg


def run():
    import ctranslate2
    import numpy as np
    from faster_whisper import WhisperModel
    from tokenizers import Tokenizer

    reg = verified()
    if ctranslate2.__version__ != "4.8.2":
        raise ValueError("Cap semantics are verified only for the registered CT2 version")
    features, source, old = inputs()
    tokenizer = Tokenizer.from_file(str(prior.TARGET / "tokenizer.json"))
    if any(prior.text_from_tokens(tokenizer, row["tokens"]) != row["text"] for row in source):
        raise ValueError("Saved source text differs from shared tokenizer")
    observed = json.loads((prior.OUTPUT / "registration.json").read_text(encoding="utf-8"))["suppressTokens"]
    started = datetime.now(timezone.utc).isoformat()
    rows, failure = [], None
    model = WhisperModel(str(prior.TARGET), device="cpu", compute_type="int8", cpu_threads=4, local_files_only=True)
    with (OUT / "converted.jsonl").open("x", encoding="utf-8") as log:
        for item in features:
            row = {"filename": item["filename"], "featureSHA256": item["featureSHA256"]}
            began = time.perf_counter()
            try:
                array = np.load(ROOT / item["featureFile"], allow_pickle=False)
                if array.shape != (80, 3000) or array.dtype != np.float32 or prior.sample_digest(array) != item["featureDataSHA256"]:
                    raise ValueError("Invalid shared feature")
                result = model.model.generate(model.encode(array), [prior.PROMPT], beam_size=3, patience=1,
                    length_penalty=1, max_length=CT2_CAP, suppress_blank=True,
                    suppress_tokens=observed, return_scores=True, return_logits_vocab=False)[0]
                if not result.sequences_ids:
                    raise ValueError("No generated hypothesis")
                row["tokens"] = [int(token) for token in result.sequences_ids[0]]
                normalize_eos(row["tokens"])
                if not row["tokens"] or len(row["tokens"]) > TOKEN_BUDGET:
                    raise ValueError("Empty or over-budget output")
                row["text"] = prior.text_from_tokens(tokenizer, row["tokens"])
                row["scores"] = [float(score) for score in result.scores]
            except Exception as error:
                row["error"] = {"type": type(error).__name__, "message": str(error)}
                failure = row["error"]
            row["elapsedMs"] = (time.perf_counter() - began) * 1000
            rows.append(row)
            log.write(json.dumps(row, ensure_ascii=False, allow_nan=False) + "\n")
            log.flush()
            print(json.dumps({"filename": row["filename"], "tokens": len(row.get("tokens", [])),
                              "error": row.get("error")}), flush=True)
            if failure:
                break
    verified()
    comparison = compare_rows(rows, source) if failure is None else None
    before = compare_rows(old, source)
    report = {"type": "MATCHED_CAP_CONVERTED_ONLY_COMPARISON", "startedUtc": started,
        "finishedUtc": datetime.now(timezone.utc).isoformat(), "complete": comparison is not None,
        "failure": failure, "before": before, "after": comparison,
        "oldRawTokenMatches": sum(a["tokens"] == b["tokens"] for a, b in zip(old, source)),
        "oldConvertedAt98": [row["filename"] for row in old if len(row["tokens"]) == 98],
        "newConvertedAt192": [row["filename"] for row in rows if len(row.get("tokens", [])) == TOKEN_BUDGET],
        "changedConvertedCases": [row["filename"] for row, previous in zip(rows, old) if row.get("tokens") != previous["tokens"]],
        "registrationSHA256": base.digest(OUT / "registration.json"),
        "newRowsSHA256": base.digest(OUT / "converted.jsonl"),
        "sourceReused": True, "productionChanged": False, "reservedHoldoutSubmitted": False,
        "limitations": "Eight inspected public development calls; source timing invalidated by earlier sleep. Distinct beam implementations/float32-int8 arithmetic. No speech/legal accuracy, speed or conversion-defect claim."}
    base.save_new(OUT / "report.json", report)
    print(json.dumps({"complete": report["complete"], "beforeTokens": before["normalizedTokenMatches"],
                      "afterTokens": comparison["normalizedTokenMatches"] if comparison else None,
                      "beforeText": before["textMatches"], "afterText": comparison["textMatches"] if comparison else None}))
    if not report["complete"]:
        raise SystemExit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("register", "run"))
    {"register": register, "run": run}[parser.parse_args().mode]()
