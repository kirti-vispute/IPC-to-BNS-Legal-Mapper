"""Offline same-feature source/int8 decode comparison, outside the application."""
import argparse
import concurrent.futures
import hashlib
import importlib.metadata
import json
import os
import subprocess
import sys
import time
from pathlib import Path

from scripts import audit_marathi_checkpoint as audit
from scripts import assess_marathi_decoder as base

ROOT = base.ROOT
OUTPUT = ROOT / "output/public-speech-validation/source-parity-20261004"
PLAN = ROOT / "Feature-marathi-source-parity-plan.md"
SOURCE = ROOT / "models/speech/marathi-small-source"
TARGET = base.MODEL
FIXTURES = base.MANIFESTS["development"]
VAD_ROWS = ROOT / "output/public-speech-validation/vad-retention-20261004/observations.jsonl"
SEGMENT_ROWS = ROOT / "output/public-speech-validation/segment-diagnostic-20261004/observations.jsonl"
PROMPT = [50258, 50320, 50359, 50363]
MAX_NEW_TOKENS = 192


def rows(path):
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def sample_digest(array):
    return hashlib.sha256(array.tobytes()).hexdigest()


def retained_audio(audio, intervals):
    import numpy as np
    from scripts.audit_marathi_vad import interval_summary
    from faster_whisper.vad import collect_chunks

    summary = interval_summary(int(audio.size), intervals)
    chunks, _ = collect_chunks(audio, intervals)
    retained = np.concatenate(chunks) if chunks else audio[:0]
    if retained.size != summary["retainedSamples"] or retained.size == 0:
        raise ValueError("Invalid retained audio")
    return retained


def text_from_tokens(tokenizer, tokens):
    return tokenizer.decode([token for token in tokens if token < 50257], skip_special_tokens=True).strip()


def source_generated_tokens(sequence, prompt=PROMPT):
    values = [int(token) for token in sequence]
    if values[:len(prompt)] != prompt or len(values) <= len(prompt):
        raise ValueError("Source did not generate from the registered Marathi prompt")
    return values[len(prompt):]


def versions():
    wanted = ("faster-whisper", "ctranslate2", "numpy", "torch", "transformers", "tokenizers", "safetensors")
    result = {}
    for name, folder in (("speech", ".venv-speech"), ("source", ".venv-translation")):
        site = ROOT / folder / "Lib/site-packages"
        found = {item.metadata["Name"].lower(): item.version
                 for item in importlib.metadata.distributions(path=[str(site)])}
        result[name] = {package: found.get(package) for package in wanted}
    return result


def register():
    from scripts import inspect_marathi_segments as segments
    previous = audit.read_json(audit.OUTPUT / "report.json")
    if not previous["passed"] or previous["changedInputs"]:
        raise ValueError("Prior checkpoint audit did not pass")
    fixtures = audit.read_json(FIXTURES)["fixtures"]
    if len(fixtures) != 8 or any(item["language"] != "mr" for item in fixtures):
        raise ValueError("Expected eight inspected Marathi development clips")
    vad = rows(VAD_ROWS)
    segments = rows(SEGMENT_ROWS)
    if {item["filename"] for item in fixtures} != {item["filename"] for item in vad} or any(
            len(item["generationWindows"]) != 1 for item in segments):
        raise ValueError("Saved inspected sample identities/windows disagree")
    for item in fixtures:
        if base.digest(FIXTURES.parent / item["filename"]) != item["sha256"]:
            raise ValueError("Development WAV changed")
    suppress = segments[0]["transcriptionOptions"]["suppress_tokens"]
    if any(item["transcriptionOptions"]["suppress_tokens"] != suppress or
           item["generationWindows"][0]["promptTokens"] != PROMPT[:3] for item in segments):
        raise ValueError("Previous production prompt/suppression changed")
    paths = [PLAN, ROOT / "scripts/compare_marathi_checkpoints.py", ROOT / "tests/test_marathi_checkpoint_parity.py",
             FIXTURES, VAD_ROWS, SEGMENT_ROWS, audit.OUTPUT / "report.json",
             ROOT / "scripts/audit_marathi_checkpoint.py", ROOT / "scripts/audit_marathi_vad.py",
             ROOT / "backend/speech/transcribe.py"]
    paths += [FIXTURES.parent / item["filename"] for item in fixtures]
    paths += [path for folder in (SOURCE, TARGET) for path in folder.iterdir() if path.is_file()]
    paths += [ROOT / ".venv-speech/Lib/site-packages" / name for name in
              ("faster_whisper/audio.py", "faster_whisper/vad.py", "faster_whisper/feature_extractor.py",
               "faster_whisper/transcribe.py", "faster_whisper/tokenizer.py")]
    hashes = {str(path.relative_to(ROOT)): base.digest(path) for path in dict.fromkeys(paths)}
    OUTPUT.mkdir(exist_ok=False)
    base.save_new(OUTPUT / "registration.json", {
        "type": "SOURCE_VS_CONVERTED_SAME_FEATURE_DIAGNOSTIC", "hashes": hashes,
        "fixtures": fixtures, "vadRows": vad, "prompt": PROMPT, "maxNewTokens": MAX_NEW_TOKENS,
        "suppressTokens": suppress, "runtimeVersions": versions(),
        "sourceModel": "local-pinned-float32", "convertedModel": "current-local-int8",
        "timestampMode": "no-timestamps-diagnostic", "beamSize": 3,
        "reservedHoldoutSubmitted": False})
    print(json.dumps({"registered": True, "clips": len(fixtures), "inputHashes": len(hashes)}))


