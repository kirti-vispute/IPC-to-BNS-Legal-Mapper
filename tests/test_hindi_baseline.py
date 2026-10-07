"""Synthetic diagnostic integrity/scoring contracts, not recognition accuracy."""
import unittest
from scripts.validate_hindi_baseline import assess, disjoint


class HindiBaselineTests(unittest.TestCase):
    def fixtures(self):
        return [{"filename": str(i), "rowIndex": i, "datasetId": i, "sha256": str(i), "language": "hi",
                 "genderCode": i % 2, "numSamples": 16000, "transcript": "one two"} for i in range(12)]

    def rows(self):
        return [{"filename": str(i), "text": "one two", "requestMs": 10} for i in range(12)]

    def test_complete_reference_scoring(self):
        result = assess(self.rows(), self.fixtures())
        self.assertTrue(result["complete"])
        self.assertEqual(result["totals"]["words"], 24)
        self.assertEqual(result["wer"], 0)
        self.assertFalse(result["productionChange"])
        self.assertTrue(all(r["speakerId"] is None for r in result["perClip"]))

    def test_empty_valid_response_counts_deletions(self):
        rows = self.rows()
        rows[0]["text"] = ""
        result = assess(rows, self.fixtures())
        self.assertEqual(result["totals"]["wordEdits"], 2)
        self.assertEqual(result["totals"]["words"], 24)
        self.assertEqual(result["emptyClips"], ["0"])

    def test_error_or_missing_has_no_complete_set_accuracy(self):
        rows = self.rows()
        rows[0]["error"] = "failed"
        for sample in (rows, self.rows()[:-1]):
            result = assess(sample, self.fixtures())
            self.assertFalse(result["complete"])
            self.assertIsNone(result["wer"])

    def test_duplicate_and_unknown_results_rejected(self):
        with self.assertRaises(ValueError):
            assess(self.rows() + [self.rows()[0]], self.fixtures())
        with self.assertRaises(ValueError):
            assess([{"filename": "unknown"}], self.fixtures())

    def test_prior_sentence_audio_and_internal_overlap_rejected(self):
        disjoint(self.fixtures(), [{"language": "hi", "datasetId": 99, "sha256": "other"}])
        for key, value in (("datasetId", 0), ("sha256", "0")):
            old = {"language": "hi", "datasetId": 99, "sha256": "other", key: value}
            with self.assertRaises(ValueError):
                disjoint(self.fixtures(), [old])
        fixtures = self.fixtures()
        fixtures[1] = dict(fixtures[0])
        with self.assertRaises(ValueError):
            disjoint(fixtures, [])


if __name__ == "__main__":
    unittest.main()
