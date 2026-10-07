"""Download pinned local Whisper conversions (tiny for Auto and fallback English, small for the Marathi fallback).

Hindi, Urdu and Gujarati use their language-tuned models from scripts/setup_indic_speech.py; the generic medium
model is no longer installed or used for any language.
"""
from pathlib import Path
from huggingface_hub import snapshot_download

ROOT = Path(__file__).resolve().parents[1]
for repo, revision, directory in [
    ("Systran/faster-whisper-tiny", "d90ca5fe260221311c53c58e660288d3deb8d356", "whisper-tiny"),
    ("Systran/faster-whisper-small", "536b0662742c02347bc0e980a01041f333bce120", "whisper-small"),
]:
    model = ROOT / "models" / "speech" / directory
    snapshot_download(
        repo_id=repo,
        revision=revision,
        local_dir=str(model),
        allow_patterns=["model.bin", "config.json", "tokenizer.json", "vocabulary.txt", "README.md"],
    )
    print(f"Local speech model ready: {model}")
