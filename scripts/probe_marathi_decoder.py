"""Isolated registered prefix-level comparison of existing Marathi decoders."""
import argparse
import json
from pathlib import Path

from scripts import assess_marathi_decoder as base
from scripts import compare_marathi_checkpoints as prior

ROOT = base.ROOT
OUT = ROOT / "output/public-speech-validation/marathi-decoder-probe-20261005"
PLAN = ROOT / "Feature-marathi-decoder-probe-plan.md"
FEATURE = prior.OUTPUT / "mr-30.npy"
PROMPTS = {"initial": prior.PROMPT, "divergence": prior.PROMPT + [35082, 43372, 8485, 101, 21981]}


def identity_paths():
    return [PLAN, Path(__file__), ROOT / "tests/test_marathi_decoder_probe.py",
            FEATURE, prior.OUTPUT / "features.json", prior.OUTPUT / "registration.json",
            prior.OUTPUT / "ct2-worker.jsonl",
            ROOT / "output/public-speech-validation/source-parity-structured-20261004/source-worker.jsonl",
            prior.SOURCE / "model.safetensors", prior.SOURCE / "config.json",
            prior.SOURCE / "generation_config.json", prior.TARGET / "model.bin",
            prior.TARGET / "config.json",
            ROOT / ".venv-translation/Lib/site-packages/transformers/models/whisper/generation_whisper.py",
            ROOT / ".venv-translation/Lib/site-packages/transformers/models/whisper/modeling_whisper.py",
            ROOT / ".venv-speech/Lib/site-packages/faster_whisper/transcribe.py",
            ROOT / "scripts/assess_marathi_decoder.py", ROOT / "scripts/compare_marathi_checkpoints.py"]


def register():
    prior.verified_registration()
    features = json.loads((prior.OUTPUT / "features.json").read_text(encoding="utf-8"))
    feature = next(item for item in features if item["filename"] == "mr-30.wav")
    old_source = json.loads((ROOT / "output/public-speech-validation/source-parity-structured-20261004/source-worker.jsonl").read_text(encoding="utf-8").splitlines()[0])
    old_ct2 = json.loads((prior.OUTPUT / "ct2-worker.jsonl").read_text(encoding="utf-8").splitlines()[0])
    shared = PROMPTS["divergence"][len(prior.PROMPT):]
    if base.digest(FEATURE) != feature["featureSHA256"] or old_source["filename"] != "mr-30.wav" or old_ct2["filename"] != "mr-30.wav":
        raise ValueError("Prior feature/rows disagree")
    if old_source["tokens"][:5] != shared or old_ct2["tokens"][:5] != shared or old_source["tokens"][5] == old_ct2["tokens"][5]:
        raise ValueError("This is not the previously observed divergence prefix")
    original = json.loads((prior.OUTPUT / "registration.json").read_text(encoding="utf-8"))
    OUT.mkdir(exist_ok=False)
    base.save_new(OUT / "registration.json", {
        "type": "MARATHI_FIXED_PREFIX_DIAGNOSTIC", "feature": feature,
        "prefixes": PROMPTS, "priorNextTokens": {"source": old_source["tokens"][5], "converted": old_ct2["tokens"][5]},
        "suppressTokens": original["suppressTokens"],
        "runtimeVersions": prior.versions(),
        "hashes": {str(path.relative_to(ROOT)): base.digest(path) for path in identity_paths()},
        "reservedHoldoutSubmitted": False, "productionChanged": False})
    print(json.dumps({"registered": True, "files": len(identity_paths())}))


def verified():
    reg = json.loads((OUT / "registration.json").read_text(encoding="utf-8"))
    if reg["prefixes"] != PROMPTS or reg["runtimeVersions"] != prior.versions() or any(base.digest(ROOT / name) != expected for name, expected in reg["hashes"].items()):
        raise ValueError("Registered input changed")
    return reg


def shared_feature(reg):
    import numpy as np
    if base.digest(FEATURE) != reg["feature"]["featureSHA256"]:
        raise ValueError("Feature file changed")
    array = np.load(FEATURE, allow_pickle=False)
    if array.shape != (80, 3000) or array.dtype != np.float32 or prior.sample_digest(array) != reg["feature"]["featureDataSHA256"]:
        raise ValueError("Feature data changed")
    return array


def top_indices(values, excluded=(), count=10, allow_negative_infinity=False):
    import numpy as np
    scores = np.asarray(values, dtype=np.float64).copy()
    if scores.ndim != 1 or np.isnan(scores).any() or np.isposinf(scores).any() or (not allow_negative_infinity and np.isneginf(scores).any()):
        raise ValueError("Invalid vocabulary scores")
    scores[list(excluded)] = -np.inf
    allowed = np.flatnonzero(np.isfinite(scores))
    if not len(allowed) or count < 1:
        raise ValueError("No finite candidates or invalid count")
    ids = allowed[np.argsort(scores[allowed])[-count:][::-1]]
    return [{"id": int(i), "value": float(scores[i])} for i in ids]


