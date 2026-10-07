"""Install the pinned Marathi Whisper model for offline faster-whisper inference."""
import hashlib
from pathlib import Path

import requests
from ctranslate2.converters import TransformersConverter
from huggingface_hub import snapshot_download
from transformers import AutoTokenizer


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "models" / "speech" / "marathi-small-source"
TARGET = ROOT / "models" / "speech" / "marathi-small-ct2"
REVISION = "422f5ad4f5356d3dcd413ee862f09a7a389bebd7"
EXPECTED_SHA256 = "8e741272f0b627a532075e9e3084a35be4f4b678047f972d79c818c0b42f942f"
REQUIRED = ("model.bin", "config.json", "tokenizer.json", "vocabulary.json")


def main():
    if all((TARGET / name).is_file() for name in REQUIRED):
        print(f"Existing Marathi speech model retained: {TARGET}")
        return
    if TARGET.exists() and any(TARGET.iterdir()):
        raise RuntimeError(f"Incomplete target exists; inspect it before retrying: {TARGET}")

    snapshot_download(
        repo_id="durgesh10/whisper-small-marathi",
        revision=REVISION,
        local_dir=str(SOURCE),
        allow_patterns=["*.json", "merges.txt", "README.md"],
    )
    weights = SOURCE / "model.safetensors"
    if not weights.exists():
        partial = SOURCE / "model.safetensors.partial"
        offset = partial.stat().st_size if partial.exists() else 0
        headers = {"Range": f"bytes={offset}-"} if offset else {}
        url = f"https://huggingface.co/durgesh10/whisper-small-marathi/resolve/{REVISION}/model.safetensors"
        with requests.get(url, headers=headers, stream=True, timeout=(30, 60)) as response:
            response.raise_for_status()
            if offset and (response.status_code != 206 or not response.headers.get("Content-Range", "").startswith(f"bytes {offset}-")):
                raise RuntimeError("Download server did not honor the requested resume offset")
            with partial.open("ab" if offset else "wb") as output:
                for chunk in response.iter_content(1024 * 1024):
                    output.write(chunk)
        with partial.open("rb") as downloaded:
            if hashlib.file_digest(downloaded, "sha256").hexdigest() != EXPECTED_SHA256:
                raise RuntimeError("Marathi model checksum mismatch; conversion refused")
        partial.replace(weights)
    with weights.open("rb") as downloaded:
        if hashlib.file_digest(downloaded, "sha256").hexdigest() != EXPECTED_SHA256:
            raise RuntimeError("Marathi model checksum mismatch; conversion refused")

    TransformersConverter(str(SOURCE), low_cpu_mem_usage=True).convert(str(TARGET), quantization="int8")
    AutoTokenizer.from_pretrained(str(SOURCE), local_files_only=True, use_fast=True).save_pretrained(str(TARGET))
    if not all((TARGET / name).is_file() for name in REQUIRED):
        raise RuntimeError("Converted Marathi speech model is incomplete")
    print(f"Local Marathi speech model ready: {TARGET}")


if __name__ == "__main__":
    main()
