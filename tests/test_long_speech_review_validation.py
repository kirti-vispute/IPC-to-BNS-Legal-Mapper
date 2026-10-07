"""Diagnostic integrity/expected-metadata contracts; no neural inference."""
import copy
import unittest
from scripts.validate_long_speech_review import canonical_hashes, expected_review, read, SAVED, ROOT, verify_frozen_assessment


class LongReviewValidationTests(unittest.TestCase):
    def test_aliases_share_one_commitment_and_conflicts_reject(self):
        self.assertEqual(canonical_hashes({"frontend\\app.js": "AB", "frontend/app.js": "ab"}),
                         {"frontend/app.js": "ab"})
        with self.assertRaises(ValueError):
            canonical_hashes({"frontend\\app.js": "ab", "frontend/app.js": "cd"})

    def test_saved_windows_derive_risk_without_changing_evidence(self):
        observation = read(SAVED)
        before = copy.deepcopy(observation)
        result = expected_review(observation)
        self.assertEqual(result["warningWindows"], [0, 1])
        self.assertEqual(result["compressionWindows"], [0, 1])
        self.assertEqual(result["silenceConfidenceWindows"], [])
        self.assertEqual(result["windowCount"], 3)
        self.assertEqual(observation, before)

    def test_empty_or_missing_saved_generation_does_not_get_clear_verdict(self):
        for observation in ({"windows": [], "response": {"text": "saved"}},
                            {"windows": [{}], "response": {"text": ""}}):
            with self.assertRaises(ValueError):
                expected_review(observation)

    def test_offline_details_match_rule_without_conflating_summary_schema(self):
        rows = read(ROOT / "output/public-speech-validation/review-warning-20261006/report.json")["rows"]
        response = copy.deepcopy(next(row for row in rows if row["caseId"] == "saved-production30s-stress")["responseWithOfflineReview"])
        observation = read(SAVED)
        verify_frozen_assessment(observation, response)
        response["speechReview"]["windows"][0]["requiresReview"] = False
        with self.assertRaises(ValueError):
            verify_frozen_assessment(observation, response)


if __name__ == "__main__":
    unittest.main()
