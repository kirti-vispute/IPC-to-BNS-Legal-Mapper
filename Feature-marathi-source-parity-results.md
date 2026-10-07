# Marathi Source Versus Converted Checkpoint Results

Date: 2026-10-04. Scope: previously inspected eight public Marathi telephone clips, not legal queries or new holdout audio. Plans: `Feature-marathi-source-parity-plan.md`, `Feature-marathi-source-parity-retry-plan.md`, `Feature-marathi-source-parity-structured-plan.md`. Raw model outputs and hashes are in the corresponding exclusive `output/public-speech-validation/source-parity-*/` directories.

## What ran

The original script registered44 inputs, verified the saved default-VAD intervals/audio hashes, generated eight shared 80 x3000 feature arrays and completed eight converted-int8 decodes. Its source step was interrupted by laptop sleep and timed out: 20:02:07 local sleep, a transient wake/sleep at21:00:08, and resume at22:07:55. The old report remains `usable:false`, with zero source rows. This timeout is not evidence that original weights are intrinsically slow.

A separate source-only retry loaded the local float32 checkpoint and decoded the first feature, but the diagnostic expected Transformers' plain return to contain its decoder prompt. Installed `generation_whisper.py` strips the prompt from the plain tensor. This parser error produced another `usable:false` report; it is not a model failure. The original plan/tool/results were not edited.

A third, separately registered source-only attempt used the same model/input/prompt/beam/suppression/token cap and requested `return_dict_in_generate=True`, so the full generated sequence retained the prompt. The source worker checked `[50258,50320,50359,50363]` for every clip and completed8/8. It reused the original eight converted rows, not another converted inference pass. All eight shared feature/model/recording/input hashes remained stable across registrations44+17+20. Neither checkpoint, production code nor reserved holdout changed.

## Observations

The structured report records **0/8 exact generated-token matches and1/8 exact decoded-text matches**. Both outputs are saved per clip. For example, both source and converted outputs on `mr-30.wav` contain the earlier observed erroneous `तीनधार` rather than the published `तीन हजार`; switching to original source weights is not shown to correct that example. The source run emitted a warning that an attention mask could not be inferred from equal pad and end-of-sequence IDs. The frameworks also differ in decoder implementation, beam stopping and float32/int8 arithmetic. Their unequal outputs cannot identify a faulty conversion or show that either one is more accurate.

Correctly parsed Windows power records show sleep at16:52:35.6318402UTC and resume at16:52:52.4154622UTC during the structured source run (22:18:48 to22:23:18 local). The run's eight token/text pairs are complete, but it is **not an uninterrupted timing experiment**; no speed claim is made. The first power query accidentally passed a PowerShell auto-converted local DateTime back through a date parser and checked the wrong month. That empty query is excluded. The corrected query read raw ISO strings with `JsonDocument` and invariant `DateTimeOffset`; its exact window/events and source hashes are in `source-parity-structured-20261004/assessment.json`. The original machine report remains untouched.

This comparison used one no-timestamp generation window with identical saved features and prompt. The website uses timestamped segmentation, so this is not an end-to-end website replay. Public telephone reference transcripts are not lawyer labels; no legal or general Marathi accuracy rate follows. The underlying reason for the project's Marathi errors remains open. The results do not justify a model replacement, inference-setting change or claim that int8 quantization caused the errors.

## Verification

- Full Python test suite:37/37 passed (three new diagnostic-contract tests).
- Full JavaScript suite:231/231 passed.
- Existing same-crosswalk IPC/BNS mapping benchmark:104/104 each Top-1/Top-3; not independent legal validation.
- Separate current resolved official-source replay:5/5 Top-1 and5/5 Top-3 in `output/project-completion/marathi-source-parity-replay-20261004.json`; historical sealed results unchanged.
-83 protected/current hashes unchanged. All44 original,17 first-retry and20 structured-retry registered inputs unchanged; reserved holdout still undecoded.

## Next single step

Investigate the cross-library decoder difference on one already inspected clip by comparing a fixed prefix and one-step token distribution/beam controls, while keeping the same shared features. First resolve the source attention-mask warning and document the exact suppression/stopping differences. Do not replace the production model or decode reserved audio based on this comparison.
