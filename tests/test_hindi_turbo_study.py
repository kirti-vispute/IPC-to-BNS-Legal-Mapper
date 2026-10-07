"""Synthetic preregistered model-comparison gates, not speech accuracy."""
import unittest
from scripts.study_hindi_turbo import assess, numeric, silence_bytes


class HindiTurboStudyTests(unittest.TestCase):
    def inputs(self):
        fixtures = [{"filename": str(i), "transcript": "एक शब्द 1767"} for i in range(2)]
        old = [{"filename": str(i), "text": "दूसरा गलत 1766", "requestMs": 100} for i in range(2)]
        new = [{"filename": str(i), "text": "एक शब्द 1767", "requestMs": 50} for i in range(2)]
        for rows in (old, new):
            rows.append({"filename": "synthetic-silence", "text": "", "requestMs": 10})
        return old, new, fixtures

    def test_complete_gain_passes_but_never_deploys(self):
        result = assess(*self.inputs())
        self.assertTrue(result["passed"])
        self.assertFalse(result["productionDeployment"])

    def test_per_clip_regression_rejects_aggregate_gain(self):
        old, new, fixtures = self.inputs()
        old[0]["text"] = fixtures[0]["transcript"]
        new[0]["text"] = "एक शब्द 1767 फिर"
        self.assertFalse(assess(old, new, fixtures)["qualityGate"])

    def test_numeric_guard_generalizes_and_rejects_wrong_year(self):
        self.assertEqual(numeric("दिन १७६७ और 2024"), ["1767", "2024"])
        old, new, fixtures = self.inputs()
        new[0]["text"] = "एक शब्द 1766"
        self.assertEqual(assess(old, new, fixtures)["numericFailures"], ["0"])

    def test_silence_script_empty_error_and_slow_fail(self):
        for index, key, value in ((-1, "text", "आवाज"), (0, "text", "english"), (0, "text", ""),
                                  (0, "error", "failed"), (0, "requestMs", 180001)):
            old, new, fixtures = self.inputs()
            new[index][key] = value
            self.assertFalse(assess(old, new, fixtures)["passed"])

    def test_missing_duplicate_unknown_replies_fail(self):
        old, new, fixtures = self.inputs()
        with self.assertRaises(ValueError):
            assess(old, new[:-1], fixtures)
        new[0] = new[1]
        with self.assertRaises(ValueError):
            assess(old, new, fixtures)

    def test_synthetic_silence_is_valid_one_second_wav(self):
        import io
        import wave
        with wave.open(io.BytesIO(silence_bytes()), "rb") as audio:
            self.assertEqual(audio.getnframes(), 16000)
            self.assertEqual(audio.getframerate(), 16000)
            self.assertEqual(audio.readframes(16000), b"\0" * 32000)


if __name__ == "__main__":
    unittest.main()