def verified_registration():
    reg = audit.read_json(OUTPUT / "registration.json")
    if reg["prompt"] != PROMPT or reg["maxNewTokens"] != MAX_NEW_TOKENS or reg["runtimeVersions"] != versions():
        raise ValueError("Registered options/runtime changed")
    if any(base.digest(ROOT / name) != expected for name, expected in reg["hashes"].items()):
        raise ValueError("Registered input changed")
    return reg


def prepare():
    import numpy as np
    from faster_whisper.audio import decode_audio, pad_or_trim
    from faster_whisper.feature_extractor import FeatureExtractor

    reg = verified_registration()
    prepped = []
    for fixture in reg["fixtures"]:
        filename = fixture["filename"]
        vad = next(item for item in reg["vadRows"] if item["filename"] == filename)
        audio = decode_audio(str(FIXTURES.parent / filename), sampling_rate=16000)
        if audio.ndim != 1 or not 0 < audio.size <= 30 * 16000 or sample_digest(audio) != vad["decodedSampleSHA256"]:
            raise ValueError("Decoded audio disagrees with prior VAD evidence")
        kept = retained_audio(audio, vad["retainedIntervals"])
        if sample_digest(kept) != vad["retainedSampleSHA256"]:
            raise ValueError("Retained audio disagrees with prior VAD evidence")
        features = pad_or_trim(FeatureExtractor()(kept), length=3000)
        if features.shape != (80, 3000) or features.dtype != np.float32 or not np.isfinite(features).all():
            raise ValueError("Invalid shared audio features")
        feature_path = OUTPUT / f"{Path(filename).stem}.npy"
        with feature_path.open("xb") as stream:
            np.save(stream, features, allow_pickle=False)
        prepped.append({"filename": filename, "featureFile": feature_path.relative_to(ROOT).as_posix(),
                        "featureSHA256": base.digest(feature_path), "featureDataSHA256": sample_digest(features),
                        "retainedSamples": kept.size})
    base.save_new(OUTPUT / "features.json", prepped)
    return prepped


def model_worker(mode):
    import numpy as np
    from tokenizers import Tokenizer

    reg = verified_registration()
    tokenizer = Tokenizer.from_file(str(TARGET / "tokenizer.json"))
    if mode == "ct2-worker":
        from faster_whisper import WhisperModel
        model = WhisperModel(str(TARGET), device="cpu", compute_type="int8", cpu_threads=4, local_files_only=True)
    else:
        import torch
        from transformers import WhisperForConditionalGeneration
        torch.set_num_threads(4)
        torch.set_num_interop_threads(1)
        model = WhisperForConditionalGeneration.from_pretrained(
            str(SOURCE), local_files_only=True, use_safetensors=True, dtype=torch.float32,
            attn_implementation="eager")
        model.eval()
        # Both backends receive the observed production suppression set.
        model.generation_config.suppress_tokens = reg["suppressTokens"]
        model.generation_config.begin_suppress_tokens = [220, 50257]
    print(json.dumps({"ready": True, "backend": mode}), flush=True)
    features = audit.read_json(OUTPUT / "features.json")
    for index, line in enumerate(sys.stdin):
        started = time.perf_counter()
        job = None
        try:
            job = json.loads(line)
            feature = features[index]
            if job != {"filename": feature["filename"], "featureSHA256": feature["featureSHA256"]}:
                raise ValueError("Unexpected fixture or feature identity")
            path = ROOT / feature["featureFile"]
            if base.digest(path) != feature["featureSHA256"]:
                raise ValueError("Feature changed")
            array = np.load(path, allow_pickle=False)
            if array.shape != (80, 3000) or array.dtype != np.float32 or sample_digest(array) != feature["featureDataSHA256"]:
                raise ValueError("Invalid shared features")
            if mode == "ct2-worker":
                encoded = model.encode(array)
                generated = model.model.generate(
                    encoded, [PROMPT], beam_size=3, patience=1, length_penalty=1,
                    max_length=len(PROMPT) + MAX_NEW_TOKENS, suppress_blank=True,
                    suppress_tokens=reg["suppressTokens"], return_scores=True)[0]
                tokens = [int(token) for token in generated.sequences_ids[0]]
            else:
                import torch
                with torch.inference_mode():
                    generated = model.generate(
                        input_features=torch.from_numpy(array).unsqueeze(0),
                        language="mr", task="transcribe", return_timestamps=False,
                        num_beams=3, do_sample=False, max_new_tokens=MAX_NEW_TOKENS,
                        length_penalty=1, early_stopping=False)
                tokens = source_generated_tokens(generated[0].tolist())
            result = {"filename": feature["filename"], "tokens": tokens,
                      "text": text_from_tokens(tokenizer, tokens),
                      "elapsedMs": (time.perf_counter() - started) * 1000}
        except Exception as error:
            result = {"filename": job.get("filename") if isinstance(job, dict) else None,
                      "error": type(error).__name__, "detail": str(error)[:300],
                      "elapsedMs": (time.perf_counter() - started) * 1000}
        print(json.dumps(result, ensure_ascii=True, allow_nan=False), flush=True)


