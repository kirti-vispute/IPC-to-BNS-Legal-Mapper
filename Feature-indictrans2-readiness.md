# IndicTrans2 Assessment Readiness

Date: 2026-10-03. This is preparation, NOT an implemented translation fix.

## Problem And Decision

Current NLLB still loses long-text meaning and some Gujarati/Kannada intent. The tested OPUS alternative was rejected. Next candidate is the official Indic-to-English distilled 200M model, but no local folder has been supplied. Do not weaken translation safety checks, insert expected answers, or change retrieval to conceal these losses.

The [official model page](https://huggingface.co/ai4bharat/indictrans2-indic-en-dist-200M) requires the account holder to accept contact-sharing/access conditions. This agent has not accepted them, used tokens or downloaded gated files. Public metadata is accessible separately and was verified at revision `eb9e49d81077cfc5311e82ff36d8c1fc11557b5d`.

The [official HF interface](https://github.com/AI4Bharat/IndicTrans2/tree/main/huggingface_interface) requires its tokenizer and IndicProcessor preprocessing/postprocessing. Its linked [toolkit](https://github.com/VarunGumma/IndicTransToolkit) currently states Windows is not a supported/tested environment. This is a compatibility risk, not proof inference is impossible. WSL status/list were checked: only `docker-desktop` is registered. Do not install packages inside Docker's internal distribution or replace production dependencies. A separate validated Linux container/distro or a tested Windows-compatible implementation must be assessed before inference.

## What Was Added

- `scripts/translation-candidates/indictrans2-200m.json`: 13 required file sizes/official identities pinned from public revision metadata; MIT and gated-access status recorded. Translation-model provenance only, NOT legal corpus/reference data.
- `scripts/check_indictrans2_files.py`: offline, read-only model-file checker. Computes SHA-256 for LFS files and Git blob hashes for ordinary files; reports missing/changed files and unexpected Python files. Never imports/executes candidate code, loads weights, downloads files or reads credentials. `readyForInference` remains false even if files match, because review/testing is still required. Evidence uses exclusive creation, never overwrite.
- `tests/test_indictrans_readiness.py`: seven synthetic file-integrity tests. Fake tiny payloads are explicitly NOT models or legal labels.

No production code, model settings, dependency versions, translation/routing/retrieval, UI, speech, legal corpus or evaluation artifacts were changed. No Git branch/commit available. No production rollback required; these tools are not imported by the application.

## Account-Holder Setup

1. Open the official model page above in your own browser. Sign in and personally review/accept its conditions only if you agree.
2. Choose the pinned revision in Files and Versions: [exact snapshot](https://huggingface.co/ai4bharat/indictrans2-indic-en-dist-200M/tree/eb9e49d81077cfc5311e82ff36d8c1fc11557b5d).
3. Download the 13 files listed in the manifest into one separate folder, preferably `models/experiments/indictrans2-200m-source`. Use `model.safetensors` (913,353,672 bytes), not the duplicate `pytorch_model.bin`. Include config, tokenizer dictionaries/models, license/card, and the three custom implementation files. Downloading code does NOT approve executing it.
4. Send the local folder path here. Do not send passwords or access tokens. The next step is identity checking and code/environment review, then isolated translation testing. Nothing is automatically connected to the website.

Optional quicker download in YOUR OWN Command Prompt, after accepting conditions: the existing Hugging Face CLI is available. Its login/download help was checked, but these commands have NOT been executed. Login is private; keep credentials out of chat and command arguments. Do not agree to storing a token in Git unless you intend to.

```bat
cd /d "D:\Kirti\__VIT RELATED\Lab Experiments\NLP\Project"
.venv-translation\Scripts\hf.exe auth login
.venv-translation\Scripts\hf.exe download ai4bharat/indictrans2-indic-en-dist-200M --revision eb9e49d81077cfc5311e82ff36d8c1fc11557b5d --local-dir models/experiments/indictrans2-200m-source --exclude pytorch_model.bin .gitattributes --max-workers 2
```

The command downloads files, not installs or executes the model. If access is denied, request/resolve access on the official site; do not use unofficial mirrors to evade the gate. No successful authorized download has been claimed.

## Reproducible Checks

From the project root:

```bat
.venv-translation\Scripts\python.exe -m unittest discover -s tests -p test_indictrans_readiness.py -v
.venv-translation\Scripts\python.exe scripts/check_indictrans2_files.py --model-dir "models/experiments/indictrans2-200m-source" --output local-check-NEW-RUN.json
npm test
npm run evaluate
node scripts/project_completion_validation.mjs replay indictrans-readiness-replay.json
```

Use a fresh report/replay name when repeating; do not overwrite prior evidence. File check returns Python exit2 for missing/invalid files, exit0 for verified identities; neither authorizes inference. No directory argument intentionally reports missing files, not an accuracy failure. The PowerShell command wrapper can surface a generic nonzero exit status.

## Actual Results

- New checker tests: 7/7 passed. Covers absence, exact identities without execution, missing/truncated files, same-size tampering, extra Python, path traversal and immutable evidence.
- Public official metadata: all 13 prepared entries match pinned revision; no mismatches. Weight hash `a9bff20ae94712db41c8dc99d2e381eb456ddccbcd48cb2c7cf077ccc5bc58d8`.
- Real readiness report: no folder provided, files missing, `readyForInference: false`; expected nonzero state, not a fabricated model test.
- Existing full suite: 217/217 passed. Mapping/replay/integrity session-close results are recorded in Handover/TestChecklist.
- No IndicTrans2 translation, latency, bilingual or legal accuracy results exist yet. Previous 53/55 multilingual diagnostics and sealed 40% result remain historical, not rerun here.

Evidence: `output/indictrans2-readiness/readiness-20261003.json`, `official-metadata-verification.json`, and session-close integrity report. No model is trained by this preparation.

## Next Single Step

Obtain the account-holder-downloaded official folder. Verify identity, inspect exact custom code and processor version in an isolated compatible runtime, then compare existing and disjoint multilingual contrasts. Preserve native dates/sections/roles/negation/ownership/intent and English bypass; retain current legal pipeline. Do not promote on language coverage, a few correct sections or decoder likelihood. Independent bilingual/legal review and physical microphone testing remain unavailable; no approvals or labels fabricated.
