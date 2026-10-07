"""Contracts for comparing the same input without reporting invented parity."""
import unittest

from scripts.compare_marathi_checkpoints import source_generated_tokens, summarize


class MarathiCheckpointParityTests(unittest.TestCase):
    def test_source_requires_exact_marathi_prompt(self):
        self.assertEqual(source_generated_tokens([50258, 50320, 50359, 50363, 42, 50257]), [42, 50257])
        for values in ([50258, 50259, 50359, 50363, 42], [50258, 50320, 50359], [42, 50257]):
            with self.assertRaises(ValueError):
                source_generated_tokens(values)

    def test_summary_requires_complete_matched_outputs(self):
        left = [{"filename": f"mr-{i}.wav", "tokens": [i], "text": str(i)} for i in range(8)]
        right = [dict(item) for item in left]
        self.assertEqual(summarize(left, right)["sameTokens"], 8)
        self.assertEqual(summarize(left, right)["sameText"], 8)
        right[3]["tokens"] = [99]
        self.assertEqual(summarize(left, right)["sameTokens"], 7)
        self.assertEqual(summarize(left, right)["sameText"], 8)
        right[3]["filename"] = "other.wav"
        with self.assertRaises(ValueError):
            summarize(left, right)
        with self.assertRaises(ValueError):
            summarize(left, right[:7])


if __name__ == "__main__":
    unittest.main()
