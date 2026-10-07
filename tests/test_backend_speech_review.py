"""Production review contracts; no neural inference or speech-accuracy labels."""
import copy
import logging
import subprocess
import unittest
from pathlib import Path
from types import SimpleNamespace as NS
from unittest.mock import patch

from backend.speech.review import assess_window, review_model_class, supported_runtime
from backend.speech.transcribe import recognize
from scripts.assess_speech_review_warning import assess_window as frozen_assess, saved_cases

TB = 50364
OPTIONS = dict(max_new_tokens=None, without_timestamps=False, no_speech_threshold=0.6,
               log_prob_threshold=-1, compression_ratio_threshold=2.4)
TEXT = "\u092e\u094b\u092c\u093e\u0907\u0932 \u091a\u094b\u0930\u0940 20/06/2024 IPC 379 \ufffd"


class Base:
    max_length = 448

    def __init__(self):
        self.tokens = [TB] + [100] * 223
        self.calls = []
        self.options = NS(**OPTIONS)
        self.failure = False

    def generate_with_fallback(self, *args):
        self.calls.append(args)
        self.decoded = (NS(sequences_ids=[self.tokens], no_speech_prob=0.73), -0.14, 0, 13.6)
        return self.decoded

    def detect_language(self, **kwargs):
        return "en", 0.9, None

    def transcribe(self, audio, **kwargs):
        self.transcribe_options = kwargs
        def segments():
            self.generate_with_fallback("encoder", [50258, 50320, 50359], NS(timestamp_begin=TB), self.options)
            if self.failure:
                raise RuntimeError("synthetic recognition failure")
            yield NS(text=TEXT)
        return segments(), None


