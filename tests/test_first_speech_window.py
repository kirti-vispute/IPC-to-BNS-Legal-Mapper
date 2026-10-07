"""First-window diagnostic consumption leaves original control outputs intact."""
import unittest
from types import SimpleNamespace

from scripts.audit_first_speech_window import first_window


class FirstSpeechWindowTests(unittest.TestCase):
    def test_stops_before_revisit_and_closes_without_changing_original_segments(self):
        returned, closed, calls = [object(), object()], [], []
        model = SimpleNamespace(splits=[{"segments": [{"start": 0, "end": 1, "tokens": [100]},
                                                      {"start": 1, "end": 2, "tokens": [101]}]}])
        def method(model, features, tokenizer, *args, **kwargs):
            calls.append((features, args, kwargs))
            try:
                yield from returned
                raise AssertionError("Should not consume second generation window")
            finally:
                closed.append(True)
        tokenizer = SimpleNamespace(decode=lambda tokens: "synthetic")
        result = list(first_window(method)(model, "features", tokenizer, False, encoder_output=None))
        self.assertEqual(result, returned)
        self.assertEqual(closed, [True])
        self.assertEqual(calls, [("features", (False,), {"encoder_output": None})])

    def test_skipped_window_has_no_segments_and_closes_normally(self):
        closed = []
        def method(*args, **kwargs):
            try:
                return
                yield
            finally:
                closed.append(True)
        result = list(first_window(method)(SimpleNamespace(splits=[]), "features", None))
        self.assertEqual(result, [])
        self.assertEqual(closed, [True])


if __name__ == "__main__":
    unittest.main()
