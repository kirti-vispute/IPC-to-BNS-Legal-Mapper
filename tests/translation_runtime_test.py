import hashlib
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend/translation"))
import worker


class TokenizerStub:
    def __init__(self, model):
        pass

    def encode(self, text, source):
        return [source, text, "</s>"]

    def decode(self, tokens):
        return " ".join(tokens)


class TranslatorStub:
    calls = []

    def __init__(self, *args, **kwargs):
        pass

    def translate_batch(self, batches, **kwargs):
        self.calls.append(batches)
        return [types.SimpleNamespace(hypotheses=[[kwargs["target_prefix"][i][0], "translated", batch[1]]], scores=[-1]) for i, batch in enumerate(batches)]


class RuntimeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.model = Path(self.temp.name)
        (self.model / "model.bin").touch()
        self.original = {name: sys.modules.get(name) for name in ["ctranslate2", "local_tokenizer"]}
        sys.modules["ctranslate2"] = types.SimpleNamespace(Translator=TranslatorStub)
        sys.modules["local_tokenizer"] = types.SimpleNamespace(LocalTokenizer=TokenizerStub)
        TranslatorStub.calls = []
        self.state = {}

    def tearDown(self):
        for name, module in self.original.items():
            if module is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = module
        self.temp.cleanup()

    def request(self, source, texts):
        return worker.handle({"action":"translate", "source":source, "target":"hi" if source == "en" else "en", "texts":texts, "modelPath":str(self.model)}, self.state)

    def test_display_duplicates_have_identical_results_but_decode_once(self):
        result = self.request("en", ["label", "label", "title"])
        self.assertEqual(result["texts"], ["translated label", "translated label", "translated title"])
        self.assertEqual(len(TranslatorStub.calls[0]), 2)
        self.request("en", ["label"])
        self.assertEqual(len(TranslatorStub.calls), 1)

    def test_native_text_is_never_cached_or_deduplicated(self):
        self.request("hi", ["case", "case"])
        self.request("hi", ["case"])
        self.assertEqual(len(TranslatorStub.calls), 2)
        self.assertEqual(len(TranslatorStub.calls[0]), 2)
        self.assertEqual(self.state["translations"], {})

    def test_empty_warmup_performs_no_decoding_and_reuses_one_tokenizer(self):
        self.assertEqual(self.request("en", [])["texts"], [])
        tokenizer = self.state["tokenizer"]
        self.request("hi", ["case"])
        self.assertIs(self.state["tokenizer"], tokenizer)

    def test_catalog_requires_matching_weights_and_valid_entries(self):
        (self.model / "tokenizer.json").write_text("{}", encoding="utf-8")
        path = self.model / "catalog.json"
        data = {"type":"STATIC_DISPLAY_TRANSLATIONS", "reviewStatus":"MACHINE_GENERATED_UNREVIEWED",
                "modelSha256":hashlib.sha256(b"").hexdigest(),
                "tokenizerSha256":hashlib.sha256(b"{}").hexdigest(), "entries":{"hi":{"label":"saved"}}}
        path.write_text(json.dumps(data), encoding="utf-8")
        self.assertEqual(worker.load_display_catalog(self.model, path), data["entries"])
        data["modelSha256"] = "stale"
        path.write_text(json.dumps(data), encoding="utf-8")
        self.assertEqual(worker.load_display_catalog(self.model, path), {})
        path.write_text("[]", encoding="utf-8")
        self.assertEqual(worker.load_display_catalog(self.model, path), {})
        data["modelSha256"] = hashlib.sha256(b"").hexdigest()
        data["entries"] = {"hi": []}
        path.write_text(json.dumps(data), encoding="utf-8")
        self.assertEqual(worker.load_display_catalog(self.model, path), {})

    def test_catalog_is_display_only_and_does_not_replace_native_case_text(self):
        self.request("en", [])
        self.state["display_catalog"] = {"hi":{"label":"saved"}, "en":{"case":"not allowed"}}
        self.assertEqual(self.request("en", ["label"])["texts"], ["saved"])
        self.assertEqual(TranslatorStub.calls, [])
        self.assertEqual(self.request("hi", ["case"])["texts"], ["translated case"])


if __name__ == "__main__":
    unittest.main()
