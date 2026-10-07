"""Install pinned pretrained speech models for English, Hindi, Gujarati and Urdu.

Each target is verified against a published SHA-256 before use, lands in an ignored
models/speech/ folder, and is then used offline. No account, token or paid service.

  .venv-speech      python scripts/setup_indic_speech.py --only whistle urdu
  .venv-translation python scripts/setup_indic_speech.py --only hindi gujarati

Hindi/Gujarati ship as PyTorch weights and need the one-time CTranslate2 int8 conversion
(about 3 GB download each, about 770 MB converted); torch/transformers/ctranslate2 come
from backend/translation/requirements.txt. Whistle and Urdu are used as published.
"""
import argparse
import hashlib
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEECH = ROOT / "models" / "speech"

WHISTLE = {
    "repo": "Cactus-Compute/whistle",
    "revision": "b358ddadd89b7a713b5aa131f23032d3cca1b251",
    "weights": "whistle.cact",
    "weights_sha256": "b6e02f048568ac5d01a2042556c658061e699acbc0aa2a1439f52f3d461dffeb",
    "directory": "whistle",
    # Engine library is fetched by the pinned cactus-needle package (engine 3.2.0).
    "engine_sha256": {"win_amd64": "d20c72dccd7557b10493fae3d6af97e4456d420cb454804d5716fa2cb15eb774"},
}
URDU = {
    "repo": "kingabzpro/whisper-large-v3-urdu-ct2",
    "revision": "4b8b0b9409ddef25ed4a9da5b206cebaefc4df3c",
    "model_sha256": "05d4e23634030e21c7683504834dde398fe19ace43b08f427ea4bbc40686c986",
    "directory": "urdu-large-v3-ct2",
}
# IIT Madras Speech Lab Whisper-medium fine-tunes (Apache 2.0), converted to CTranslate2 int8.
CONVERTED = {
    "hindi": {
        "repo": "vasista22/whisper-hindi-medium",
        "revision": "d53532a4dc1d0d89e484ed8f7acfb2228a7d3785",
        "weights_sha256": "c01059f10127b727269ab42a183e913409c4bcbc6b9eab6f76d2cac2bdbc6e35",
        "directory": "hindi-medium-ct2",
    },
    "gujarati": {
        "repo": "vasista22/whisper-gujarati-medium",
        "revision": "0d0a25c8834c78f1a0bf3d94f2cda46dce603eeb",
        "weights_sha256": "b6a70aa520d94ab03d43b72a5196e6c547a72eabb3f629bdf65b311e5d5e19bf",
        "directory": "gujarati-medium-ct2",
    },
}
CT2_FILES = ("model.bin", "config.json", "tokenizer.json", "vocabulary.json")


def sha256(path):
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def require_hash(path, expected, label):
    if sha256(path) != expected:
        raise RuntimeError(f"{label} checksum mismatch; refusing to use {path}")


def complete(directory, names):
    return all((directory / name).is_file() for name in names)


def setup_whistle():
    from huggingface_hub import hf_hub_download

    target = SPEECH / WHISTLE["directory"]
    target.mkdir(parents=True, exist_ok=True)
    weights = target / WHISTLE["weights"]
    if not weights.is_file():
        downloaded = hf_hub_download(WHISTLE["repo"], WHISTLE["weights"], revision=WHISTLE["revision"], local_dir=str(target))
        weights = Path(downloaded)
    require_hash(weights, WHISTLE["weights_sha256"], "Whistle weights")
    from needle.agent import fetch  # installed with cactus-needle

    engine = target / fetch.lib_name(3)
    if not engine.is_file():
        fetched = Path(fetch.fetch_library(dest_dir=str(target), generation=3))
        if fetched != engine:
            shutil.move(str(fetched), str(engine))
    expected = WHISTLE["engine_sha256"].get(fetch._platform_tag())
    actual = sha256(engine)
    if expected and not expected.startswith("__") and actual != expected:
        raise RuntimeError("Whistle engine checksum mismatch; refusing to use it")
    print(f"Local Whistle (English) ready: {target} (engine sha256 {actual[:16]}...)")


def setup_urdu():
    from huggingface_hub import snapshot_download

    target = SPEECH / URDU["directory"]
    snapshot_download(repo_id=URDU["repo"], revision=URDU["revision"], local_dir=str(target),
                      allow_patterns=["model.bin", "config.json", "tokenizer.json", "vocabulary.json", "preprocessor_config.json", "README.md"])
    require_hash(target / "model.bin", URDU["model_sha256"], "Urdu model")
    if not complete(target, CT2_FILES):
        raise RuntimeError("Urdu speech model is incomplete")
    print(f"Local Urdu speech model ready: {target}")


def setup_converted(name, keep_source):
    from ctranslate2.converters import TransformersConverter
    from huggingface_hub import snapshot_download
    from transformers import AutoTokenizer

    spec = CONVERTED[name]
    source = SPEECH / f"{name}-medium-source"
    target = SPEECH / spec["directory"]
    if complete(target, CT2_FILES):
        print(f"Existing {name} speech model retained: {target}")
        return
    if target.exists() and any(target.iterdir()):
        raise RuntimeError(f"Incomplete target exists; inspect it before retrying: {target}")
    snapshot_download(repo_id=spec["repo"], revision=spec["revision"], local_dir=str(source),
                      allow_patterns=["*.json", "merges.txt", "pytorch_model.bin"])
    weights = source / "pytorch_model.bin"
    require_hash(weights, spec["weights_sha256"], f"{name} source weights")
    TransformersConverter(str(source), low_cpu_mem_usage=True,
                          copy_files=["preprocessor_config.json"]).convert(str(target), quantization="int8")
    AutoTokenizer.from_pretrained(str(source), local_files_only=True, use_fast=True).save_pretrained(str(target))
    if not complete(target, CT2_FILES):
        raise RuntimeError(f"Converted {name} speech model is incomplete")
    if not keep_source:
        shutil.rmtree(source)
    print(f"Local {name} speech model ready: {target}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--only", nargs="+", choices=["whistle", "urdu", "hindi", "gujarati"],
                        default=["whistle", "urdu", "hindi", "gujarati"])
    parser.add_argument("--keep-source", action="store_true", help="keep the 3 GB PyTorch source after conversion")
    args = parser.parse_args()
    steps = {"whistle": setup_whistle, "urdu": setup_urdu,
             "hindi": lambda: setup_converted("hindi", args.keep_source),
             "gujarati": lambda: setup_converted("gujarati", args.keep_source)}
    for name in args.only:
        steps[name]()


if __name__ == "__main__":
    sys.exit(main())
