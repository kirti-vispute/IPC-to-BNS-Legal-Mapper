"""Synthetic timing checks; no inference, standby or production changes."""
import concurrent.futures
import json
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.audit_speech_deadlines import audit_rows, standby_intervals, validate_power_events, write_new
from scripts.assess_marathi_decoder import bounded_reply


class SpeechDeadlineTests(unittest.TestCase):
    def test_over_budget_result_is_not_usable_latency_evidence(self):
        result = audit_rows([{"filename": "synthetic", "beam": 2, "decodeMs": 1702734}])
        self.assertFalse(result["recordedDecodeBudgetSatisfied"])
        self.assertEqual(result["violations"][0]["reason"], "elapsed-budget-exceeded")

    def test_positive_finite_budget_and_timings(self):
        self.assertTrue(audit_rows([{"decodeMs": 120000}])["recordedDecodeBudgetSatisfied"])
        for value in [None, True, 0, -1, float("nan"), float("inf")]:
            self.assertFalse(audit_rows([{"decodeMs": value}])["recordedDecodeBudgetSatisfied"])
        for value in [True, 0, float("inf")]:
            with self.assertRaises(ValueError):
                audit_rows([], value)

    def test_empty_and_error_rows_do_not_pass(self):
        self.assertFalse(audit_rows([])["recordedDecodeBudgetSatisfied"])
        self.assertFalse(audit_rows([{"decodeMs": 1, "error": "synthetic"}])["recordedDecodeBudgetSatisfied"])
        self.assertFalse(audit_rows([{"decodeMs": 1}])["controlledLatencyClaimSupported"])

    def test_future_can_return_after_notification_without_elapsed_validation(self):
        future = concurrent.futures.Future()
        # Simulate a notification on resume; this does not suspend the laptop.
        with patch.object(future._condition, "wait", side_effect=lambda timeout: future.set_result("late")):
            self.assertEqual(future.result(timeout=0.001), "late")
        self.assertFalse(audit_rows([{"decodeMs": 1702734}])["recordedDecodeBudgetSatisfied"])

    def test_power_intervals_are_sorted_and_unmatched_events_not_guessed(self):
        events = [{"id": 507, "utc": "2026-10-03T16:09:01Z"},
                  {"id": 506, "utc": "2026-10-03T15:40:50Z"}]
        self.assertEqual(standby_intervals(events)[0]["seconds"], 1691)
        self.assertEqual(standby_intervals(events[:1]), [])
        self.assertEqual(standby_intervals(events[1:]), [])

    def test_audit_evidence_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "report.json"
            write_new(path, {"original": True})
            with self.assertRaises(FileExistsError):
                write_new(path, {"original": False})
            self.assertEqual(json.loads(path.read_text(encoding="utf-8")), {"original": True})

    def test_time_zone_shifted_or_naive_event_cannot_be_used_as_evidence(self):
        start, end = 1791043200, 1791046800  # 2026-10-03 16:00..17:00 UTC
        correct = [{"id": 507, "utc": "2026-10-03T16:09:01Z"}]
        self.assertEqual(validate_power_events(correct, start, end), correct)
        for utc in ["2026-10-03T10:39:01Z", "2026-10-03T16:09:01"]:
            with self.assertRaises(ValueError):
                validate_power_events([{"id": 507, "utc": utc}], start, end)

    def test_completed_response_after_clock_jump_is_rejected(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            times = iter([0, 1702.734])
            with self.assertRaises(TimeoutError):
                bounded_reply(executor, io.StringIO('{"ready":true}\n'), clock=lambda: next(times))
            times = iter([0, 1])
            self.assertEqual(bounded_reply(executor, io.StringIO('{"ready":true}\n'),
                                           clock=lambda: next(times)), {"ready": True})

    def test_reply_framing_and_underlying_timeout_are_preserved(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            with self.assertRaises(ValueError):
                bounded_reply(executor, io.StringIO('no newline'))
        executor = unittest.mock.Mock()
        executor.submit.return_value.result.side_effect = TimeoutError
        with self.assertRaises(TimeoutError):
            bounded_reply(executor, io.StringIO(''))
        executor.submit.return_value.result.assert_called_once_with(timeout=120)


if __name__ == "__main__":
    unittest.main()
