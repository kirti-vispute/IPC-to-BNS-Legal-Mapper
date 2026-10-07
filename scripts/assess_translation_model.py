"""Isolated model assessment; never imported by the application or scorer."""
import argparse
import hashlib
import json
import os
import re
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "translation-model-assessment"
SOURCE = OUT / "opus-source"
TARGET = OUT / "opus-int8"
MODEL_ID = "Helsinki-NLP/opus-mt-mul-en"
REVISION = "848eae0c1676cfce9bb791c200e8228e5a6396ff"
WEIGHT_SHA = "33ff438ec37160a105f0700819a5b78a07918e1913fc2f249184b1f46a248e4e"
FILES = ["README.md", "config.json", "generation_config.json", "metadata.json",
         "pytorch_model.bin", "source.spm", "target.spm", "tokenizer_config.json", "vocab.json"]


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def write_new(path, value):
    with path.open("x", encoding="utf-8") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write("\n")


def snapshot():
    prior = json.loads((ROOT / "output/translation-role-fix/before-hashes.json").read_text())
    paths = set(prior)
    for folder in ["models/translation/source", "models/translation/nllb-int8"]:
        paths.update(str(p.relative_to(ROOT)).replace("\\", "/")
                     for p in (ROOT / folder).rglob("*") if p.is_file())
    write_new(OUT / "before-hashes.json", {p: digest(ROOT / p) for p in sorted(paths)})


def prepare():
    import requests
    response = requests.get(f"https://huggingface.co/api/models/{MODEL_ID}/revision/{REVISION}?blobs=true", timeout=30)
    response.raise_for_status()
    metadata = response.json()
    if metadata.get("gated") or metadata["sha"] != REVISION:
        raise RuntimeError("Unexpected revision/access status; do not accept gates")
    if metadata.get("cardData", {}).get("license") != "apache-2.0":
        raise RuntimeError("License must be checked before downloading")
    expected = {f["rfilename"]: f for f in metadata["siblings"]}
    write_new(OUT / "official-metadata.json", metadata)
    SOURCE.mkdir(exist_ok=False)
    for name in FILES:
        destination = SOURCE / name
        with requests.get(f"https://huggingface.co/{MODEL_ID}/resolve/{REVISION}/{name}",
                          stream=True, timeout=(20, 90)) as response:
            response.raise_for_status()
            with destination.open("xb") as stream:
                for chunk in response.iter_content(1024 * 1024):
                    stream.write(chunk)
        if destination.stat().st_size != expected[name]["size"]:
            raise RuntimeError(f"Incorrect file size: {name}")
        lfs_sha = (expected[name].get("lfs") or {}).get("sha256")
        if lfs_sha and digest(destination) != lfs_sha:
            raise RuntimeError(f"Incorrect official LFS checksum: {name}")
        print(json.dumps({"downloaded": name, "bytes": destination.stat().st_size}), flush=True)
    if digest(SOURCE / "pytorch_model.bin") != WEIGHT_SHA:
        raise RuntimeError("Pinned weight checksum mismatch")
    write_new(OUT / "download-manifest.json", {
        "model": MODEL_ID, "revision": REVISION, "license": "Apache-2.0",
        "files": {name: digest(SOURCE / name) for name in FILES},
        "productionConnected": False,
    })


def verify_source():
    manifest = json.loads((OUT / "download-manifest.json").read_text())
    if manifest["revision"] != REVISION:
        raise RuntimeError("Unexpected downloaded model revision")
    for name, expected in manifest["files"].items():
        if digest(SOURCE / name) != expected:
            raise RuntimeError(f"Downloaded source changed: {name}")


def convert():
    verify_source()
    from ctranslate2.converters import TransformersConverter
    if TARGET.exists():
        raise RuntimeError("Do not overwrite existing assessment conversion")
    start = time.perf_counter()
    TransformersConverter(str(SOURCE), trust_remote_code=False).convert(str(TARGET), quantization="int8")
    write_new(OUT / "conversion.json", {
        "elapsedMs": round((time.perf_counter() - start) * 1000), "computeType": "int8",
        "files": {p.name: digest(p) for p in TARGET.iterdir() if p.is_file()},
    })


def probes():
    fixtures = json.loads((ROOT / "tests/fixtures/multilingual-completion.json").read_text(encoding="utf-8"))
    cases = [{"id": f"{f['language']}-{kind}", "language": f["language"], "text": f[kind]}
             for f in fixtures if f["language"] != "en" for kind in ["theft", "injury", "cheating"]]
    cases += [{"id": f"{f['language']}-repeated-long", "language": f["language"],
               "text": " ".join([f["theft"]] * 5)} for f in fixtures if f["language"] != "en"]
    # Contrast probes are diagnostic inputs, not bilingual-certified gold answers.
    prior = json.loads((ROOT / "output/translation-context-search/intent.json").read_text(encoding="utf-8"))
    cases += [{k: row[k] for k in ["id", "language", "text"]}
              for row in prior["rows"] if row["id"].endswith(("context", "permitted"))]
    return cases


