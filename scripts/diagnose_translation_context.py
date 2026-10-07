"""Offline experiments only; never imported by the HTTP or legal pipeline."""
import hashlib
import json
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend" / "translation"))
from local_tokenizer import LocalTokenizer
from worker import LANGS
import ctranslate2

OUT = ROOT / "output" / "translation-context-search"
if len(sys.argv) > 2:
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9-]{0,63}", sys.argv[2]):
        raise SystemExit("Use a short alphanumeric/hyphen run name")
    OUT = OUT / sys.argv[2]
OUT.mkdir(parents=True, exist_ok=True)
MODEL = ROOT / "models" / "translation" / "nllb-int8"
tokenizer = LocalTokenizer(MODEL)
translator = ctranslate2.Translator(str(MODEL), device="cpu", compute_type="int8", inter_threads=1, intra_threads=4)
fixtures = json.loads((ROOT / "tests" / "fixtures" / "multilingual-completion.json").read_text(encoding="utf-8"))
mode = sys.argv[1] if len(sys.argv) > 1 else "intent"
if mode == "intent":
    cases = [{"id": f"{f['language']}-known-intent", "language": f["language"], "text": f["cheating"]}
             for f in fixtures if f["language"] in ["gu", "kn"]]
    cases += [
        {"id": "gu-context", "language": "gu", "text": "એક વ્યક્તિએ પૈસા મેળવવા માટે ખોટી માહિતી આપી. તેણે બેઈમાનીથી બીજી વ્યક્તિને તેની મિલકત સોંપવા પ્રેરિત કર્યો."},
        {"id": "kn-context", "language": "kn", "text": "ಒಬ್ಬ ವ್ಯಕ್ತಿ ಸುಳ್ಳು ಮಾಹಿತಿ ನೀಡಿ ಮತ್ತೊಬ್ಬನನ್ನು ಮೋಸಗೊಳಿಸಿದನು. ಅವನು ಅಪ್ರಾಮಾಣಿಕವಾಗಿ ಆಸ್ತಿಯನ್ನು ಕೊಡಲು ಪ್ರೇರೇಪಿಸಿದನು."},
        {"id": "gu-permitted", "language": "gu", "text": "માલિકે સ્વેચ્છાએ પોતાની મિલકત આપી. કોઈએ તેને છેતર્યો નથી."},
        {"id": "kn-permitted", "language": "kn", "text": "ಮಾಲೀಕ ತನ್ನ ಆಸ್ತಿಯನ್ನು ಸ್ವಯಂಪ್ರೇರಣೆಯಿಂದ ಕೊಟ್ಟನು. ಯಾರೂ ಅವನನ್ನು ಮೋಸಗೊಳಿಸಲಿಲ್ಲ."},
    ]
    settings = [{"beam_size": 2}, {"beam_size": 4}, {"beam_size": 8, "num_hypotheses": 8}]
elif mode == "actors":
    cases = [{"id": f"kn-actor-{i}", "language": "kn", "text": text} for i, text in enumerate([
        "ಆರೋಪಿಯು ಒಬ್ಬ ವ್ಯಕ್ತಿಯನ್ನು ಮೋಸಗೊಳಿಸಿ ಅಪ್ರಾಮಾಣಿಕವಾಗಿ ಆಸ್ತಿಯನ್ನು ನೀಡಲು ಪ್ರೇರೇಪಿಸಿದನು.",
        "ಆರೋಪಿ ಒಬ್ಬ ವ್ಯಕ್ತಿಯನ್ನು ಮೋಸಗೊಳಿಸಿ ಆಸ್ತಿಯನ್ನು ನೀಡಲು ಪ್ರೇರೇಪಿಸಿದನು.",
        "ಆರೋಪಿ ಮತ್ತೊಬ್ಬ ವ್ಯಕ್ತಿಯನ್ನು ಮೋಸಗೊಳಿಸಿದನು.",
        "ಆರೋಪಿ ಒಬ್ಬ ವ್ಯಕ್ತಿಗೆ ಗಂಭೀರ ಗಾಯ ಉಂಟುಮಾಡಿದನು.",
        "ಆರೋಪಿಯು ಮತ್ತೊಬ್ಬ ವ್ಯಕ್ತಿಯನ್ನು ಮೋಸಗೊಳಿಸಿದನು.",
        "ಆರೋಪಿ ಅಪ್ರಾಮಾಣಿಕವಾಗಿ ಆಸ್ತಿಯನ್ನು ಪಡೆದನು.",
    ])]
    settings = [{"beam_size": 2}, {"beam_size": 4}]
elif mode == "long":
    cases = [{"id": f"{f['language']}-whole-repeated", "language": f["language"], "text": " ".join([f["theft"]] * 5)}
             for f in fixtures if f["language"] != "en"]
    settings = [{"beam_size": 2}, {"beam_size": 4}, {"beam_size": 4, "coverage_penalty": 1}]
else:
    raise SystemExit("Use intent, actors or long")

report = {"type": "EXPLORATORY_TRANSLATION_DIAGNOSTIC", "reviewStatus": "NOT_EXPERT_REVIEWED",
          "limitations": "Generated native contrast probes are not gold translations or legal labels. Scores are model likelihood, not semantic accuracy. No dates/identifiers were sent in these isolated prose experiments.",
          "model": str(MODEL.relative_to(ROOT)), "rows": []}
destination = OUT / f"{mode}.json"
if destination.exists():
    raise SystemExit("Evidence already exists; do not overwrite")
for case in cases:
    tokens = tokenizer.encode(case["text"], LANGS[case["language"]])
    row = {**case, "inputTokens": len(tokens), "sourceSha256": hashlib.sha256(case["text"].encode()).hexdigest(), "variants": []}
    if len(tokens) > 400:
        row["error"] = "EXCEEDS_EXISTING_TOKEN_LIMIT"
    else:
        for setting in settings:
            start = time.perf_counter()
            try:
                result = translator.translate_batch([tokens], target_prefix=[[LANGS["en"]]],
                    max_batch_size=8, max_decoding_length=400, return_scores=True, **setting)[0]
                variant = {"settings": setting, "elapsedMs": round((time.perf_counter() - start) * 1000),
                    "hypotheses": [{"text": tokenizer.decode(hyp[1:]).strip(), "score": score, "outputTokens": len(hyp) - 1}
                                   for hyp, score in zip(result.hypotheses, result.scores)]}
            except Exception as error:
                variant = {"settings": setting, "error": type(error).__name__, "detail": str(error)}
            row["variants"].append(variant)
            print(json.dumps({"id": case["id"], "variant": variant}, ensure_ascii=True), flush=True)
    report["rows"].append(row)
    destination.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
