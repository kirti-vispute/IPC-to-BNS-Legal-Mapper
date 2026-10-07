"""Sample accounting contracts only, not speech annotations."""
import unittest
from scripts.audit_marathi_vad import interval_summary


class VadRetentionTests(unittest.TestCase):
    def test_full_retention_has_no_discarded_samples(self):
        result = interval_summary(100, [{"start": 0, "end": 100}])
        self.assertEqual(result["retainedFraction"], 1)
        self.assertEqual(result["discardedSamples"], 0)
        self.assertEqual(result["discardedIntervals"], [])

    def test_prefix_internal_gap_suffix_are_accounted_once(self):
        result = interval_summary(100, [{"start": 10, "end": 30}, {"start": 50, "end": 90}])
        self.assertEqual(result["retainedSamples"], 60)
        self.assertEqual(result["discardedSamples"], 40)
        self.assertEqual(result["discardedIntervals"], [{"start": 0, "end": 10},
                                                      {"start": 30, "end": 50}, {"start": 90, "end": 100}])

    def test_no_speech_and_adjacent_chunks(self):
        self.assertEqual(interval_summary(100, [])["discardedIntervals"], [{"start": 0, "end": 100}])
        self.assertEqual(interval_summary(100, [{"start": 0, "end": 30}, {"start": 30, "end": 100}])["discardedSamples"], 0)

    def test_invalid_sample_bounds_and_types_are_rejected(self):
        for start, end in [(-1, 50), (50, 50), (80, 50), (0, 101), (True, 20), (0, 20.5)]:
            with self.assertRaises(ValueError):
                interval_summary(100, [{"start": start, "end": end}])
        for size in [0, -1, True, 100.5]:
            with self.assertRaises(ValueError):
                interval_summary(size, [])

    def test_overlap_or_reordered_intervals_cannot_inflate_retention(self):
        for intervals in [[{"start": 0, "end": 70}, {"start": 50, "end": 100}],
                          [{"start": 60, "end": 90}, {"start": 0, "end": 30}]]:
            with self.assertRaises(ValueError):
                interval_summary(100, intervals)


if __name__ == "__main__":
    unittest.main()
