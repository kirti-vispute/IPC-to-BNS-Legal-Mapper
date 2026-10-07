"""Actual installed timestamp-splitting contracts, not acoustic accuracy tests."""
import unittest

from scripts.audit_speech_continuation import settings, split, summarize, TIMESTAMP_BEGIN as TB


class SpeechContinuationTests(unittest.TestCase):
    def test_production_inherits_timestamped_defaults(self):
        current = settings()
        self.assertEqual(current["max_length"], 448)
        self.assertEqual(current["sourceDerivedStepBound"], 224)
        self.assertIsNone(current["max_new_tokens"])
        self.assertFalse(current["without_timestamps"])
        self.assertFalse(current["condition_on_previous_text"])

    def test_bound_length_without_pairs_advances_whole_window(self):
        segments, seek, ending = split([TB] + [100] * 223, seek=3000)
        self.assertEqual(seek, 6000)
        self.assertEqual((segments[0]["start"], segments[0]["end"]), (30, 60))
        self.assertFalse(ending)
        segments, seek, ending = split([TB] + [100] * 222 + [TB + 50])
        self.assertEqual(segments[0]["end"], 1)
        self.assertEqual(seek, 3000)
        self.assertTrue(ending)

    def test_unfinished_tail_rewinds_but_complete_pair_advances(self):
        tokens = [TB, 100, TB + 100, TB + 100, 101]
        segments, seek, ending = split(tokens)
        self.assertEqual(seek, 200)
        self.assertEqual(len(segments), 1)
        self.assertEqual(segments[0]["end"], 2)
        self.assertFalse(ending)
        segments, seek, ending = split(tokens + [TB + 200])
        self.assertEqual(seek, 3000)
        self.assertEqual(len(segments), 2)
        self.assertTrue(ending)
        self.assertEqual(tokens, [TB, 100, TB + 100, TB + 100, 101])

    def test_unusable_or_duplicate_saved_evidence_rejected(self):
        with self.assertRaises(ValueError):
            summarize({"diagnosticUsable": False}, 224)
        with self.assertRaises(ValueError):
            summarize({"diagnosticUsable": True, "rows": [{"filename": "same"}] * 8}, 224)


if __name__ == "__main__":
    unittest.main()
