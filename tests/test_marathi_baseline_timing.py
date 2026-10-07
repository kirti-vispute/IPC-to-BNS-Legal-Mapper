"""Synthetic profiling contracts, not speech/latency accuracy."""
import unittest
from scripts.profile_marathi_baseline import assess, timestamp


def rows():
    return [{"text": "synthetic", "parentRequestMs": 100, "workerRequestMs": 100,
             "decodeMs": 90, "audioPreparationMs": 10, "decodeCpuMs": 300,
             "workerStartUtc": "2026-10-04T01:00:00+00:00",
             "workerEndUtc": "2026-10-04T01:00:00.100+00:00"} for _ in range(8)]


class BaselineTimingTests(unittest.TestCase):
    def test_baseline_requires_complete_stable_parity_and_available_power_records(self):
        data = rows()
        self.assertTrue(assess(data, {"available": True, "events": []}, True, True)["measurementUsable"])
        for parity, stable in [(False, True), (True, False)]:
            self.assertFalse(assess(data, {"available": True, "events": []}, parity, stable)["measurementUsable"])
        for power in [{"available": False, "events": []}, {"available": True, "events": [{"id": 507}]}]:
            self.assertFalse(assess(data, power, True, True)["measurementUsable"])
        self.assertFalse(assess(data[:7], {"available": True, "events": []}, True, True)["measurementUsable"])

    def test_resume_clock_drift_and_late_response_invalidate_run(self):
        data = rows()
        data[0]["workerEndUtc"] = "2026-10-04T01:30:00+00:00"
        self.assertFalse(assess(data, {"available": True, "events": []}, True, True)["measurementUsable"])
        data = rows()
        data[0]["parentRequestMs"] = 1702734
        self.assertFalse(assess(data, {"available": True, "events": []}, True, True)["measurementUsable"])

    def test_cpu_can_exceed_wall_time_but_invalid_timings_cannot_pass(self):
        for value in [0, -1, float("nan"), True]:
            data = rows()
            data[0]["decodeMs"] = value
            self.assertFalse(assess(data, {"available": True, "events": []}, True, True)["measurementUsable"])
        result = assess(rows(), {"available": True, "events": []}, True, True)
        self.assertFalse(result["speedImprovementClaim"])
        self.assertFalse(result["generalAccuracyClaim"])
        with self.assertRaises(ValueError):
            timestamp("2026-10-04T01:00:00")


if __name__ == "__main__":
    unittest.main()
