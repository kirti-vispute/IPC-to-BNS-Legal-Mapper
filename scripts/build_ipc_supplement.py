"""Extract only verified IPC 354D from the separate official NCW source."""
import hashlib
import json
import re
from pathlib import Path
from pypdf import PdfReader

root = Path(__file__).resolve().parent.parent
directory = root / "legal-sources/supplements"
pdf = directory / "ipc-ncw.pdf"
digest = hashlib.sha256(pdf.read_bytes()).hexdigest()
manifest_path = directory / "manifest.json"
if manifest_path.exists():
    previous = json.loads(manifest_path.read_text(encoding="utf-8"))
    if previous["sources"][0]["sha256"] != digest:
        raise RuntimeError("Supplement source changed; review it before rebuilding.")
reader = PdfReader(pdf)
first = reader.pages[79].extract_text()
second = reader.pages[80].extract_text()
if "354D. Stalking." not in first or "355. Assault" not in second:
    raise RuntimeError("Verified section/page boundaries no longer match")
second = re.sub(r"^81\s*\n", "", second, count=1)
start = first.index("354D. Stalking.")
body = first[start:first.index("commits the offence of stalking:", start) + len("commits the offence of stalking:")]
body += " " + second[:second.index("355. Assault")]
# Missing punctuation glyphs are extraction artifacts; preserve all statutory words/clauses.
text = re.sub(r"\s+", " ", body.replace("\ufffd", " ")).strip()
for clause in ["follows a woman", "monitors the use", "Provided that", "reasonable and justified", "second or subsequent conviction"]:
    if clause not in text:
        raise RuntimeError(f"Incomplete section extraction: {clause}")
base = next(doc for doc in json.loads((root / "backend/data/statutes.json").read_text(encoding="utf-8")) if doc["id"] == "ipc-354d")
source = {"document":"The Indian Penal Code, 1860 (official consolidated PDF)",
    "authority":"National Commission for Women, Government of India", "file":"supplements/ipc-ncw.pdf",
    "page":80, "endPage":81,
    "url":"https://cdn.ncw.gov.in/wp-content/uploads/2022/12/THEINDIANPENALCODE1860_0.pdf", "sha256":digest}
record = {**base, "text":text, "keywords":["stalking", "follows", "contacts", "woman", "repeatedly", "disinterest", "monitors", "internet", "email", "electronic", "communication"],
    "recordType":"primary-statute-supplement", "source":source}
records = [record]
data = (json.dumps(records, ensure_ascii=True, indent=2) + "\n").encode()
(root / "backend/data/statute-supplements.json").write_bytes(data)
manifest = {"purpose":"Separate official-source supplement; original corpus/manifest and sealed evaluation remain frozen.",
    "retrievedOn":"2026-10-02", "sources":[source], "recordsFile":"backend/data/statute-supplements.json",
    "recordsSha256":hashlib.sha256(data).hexdigest(), "extraction":"IPC 354D only, PDF pages 80-81; full exceptions and punishment retained; printed page81 header removed; missing punctuation glyphs normalized to spaces."}
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"section":record["id"], "pdfPages":[80,81], "sourceSha256":digest, "characters":len(text)}))
