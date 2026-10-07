"""Offline warning semantics and original-response preservation, not ASR accuracy."""
import copy
import unittest

from scripts.assess_speech_review_warning import assess_window, add_review_metadata
from scripts.audit_speech_continuation import TIMESTAMP_BEGIN as TB


class SpeechReviewWarningTests(unittest.TestCase):
    def inputs(self):
        window = {"tokens": [TB] + [100] * 223, "promptTokens": [50258, 50320, 50359],
                  "noSpeechProbability": 0.73, "avgLogprob": -0.14, "compressionRatio": 13.6}
        options = dict(max_new_tokens=None, without_timestamps=False, no_speech_threshold=0.6,
                       log_prob_threshold=-1, compression_ratio_threshold=2.4)
        return window, options

    def assess(self, window, options):
        return assess_window(window, options, 448, TB)

    def test_bound_without_ending_warns_and_separates_supporting_evidence(self):
        result = self.assess(*self.inputs())
        self.assertEqual(result["sourceDerivedStepBound"], 224)
        self.assertTrue(result["requiresReview"])
        self.assertTrue(result["supportingEvidence"]["contradictorySilenceConfidence"])
        self.assertTrue(result["supportingEvidence"]["compressionThresholdExceeded"])

    def test_valid_ending_at_bound_does_not_warn_despite_repetition_or_silence(self):
        window, options = self.inputs()
        window["tokens"][-1] = TB + 100
        result = self.assess(window, options)
        self.assertTrue(result["completedEndingTimestamp"])
        self.assertFalse(result["requiresReview"])

    def test_below_bound_ordinary_or_repeated_text_does_not_warn(self):
        window, options = self.inputs()
        for count in (1, 60, 223):
            window["tokens"] = [TB] + [100] * (count - 1)
            result = self.assess(window, options)
            self.assertFalse(result["requiresReview"])
            self.assertTrue(result["supportingEvidence"]["compressionThresholdExceeded"])

    def test_warning_does_not_require_repetition_or_high_silence(self):
        window, options = self.inputs()
        window.update(noSpeechProbability=0.01, compressionRatio=1)
        result = self.assess(window, options)
        self.assertTrue(result["requiresReview"])
        self.assertFalse(result["supportingEvidence"]["contradictorySilenceConfidence"])

    def test_original_response_tokens_options_and_native_text_remain_exact(self):
        window, options = self.inputs()
        response = {"text": "\u091a\u094b\u0930\u0940 20/06/2024 IPC 379 \ufffd repeat repeat", "originalLanguage": None}
        before = copy.deepcopy((response, window, options))
        result = add_review_metadata(response, [window], options, {"max_length": 448})
        self.assertEqual(result["text"].encode("utf-8"), response["text"].encode("utf-8"))
        self.assertEqual((response, window, options), before)
        self.assertNotIn("speechReview", response)
        self.assertFalse(result["speechReview"]["textModified"])

    def test_paired_unfinished_tail_warns_even_if_original_seek_can_recover_it(self):
        window, options = self.inputs()
        window["tokens"][10:14] = [TB + 100, TB + 100, 101, 102]
        window.update(seekBeforeFrame=3000, seekAfterFrame=3200)
        self.assertTrue(self.assess(window, options)["requiresReview"])
        self.assertEqual(window["seekAfterFrame"], 3200)

    def test_invalid_metadata_or_changed_budget_is_not_reported_clear(self):
        window, options = self.inputs()
        for replacement in ([], [True], [-1]):
            with self.assertRaises(ValueError):
                self.assess({**window, "tokens": replacement}, options)
        with self.assertRaises(ValueError):
            self.assess({**window, "tokenCount": 1}, options)
        with self.assertRaises(ValueError):
            self.assess({**window, "compressionRatio": float("nan")}, options)
        with self.assertRaises(ValueError):
            self.assess(window, {**options, "max_new_tokens": 50})
        with self.assertRaises(ValueError):
            add_review_metadata({"error": "SPEECH_PROCESS_ERROR"}, [window], options, {"max_length": 448})
        with self.assertRaises(ValueError):
            add_review_metadata({"text": ""}, [window], options, {"max_length": 448})
        with self.assertRaises(KeyError):
            self.assess(window, {})


if __name__ == "__main__":
    unittest.main()
