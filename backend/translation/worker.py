"""Local language detection and translation. JSON stdin/stdout; no network or logs."""
import json
import os
import re
import sys
import hashlib
from pathlib import Path

LANGS = {"en": "eng_Latn", "hi": "hin_Deva", "mr": "mar_Deva", "gu": "guj_Gujr", "bn": "ben_Beng", "ta": "tam_Taml", "te": "tel_Telu", "kn": "kan_Knda", "ml": "mal_Mlym", "pa": "pan_Guru", "ur": "urd_Arab"}


def resolve_detection(text, ranking):
    language, confidence = ranking[0]
    probabilities = dict(ranking)
    words = set(re.findall(r"[\u0900-\u097f]+", text))
    # Independent grammatical families, not a script or single-keyword override.
    marathi = [
        {"रोजी", "पर्यंत"}, {"आणि", "किंवा"},
        {"झाले", "झाली", "झाला", "राहिले", "राहिली", "राहिला", "होते", "होती", "होता"},
        {"एका", "दुसऱ्या", "त्याच्या", "त्याची", "तिच्या"},
        {"घेतला", "घेतली", "घेतले", "संमतीशिवाय", "परवानगीशिवाय"},
    ]
    hindi = [{"और", "लेकिन", "अथवा"}, {"हुआ", "हुई", "हुए", "था", "थी", "थे"}, {"उसकी", "उसके", "उसका", "अपने", "को", "ने"}]
    mr_signals = sum(bool(words & family) for family in marathi)
    hi_signals = sum(bool(words & family) for family in hindi)
    guarded = (language == "hi" and float(confidence) < 0.98
               and len(ranking) > 1 and ranking[1][0] == "mr"
               and float(probabilities.get("mr", 0)) >= 0.05
               and mr_signals >= 3 and hi_signals == 0)
    if guarded:
        language = "mr"
    return {"language": language, "detected_language": language, "language_code": language,
            "confidence": float(probabilities[language]),
            "detection_method": "py3langid+marathi-consensus" if guarded else "py3langid",
            "reliable": guarded or float(confidence) >= 0.8,
            "model_language": ranking[0][0], "model_confidence": float(confidence),
            "marathi_signal_groups": mr_signals, "hindi_signal_groups": hi_signals}


class WorkerFailure(Exception):
    def __init__(self, code, segment_index=None, reason=None):
        self.code = code
        self.segment_index = segment_index
        self.reason = reason


def fail(code, segment_index=None, reason=None):
    raise WorkerFailure(code, segment_index, reason)


def load_display_catalog(model, path=None):
    path = path or Path(__file__).resolve().parents[1] / "data/display-translations.json"
    if not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return {}
        def digest(file):
            checksum = hashlib.sha256()
            with file.open("rb") as stream:
                for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                    checksum.update(chunk)
            return checksum.hexdigest()
        if data.get("type") != "STATIC_DISPLAY_TRANSLATIONS" or data.get("reviewStatus") != "MACHINE_GENERATED_UNREVIEWED":
            return {}
        if data.get("modelSha256") != digest(model / "model.bin") or data.get("tokenizerSha256") != digest(model / "tokenizer.json"):
            return {}
        entries = data["entries"]
        if not isinstance(entries, dict) or any(
            language not in LANGS or not isinstance(texts, dict)
            or any(not isinstance(key, str) or not isinstance(value, str) for key, value in texts.items())
            for language, texts in entries.items()
        ):
            return {}
        return entries
    except (OSError, ValueError, KeyError):
        return {}


def handle(payload, state):
    if payload["action"] == "detect":
        if state.get("detector") is None:
            from py3langid.langid import LanguageIdentifier, MODEL_FILE
            state["detector"] = LanguageIdentifier.from_pickled_model(MODEL_FILE, norm_probs=True)
        return resolve_detection(payload["text"], state["detector"].rank(payload["text"]))
    source, target = payload["source"], payload["target"]
    if source not in LANGS or target not in LANGS:
        fail("UNSUPPORTED_LANGUAGE")
    model = Path(payload["modelPath"])
    if not (model / "model.bin").is_file():
        fail("TRANSLATION_MODEL_MISSING")
    import ctranslate2
    from local_tokenizer import LocalTokenizer
    if state.get("model_path") != model:
        state.update(model_path=model, tokenizer=None, translator=None, translations={}, display_catalog=load_display_catalog(model))
    if state["tokenizer"] is None:
        state["tokenizer"] = LocalTokenizer(model)
    tokenizer = state["tokenizer"]
    if state["translator"] is None:
        state["translator"] = ctranslate2.Translator(str(model), device="cpu", compute_type="int8", inter_threads=1, intra_threads=4)
    cache = state["translations"]
    translated = [None] * len(payload["texts"])
    missing = []
    batches = []
    duplicates = {}
    first_indices = {}
    for index, text in enumerate(payload["texts"]):
        key = (source, target, text)
        tokens = tokenizer.encode(text, LANGS[source])
        if len(tokens) > 400:
            fail("TRANSLATION_TEXT_TOO_LONG")
        # Native case text is translated afresh; only repeatable display prose is cached.
        if source == "en" and key in cache:
            translated[index] = cache[key]
        elif source == "en" and isinstance(state["display_catalog"].get(target, {}).get(text), str):
            translated[index] = state["display_catalog"][target][text]
        elif source == "en" and key in first_indices:
            duplicates[index] = first_indices[key]
        else:
            first_indices[key] = index
            missing.append((index, key))
            batches.append(tokens)
    if batches:
        results = state["translator"].translate_batch(
            batches, target_prefix=[[LANGS[target]]] * len(batches), beam_size=4 if payload.get("quality") == "review" else 2,
            max_batch_size=8, max_decoding_length=400, return_scores=True,
        )
        if len(results) != len(missing):
            fail("TRANSLATION_FAILED")
        fresh = []
        for (index, key), result in zip(missing, results):
            tokens = result.hypotheses[0][1:]
            text = tokenizer.decode(tokens).strip()
            if not text or len(tokens) >= 399 or result.scores[0] < -5:
                fail("TRANSLATION_UNCERTAIN", index, "truncated" if len(tokens) >= 399 else "empty or low score")
            translated[index] = text
            fresh.append((key, text))
        if source == "en":
            for key, text in fresh:
                if len(cache) >= 4096:
                    cache.clear()
                cache[key] = text
    for index, first in duplicates.items():
        translated[index] = translated[first]
    return {"texts": translated}


def response(payload, state):
    try:
        return handle(payload, state)
    except WorkerFailure as error:
        return {"error": error.code, "segmentIndex": error.segment_index, "reason": error.reason}
    except (ImportError, OSError):
        return {"error": "TRANSLATION_RUNTIME_UNAVAILABLE"}
    except Exception:
        return {"error": "TRANSLATION_FAILED"}


def main():
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
    state = {}
    if "--stream" in sys.argv:
        for raw in iter(lambda: sys.stdin.buffer.readline(512 * 1024 + 1), b""):
            try:
                result = response(json.loads(raw), state)
            except Exception:
                result = {"error": "TRANSLATION_FAILED"}
            print(json.dumps(result, ensure_ascii=True), flush=True)
    else:
        try:
            result = response(json.loads(sys.stdin.buffer.read(512 * 1024)), state)
        except Exception:
            result = {"error": "TRANSLATION_FAILED"}
        print(json.dumps(result, ensure_ascii=True))
        if result.get("error"):
            sys.exit(1)


if __name__ == "__main__":
    main()
