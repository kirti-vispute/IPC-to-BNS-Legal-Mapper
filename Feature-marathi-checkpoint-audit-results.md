# Marathi Checkpoint Local Consistency Results

Date: 2026-10-04. Scope and method: `Feature-marathi-checkpoint-audit-plan.md`. Raw registered hashes and machine-readable observations: `output/public-speech-validation/checkpoint-audit-20261004/{registration,report}.json`. This is a read-only local file/configuration check. No speech model was run.

## Findings

The source `model.safetensors` SHA-256 matches the pin in `scripts/setup_marathi_speech.py` (`8e741272f0b627a532075e9e3084a35be4f4b678047f972d79c818c0b42f942f`). All ten locally cached source metadata files name the pinned revision `422f5ad4f5356d3dcd413ee862f09a7a389bebd7`, and their Git blob identities match local bytes. This establishes local consistency with the saved setup pin/cache, not an independent fresh remote authenticity check.

The source base-plus-added vocabulary, converted ordered vocabulary and actual fast tokenizer each contain 51,865 tokens with zero ID mismatches. Source and converted base vocabulary maps and merges bytes match. The Marathi token ID is 50320. Production's already observed generated prompts used `[50258,50320,50359]` (Marathi/transcribe). Although source `config.json` has English forced decoder defaults, the current selected-Marathi runtime explicitly constructs a Marathi task prompt; this audit did not establish English prompting as a cause.

Converted `config.json` agrees with saved source generation configuration for suppression, initial suppression, alignment heads and language IDs. The converted folder has no `preprocessor_config.json`; the installed runtime's actual default audio features (80 mel bins, 16 kHz, 160 hop, 30 second chunk, FFT 400) match the saved source preprocessing values. The audit found no mismatch in these checked settings.

The current setup script checks a present target for four required files and otherwise converts the pinned source using `TransformersConverter(..., quantization="int8")`; it does not store a conversion-job/version manifest alongside the current model. Static file agreement cannot prove `model.bin` was produced from these particular source weight bytes, nor numerical or acoustic output parity. Vocabulary ID/merges equality also does not prove all tokenizer preprocessing behavior matches. Publisher model-card dataset/WER statements remain publisher claims, not project training or legal accuracy results. The underlying source of Marathi word errors remains unconfirmed.

## Verification

- Audit: 8/8 checks pass; 156 registered inputs stable; no changed input; reserved holdout remains undecoded. Registered input count includes 124 previously protected/evidence paths and newly inspected source/target/cache/tool/library paths.
- Full Python suite: 34/34 passed, including four new synthetic consistency tests.
- Full JavaScript suite: 231/231 passed.
- Existing official crosswalk retrieval benchmark: IPC 104/104 and BNS 104/104 Top-1/Top-3, same-source consistency only.
- Separate current resolved-case replay: 5/5 Top-1 and 5/5 Top-3, `output/project-completion/marathi-checkpoint-replay-20261004.json`. Historical sealed predictions/evaluation remain unchanged and are not independent lawyer validation.
- Independently checked 83 protected/current files against existing before-hashes: zero changes. No production code, model file, audio fixture, dataset, reference label or benchmark methodology changed.

## Next single step

If more diagnostic work is desired, preregister a source-versus-converted Marathi model parity check on the already inspected eight development clips, with matched input/prompt/settings and exclusive outputs. First verify an isolated source-runtime can run locally; do not install into production or use the reserved holdout. A mismatch would then need investigation; parity alone would still not establish recognition accuracy. No production model or settings change is justified by this audit.
