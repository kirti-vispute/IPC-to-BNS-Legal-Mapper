# Local Translation Model Assessment

Date: 2026-10-03. Status: assessment completed; candidate NOT deployed.

## Problem And Investigation

The existing NLLB model loses clauses in long native passages and explicit dishonest intent in some Gujarati/Kannada inputs. Wider decoding and sentence-boundary prototypes did not justify a safe production replacement. Assess a different model before changing the adapter, date routing, retrieval or UI. No Git repository/commit is available.

Primary sources checked:

- [IndicTrans2 official repository](https://github.com/AI4Bharat/IndicTrans2) and [Indic-to-English distilled model](https://huggingface.co/ai4bharat/indictrans2-indic-en-dist-200M): MIT, covers the required Indian languages, but official access requires account-holder conditions. The author-linked BPCC archive returned HTTP401/GatedRepo. No terms accepted, tokens accessed or access gate bypassed. Distinct preprocessing/tokenizer is required; not a drop-in replacement. Coverage is not evidence of legal translation quality.
- [M2M100 official card](https://huggingface.co/facebook/m2m100_418M): its listed languages omit Telugu. Not selected as a single all-ten-language replacement.
- [OPUS-MT official card](https://huggingface.co/Helsinki-NLP/opus-mt-mul-en): Apache-2.0; lists Hindi, Marathi, Gujarati, Bengali, Tamil, Telugu, Kannada, Malayalam, Punjabi and Urdu as sources, English as target. Public access verified through official API metadata. Selected for an isolated experiment, not endorsed for legal usage.

Measured laptop runtime:12 logical CPUs, Torch2.6.0 CPU build reporting CUDA unavailable, total RAM16,849,256,448 bytes and available RAM2,719,084,544 bytes at measurement. This is not a claim about physical GPU presence or persistent free memory. Avoid simultaneous large-model experiments.

## Implementation Boundary

New offline code: `scripts/assess_translation_model.py` and `scripts/compare_translation_models.mjs`. No production module imports them. Source/config/tokenizer files downloaded from pinned official revision `848eae0c1676cfce9bb791c200e8228e5a6396ff`. Weight size310,385,901 bytes; verified official SHA-256 `33ff438ec37160a105f0700819a5b78a07918e1913fc2f249184b1f46a248e4e`. Source manifest records all downloaded hashes. CTranslate2int8 conversion uses built-in Marian loading, no remote custom code. Network-free conversion/inference; original source load uses `weights_only=True`.

All candidate assets/evidence are under ignored `output/translation-model-assessment/`, separate from production `models/translation/`. No production dependency, model path or display model was changed. Tokenizer warns that optional sacremoses punctuation normalization is absent; the tested setup uses installed MarianTokenizer/SentencePiece. Do not generalize this assessment to every possible configuration.

## Tests And Results

Identical44 raw-prose inputs per model:30 existing short theft/injury/cheating fixtures across ten native languages, ten five-repeat passages, and four prior Gujarati/Kannada contrast probes. No dates or legal identifiers submitted to these isolated decoders. Both CPUint8, beam2, four threads, output limit400 tokens. Existing synthetic diagnostics, not a disjoint holdout, independent bilingual gold labels, legal evaluation or end-to-end website accuracy.

| Measurement | Current NLLB | OPUS candidate |
|---|---:|---:|
| Completed decoder executions |44|44|
| Decoder errors |0|0|
| Existing role/intent guard rejections on raw output |5|8|
| Median raw decoding time |2,043ms|546ms|
| Observed P95 raw decoding time |8,618ms|2,589ms|
| Total measured decoding time |135,013ms|40,630ms|

Timing excludes model loading, adapter retry/chunking, legal analysis and native display. Different output lengths contribute to timings; this is not a website speedup. Guard acceptance is NOT semantic correctness. Raw NLLB rejections are not the existing operational matrix's two unresolved failures: the real adapter can retry and process differently.

Observed reasons to reject this candidate:

- Hindi/Marathi short phone-taking translations omit the absence-of-permission/consent clause that NLLB retains.
- Gujarati injury introduces unrelated sedition/heresy; Gujarati cheating produces an unrelated religious passage.
- Kannada short injury loses the injury, and Kannada/Tamil cheating duplicates accused roles.
- Bengali short injury renders the accused as the injured party rather than the actor.
- Both models omit or alter repeated clauses in long probes. Candidate's five-repeat Marathi passage loses phone/consent concepts; retaining a sentence count alone would not establish meaning.

Checked unconverted PyTorchfloat32 on three selected probes: Hindi theft still loses permission; Gujarati cheating still yields the unrelated passage; Kannada injury differs from int8 and includes injury but changes the actor to a complaint. All three texts differ from int8. Some failures exist before conversion; NOT proof of exact numerical parity or a claim that int8 never contributes. Evidence: `conversion-reference.json`.

## Decision And Production Verification

Do NOT replace production NLLB with this tested OPUS configuration, add language-specific answer insertion, loosen intent/role guards, or change retrieval to compensate for lost translation facts. Faster incorrect text is not an acceptable improvement. IndicTrans2 remains untested, not a promised fix.

- Full `npm test`:217/217; no failures/skips.
- `npm run evaluate`:IPC104/104 and BNS104/104 Top1/Top3; same-crosswalk benchmark, not independent accuracy.
- Separate current replay:5/5 Top1 and5/5 Top3, unchanged; `output/project-completion/translation-model-assessment-replay.json`.
- 83-file snapshot audit unchanged: production/frontend/speech, existing model source/runtime, sealed predictions, references/report, corpus/provenance and prior evaluation files. Historical sealed result remains40% on five provision-eligible cases; never replaced with replay results.
- Diagnostic syntax check passes. Old backend had ended; restarted unchanged server on3002, translation warmup ready. Health reports local speech runtime/models ready; live English phone-taking returns IPC_ONLY with IPC378/379 first two.
- No microphone/UI-language/full end-to-end matrix rerun in this assessment. Prior53/55 matrix remains historical and is not claimed as a new result.

Evidence: `official-metadata.json`, `download-manifest.json`, `conversion.json`, `nllb-probes.json`, `opus-probes.json`, `comparison.json`, `conversion-reference.json`, `before-hashes.json`, `integrity.json` under `output/translation-model-assessment/`. Raw outputs may contain invented content from the rejected model; they are NOT legal source material or labels.

## Reproduction And Next Step

Run the script with `.venv-translation/Scripts/python.exe`, in order: `snapshot`, `prepare` (public download), `convert`, `opus`, `nllb`, `reference`, `audit`. Modes refuse existing evidence. For a repeat, supply the same fresh `--run-name repeat-YYYYMMDD` to each command; this intentionally creates a separate download/conversion too. Requires the existing multilingual fixture and prior `output/translation-context-search/intent.json`; no sealed predictions read by inference.

Generate the comparison with `node scripts/compare_translation_models.mjs` (append the same run-name for a repeat). It validates exact source-text/language/ID parity, computes timings, and reuses existing safety checks without legal scoring. `node scripts/compare_translation_models.mjs --check` recomputes and verifies the saved comparison without overwriting evidence; this passed on the current44-probe reports.

Next single step: obtain legitimate account-holder access/local files for official IndicTrans2, inspect/pin its preprocessing and custom implementation, then run an isolated all-language comparison and genuinely disjoint contrast probes before any production proposal. Account-holder terms must not be accepted by the agent. Independent bilingual review still needed; no legal/expert answers fabricated. Long-text fidelity, GU/KN explicit intent, spontaneous speech and physical microphone testing remain unfinished.

Rollback: no production rollback required. Assessment script/assets are unconnected to application imports/configuration; leaving them in place does not affect the website. Never restore older production code or models to remove this experiment.
