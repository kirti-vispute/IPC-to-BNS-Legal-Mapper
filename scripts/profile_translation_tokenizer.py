"""Compare the installed fast tokenizer with its standalone engine, offline."""
import json
import time
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
model = root / "models/translation/nllb-int8"
fixtures = json.loads((root / "tests/fixtures/multilingual-completion.json").read_text(encoding="utf-8"))
started = time.perf_counter()
from tokenizers import Tokenizer
sys.path.insert(0, str(root / "backend/translation"))
from local_tokenizer import LocalTokenizer
local = LocalTokenizer(model)
raw = local.engine
raw_seconds = time.perf_counter() - started
started = time.perf_counter()
from transformers import AutoTokenizer
import_seconds = time.perf_counter() - started
codes = {"en":"eng_Latn", "hi":"hin_Deva", "mr":"mar_Deva", "gu":"guj_Gujr", "bn":"ben_Beng", "ta":"tam_Taml", "te":"tel_Telu", "kn":"kan_Knda", "ml":"mal_Mlym", "pa":"pan_Guru", "ur":"urd_Arab"}
rows = []
for fixture in fixtures:
    hf = AutoTokenizer.from_pretrained(str(model), local_files_only=True, src_lang=codes[fixture["language"]])
    for kind in ["theft", "injury", "cheating"]:
        text = fixture[kind]
        content = raw.encode(text, add_special_tokens=False).ids
        standalone = [raw.token_to_id(token) for token in local.encode(text, codes[fixture["language"]])]
        expected = hf.encode(text)
        rows.append({"language":fixture["language"], "kind":kind, "encodeEqual":standalone == expected,
                     "decodeEqual":local.decode(raw.encode(text, add_special_tokens=False).tokens) == hf.decode(content, skip_special_tokens=True),
                     "hfEdges":[hf.convert_ids_to_tokens(expected[:2]),hf.convert_ids_to_tokens(expected[-2:])]})
report = {"standaloneLoadSeconds":raw_seconds, "transformersImportSeconds":import_seconds, "rows":rows}
out = root / "output/project-completion/tokenizer-profile.json"
out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"standaloneLoadSeconds":raw_seconds, "transformersImportSeconds":import_seconds,
                  "equal":sum(r["encodeEqual"] and r["decodeEqual"] for r in rows), "total":len(rows)}), flush=True)
if not all(r["encodeEqual"] and r["decodeEqual"] for r in rows):
    raise SystemExit(1)
