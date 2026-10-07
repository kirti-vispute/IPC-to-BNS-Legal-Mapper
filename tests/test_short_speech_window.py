"""Offline window injection and comparison contracts, not speech accuracy tests."""
import unittest

from scripts.compare_short_speech_window import candidate_model, compare_case, metrics, phrase_counts


class ShortWindowTests(unittest.TestCase):
    def test_only_chunk_length_changes_and_inputs_return_remain_original(self):
        calls, result = [], object()
        class Base:
            def transcribe(self, *args, **kwargs):
                calls.append((args, kwargs))
                return result
        options = {"language": "mr", "beam_size": 3, "temperature": 0, "condition_on_previous_text": False}
        candidate = candidate_model(Base)()
        self.assertIs(candidate.transcribe("audio", **options), result)
        self.assertEqual(calls, [(("audio",), {**options, "chunk_length": 15})])
        self.assertNotIn("chunk_length", options)
        with self.assertRaises(ValueError):
            candidate.transcribe("audio", chunk_length=30)

    def test_cap_and_raw_vs_emitted_malformed_text_are_separate(self):
        windows = [{"tokens": [100] * 224, "decodedText": "synthetic\ufffd"}]
        result = metrics("synthetic", windows)
        self.assertEqual(result["boundHits"], 1)
        self.assertEqual(result["generatedReplacementCharacters"], 1)
        self.assertEqual(result["emittedReplacementCharacters"], 0)

    def test_phrase_counts_are_literal_normalized_and_can_expose_overcount(self):
        self.assertEqual(phrase_counts("First, phrase. first phrase!", ["first phrase", "missing"]), [2, 0])
        with self.assertRaises(ValueError):
            phrase_counts("synthetic", [""])

    def test_comparison_rejects_failure_and_detects_options_or_vad_change(self):
        windows = [{"tokens": [100], "decodedText": "synthetic"}]
        baseline = {"text": "synthetic", "windows": windows, "options": {"beam_size": 3}, "durationAfterVad": 5}
        row = {"caseId": "synthetic", "response": {"text": "synthetic"}, "windows": windows,
               "transcriptionOptions": {"beam_size": 3}, "durationAfterVad": 5}
        self.assertTrue(compare_case(row, baseline)["sameText"])
        self.assertFalse(compare_case({**row, "transcriptionOptions": {"beam_size": 5}}, baseline)["sameOptions"])
        self.assertFalse(compare_case({**row, "durationAfterVad": 4}, baseline)["sameVadDuration"])
        with self.assertRaises(ValueError):
            compare_case({**row, "response": {"error": "synthetic"}}, baseline)


if __name__ == "__main__":
    unittest.main()
