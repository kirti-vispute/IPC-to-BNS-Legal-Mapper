"""Read-only local checkpoint consistency audit; never loads a speech model."""
import ast
import hashlib
import inspect
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "models/speech/marathi-small-source"
TARGET = ROOT / "models/speech/marathi-small-ct2"
OUTPUT = ROOT / "output/public-speech-validation/checkpoint-audit-20261004"


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def merge_vocabulary(base, added):
    merged = dict(base)
    for token, index in added.items():
        if token in merged and merged[token] != index:
            raise ValueError("Conflicting token ID")
        merged[token] = index
    if any(type(index) is not int or index < 0 for index in merged.values()):
        raise ValueError("Invalid token ID")
    if sorted(merged.values()) != list(range(len(merged))):
        raise ValueError("Non-contiguous or duplicate token IDs")
    return merged


def vocabulary_mismatches(mapping, ordered):
    if not isinstance(ordered, list) or not all(isinstance(token, str) for token in ordered):
        raise ValueError("Invalid ordered vocabulary")
    expected = {token: index for index, token in enumerate(ordered)}
    return sorted(token for token in set(mapping) | set(expected)
                  if mapping.get(token) != expected.get(token))


def cache_identity(path, metadata, revision):
    lines = metadata.read_text(encoding="utf-8").splitlines()
    if len(lines) != 3:
        raise ValueError("Invalid cache metadata")
    contents = path.read_bytes()
    blob = hashlib.sha1(b"blob " + str(len(contents)).encode("ascii") + b"\0" + contents).hexdigest()
    return {"revisionMatches": lines[0] == revision, "gitBlobMatches": lines[1] == blob,
            "cachedRevision": lines[0], "cachedBlob": lines[1]}


def setup_constants(path):
    wanted = {"REVISION", "EXPECTED_SHA256"}
    return {node.targets[0].id: ast.literal_eval(node.value)
            for node in ast.parse(path.read_text(encoding="utf-8")).body
            if isinstance(node, ast.Assign) and len(node.targets) == 1
            and isinstance(node.targets[0], ast.Name) and node.targets[0].id in wanted}


def save_new(path, value):
    with path.open("x", encoding="utf-8") as stream:
        json.dump(value, stream, indent=2, ensure_ascii=True)
        stream.write("\n")


