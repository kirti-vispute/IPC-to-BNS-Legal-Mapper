"""Bounded speech-risk metadata; never a correction or an accuracy verdict."""
import math
from importlib.metadata import version

MAX_REVIEW_WINDOWS = 128
WARNING = "REVIEW_SATURATED_UNFINISHED_WINDOW"


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def assess_window(window, options, max_length, timestamp_begin):
    if type(max_length) is not int or max_length <= 1 or type(timestamp_begin) is not int or timestamp_begin <= 0:
        raise ValueError("Invalid decoder limits")
    if options["max_new_tokens"] is not None or options["without_timestamps"] is not False:
        raise ValueError("Unaudited decoding path")
    tokens, prompt = window["tokens"], window["promptTokens"]
    if any(not isinstance(values, list) or not values or any(type(token) is not int or token < 0 for token in values)
           for values in (tokens, prompt)) or len(prompt) >= max_length:
        raise ValueError("Invalid tokens/prompt")
    if "tokenCount" in window and window["tokenCount"] != len(tokens):
        raise ValueError("Inconsistent token count")
    probability, logprob, compression = window["noSpeechProbability"], window["avgLogprob"], window["compressionRatio"]
    if not finite(probability) or not 0 <= probability <= 1 or not finite(logprob) or not finite(compression) or compression < 0:
        raise ValueError("Invalid generation metrics")
    silence, confidence, repetition = (options[key] for key in
                                      ("no_speech_threshold", "log_prob_threshold", "compression_ratio_threshold"))
    if any(value is not None and not finite(value) for value in (silence, confidence, repetition)):
        raise ValueError("Invalid thresholds")
    high_silence = silence is not None and probability > silence
    override = confidence is not None and logprob > confidence
    # This bound and ending predicate are version-specific, not a decoder stop reason.
    bound = min(max_length // 2, max_length - len(prompt) + 1)
    ending = len(tokens) >= 2 and tokens[-2] < timestamp_begin <= tokens[-1]
    at_bound = len(tokens) >= bound
    return {"tokenCount": len(tokens), "sourceDerivedStepBound": bound, "atStepBound": at_bound,
            "completedEndingTimestamp": ending, "requiresReview": at_bound and not ending,
            "warningCode": WARNING if at_bound and not ending else None,
            "supportingEvidence": {"highNoSpeech": high_silence, "logprobOverride": override,
                "expectedWindowSkip": high_silence and not override,
                "contradictorySilenceConfidence": high_silence and override,
                "compressionThresholdExceeded": repetition is not None and compression > repetition,
                "noSpeechProbability": probability, "avgLogprob": logprob, "compressionRatio": compression,
                "noSpeechThreshold": silence, "logProbThreshold": confidence, "compressionThreshold": repetition}}


def supported_runtime():
    try:
        return version("faster-whisper") == "1.2.1" and version("ctranslate2") == "4.8.2"
    except Exception:
        return False


class SpeechReviewObserver:
    def reset_speech_review(self):
        self._review_count = 0
        self._review_available = self._review_supported
        self._review_warning = []
        self._review_silence = []
        self._review_compression = []

    def speech_review(self):
        available = self._review_available and self._review_count > 0
        return {"version": 1, "status": "assessed" if available else "unavailable",
                "requiresReview": bool(self._review_warning) if available else None,
                "windowCount": self._review_count, "textModified": False,
                "warningCode": WARNING if available and self._review_warning else None,
                "warningWindows": list(self._review_warning) if available else [],
                "silenceConfidenceWindows": list(self._review_silence) if available else [],
                "compressionWindows": list(self._review_compression) if available else []}


def review_model_class(base_class, runtime_supported):
    class ReviewedModel(SpeechReviewObserver, base_class):
        def __init__(self, *args, **kwargs):
            self._review_supported = runtime_supported
            self.reset_speech_review()
            super().__init__(*args, **kwargs)

        def generate_with_fallback(self, encoder_output, prompt, tokenizer, options):
            decoded = super().generate_with_fallback(encoder_output, prompt, tokenizer, options)
            index = self._review_count
            self._review_count += 1
            if self._review_available:
                try:
                    if index >= MAX_REVIEW_WINDOWS:
                        raise ValueError("Review metadata limit reached")
                    result, logprob, _, compression = decoded
                    assessment = assess_window({"tokens": result.sequences_ids[0], "promptTokens": prompt,
                        "noSpeechProbability": result.no_speech_prob, "avgLogprob": logprob,
                        "compressionRatio": compression}, vars(options), self.max_length, tokenizer.timestamp_begin)
                    if assessment["requiresReview"]:
                        self._review_warning.append(index)
                    supporting = assessment["supportingEvidence"]
                    if supporting["contradictorySilenceConfidence"]:
                        self._review_silence.append(index)
                    if supporting["compressionThresholdExceeded"]:
                        self._review_compression.append(index)
                except Exception:
                    # An observation failure must not discard or rewrite recognized speech.
                    self._review_available = False
            return decoded
    return ReviewedModel