def source():
    import numpy as np
    import torch
    from transformers import WhisperForConditionalGeneration

    reg = verified()
    array = shared_feature(reg)
    torch.set_num_threads(4)
    torch.set_num_interop_threads(1)
    model = WhisperForConditionalGeneration.from_pretrained(
        str(prior.SOURCE), local_files_only=True, use_safetensors=True,
        dtype=torch.float32, attn_implementation="eager")
    model.eval()
    model.generation_config.suppress_tokens = reg["suppressTokens"]
    model.generation_config.begin_suppress_tokens = [220, 50257]
    features = torch.from_numpy(array).unsqueeze(0)
    masks = {"none": None, "full": torch.ones((1, 3000), dtype=torch.long)}
    rows, mask_differences = [], []
    with torch.inference_mode():
        for label, prefix in PROMPTS.items():
            without_mask = None
            for mask_name, mask in masks.items():
                logits = model(input_features=features, attention_mask=mask,
                               decoder_input_ids=torch.tensor([prefix]), use_cache=False).logits[0, -1].numpy()
                excluded = reg["suppressTokens"] + ([220, 50257] if label == "initial" else [])
                if mask is None:
                    without_mask = logits.copy()
                else:
                    mask_differences.append({"prefix": label, "allLogitsExactlyEqual": bool(np.array_equal(without_mask, logits)),
                                             "maxAbsoluteDifference": float(np.max(np.abs(without_mask - logits)))})
                rows.append({"prefix": label, "mask": mask_name, "rawTop10": top_indices(logits),
                             "suppressedTop10": top_indices(logits, excluded),
                             "rawMaximum": float(np.max(logits)),
                             "rawSum": float(np.sum(logits, dtype=np.float64))})
        generations = []
        for mask_name, mask in masks.items():
            for beam in (1, 3):
                model.generation_config.suppress_tokens = reg["suppressTokens"]
                model.generation_config.begin_suppress_tokens = [220, 50257]
                output = model.generate(input_features=features, attention_mask=mask,
                                        language="mr", task="transcribe", return_timestamps=False,
                                        num_beams=beam, do_sample=False, max_new_tokens=1,
                                        length_penalty=1, early_stopping=False,
                                        return_dict_in_generate=True)
                seq = output.sequences[0].tolist()
                prior.source_generated_tokens(seq)
                generations.append({"mask": mask_name, "beam": beam,
                                    "prompt": seq[:len(prior.PROMPT)], "generated": seq[len(prior.PROMPT):]})
    base.save_new(OUT / "source.json", {"rows": rows, "initialGeneration": generations, "maskDifferences": mask_differences,
                                        "floatPrecision": "float32", "maskFullMeansRealDuration": False})
    print(json.dumps({"sourceComplete": True, "rows": len(rows), "generationRows": len(generations)}))


def converted():
    import numpy as np
    from faster_whisper import WhisperModel

    reg = verified()
    array = shared_feature(reg)
    model = WhisperModel(str(prior.TARGET), device="cpu", compute_type="int8", cpu_threads=4,
                         local_files_only=True)
    encoded = model.encode(array)
    rows = []
    for label, prefix in PROMPTS.items():
        for beam in (1, 3):
            for suppression in ("observed", "none"):
                result = model.model.generate(encoded, [prefix], beam_size=beam, patience=1,
                                              length_penalty=1, max_length=len(prefix) + 1,
                                              suppress_blank=True,
                                              suppress_tokens=reg["suppressTokens"] if suppression == "observed" else [],
                                              return_scores=True, return_logits_vocab=True)[0]
                row = {"prefix": label, "beam": beam, "suppression": suppression,
                       "generated": [int(i) for i in result.sequences_ids[0]],
                       "resultFields": [name for name in dir(result) if not name.startswith("_")]}
                logits = np.asarray(result.logits)
                row["logitsShape"] = list(logits.shape)
                row["scores"] = [float(score) for score in result.scores]
                if logits.size and logits.shape[-1] == 51865:
                    row["vocabularyTop10"] = [top_indices(values, allow_negative_infinity=True)
                                               for values in logits.reshape(-1, 51865)]
                rows.append(row)
    base.save_new(OUT / "converted.json", {"rows": rows, "computeType": "int8",
                                           "suppressBlankRetained": True})
    print(json.dumps({"convertedComplete": True, "rows": len(rows)}))


def report():
    reg = verified()
    source_rows = json.loads((OUT / "source.json").read_text(encoding="utf-8"))
    converted_rows = json.loads((OUT / "converted.json").read_text(encoding="utf-8"))
    initial = [row for row in source_rows["rows"] if row["prefix"] == "initial"]
    divergence = [row for row in source_rows["rows"] if row["prefix"] == "divergence"]
    result = {"type": "MARATHI_FIXED_PREFIX_DIAGNOSTIC", "registrationSHA256": base.digest(OUT / "registration.json"),
              "sourceSHA256": base.digest(OUT / "source.json"), "convertedSHA256": base.digest(OUT / "converted.json"),
              "sourceInitialMaskTop10Same": initial[0]["rawTop10"] == initial[1]["rawTop10"],
              "sourceDivergenceMaskTop10Same": divergence[0]["rawTop10"] == divergence[1]["rawTop10"],
              "sourceMaskDifferences": source_rows["maskDifferences"],
              "priorNextTokens": reg["priorNextTokens"],
              "reservedHoldoutSubmitted": False, "productionChanged": False,
              "limitations": "One previously inspected telephone clip; no website replay or speech/legal accuracy claim. Beam implementations and float32/int8 differ."}
    base.save_new(OUT / "report.json", result)
    print(json.dumps(result))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("register", "source", "converted", "report"))
    {"register": register, "source": source, "converted": converted, "report": report}[parser.parse_args().mode]()