def run(model):
    import ctranslate2
    destination = OUT / f"{model}-probes.json"
    if destination.exists():
        raise RuntimeError("Evidence exists; do not overwrite")
    if model == "opus":
        verify_source()
        conversion = json.loads((OUT / "conversion.json").read_text())
        for name, expected in conversion["files"].items():
            if digest(TARGET / name) != expected:
                raise RuntimeError(f"Converted assessment model changed: {name}")
        from transformers import MarianTokenizer
        tokenizer = MarianTokenizer.from_pretrained(str(SOURCE), local_files_only=True)
        translator = ctranslate2.Translator(str(TARGET), device="cpu", compute_type="int8", intra_threads=4)

        def translate(text, language):
            tokens = tokenizer.convert_ids_to_tokens(tokenizer.encode(text))
            result = translator.translate_batch([tokens], beam_size=2, max_decoding_length=400, return_scores=True)[0]
            return tokenizer.decode(tokenizer.convert_tokens_to_ids(result.hypotheses[0]), skip_special_tokens=True), len(tokens), result.scores[0]
    else:
        import sys
        sys.path.insert(0, str(ROOT / "backend/translation"))
        from local_tokenizer import LocalTokenizer
        from worker import LANGS
        path = ROOT / "models/translation/nllb-int8"
        tokenizer = LocalTokenizer(path)
        translator = ctranslate2.Translator(str(path), device="cpu", compute_type="int8", intra_threads=4)

        def translate(text, language):
            tokens = tokenizer.encode(text, LANGS[language])
            result = translator.translate_batch([tokens], target_prefix=[[LANGS["en"]]],
                beam_size=2, max_decoding_length=400, return_scores=True)[0]
            return tokenizer.decode(result.hypotheses[0][1:]).strip(), len(tokens), result.scores[0]
    report = {"type": "ISOLATED_TRANSLATION_MODEL_DIAGNOSTIC", "model": model,
              "reviewStatus": "NOT_EXPERT_REVIEWED", "productionConnected": False,
              "limitations": "Raw prose only; no adapter, routing, retrieval or date normalization. Existing synthetic probes, not an independent holdout or accuracy benchmark. Model scores are not correctness.",
              "rows": []}
    for case in probes():
        start = time.perf_counter()
        try:
            text, token_count, score = translate(case["text"], case["language"])
            result = {"translation": text, "inputTokens": token_count, "modelScore": score}
        except Exception as error:
            result = {"error": type(error).__name__, "detail": str(error)}
        row = {**case, **result, "elapsedMs": round((time.perf_counter() - start) * 1000)}
        report["rows"].append(row)
        print(json.dumps(row, ensure_ascii=True), flush=True)
    write_new(destination, report)


def reference():
    verify_source()
    import torch
    from transformers import MarianMTModel, MarianTokenizer
    torch.set_num_threads(4)
    tokenizer = MarianTokenizer.from_pretrained(str(SOURCE), local_files_only=True)
    model = MarianMTModel.from_pretrained(str(SOURCE), local_files_only=True, weights_only=True).eval()
    converted = json.loads((OUT / "opus-probes.json").read_text(encoding="utf-8"))
    rows = []
    for case in converted["rows"]:
        if case["id"] not in ["hi-theft", "gu-cheating", "kn-injury"]:
            continue
        with torch.inference_mode():
            tokens = tokenizer(case["text"], return_tensors="pt", truncation=False)
            result = model.generate(**tokens, num_beams=2, max_new_tokens=400)
        text = tokenizer.decode(result[0], skip_special_tokens=True)
        row = {"id": case["id"], "pytorchFloat32": text, "ctranslate2Int8": case["translation"],
               "exactTextEqual": text == case["translation"]}
        rows.append(row)
        print(json.dumps(row, ensure_ascii=True), flush=True)
    write_new(OUT / "conversion-reference.json", {"type": "UNCONVERTED_MODEL_CHECK", "rows": rows})


def audit():
    before = json.loads((OUT / "before-hashes.json").read_text())
    rows = [{"path": path, "unchanged": digest(ROOT / path) == expected} for path, expected in before.items()]
    write_new(OUT / "integrity.json", {"checked": len(rows), "unchanged": all(r["unchanged"] for r in rows), "rows": rows})
    if not all(r["unchanged"] for r in rows):
        raise SystemExit("Protected/current production snapshot changed")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["snapshot", "prepare", "convert", "opus", "nllb", "reference", "audit"])
    parser.add_argument("--run-name", help="Fresh assessment directory; existing evidence is never overwritten")
    args = parser.parse_args()
    if args.run_name:
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9-]{0,63}", args.run_name):
            raise SystemExit("Use a short alphanumeric/hyphen run name")
        OUT = OUT / args.run_name
        SOURCE, TARGET = OUT / "opus-source", OUT / "opus-int8"
    OUT.mkdir(parents=True, exist_ok=True)
    if args.mode in ["convert", "opus", "nllb", "reference"]:
        os.environ["HF_HUB_OFFLINE"] = "1"
        os.environ["TRANSFORMERS_OFFLINE"] = "1"
    {"snapshot": snapshot, "prepare": prepare, "convert": convert,
     "opus": lambda: run("opus"), "nllb": lambda: run("nllb"), "reference": reference, "audit": audit}[args.mode]()
