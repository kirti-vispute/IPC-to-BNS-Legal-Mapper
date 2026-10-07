"""Build the searchable IPC/BNS corpus from approved government legal PDFs only."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "legal-sources"
OUTPUT_PATH = ROOT / "backend" / "data" / "statutes.json"
MAPPING_PATH = ROOT / "backend" / "data" / "ipc-bns-mappings.json"
MANIFEST_PATH = SOURCE_DIR / "manifest.json"

SOURCES = {
    "IPC": {
        "file": "ipc-1860-mha.pdf",
        "title": "The Indian Penal Code, 1860",
        "authority": "Ministry of Home Affairs, Government of India",
        "url": "https://www.mha.gov.in/sites/default/files/2025-11/5IPC1860_27022023.pdf",
        "x_tolerance": 1.0,
    },
    "BNS": {
        "file": "bns-2023-official-gazette.pdf",
        "title": "The Bharatiya Nyaya Sanhita, 2023",
        "authority": "Gazette of India, Ministry of Law and Justice",
        "url": "https://www.mha.gov.in/sites/default/files/2026-02/1_250883_english_01042024.pdf",
        "x_tolerance": 0.5,
    },
    "COMMENCEMENT": {
        "file": "bns-commencement-gazette-2024.pdf",
        "title": "BNS Commencement Notification S.O. 850(E)",
        "authority": "Gazette of India, Ministry of Home Affairs",
        "url": "https://www.mha.gov.in/sites/default/files/BhartiyaNyayaSanhita_24022024.pdf",
    },
    "MAPPING": {
        "file": "ipc-bns-comparative-chart-bprd.pdf",
        "title": "Comparative Chart of Commonly Used Sections of IPC vis-a-vis BNS",
        "authority": "Bureau of Police Research and Development, Ministry of Home Affairs, Government of India",
        "url": "https://bprd.nic.in/uploads/pdf/BNS_English_30-04-2024.pdf",
    },
}

STOPWORDS = {
    "about", "after", "against", "also", "been", "being", "from", "have", "into",
    "offence", "person", "provisions", "section", "shall", "such", "that", "their",
    "there", "these", "they", "this", "under", "where", "which", "whoever", "with",
    "would",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def clean_text(text: str) -> str:
    text = text.replace("\u00ad", "").replace("\r", "")
    text = re.sub(r"^_+$", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*\d+\s+THE\s+GAZETTE.+$", "", text, flags=re.MULTILINE | re.IGNORECASE)
    text = re.sub(r"^\s*Sec\.\s*1\].+$", "", text, flags=re.MULTILINE | re.IGNORECASE)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_pages(path: Path, x_tolerance: float) -> list[str]:
    with pdfplumber.open(path) as pdf:
        return [clean_text(page.extract_text(x_tolerance=x_tolerance) or "") for page in pdf.pages]


def page_for_offset(offset: int, page_offsets: list[int]) -> int:
    page = 1
    for index, page_offset in enumerate(page_offsets):
        if page_offset > offset:
            break
        page = index + 1
    return page


def combine_pages(pages: list[str]) -> tuple[str, list[int]]:
    offsets = []
    pieces = []
    position = 0
    for page in pages:
        offsets.append(position)
        pieces.append(page)
        position += len(page) + 2
    return "\n\n".join(pieces), offsets


def collapse_words(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip(" .-\n")
    return re.sub(r"(?:\b[A-Za-z]\s+){3,}[A-Za-z]\b", lambda match: match.group(0).replace(" ", ""), text)


def derive_title(text: str) -> str:
    first_sentence = re.split(r"(?<=[.;:])\s+", collapse_words(text), maxsplit=1)[0]
    return " ".join(first_sentence.split()[:14]).rstrip(".,;:") or "Statutory provision"


def keywords_for(title: str, text: str) -> list[str]:
    words = re.findall(r"[a-z][a-z-]{3,}", f"{title} {text}".lower())
    counts: dict[str, int] = {}
    for word in words:
        if word not in STOPWORDS:
            counts[word] = counts.get(word, 0) + 1
    return [word for word, _ in sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:16]]


def source_meta(code: str, page: int, checksums: dict[str, str]) -> dict:
    source = SOURCES[code]
    return {
        "document": source["title"],
        "authority": source["authority"],
        "file": source["file"],
        "page": page,
        "url": source["url"],
        "sha256": checksums[source["file"]],
    }


def parse_bns(pages: list[str], checksums: dict[str, str]) -> list[dict]:
    combined, page_offsets = combine_pages(pages)
    starts = []
    cursor = 0
    for number in range(1, 359):
        pattern = re.compile(rf"(?m)^(?P<prefix>[^\n]{{0,140}}?)\b{number}\.\s*(?P<body>\S.*)$")
        match = pattern.search(combined, cursor)
        if not match:
            raise ValueError(f"BNS section {number} was not found in sequence")
        starts.append((str(number), match.start(), match.end(), match.group("prefix"), match.group("body")))
        cursor = match.end()

    records = []
    for index, (section, start, body_start, prefix, first_line) in enumerate(starts):
        end = starts[index + 1][1] if index + 1 < len(starts) else len(combined)
        body = collapse_words(f"{first_line} {combined[body_start:end]}")
        title = collapse_words(prefix)
        if not title or len(title) < 4 or title.upper().startswith(("THE GAZETTE", "CHAPTER")):
            title = derive_title(body)
        records.append({
            "id": f"bns-{section.lower()}",
            "code": "BNS",
            "section": section,
            "title": title,
            "text": body,
            "keywords": keywords_for(title, body),
            "mapsTo": [],
            "source": source_meta("BNS", page_for_offset(start, page_offsets), checksums),
            "effectiveDate": "2024-07-01",
            "commencementException": "Sub-section (2) is not commenced by S.O. 850(E)." if section == "106" else None,
            "commencementSource": source_meta("COMMENCEMENT", 1, checksums),
        })
    return records


def parse_ipc(pages: list[str], checksums: dict[str, str]) -> list[dict]:
    combined, page_offsets = combine_pages(pages)
    pattern = re.compile(
        r"(?m)^(?:\d+\*\[)?(?P<section>\d{1,3}[A-Z]*)\.\s*$\n"
        r"(?P<title>(?:(?!^\d{1,3}[A-Z]*\.\s*$).+\n){1,8}?)"
        r"\s*(?:\d+\*\[?|\[)?(?P=section)\.\s+"
    )
    candidates = []
    seen = set()
    for match in pattern.finditer(combined):
        section = match.group("section").upper()
        if section in seen:
            continue
        number = int(re.match(r"\d+", section).group())
        if not 1 <= number <= 511:
            continue
        seen.add(section)
        title = collapse_words(match.group("title"))
        candidates.append((section, match.start(), match.end(), title))

    candidates.sort(key=lambda item: item[1])
    records = []
    for index, (section, start, body_start, title) in enumerate(candidates):
        end = candidates[index + 1][1] if index + 1 < len(candidates) else len(combined)
        body = collapse_words(combined[body_start:end])
        records.append({
            "id": f"ipc-{section.lower()}",
            "code": "IPC",
            "section": section,
            "title": title or derive_title(body),
            "text": body,
            "keywords": keywords_for(title, body),
            "mapsTo": [],
            "source": source_meta("IPC", page_for_offset(start, page_offsets), checksums),
        })

    if len(records) < 450:
        raise ValueError(f"Only {len(records)} IPC sections were extracted; expected at least 450")
    return records


def section_base(value: str) -> str:
    match = re.match(r"\s*(\d{1,3}[A-Z]*)", value.upper().replace(" ", ""))
    return match.group(1) if match else ""


def parse_mappings(path: Path, checksums: dict[str, str]) -> list[dict]:
    mappings = []
    seen = set()
    with pdfplumber.open(path) as pdf:
        for page_number in range(21, 26):
            for table in pdf.pages[page_number - 1].extract_tables():
                for row in table:
                    cells = [collapse_words(str(cell).replace("\n", " ")) for cell in row if cell and str(cell).strip()]
                    if len(cells) != 3 or cells[0].upper() == "IPC":
                        continue
                    ipc_values = [section_base(value) for value in cells[0].split("/")]
                    bns = section_base(cells[2])
                    if not bns:
                        continue
                    for ipc in filter(None, ipc_values):
                        key = (ipc, bns)
                        if key in seen:
                            continue
                        seen.add(key)
                        mappings.append({
                            "ipc": ipc,
                            "bns": bns,
                            "offence": cells[1],
                            "source": source_meta("MAPPING", page_number, checksums),
                        })
    if len(mappings) < 80:
        raise ValueError(f"Only {len(mappings)} official mappings were extracted; expected at least 80")
    return mappings


def apply_mappings(records: list[dict], mappings: list[dict]) -> None:
    by_id = {record["id"]: record for record in records}
    for mapping in mappings:
        ipc_id = f"ipc-{mapping['ipc'].lower()}"
        bns_id = f"bns-{mapping['bns'].lower()}"
        if ipc_id in by_id and bns_id in by_id:
            if bns_id not in by_id[ipc_id]["mapsTo"]:
                by_id[ipc_id]["mapsTo"].append(bns_id)
            if ipc_id not in by_id[bns_id]["mapsTo"]:
                by_id[bns_id]["mapsTo"].append(ipc_id)


def add_mapping_reference_records(records: list[dict], mappings: list[dict]) -> int:
    existing = {record["id"] for record in records}
    added = 0
    for mapping in mappings:
        ipc_id = f"ipc-{mapping['ipc'].lower()}"
        if ipc_id in existing:
            continue
        title = mapping["offence"]
        records.append({
            "id": ipc_id,
            "code": "IPC",
            "section": mapping["ipc"],
            "title": title,
            "text": f"Official comparative-chart reference: IPC Section {mapping['ipc']} - {title}.",
            "keywords": keywords_for(title, title),
            "mapsTo": [],
            "recordType": "mapping-reference",
            "source": mapping["source"],
        })
        existing.add(ipc_id)
        added += 1
    return added


def main() -> None:
    missing = [source["file"] for source in SOURCES.values() if not (SOURCE_DIR / source["file"]).is_file()]
    if missing:
        raise FileNotFoundError(f"Missing approved legal source files: {', '.join(missing)}")

    checksums = {source["file"]: sha256(SOURCE_DIR / source["file"]) for source in SOURCES.values()}
    ipc_pages = extract_pages(SOURCE_DIR / SOURCES["IPC"]["file"], SOURCES["IPC"]["x_tolerance"])
    bns_pages = extract_pages(SOURCE_DIR / SOURCES["BNS"]["file"], SOURCES["BNS"]["x_tolerance"])
    ipc_records = parse_ipc(ipc_pages, checksums)
    bns_records = parse_bns(bns_pages, checksums)
    records = ipc_records + bns_records
    mappings = parse_mappings(SOURCE_DIR / SOURCES["MAPPING"]["file"], checksums)
    mapping_reference_count = add_mapping_reference_records(records, mappings)
    apply_mappings(records, mappings)

    manifest = {
        "policy": "Only official Government of India legal publications are accepted.",
        "generatedFrom": [
            {**{key: value for key, value in source.items() if key != "x_tolerance"}, "sha256": checksums[source["file"]]}
            for source in SOURCES.values()
        ],
        "recordCounts": {
            "IPCActSections": len(ipc_records),
            "BNSActSections": len(bns_records),
            "mappingOnlyReferences": mapping_reference_count,
            "officialMappings": len(mappings),
        },
        "commencementRule": {
            "BNS": "2024-07-01",
            "exception": "BNS 106(2)",
            "source": source_meta("COMMENCEMENT", 1, checksums),
        },
    }

    OUTPUT_PATH.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    MAPPING_PATH.write_text(json.dumps(mappings, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest["recordCounts"], indent=2))


if __name__ == "__main__":
    main()
