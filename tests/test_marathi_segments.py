"""Observer/skip contracts, not speech-accuracy tests."""
import logging
import unittest
from types import SimpleNamespace
from scripts.inspect_marathi_segments import Capture, observed_model_class, skip_decision


class SegmentDiagnosticTests(unittest.TestCase):
    def test_strict_skip_guard_and_logprob_override(self):
        self.assertFalse(skip_decision(0.6, -2, 0.6, -1)["expectedWindowSkip"])
        self.assertTrue(skip_decision(0.61, -1, 0.6, -1)["expectedWindowSkip"])
        self.assertTrue(skip_decision(0.61, -1.1, 0.6, -1)["expectedWindowSkip"])
        self.assertFalse(skip_decision(0.99, -0.99, 0.6, -1)["expectedWindowSkip"])

    def test_disabled_thresholds_and_invalid_metrics(self):
        self.assertFalse(skip_decision(1, -2, None, -1)["expectedWindowSkip"])
        self.assertTrue(skip_decision(1, -0.5, 0.6, None)["expectedWindowSkip"])
        for probability, avg in [(True, -1), (-0.1, -1), (1.1, -1), (float("nan"), -1), (0.1, float("inf"))]:
            with self.assertRaises(ValueError):
                skip_decision(probability, avg, 0.6, -1)

    def test_observer_calls_original_once_returns_identical_tuple_and_does_not_mutate(self):
        decoded = (SimpleNamespace(sequences_ids=[[1, 2]], no_speech_prob=0.1), -0.2, 0, 1)
        calls = []
        class Base:
            def __init__(self):
                pass
            def generate_with_fallback(self, *args):
                calls.append(args)
                return decoded
        tokenizer = SimpleNamespace(decode=lambda tokens: "synthetic", language=1, task=2, language_code="mr")
        options = SimpleNamespace(no_speech_threshold=0.6, log_prob_threshold=-1)
        model, prompt = observed_model_class(Base)(), [1, 2]
        self.assertIs(model.generate_with_fallback("encoder", prompt, tokenizer, options), decoded)
        self.assertEqual(len(calls), 1)
        self.assertIs(calls[0][1], prompt)
        self.assertEqual(prompt, [1, 2])
        self.assertEqual(decoded[0].sequences_ids, [[1, 2]])
        self.assertEqual(vars(options), {"no_speech_threshold": 0.6, "log_prob_threshold": -1})
        self.assertFalse(model.decisions[0]["expectedWindowSkip"])

    def test_capture_bounds_and_reset_are_explicit(self):
        capture = Capture()
        record = logging.LogRecord("synthetic", logging.DEBUG, "", 1, "message", (), None)
        for _ in range(129):
            capture.emit(record)
        self.assertEqual(len(capture.records), 128)
        self.assertTrue(capture.truncated)
        capture.reset()
        self.assertEqual(capture.records, [])
        self.assertFalse(capture.truncated)
        capture.emit(logging.LogRecord("synthetic", logging.DEBUG, "", 1, "x" * 513, (), None))
        self.assertTrue(capture.truncated)
        self.assertEqual(len(capture.records[0]["message"]), 512)


if __name__ == "__main__":
    unittest.main()
