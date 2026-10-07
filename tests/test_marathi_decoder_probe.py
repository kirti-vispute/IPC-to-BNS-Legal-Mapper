import unittest

from scripts.probe_marathi_decoder import PROMPTS, top_indices


class DecoderProbeTest(unittest.TestCase):
    def test_prefixes_include_observed_first_difference(self):
        self.assertEqual(PROMPTS["initial"], [50258, 50320, 50359, 50363])
        self.assertEqual(PROMPTS["divergence"][4:], [35082, 43372, 8485, 101, 21981])

    def test_excluded_token_cannot_win(self):
        self.assertEqual([row["id"] for row in top_indices([1, 3, 2], [1], 2)], [2, 0])

    def test_invalid_logits_are_rejected(self):
        with self.assertRaises(ValueError):
            top_indices([1, float("nan")])

    def test_suppressed_infinity_is_excluded_from_short_list(self):
        self.assertEqual([row["id"] for row in top_indices([1, float("-inf"), 2], allow_negative_infinity=True)], [2, 0])
        with self.assertRaises(ValueError):
            top_indices([float("-inf")], allow_negative_infinity=True)


if __name__ == "__main__":
    unittest.main()
