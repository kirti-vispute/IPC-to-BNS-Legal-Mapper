"""Synthetic trace contracts; no speech model or recordings initialized."""
import io
import unittest
import wave
from types import SimpleNamespace

from scripts.trace_long_marathi_speech import assemble, assess, tracing_model


class LongSpeechTraceTests(unittest.TestCase):
    def test_assembly_preserves_full_clip_order_and_pcm_recipe(self):
        import numpy as np
        clips = [np.array([-1, 0, 1], dtype=np.float32), np.array([0.5], dtype=np.float32)]
        body, info = assemble(clips, ["first", "second"], target=6)
        self.assertEqual(info["samples"], 7)
        self.assertEqual(info["reference"], "first second first")
        self.assertEqual([span["clipIndex"] for span in info["repetitions"]], [0, 1, 0])
        with wave.open(io.BytesIO(body), "rb") as stream:
            self.assertEqual(stream.getparams()[:4], (1, 2, 16000, 7))
            self.assertEqual(np.frombuffer(stream.readframes(7), dtype="<i2").tolist(), [-32767, 0, 32767, 16383, -32767, 0, 32767])
        with self.assertRaises(ValueError):
            assemble([], [], 1)

    def test_observer_returns_original_results_and_preserves_tokens(self):
        decoded = (SimpleNamespace(sequences_ids=[[50364, 100, 50464]], no_speech_prob=0.01), -0.2, 0, 1)
        original_split = ([{"start": 0, "end": 2, "tokens": [50364, 100, 50464]}], 200, False)
        calls, events = [], []
        class Base:
            def __init__(self):
                self.feature_extractor = SimpleNamespace(nb_max_frames=3000)
                self.max_length, self.frames_per_second = 448, 100
            def generate_segments(self, features):
                yield "placeholder"
            def generate_with_fallback(self, *args):
                calls.append(args)
                return decoded
            def _split_segments_by_timestamps(self, **kwargs):
                return original_split
        model = tracing_model(Base, lambda kind, value: events.append((kind, dict(value))))()
        self.assertEqual(list(model.generate_segments(SimpleNamespace(shape=(80, 6001)))), ["placeholder"])
        tokenizer = SimpleNamespace(decode=lambda ids: "synthetic", language=50320, task=50359, language_code="mr")
        options = SimpleNamespace(no_speech_threshold=0.6, log_prob_threshold=-1)
        prompt = [50258, 50320, 50359]
        self.assertIs(model.generate_with_fallback("encoder", prompt, tokenizer, options), decoded)
        self.assertIs(calls[0][1], prompt)
        self.assertIs(model._split_segments_by_timestamps(seek=0, segment_size=3000), original_split)
        self.assertEqual(model.trace_seek, 200)
        self.assertEqual(decoded[0].sequences_ids, [[50364, 100, 50464]])
        self.assertEqual([kind for kind, _ in events], ["features", "generation", "split"])
        self.assertEqual(model.trace_windows[0]["sourceDerivedStepBound"], 224)

    def test_assessment_rejects_interruption_incomplete_trace_and_unavailable_power(self):
        result = {"parentRequestMs": 1000, "workerRequestMs": 1000,
                  "workerStartUtc": "2026-10-05T10:00:00Z", "workerEndUtc": "2026-10-05T10:00:01Z",
                  "windows": [{"seekBeforeFrame": 0, "seekAfterFrame": 3000, "atStepBound": True,
                               "inputEndFrame": 3000, "segmentFrames": 3000}], "contentFrames": 3000,
                  "response": {"text": "synthetic"}, "vad": [{}], "logsTruncated": False}
        power = {"available": True, "events": []}
        self.assertTrue(assess(result, power, True)["traceUsable"])
        self.assertFalse(assess(result, power, False)["traceUsable"])
        self.assertFalse(assess(result, {"available": False, "events": []}, True)["traceUsable"])
        self.assertFalse(assess({**result, "workerRequestMs": 120001}, power, True)["traceUsable"])
        self.assertFalse(assess({**result, "windows": [{}]}, power, True)["traceUsable"])
        self.assertFalse(assess({**result, "contentFrames": 6000}, power, True)["traceUsable"])
        self.assertFalse(assess({**result, "workerEndUtc": "2026-10-05T10:01:01Z"}, power, True)["traceUsable"])
        self.assertEqual(assess(result, power, True)["boundLengthWindows"], 1)

    def test_transcribe_wrapper_yields_original_segment_and_unchanged_arguments(self):
        from dataclasses import dataclass
        @dataclass
        class Segment:
            text: str
        segment, info, calls = Segment("synthetic"), object(), []
        class Base:
            def __init__(self):
                pass
            def transcribe(self, *args, **kwargs):
                calls.append((args, kwargs))
                return iter([segment]), info
        events = []
        model = tracing_model(Base, lambda kind, value: events.append((kind, value)))()
        generated, observed_info = model.transcribe("audio", language="mr", beam_size=3)
        self.assertIs(observed_info, info)
        self.assertIs(next(generated), segment)
        self.assertEqual(list(generated), [])
        self.assertEqual(calls, [(("audio",), {"language": "mr", "beam_size": 3})])
        self.assertEqual(events, [("emitted", {"text": "synthetic"})])


if __name__ == "__main__":
    unittest.main()