def run_worker(mode, python, features):
    environment = dict(os.environ, HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1",
                       HF_HUB_DISABLE_TELEMETRY="1", PYTHONUTF8="1", TOKENIZERS_PARALLELISM="false")
    log_path = OUTPUT / f"{mode}.jsonl"
    stderr_path = OUTPUT / f"{mode}.stderr.txt"
    observations = []
    with log_path.open("x", encoding="utf-8") as log, stderr_path.open("xb") as errors:
        child = subprocess.Popen([str(python), "-m", "scripts.compare_marathi_checkpoints", mode],
                                 cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=errors,
                                 text=True, encoding="utf-8", env=environment,
                                 creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
        executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        try:
            ready = base.bounded_reply(executor, child.stdout, timeout=180)
            if ready != {"ready": True, "backend": mode}:
                raise ValueError("Model worker did not initialize")
            for feature in features:
                child.stdin.write(json.dumps({key: feature[key] for key in ("filename", "featureSHA256")}) + "\n")
                child.stdin.flush()
                row = base.bounded_reply(executor, child.stdout, timeout=180)
                if row.get("filename") != feature["filename"]:
                    raise ValueError("Worker response identity mismatch")
                observations.append(row)
                log.write(json.dumps(row, ensure_ascii=False, allow_nan=False) + "\n")
                log.flush()
                print(json.dumps({"backend": mode, "filename": row["filename"],
                                  "elapsedMs": row.get("elapsedMs"), "error": row.get("error")}), flush=True)
                if row.get("error") or row["elapsedMs"] > 180000:
                    raise ValueError("Worker error or elapsed limit")
        finally:
            if child.poll() is None:
                child.kill()
            child.wait(timeout=10)
            executor.shutdown(wait=True, cancel_futures=True)
    return observations


def summarize(converted, source):
    if len(converted) != 8 or len(source) != 8:
        raise ValueError("Incomplete comparison")
    rows_out = []
    for left, right in zip(converted, source):
        if left.get("filename") != right.get("filename") or left.get("error") or right.get("error"):
            raise ValueError("Unmatched or failed comparison")
        rows_out.append({"filename": left["filename"], "sameTokens": left["tokens"] == right["tokens"],
                         "sameText": left["text"] == right["text"],
                         "convertedText": left["text"], "sourceText": right["text"]})
    return {"cases": rows_out, "sameTokens": sum(row["sameTokens"] for row in rows_out),
            "sameText": sum(row["sameText"] for row in rows_out), "total": 8}


def run():
    reg = verified_registration()
    features = prepare()
    converted, source, failure = [], [], None
    try:
        converted = run_worker("ct2-worker", ROOT / ".venv-speech/Scripts/python.exe", features)
        source = run_worker("source-worker", ROOT / ".venv-translation/Scripts/python.exe", features)
        comparison = summarize(converted, source)
    except Exception as error:
        failure = {"type": type(error).__name__, "message": str(error)[:300]}
        comparison = None
    changed = [name for name, expected in reg["hashes"].items() if base.digest(ROOT / name) != expected]
    report = {"type": "SAME_FEATURE_SOURCE_VS_INT8_DIAGNOSTIC", "usable": comparison is not None and not changed,
              "failure": failure, "comparison": comparison, "registeredInputsChanged": changed,
              "registrationSHA256": base.digest(OUTPUT / "registration.json"),
              "featuresSHA256": base.digest(OUTPUT / "features.json"),
              "convertedRowsSHA256": base.digest(OUTPUT / "ct2-worker.jsonl"),
              "sourceRowsSHA256": base.digest(OUTPUT / "source-worker.jsonl") if (OUTPUT / "source-worker.jsonl").exists() else None,
              "productionChanged": False, "reservedHoldoutSubmitted": False,
              "limitations": "Same inspected features/prompt, distinct decoders and float32/int8 arithmetic. No-timestamp single-window mode differs from production. Difference does not isolate conversion cause or establish legal/speech accuracy."}
    base.save_new(OUTPUT / "report.json", report)
    print(json.dumps({"usable": report["usable"], "failure": failure, "comparison": comparison,
                      "registeredInputsChanged": changed}, ensure_ascii=False), flush=True)
    if not report["usable"]:
        raise SystemExit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("register", "run", "ct2-worker", "source-worker"))
    args = parser.parse_args()
    {"register": register, "run": run,
     "ct2-worker": lambda: model_worker("ct2-worker"),
     "source-worker": lambda: model_worker("source-worker")}[args.mode]()