def run():
    from tokenizers import Tokenizer
    from faster_whisper.feature_extractor import FeatureExtractor
    from scripts import inspect_marathi_segments as segments

    prior = segments.verified_registration()
    protected = read_json(ROOT / "output/translation-model-assessment/before-hashes.json")
    previous_report = read_json(segments.OUTPUT / "report.json")
    expected = {ROOT / name: value for name, value in {**protected, **prior["hashes"]}.items()}
    expected[segments.OUTPUT / "registration.json"] = previous_report["registrationSHA256"]
    expected[segments.OUTPUT / "observations.jsonl"] = previous_report["rawSHA256"]
    expected[segments.OUTPUT / "report.json"] = "e4ebc92b1f95360d21120751b8a4d08eee3aeb5130c74ea5f7c3e42640ccc60d"
    if any(digest(path) != value.lower() for path, value in expected.items()):
        raise ValueError("Previously protected input changed")
    paths = list(expected) + [path for folder in (SOURCE, TARGET) for path in folder.iterdir() if path.is_file()]
    paths += list((SOURCE / ".cache/huggingface/download").glob("*.metadata"))
    paths += [ROOT / "scripts/setup_marathi_speech.py", Path(__file__),
              ROOT / "tests/test_marathi_checkpoint.py", ROOT / "Feature-marathi-checkpoint-audit-plan.md"]
    paths += [ROOT / ".venv-speech/Lib/site-packages" / name for name in (
        "faster_whisper/transcribe.py", "faster_whisper/tokenizer.py", "faster_whisper/feature_extractor.py",
        "ctranslate2/converters/transformers.py")]
    hashes = {str(path.relative_to(ROOT)): digest(path) for path in dict.fromkeys(paths)}
    OUTPUT.mkdir(exist_ok=False)
    save_new(OUTPUT / "registration.json", {"type": "READ_ONLY_CHECKPOINT_AUDIT", "hashes": hashes})
    constants = setup_constants(ROOT / "scripts/setup_marathi_speech.py")
    source = merge_vocabulary(read_json(SOURCE / "vocab.json"), read_json(SOURCE / "added_tokens.json"))
    fast = Tokenizer.from_file(str(TARGET / "tokenizer.json"))
    target = fast.get_vocab()
    ordered = read_json(TARGET / "vocabulary.json")
    source_config, generation = read_json(SOURCE / "config.json"), read_json(SOURCE / "generation_config.json")
    target_config = read_json(TARGET / "config.json")
    preprocessor = read_json(SOURCE / "preprocessor_config.json")
    defaults = {name: parameter.default for name, parameter in inspect.signature(FeatureExtractor).parameters.items()}
    cache = {path.name: cache_identity(path, SOURCE / ".cache/huggingface/download" / (path.name + ".metadata"),
                                      constants["REVISION"])
             for path in SOURCE.iterdir() if path.is_file() and path.name != "model.safetensors"}
    tokens = ["<|endoftext|>", "<|startoftranscript|>", "<|mr|>", "<|en|>",
              "<|transcribe|>", "<|notimestamps|>", "<|0.00|>", "<|30.00|>"]
    mismatches = {"sourceToConverted": vocabulary_mismatches(source, ordered),
                  "runtimeToConverted": vocabulary_mismatches(target, ordered)}
    config_checks = {target_key: target_config.get(target_key) == generation.get(source_key)
                     for target_key, source_key in (("suppress_ids", "suppress_tokens"),
                                                    ("suppress_ids_begin", "begin_suppress_tokens"),
                                                    ("alignment_heads", "alignment_heads"))}
    config_checks["languageIDs"] = target_config.get("lang_ids") == sorted(generation["lang_to_id"].values())
    checks = {"sourceWeightPin": hashes[str((SOURCE / "model.safetensors").relative_to(ROOT))] == constants["EXPECTED_SHA256"],
              "allSourceCacheIdentities": all(row["revisionMatches"] and row["gitBlobMatches"] for row in cache.values()),
              "completeVocabularyIDs": not any(mismatches.values()),
              "baseVocabulary": read_json(SOURCE / "vocab.json") == read_json(TARGET / "vocab.json"),
              "mergesBytes": (SOURCE / "merges.txt").read_bytes() == (TARGET / "merges.txt").read_bytes(),
              "runtimeFeatureDefaults": all(preprocessor.get(key) == value for key, value in defaults.items()),
              "convertedGenerationConfig": all(config_checks.values())}
    changed = [name for name, value in hashes.items() if digest(ROOT / name) != value]
    holdout = ROOT / "output/public-speech-validation/beam2-holdout-20261003"
    checks["reservedHoldoutUndecoded"] = not (holdout / "report.json").exists() and not any(
        (ROOT / "output/public-speech-validation/beam2-assessment-20261003" / name).exists()
        for name in ("holdout-decoding.jsonl", "holdout-assessment.json"))
    report = {"type": "LOCAL_CONSISTENCY_NOT_NUMERICAL_PARITY_OR_ACCURACY", "checks": checks,
              "passed": all(checks.values()) and not changed, "changedInputs": changed,
              "registeredInputs": len(hashes), "previousProtectedInputs": len(expected),
              "sourceRevision": constants["REVISION"], "cache": cache,
              "vocabularyCounts": {"source": len(source), "runtime": len(target), "converted": len(ordered)},
              "vocabularyMismatches": mismatches, "specialTokens": {token: source[token] for token in tokens},
              "configChecks": config_checks, "runtimeFeatureDefaults": defaults,
              "sourceForcedDecoderIDs": source_config.get("forced_decoder_ids"),
              "sourceGenerationForcedDecoderIDs": generation.get("forced_decoder_ids"),
              "convertedHasPreprocessor": (TARGET / "preprocessor_config.json").exists(),
              "limitations": ["Cached identities are local evidence, not a new remote authenticity check.",
                              "No source-to-int8 tensor/numerical or acoustic parity measurement.",
                              "No conversion job/version manifest proving current model.bin derives from source weights.",
                              "Vocabulary/merges equality alone does not prove all tokenizer behavior equivalent.",
                              "No model inference, accuracy/speed improvement or expert validation."]}
    save_new(OUTPUT / "report.json", report)
    print(json.dumps({"passed": report["passed"], "checks": checks, "inputs": len(hashes)}))
    if not report["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    run()
