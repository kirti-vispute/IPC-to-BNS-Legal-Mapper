"""One-time official model download and CPU/int8 conversion, not runtime networking."""
from pathlib import Path
import hashlib
import requests
from huggingface_hub import snapshot_download
from ctranslate2.converters import TransformersConverter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "models" / "translation" / "source"
TARGET = ROOT / "models" / "translation" / "nllb-int8"
snapshot_download(
    repo_id="facebook/nllb-200-distilled-600M",
    revision="f8d333a098d19b4fd9a8b18f94170487ad3f821d",
    local_dir=str(SOURCE),
    allow_patterns=["config.json", "tokenizer.json", "sentencepiece.bpe.model", "tokenizer_config.json", "special_tokens_map.json", "README.md"],
)
weights = SOURCE / "pytorch_model.bin"
expected = "c266c2cfd19758b6d09c1fc31ecdf1e485509035f6b51dfe84f1ada83eefcc42"
if not weights.exists():
    # Explicit download avoids a stalled hub redirect; revision and content hash remain pinned.
    url = "https://huggingface.co/facebook/nllb-200-distilled-600M/resolve/f8d333a098d19b4fd9a8b18f94170487ad3f821d/pytorch_model.bin?download=true"
    partial = SOURCE / "weights.partial"
    with requests.get(url, stream=True, timeout=(30, 60)) as response:
        response.raise_for_status()
        total = 0
        with partial.open("wb") as output:
            for chunk in response.iter_content(1024 * 1024):
                output.write(chunk)
                total += len(chunk)
                if total % (100 * 1024 * 1024) == 0:
                    print(f"Downloaded {total // (1024 * 1024)} MiB", flush=True)
    with partial.open("rb") as downloaded:
        if hashlib.file_digest(downloaded, "sha256").hexdigest() != expected:
            raise RuntimeError("Official model checksum mismatch; conversion refused")
    partial.replace(weights)
with weights.open("rb") as downloaded:
    if hashlib.file_digest(downloaded, "sha256").hexdigest() != expected:
        raise RuntimeError("Official model checksum mismatch; conversion refused")
if (TARGET / "model.bin").exists():
    print(f"Existing translation model retained: {TARGET}")
else:
    TransformersConverter(str(SOURCE), copy_files=["tokenizer.json", "sentencepiece.bpe.model", "tokenizer_config.json", "special_tokens_map.json"]).convert(str(TARGET), quantization="int8")
    print(f"Local translation model ready: {TARGET}")
