import unittest

from scripts.probe_marathi_decoder_caps import cap_for_one_token


class DecoderCapTest(unittest.TestCase):
    def test_caps_account_for_supplied_text_and_internal_half_bound(self):
        for text_length in (0, 1, 5, 20):
            cap = cap_for_one_token(text_length)
            self.assertEqual(min(cap // 2, cap - 3), text_length + 1)

    def test_invalid_text_lengths_fail(self):
        for value in (-1, 1.5, None):
            with self.assertRaises(ValueError):
                cap_for_one_token(value)


if __name__ == "__main__":
    unittest.main()
