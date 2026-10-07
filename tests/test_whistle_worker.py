"""Synthetic checks for the Whistle worker's windowing and keyword loading; no model inference."""
import base64
import json
import tempfile
import unittest
from pathlib import Path

import numpy as np

from backend.speech import whistle_worker as worker

RATE = worker.SAMPLE_RATE
LIMIT = int(worker.WINDOW_SECONDS * RATE)


def tone(seconds, level=0.3):
    return (np.random.default_rng(7).uniform(-level, level, int(seconds * RATE))).astype("float32")


class WindowingTests(unittest.TestCase):
    def test_short_audio_is_a_single_window(self):
        audio = tone(12)
        windows = worker.split_windows(audio)
        self.assertEqual(len(windows), 1)
        self.assertTrue(np.array_equal(windows[0], audio))

    def test_windows_never_exceed_the_engine_limit_and_lose_no_samples(self):
        for seconds in (30, 31.5, 59, 60.2, 89.9, 90):
            audio = tone(seconds)
            windows = worker.split_windows(audio)
            self.assertTrue(all(0 < window.size <= LIMIT for window in windows), seconds)
            self.assertLessEqual(max(window.size for window in windows), 30 * RATE)
            self.assertTrue(np.array_equal(np.concatenate(windows), audio), seconds)

    def test_cut_lands_in_the_quiet_gap_not_inside_speech(self):
        audio = tone(40)
        gap_start, gap_end = int(27.0 * RATE), int(27.5 * RATE)
        audio[gap_start:gap_end] = 0
        first = worker.split_windows(audio)[0]
        self.assertGreaterEqual(first.size, gap_start)
        self.assertLessEqual(first.size, gap_end)

    def test_final_window_is_never_a_sliver(self):
        audio = tone(29.6)
        windows = worker.split_windows(audio)
        self.assertGreaterEqual(windows[-1].size, worker.MIN_TAIL_SECONDS * RATE)
        self.assertTrue(np.array_equal(np.concatenate(windows), audio))

    def test_audio_exactly_at_the_limit_is_not_split(self):
        self.assertEqual(len(worker.split_windows(tone(worker.WINDOW_SECONDS))), 1)


class KeywordTests(unittest.TestCase):
    def test_comments_and_blank_lines_are_ignored(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "words.txt"
            path.write_text("# note\n\nIPC\n  Indian Penal Code  \n  # indented comment\nBNS\n", encoding="utf-8")
            self.assertEqual(worker.load_keywords(path), ["IPC", "Indian Penal Code", "BNS"])

    def test_missing_file_means_no_biasing_rather_than_an_error(self):
        self.assertEqual(worker.load_keywords(Path("does-not-exist.txt")), [])

    def test_keyword_count_is_bounded(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "words.txt"
            path.write_text("\n".join(f"word{i}" for i in range(worker.MAX_KEYWORDS + 50)), encoding="utf-8")
            self.assertEqual(len(worker.load_keywords(path)), worker.MAX_KEYWORDS)

    def test_shipped_keyword_list_loads_and_stays_small(self):
        words = worker.load_keywords()
        self.assertIn("IPC", words)
        self.assertLess(len(words), 60)


class RecognizeTests(unittest.TestCase):
    class FakeWhistle:
        def __init__(self, texts):
            self.texts, self.calls = list(texts), []

        def transcribe(self, audio, language=None, keywords=None, word_timestamps=False):
            self.calls.append((audio.size, language, keywords))
            text = self.texts.pop(0)
            return {"text": text, "words": [{"word": word, "start": 0, "end": 0, "probability": 0.9} for word in text.split()]}

    def test_window_texts_are_joined_in_order_and_empty_windows_skipped(self):
        fake = self.FakeWhistle(["first part", "", "last part"])
        audio = tone(75)
        result = worker.recognize(b"", fake, None, ["IPC"], decoded_audio=audio)
        self.assertEqual(result["text"], "first part last part")
        self.assertEqual(result["originalLanguage"], "en")
        self.assertEqual([item["w"] for item in result["words"]], ["first", "part", "last", "part"])
        self.assertTrue(all(item["p"] == 0.9 for item in result["words"]))
        self.assertEqual(len(fake.calls), 3)
        self.assertTrue(all(call[1] == "en" and call[2] == ["IPC"] for call in fake.calls))

    def test_silence_yields_empty_text_for_the_caller_to_reject(self):
        result = worker.recognize(b"", self.FakeWhistle([""]), None, [], decoded_audio=tone(2))
        self.assertEqual(result["text"], "")

    def test_over_long_audio_is_rejected_before_inference(self):
        fake = self.FakeWhistle([])
        result = worker.recognize(b"", fake, None, [], decoded_audio=tone(91))
        self.assertEqual(result, {"error": "AUDIO_TOO_LONG"})
        self.assertEqual(fake.calls, [])

    def test_decoder_failure_and_engine_failure_become_safe_codes(self):
        def broken_decoder(*_args, **_kwargs):
            raise ValueError("not audio")

        self.assertEqual(worker.recognize(b"x", self.FakeWhistle([]), broken_decoder, []), {"error": "INVALID_AUDIO"})

        class Exploding:
            def transcribe(self, *_args, **_kwargs):
                raise RuntimeError("engine")

        self.assertEqual(worker.recognize(b"", Exploding(), None, [], decoded_audio=tone(2)), {"error": "SPEECH_PROCESS_ERROR"})


if __name__ == "__main__":
    unittest.main()