class BackendSpeechReviewTests(unittest.TestCase):
    def model(self, supported=True):
        return review_model_class(Base, supported)()

    def recognize(self, model, language="mr", size=16000):
        return recognize(b"synthetic audio", model, language, lambda *args, **kwargs: NS(size=size))

    def test_delegation_identity_and_no_input_mutation(self):
        model = self.model()
        prompt, options, tokenizer = [50258, 50320, 50359], NS(**OPTIONS), NS(timestamp_begin=TB)
        before = copy.deepcopy((model.tokens, prompt, vars(options)))
        returned = model.generate_with_fallback("encoder", prompt, tokenizer, options)
        self.assertIs(returned, model.decoded)
        self.assertIs(model.calls[0][1], prompt)
        self.assertEqual(len(model.calls), 1)
        self.assertEqual(before, (model.tokens, prompt, vars(options)))
        self.assertTrue(model.speech_review()["requiresReview"])

    def test_actual_recognize_preserves_native_text_options_and_resets(self):
        model = self.model()
        result = self.recognize(model)
        original = self.recognize(Base())
        self.assertEqual({k: v for k, v in result.items() if k != "speechReview"}, original)
        self.assertEqual(result["text"].encode(), TEXT.encode())
        self.assertEqual(result["speechReview"]["warningWindows"], [0])
        self.assertEqual(result["speechReview"]["silenceConfidenceWindows"], [0])
        self.assertEqual(model.transcribe_options, dict(task="transcribe", language="mr", beam_size=3,
            temperature=0, vad_filter=True, condition_on_previous_text=False, initial_prompt=None))
        self.assertEqual(model.speech_review()["windowCount"], 0)
        self.assertIsNone(model.speech_review()["requiresReview"])

    def test_consecutive_and_repeated_requests_do_not_leak(self):
        model = self.model()
        first = self.recognize(model)
        second = self.recognize(model)
        self.assertEqual(first, second)
        model.tokens = [TB, 100, TB + 50]
        third = self.recognize(model)
        self.assertEqual(third["speechReview"]["windowCount"], 1)
        self.assertFalse(third["speechReview"]["requiresReview"])
        self.assertEqual(third["speechReview"]["warningWindows"], [])
        self.assertEqual(first["speechReview"]["warningWindows"], [0])

    def test_decode_and_generation_failures_keep_error_contract_and_clear_state(self):
        model = self.model()
        for size, expected in ((0, "INVALID_AUDIO"), (90 * 16000 + 1, "AUDIO_TOO_LONG")):
            self.assertEqual(self.recognize(model, size=size), {"error": expected})
            self.assertEqual(model.speech_review()["windowCount"], 0)
        self.assertEqual(recognize(b"bad", model, "mr", lambda *a, **k: 1 / 0), {"error": "INVALID_AUDIO"})
        model.failure = True
        self.assertEqual(self.recognize(model), {"error": "SPEECH_PROCESS_ERROR"})
        self.assertEqual(model.speech_review()["windowCount"], 0)
        model.failure = False
        model.tokens = [TB, 100, TB + 50]
        self.assertFalse(self.recognize(model)["speechReview"]["requiresReview"])

    def test_invalid_or_unsupported_observation_is_unknown_not_clear_or_failed_speech(self):
        for supported, options in ((False, OPTIONS), (True, {**OPTIONS, "max_new_tokens": 50}),
                                   (True, {**OPTIONS, "compression_ratio_threshold": float("nan")})):
            model = self.model(supported)
            model.options = NS(**options)
            result = self.recognize(model)
            self.assertEqual(result["text"], TEXT)
            self.assertEqual(result["speechReview"]["status"], "unavailable")
            self.assertIsNone(result["speechReview"]["requiresReview"])
            self.assertEqual(result["speechReview"]["warningWindows"], [])

    def test_bounded_metadata_and_returned_snapshots(self):
        model = self.model()
        for _ in range(128):
            model.generate_with_fallback(None, [1, 2], NS(timestamp_begin=TB), NS(**OPTIONS))
        summary = model.speech_review()
        self.assertEqual(len(summary["warningWindows"]), 128)
        summary["warningWindows"].clear()
        self.assertEqual(len(model.speech_review()["warningWindows"]), 128)
        model.generate_with_fallback(None, [1, 2], NS(timestamp_begin=TB), NS(**OPTIONS))
        self.assertEqual(model.speech_review()["status"], "unavailable")
        self.assertIsNone(model.speech_review()["requiresReview"])

    def test_hindi_auto_and_empty_text_do_not_gain_review_metadata(self):
        for language in ("hi", None):
            self.assertNotIn("speechReview", self.recognize(self.model(), language))
        model = self.model()
        model.transcribe = lambda *args, **kwargs: (iter([]), None)
        self.assertEqual(self.recognize(model), {"text": "", "originalLanguage": None, "languageProbability": None})

    def test_all_saved_windows_match_frozen_rule_and_observer(self):
        cases, windows = 0, 0
        for _, response, rows, options in saved_cases():
            cases += 1
            before = copy.deepcopy((response, rows, options))
            model = self.model()
            for index, row in enumerate(rows):
                windows += 1
                expected = frozen_assess(row, options, 448, TB)
                self.assertEqual(assess_window(row, options, 448, TB), expected)
                model.tokens = row["tokens"]
                def saved(*args, _row=row):
                    return (NS(sequences_ids=[_row["tokens"]], no_speech_prob=_row["noSpeechProbability"]),
                            _row["avgLogprob"], 0, _row["compressionRatio"])
                with patch.object(Base, "generate_with_fallback", saved):
                    model.generate_with_fallback(None, row["promptTokens"], NS(timestamp_begin=TB), NS(**options))
                self.assertEqual(index in model.speech_review()["warningWindows"], expected["requiresReview"])
            self.assertEqual(before, (response, rows, options))
        self.assertEqual((cases, windows), (10, 16))

    def test_installed_fallback_is_delegated_without_changing_generation_arguments(self):
        from faster_whisper import WhisperModel
        self.assertTrue(supported_runtime())
        observed_class = review_model_class(WhisperModel, True)
        model = observed_class.__new__(observed_class)
        model._review_supported = True
        model.reset_speech_review()
        model.max_length, model.time_precision = 448, 0.02
        model.logger = logging.getLogger("synthetic.review")
        calls = []
        result = NS(sequences_ids=[[TB] + [100] * 223], no_speech_prob=0.73, scores=[-0.14])
        model.model = NS(generate=lambda *args, **kwargs: calls.append((args, kwargs)) or [result])
        options = NS(**OPTIONS, max_initial_timestamp=1, temperatures=[0], beam_size=3, patience=1,
                     length_penalty=1, repetition_penalty=1, no_repeat_ngram_size=0,
                     suppress_blank=True, suppress_tokens=[-1])
        tokenizer = NS(timestamp_begin=TB, decode=lambda tokens: TEXT)
        original = WhisperModel.generate_with_fallback(model, "encoder", [50258, 50320, 50359], tokenizer, options)
        observed = model.generate_with_fallback("encoder", [50258, 50320, 50359], tokenizer, options)
        self.assertEqual(original, observed)
        self.assertIs(observed[0], result)
        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[0], calls[1])
        self.assertTrue(model.speech_review()["requiresReview"])

    def test_direct_worker_import_and_invalid_pure_metadata(self):
        import sys
        worker = Path(__file__).resolve().parents[1] / "backend/speech/transcribe.py"
        result = subprocess.run([sys.executable, str(worker), "--help"], capture_output=True, timeout=10)
        self.assertEqual(result.returncode, 0)
        for tokens in ([], [True], [-1]):
            with self.assertRaises(ValueError):
                assess_window(dict(tokens=tokens, promptTokens=[1, 2], noSpeechProbability=0.1,
                                   avgLogprob=-0.2, compressionRatio=1), OPTIONS, 448, TB)

    def test_file_spec_import_used_by_existing_diagnostics(self):
        from importlib.util import module_from_spec, spec_from_file_location
        worker = Path(__file__).resolve().parents[1] / "backend/speech/transcribe.py"
        spec = spec_from_file_location("isolated_speech_worker", worker)
        module = module_from_spec(spec)
        spec.loader.exec_module(module)
        result = module.recognize(b"synthetic", self.model(), "mr", lambda *a, **k: NS(size=16000))
        self.assertEqual(result["text"], TEXT)
        self.assertTrue(result["speechReview"]["requiresReview"])


if __name__ == "__main__":
    unittest.main()
