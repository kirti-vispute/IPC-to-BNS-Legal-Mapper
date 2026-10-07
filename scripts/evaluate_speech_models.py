"""Compare local speech models on held-out public FLEURS test clips (CC BY 4.0) via the real workers.

  .venv-speech\\Scripts\\python.exe scripts/evaluate_speech_models.py --language hi --limit 12

Clips are the FIRST `--limit` rows of the FLEURS `test` split (no filtering or cherry-picking), a split
the fine-tuned candidates did not train on (their cards list FLEURS train+dev). Each model runs through the
unchanged worker script and CLI the web app uses. Raw replies are saved before scoring. Output goes to the
ignored output/ folder; the audio is not for redistribution. This is read public speech, not legal speech,
microphone speech or a guarantee of accuracy on any other recording.
"""
import argparse
import base64
import json
import statistics
import subprocess
import sys
import threading
import time
import unicodedata
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEECH = ROOT / "models" / "speech"
CONFIGS = {"en": "en_us", "hi": "hi_in", "gu": "gu_in", "ur": "ur_pk"}
TRANSCRIBE, WHISTLE = ROOT / "backend/speech/transcribe.py", ROOT / "backend/speech/whistle_worker.py"
# (label, model folder, worker script). The first entry is the comparison baseline; the tuned model is what the app uses.
CANDIDATES = {
    "en": [("whisper-tiny (fallback)", "whisper-tiny", TRANSCRIBE), ("whistle", "whistle", WHISTLE)],
    "hi": [("whisper-medium (generic baseline, not used)", "whisper-medium", TRANSCRIBE), ("hindi-medium-ct2", "hindi-medium-ct2", TRANSCRIBE)],
    "gu": [("whisper-medium (generic baseline, not used)", "whisper-medium", TRANSCRIBE), ("gujarati-medium-ct2", "gujarati-medium-ct2", TRANSCRIBE)],
    "ur": [("whisper-medium (generic baseline, not used)", "whisper-medium", TRANSCRIBE), ("urdu-large-v3-ct2", "urdu-large-v3-ct2", TRANSCRIBE)],
}
CLIP_DEADLINE = 190


def normalize(text):
    text = unicodedata.normalize("NFC", text).lower().replace("​", "")  # zero-width space is not speech
    text = "".join(" " if unicodedata.category(ch)[0] in "PS" else ch for ch in text)
    return " ".join(text.split())


def edits(reference, hypothesis):
    previous = list(range(len(hypothesis) + 1))
    for i, ref in enumerate(reference, 1):
        current = [i]
        for j, hyp in enumerate(hypothesis, 1):
            current.append(min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (ref != hyp)))
        previous = current
    return previous[-1]


def score(reference, hypothesis):
    ref, hyp = normalize(reference), normalize(hypothesis)
    return {"wordEdits": edits(ref.split(), hyp.split()), "wordCount": len(ref.split()),
            "charEdits": edits(list(ref), list(hyp)), "charCount": len(ref)}


def get(url):
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (speech-model-evaluation)"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def rows_from_server(config, limit):
    url = f"https://datasets-server.huggingface.co/first-rows?dataset=google%2Ffleurs&config={config}&split=test"
    return [{"id": item["row"]["id"], "num_samples": item["row"]["num_samples"], "raw_transcription": item["row"]["raw_transcription"],
             "audio": get(item["row"]["audio"][0]["src"])} for item in json.loads(get(url))["rows"][:limit]]


def rows_from_parquet(config, limit, cache):
    """Large test splits exceed the dataset server's scan limit; read the first rows of the shard locally."""
    import pyarrow.parquet as pq  # evaluation-only dependency: pip install pyarrow
    from huggingface_hub import hf_hub_download

    shard = hf_hub_download("google/fleurs", f"{config}/test/0000.parquet", repo_type="dataset",
                            revision="refs/convert/parquet", local_dir=str(cache))
    batch = next(pq.ParquetFile(shard).iter_batches(batch_size=limit)).to_pylist()
    return [{"id": row["id"], "num_samples": row["num_samples"], "raw_transcription": row["raw_transcription"],
             "audio": row["audio"]["bytes"]} for row in batch]


def fetch_clips(language, limit, out):
    config = CONFIGS[language]
    try:
        rows = rows_from_server(config, limit)
    except Exception:
        rows = rows_from_parquet(config, limit, out.parent / "_parquet")
    clips = []
    for index, row in enumerate(rows):
        name = f"{language}-test-{index}.wav"
        (out / name).write_bytes(row["audio"])
        clips.append({"file": name, "rowIndex": index, "datasetId": row["id"], "numSamples": row["num_samples"],
                      "reference": row["raw_transcription"]})
    return clips


def run_model(language, label, model, worker, clips, out):
    command = [sys.executable, str(worker), "--model", str(SPEECH / model), "--mode", "transcribe", "--language", language, "--stream"]
    started = time.perf_counter()
    child = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    replies = []
    try:
        for clip in clips:
            payload = base64.b64encode((out / clip["file"]).read_bytes()).decode()
            begin = time.perf_counter()
            child.stdin.write((json.dumps({"audio": payload}) + "\n").encode())
            child.stdin.flush()
            box = []
            reader = threading.Thread(target=lambda: box.append(child.stdout.readline()), daemon=True)
            reader.start()
            reader.join(CLIP_DEADLINE)
            elapsed = time.perf_counter() - begin
            if not box or not box[0]:
                replies.append({"file": clip["file"], "error": "NO_REPLY_OR_TIMEOUT", "seconds": elapsed})
                break
            reply = json.loads(box[0])
            replies.append({"file": clip["file"], "seconds": round(elapsed, 2), **reply})
    finally:
        child.kill()
    return {"label": label, "model": model, "worker": worker.name, "totalSeconds": round(time.perf_counter() - started, 1), "replies": replies}


