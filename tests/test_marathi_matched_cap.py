import unittest

from scripts.compare_marathi_matched_cap import CT2_CAP, TOKEN_BUDGET, compare_rows, normalize_eos


class MatchedCapTests(unittest.TestCase):
    def test_only_terminal_eos_is_removed(self):
        self.assertEqual(normalize_eos([42, 50257], True), [42])
        self.assertEqual(normalize_eos([42]), [42])
        for tokens in ([42], [42, 50257, 43, 50257], [True, 50257], [-1, 50257]):
            with self.assertRaises(ValueError):
                normalize_eos(tokens, True)

    def test_eos_parity_does_not_hide_text_token_differences(self):
        left = [{"filename": f"mr-{i}", "tokens": [42], "text": "x"} for i in range(8)]
        right = [{**row, "tokens": [42, 50257]} for row in left]
        self.assertEqual(compare_rows(left, right)["normalizedTokenMatches"], 8)
        left[0]["tokens"] = [43]
        self.assertEqual(compare_rows(left, right)["normalizedTokenMatches"], 7)
        right[1]["filename"] = right[0]["filename"]
        with self.assertRaises(ValueError):
            compare_rows(left, right)
        with self.assertRaises(ValueError):
            compare_rows(left[:7], right)

    def test_registered_budget_accounts_for_internal_half_bound(self):
        self.assertEqual(min(CT2_CAP // 2, CT2_CAP - 3), TOKEN_BUDGET)
        self.assertLessEqual(CT2_CAP, 448)


if __name__ == "__main__":
    unittest.main()
