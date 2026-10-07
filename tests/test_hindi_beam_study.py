"""Synthetic diagnostic contracts, not recognition accuracy or legal labels."""
import unittest
from scripts.study_hindi_beam import NAMES, assessment, distance, normalize, scores


class HindiBeamStudyTests(unittest.TestCase):
    def test_normalization_does_not_repair_the_reported_words(self):
        self.assertNotEqual(normalize("गंभीर चोट"), normalize("गमभी चौट"))
        self.assertEqual(normalize("१२ मई २०२४।"), "१२ मई २०२४")
        self.assertNotEqual(normalize("चोट"), normalize("चोरी"))

    def test_scores_count_substitution_insertion_and_deletion(self):
        self.assertEqual(distance(["a", "b"], ["a", "c", "d"]), 2)
        self.assertEqual(distance("abc", ""), 3)
        self.assertEqual(scores("गंभीर चोट", "गंभीर चोट।")["wordEdits"], 0)
        with self.assertRaises(ValueError):
            scores("", "anything")

    def rows(self):
        return [{"filename": name, "beam": beam, "text": "synthetic", "decodeMs": 100,
                 "score": {"words": 10, "characters": 100, "wordEdits": 2 if beam == 3 else 1,
                           "characterEdits": 5 if beam == 3 else 3}}
                for name in NAMES for beam in (3, 5)]

    def test_development_pass_is_never_deployment(self):
        result = assessment(self.rows())
        self.assertTrue(result["developmentPass"])
        self.assertFalse(result["productionDeployment"])

    def test_one_regression_rejects_an_aggregate_gain(self):
        rows = self.rows()
        rows[1]["score"]["wordEdits"] = 3
        result = assessment(rows)
        self.assertFalse(result["developmentPass"])
        self.assertEqual(result["regressions"], [NAMES[0]])

    def test_slow_empty_or_incomplete_output_fails(self):
        rows = self.rows()
        rows[1]["decodeMs"] = 400
        self.assertFalse(assessment(rows)["latencyGate"])
        rows[1]["text"] = ""
        self.assertFalse(assessment(rows)["developmentPass"])
        with self.assertRaises(ValueError):
            assessment(rows[:-1])


if __name__ == "__main__":
    unittest.main()
