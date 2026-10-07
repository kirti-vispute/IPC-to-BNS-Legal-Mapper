"""Synthetic option-contract tests, not audio recognition or legal labels."""
import importlib.util
import unittest
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]


def load(path):
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class DecoderOptionsTests(unittest.TestCase):
    def test_only_beam_changes(self):
        script = load(ROOT / "scripts/assess_marathi_decoder.py")
        old, new = script.decode_options(3), script.decode_options(2)
        self.assertEqual({key for key in old if old[key] != new[key]}, {"beam_size"})
        with self.assertRaises(ValueError):
            script.decode_options(5)

    def test_baseline_matches_actual_selected_marathi_worker_options(self):
        script = load(ROOT / "scripts/assess_marathi_decoder.py")
        production = load(ROOT / "backend/speech/transcribe.py")
        captured = {}
        class Model:
            def transcribe(self, audio, **options):
                captured.update(options)
                return [SimpleNamespace(text="synthetic")], None
        result = production.recognize(b"", Model(), "mr", None, decoded_audio=SimpleNamespace(size=16000))
        self.assertEqual(result["text"], "synthetic")
        self.assertEqual(captured, script.decode_options(3))


if __name__ == "__main__":
    unittest.main()