def summarize(run, clips):
    by_file = {clip["file"]: clip for clip in clips}
    totals = {"wordEdits": 0, "wordCount": 0, "charEdits": 0, "charCount": 0}
    failures, times = 0, []
    for reply in run["replies"]:
        if reply.get("error") or not reply.get("text", "").strip():
            failures += 1
        scored = score(by_file[reply["file"]]["reference"], reply.get("text", ""))
        reply["score"] = scored
        for key in totals:
            totals[key] += scored[key]
        times.append(reply["seconds"])
    failures += len(clips) - len(run["replies"])
    return {"label": run["label"], "clips": len(clips), "emptyOrFailed": failures,
            "WER": round(100 * totals["wordEdits"] / max(1, totals["wordCount"]), 1),
            "CER": round(100 * totals["charEdits"] / max(1, totals["charCount"]), 1),
            "medianSecondsPerClip": round(statistics.median(times), 1) if times else None,
            "firstClipSeconds": times[0] if times else None, "totalSeconds": run["totalSeconds"]}


LANGUAGE_NAMES = {"en": "English", "hi": "Hindi", "gu": "Gujarati", "ur": "Urdu"}


def friendly(label):
    """Saved runs from before the registry call generic Whisper medium "(current)" or "(generic)"; say what it is now."""
    if label.startswith("whisper-medium"):
        return "whisper-medium (generic baseline, not used)"
    return "whisper-tiny (fallback)" if label.startswith("whisper-tiny") else label


def report(root, write):
    """Summarise the latest saved run per language WITHOUT running any model; optionally write the website data file."""
    rows, runs = [], []
    for language in sorted(CONFIGS):
        folders = sorted((root / "output" / "speech-model-comparison").glob(f"{language}-*/summary.json"))
        if not folders:
            continue
        saved = json.loads(folders[-1].read_text(encoding="utf-8"))
        runs.append(folders[-1].parent.name)
        for item in saved["summaries"]:
            rows.append({"language": LANGUAGE_NAMES[language], "code": language, "model": friendly(item["label"]), "WER": item["WER"], "CER": item["CER"],
                         "clips": item["clips"], "emptyOrFailed": item["emptyOrFailed"], "medianSecondsPerClip": item["medianSecondsPerClip"]})
    if not rows:
        print("No saved runs found under output/speech-model-comparison/. Run this script with --language first.")
        return 1
    print(f"{'Language':10} {'Model':30} {'WER %':>7} {'CER %':>7} {'Clips':>6}")
    for row in rows:
        print(f"{row['language']:10} {row['model']:30} {row['WER']:>7} {row['CER']:>7} {row['clips']:>6}")
    if write:
        payload = {
            "dataset": "google/fleurs test split (CC BY 4.0), first 12 clips per language, read speech",
            "note": "Measured through the project's real workers; word error rate normalises Unicode, case and punctuation only. Not a guarantee for other speech.",
            "runs": runs, "results": rows
        }
        write.parent.mkdir(parents=True, exist_ok=True)
        write.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + chr(10), encoding="utf-8")
        print(f"Wrote {write}")
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--report", action="store_true", help="print language-wise WER from the saved runs (no models are run)")
    parser.add_argument("--write", type=Path, help="with --report: write the results to this JSON file (the website reads backend/data/speech-evaluation.json)")
    parser.add_argument("--language", choices=sorted(CONFIGS))
    parser.add_argument("--limit", type=int, default=12)
    parser.add_argument("--only", nargs="*", help="run only candidate labels containing these strings")
    parser.add_argument("--rescore", type=Path, help="re-score a saved run folder from its raw replies without re-running models")
    args = parser.parse_args()
    if args.report:
        sys.exit(report(ROOT, args.write))
    if not args.language:
        parser.error("--language is required unless --report is used")
    if args.rescore:
        clips = json.loads((args.rescore / "clips.json").read_text(encoding="utf-8"))
        for raw in sorted(args.rescore.glob("raw-*.json")):
            print(json.dumps(summarize(json.loads(raw.read_text(encoding="utf-8")), clips), ensure_ascii=False))
        return
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out = ROOT / "output" / "speech-model-comparison" / f"{args.language}-{stamp}"
    out.mkdir(parents=True)
    clips = fetch_clips(args.language, args.limit, out)
    (out / "clips.json").write_text(json.dumps(clips, ensure_ascii=False, indent=1), encoding="utf-8")
    runs, summaries = [], []
    for label, model, worker in CANDIDATES[args.language]:
        if args.only and not any(part in label for part in args.only):
            continue
        if not (SPEECH / model).is_dir():
            print(f"SKIP {label}: {SPEECH / model} is not installed")
            continue
        run = run_model(args.language, label, model, worker, clips, out)
        (out / f"raw-{model}.json").write_text(json.dumps(run, ensure_ascii=False, indent=1), encoding="utf-8")
        summary = summarize(run, clips)
        runs.append(run)
        summaries.append(summary)
        print(json.dumps(summary, ensure_ascii=False), flush=True)
    (out / "summary.json").write_text(json.dumps({"language": args.language, "split": "fleurs-test-first-rows", "summaries": summaries, "runs": runs},
                                                 ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Saved: {out}")


if __name__ == "__main__":
    main()
