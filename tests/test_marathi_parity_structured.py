"""Structured output must retain the full registered source prefix."""
import unittest

from scripts.compare_marathi_checkpoints import source_generated_tokens


class StructuredSourceOutputTests(unittest.TestCase):
    def test_only_full_marathi_prefix_is_accepted(self):
        self.assertEqual(source_generated_tokens([50258, 50320, 50359, 50363, 123, 50257]), [123, 50257])
        for sequence in ([123, 50257], [50258, 50259, 50359, 50363, 123]):
            with self.assertRaises(ValueError):
                source_generated_tokens(sequence)


if __name__ == "__main__":
    unittest.main()
