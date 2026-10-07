"""Contracts for installed control replay, not acoustic recognition tests."""
import unittest
from unittest.mock import patch
from types import SimpleNamespace

import numpy as np
from faster_whisper import WhisperModel
from faster_whisper.audio import pad_or_trim

from scripts.audit_final_speech_window import replay_window
from scripts.audit_speech_continuation import split, TIMESTAMP_BEGIN as TB


class FinalSpeechWindowTests(unittest.TestCase):
    def synthetic(self, logprob=-0.1):
        text = "repeated " * 40
        window = {"window": 0, "tokens": [TB] + [100] * 223, "tokenCount": 224,
                  "inputEndFrame": 6004, "seekBeforeFrame": 6000, "segmentFrames": 4,
                  "avgLogprob": logprob, "noSpeechProbability": 0.73,
                  "promptTokens": [50258, 50320, 50359], "decodedText": text}
        tokenizer = SimpleNamespace(sot_sequence=window["promptTokens"], timestamp_begin=TB, decode=lambda tokens: text)
        options = dict(temperatures=[0], word_timestamps=False, multilingual=False, initial_prompt=None,
                       without_timestamps=False, prefix=None, hotwords=None, clip_timestamps=[0],
                       max_initial_timestamp=1, max_new_tokens=None, beam_size=3, patience=1,
                       length_penalty=1, repetition_penalty=1, no_repeat_ngram_size=0,
                       suppress_blank=True, suppress_tokens=[1], compression_ratio_threshold=2.4,
                       log_prob_threshold=-1, no_speech_threshold=0.6, condition_on_previous_text=False,
                       prompt_reset_on_temperature=0.5)
        return window, options, tokenizer

    def test_four_real_feature_frames_are_padded_not_trimmed(self):
        features = np.ones((80, 4), dtype=np.float32)
        result = pad_or_trim(features)
        self.assertEqual(result.shape, (80, 3000))
        np.testing.assert_array_equal(result[:, :4], features)
        self.assertTrue(np.all(result[:, 4:] == 0))
        self.assertEqual(features.shape, (80, 4))

    def test_high_confidence_overrides_high_no_speech_without_model_init(self):
        window, options, tokenizer = self.synthetic()
        with patch.object(WhisperModel, "__init__", side_effect=AssertionError("No model initialization")):
            result = replay_window(window, options, tokenizer, 1500)
        self.assertEqual(len(result["segments"]), 1)
        self.assertAlmostEqual(result["segments"][0]["end"], 60.04)
        self.assertEqual(result["splits"][0]["seekAfterFrame"], 6004)
        self.assertEqual(result["encodings"][0]["zeroPaddedFrames"], 2996)

    def test_low_confidence_and_high_no_speech_skips_emission(self):
        result = replay_window(*self.synthetic(-1.2), 1500)
        self.assertEqual(result["segments"], [])
        self.assertEqual(result["splits"], [])

    def test_repetition_failure_with_one_temperature_still_returns_result(self):
        result = replay_window(*self.synthetic(), 1500)
        self.assertEqual(result["stubGenerationCalls"], 1)
        self.assertGreater(result["segments"][0]["compression_ratio"], 2.4)
        self.assertTrue(any("Compression ratio threshold" in record["message"] for record in result["logs"]))

    def test_timestamp_outside_real_window_is_not_clamped(self):
        segments, seek, ending = split([TB, 100, TB + 763], seek=3000, size=1500)
        self.assertAlmostEqual(segments[0]["end"], 45.26)
        self.assertEqual(seek, 4500)
        self.assertTrue(ending)

    def test_invalid_window_is_rejected_before_control_replay(self):
        window, options, tokenizer = self.synthetic()
        window["tokenCount"] = 223
        with self.assertRaises(ValueError):
            replay_window(window, options, tokenizer, 1500)


if __name__ == "__main__":
    unittest.main()
