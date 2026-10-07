"""Synthetic scope/assessment contracts, not speech accuracy."""
import unittest
from scripts.study_hindi_cue import CUE, CueAdapter, assessment


class HindiCueStudyTests(unittest.TestCase):
    def test_adapter_changes_only_context(self):
        class Model:
            def transcribe(self, audio, **options):
                return audio, options
        options = dict(language="hi", initial_prompt=None, beam_size=3, temperature=0, vad_filter=True,
                       condition_on_previous_text=False, task="transcribe")
        original = dict(options)
        old = CueAdapter(Model(), "baseline").transcribe("audio", **options)[1]
        new = CueAdapter(Model(), "cue").transcribe("audio", **options)[1]
        self.assertEqual([key for key in old if old[key] != new[key]], ["initial_prompt"])
        self.assertEqual(new["initial_prompt"], CUE)
        self.assertEqual(options, original)
        with self.assertRaises(ValueError):
            CueAdapter(Model(), "cue").transcribe("audio", **{**options, "language": "mr"})
        with self.assertRaises(ValueError):
            CueAdapter(Model(), "other")

    def rows(self):
        rows = [{"filename": name, "arm": arm, "text": "synthetic speech", "decodeMs": 100,
                 "score": {"wordEdits": 2 if arm == "baseline" else 1, "words": 10,
                           "characterEdits": 4 if arm == "baseline" else 2, "characters": 100}}
                for name in ("a", "b") for arm in ("baseline", "cue")]
        return rows + [{"filename": "synthetic-silence", "arm": arm, "text": "", "decodeMs": 10}
                       for arm in ("baseline", "cue")]

    def test_complete_improvement_can_pass_but_is_not_deployment(self):
        result = assessment(self.rows(), ["a", "b"])
        self.assertTrue(result["passed"])
        self.assertFalse(result["productionDeployment"])

    def test_regression_rejects_aggregate_gain(self):
        rows = self.rows()
        rows[1]["score"]["characterEdits"] = 5
        self.assertFalse(assessment(rows, ["a", "b"])["passed"])

    def test_silence_and_cue_copy_reject(self):
        for index, text in ((-1, "invented"), (1, CUE)):
            rows = self.rows()
            rows[index]["text"] = text
            self.assertFalse(assessment(rows, ["a", "b"])["silenceAndCueGate"])

    def test_slow_empty_error_missing_or_duplicate_fails(self):
        for field, value in (("decodeMs", 180001), ("text", ""), ("error", "failed")):
            rows = self.rows()
            rows[1][field] = value
            self.assertFalse(assessment(rows, ["a", "b"])["passed"])
        with self.assertRaises(ValueError):
            assessment(self.rows()[:-1], ["a", "b"])
        rows = self.rows()
        rows[1] = rows[0]
        with self.assertRaises(ValueError):
            assessment(rows, ["a", "b"])


if __name__ == "__main__":
    unittest.main()
