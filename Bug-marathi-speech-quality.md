# Bug: Marathi speech fidelity on public telephone audio

## Follow-up: Long HTTP Warning Delivered, Fidelity Still Open (2026-10-06)

Same inspected60.046s nonlegal repeated WAV through actual local server/UI preserves saved wrong words/malformed character exactly and displays existing advisory on desktop/mobile.3-window warning0/1 agrees with frozen risk rule. No model/decoder/translation/retrieval change or improved speech claim; synthetic capture is not physical mic. Full245 JS/92 Python/mapping104/current replay5 stable,327 identities unchanged, reserved8 absent. Warning does not correct short words or validate natural spoken legal dates/sections. Next natural-microphone acceptance requires voluntary audio/reference words; public fixture cannot establish legal-speech fidelity. See Feature-long-speech-review-validation-results.md.

## Follow-up: Warning Is Not Improved Word Recognition (2026-10-06)

Offline guard detects saturated/unclosed saved stress windows, preserves original transcripts and does not warn on eight short outputs. Known short-word errors remain; no-warning does not mean correct transcription. No ASR inference/model/window change or speech-accuracy gain. Full231 JS/77 Python, mapping104/104 each/current replay5/5 unchanged; protected83/261 identities stable/holdout absent. Prototype not deployed. Next backend metadata integration only, not generic rejection/word repair/retrieval compensation. See `Feature-speech-review-warning-results.md`; quality stays OPEN.

## Follow-up: Tiny-Tail Acceptance Is A Control Risk, Not Acoustic Diagnosis (2026-10-06)

No new inference: eight saved windows replay exactly through real installed controls. High average score overrides candidate tail's high silence probability; compression failure has no alternative temperature/rejection, and no-ending timestamp emits/advances. Padding99.8667% established from shape, not silence or actual features. Does not explain neural repetition choice, fix short-word error or prove natural speech accuracy. Full231 JS/70 Python, mapping104/104 each/current replay5/5 unchanged, protected83/255 identities stable/holdout absent. Next one offline incomplete-window review-warning guard, no speech deletion or legal retrieval masking. See `Feature-speech-tail-audit-results.md`; quality remains OPEN.

## Follow-up: Shorter Windows Do Not Fix Fidelity (2026-10-06)

Registered offline15s candidate preserves8/8 inspected short transcripts, including prior errors. Long stress bound hits remain2; fewer malformed characters accompany worse reference CER/WER and phrase overcount/final tiny-tail repetition. Rejected, production unchanged. This is artificial repeated read-speech evidence, not natural telephony/legal accuracy. Full231 JS/62 Python, mapping104/104 each/current replay5/5 unchanged; reserved8 not decoded. See `Feature-short-speech-window-results.md`; next only read-only final-tail/padding/timestamp investigation. Fidelity bug remains OPEN.

## Follow-up: Long Production-Style Saturation Reproduced (2026-10-05)

Actual `recognize` unchanged-option trace of reconstructed60.046s public repeated read-speech reproduces historical HTTP text exactly. First attempt slept and was rejected/preserved; separate uninterrupted retry has VAD100% retention, windows224/224/75. First no-pair malformed tail advances whole30s; second paired tail resumes52.16s. This confirms unsafe saturation/continuation behavior on this stress input, not the cause of every Marathi word error or an exact missing-word rate. No production fix; short clips still have separate model errors. Full231 JS/58 Python, mapping104/104 each/current replay5/5, protected83 stable/235 checked identities unchanged, reserved8 absent. See `Bug-long-speech-continuation.md` and `Feature-long-speech-trace-results.md`. Next only offline15s-window candidate with fresh model instances/same audio/eight short clips; no legal retrieval compensation.

## Follow-up: Production Token Limit Does Not Explain Short-Clip Errors (2026-10-05)

Read-only timestamped website audit completed, with four installed-helper tests and no model inference. Source-derived bound224; saved8 short clips60-135 tokens, zero bound hits/skip, all baseline transcripts identical. Existing60s repeated public-speech output has errors but no generation/seek evidence. Synthetic cap-length/no-pair pattern advances whole30s window, while unfinished paired tail revisits remaining audio; conditional omission risk only, not a confirmed acoustic cause. Quality bug remains OPEN, no production fix justified by this audit. Full231 JS/52 Python, mapping104/104 each/current replay5/5 unchanged, protected83 stable/holdout absent. See `Feature-speech-continuation-audit-results.md`; next controlled unchanged-option60s window trace, not speech or retrieval tuning.

## Follow-up: Equal Offline Budgets Do Not Resolve Word Error (2026-10-05)

Converted-only comparison on the same8 inspected features uses a corrected192-step budget against saved source. Three old capped outputs become longer, normalized/text agreement1/8 ->2/8 but not uniform (one prior match lost). Known mr-30 `तीनधार` error remains in both. No production speech/model/UI/retrieval change or new speech accuracy claim; quality bug stays OPEN. Full231 JS/48 Python, mapping104/104 each/replay5/5, protected83/144 commitments unchanged, holdout8 undecoded. See `Feature-marathi-matched-cap-results.md`. Next inspect actual timestamped production token limit/continuation before changing it.

## Follow-up: Prefix Choices Agree; Prior Caps Differ (2026-10-05)

One inspected clip: no/full source mask produces identical entire logits on two prefixes; all8 converted verified one-new-token beam/suppression conditions agree with source local winners35082/3941. Earlier full source beam chose8485 despite local maximum3941, consistent with sequence-path effects. Prior comparison also has three converted98-token rows against source cap192 and different EOS handling. No unique word-error/conversion cause or production fix. Full45 Python/231 JS, mapping104/104 each/replay5/5, protected83 stable. Marathi quality remains OPEN. Next matched-cap converted-only diagnostic on inspected features. See `Feature-marathi-decoder-probe-results.md` and `Bug-marathi-decoder-probe.md`.

## Follow-up: Source And Converted Models Both Keep Errors (2026-10-04)

Shared-feature, forced-Marathi/no-timestamp source-versus-converted diagnostic completed8 token/text pairs in a separately registered third attempt. Exact token parity0/8 and text parity1/8; both outputs still contain the earlier wrong `तीनधार` on an inspected clip. Source return-format bug and laptop sleep interrupted earlier attempts; all reports remain separate. The completed run also slept17 seconds and source warned about an absent attention mask. Different decoders/precisions prevent attributing unequal outputs to conversion, and none of these clips are legal accuracy labels. No source-weight model switch, tuning, UI or retrieval change. Full231 JS/37 Python, mapping104/104 each, replay5/5, protected83 unchanged. Marathi quality bug remains OPEN. See `Feature-marathi-source-parity-results.md` and `Bug-marathi-parity-diagnostic.md`.

## Follow-up: Current Checkpoint Files Are Locally Consistent (2026-10-04)

Problem: wrong words persist in decoder text, without skipped windows and with nearly all inspected audio retained. Investigation: one read-only audit of the pinned source weight, ten cache records, 51,865 source/converted/runtime token IDs, merges, generation settings and installed audio feature defaults. Decision: no production change, because all eight consistency checks pass; English defaults in source config are not the observed Marathi runtime prompt. Implementation: isolated audit script, four synthetic tests, frozen plan and exclusive report; no recognizer or holdout run. Tests: full231 JS/34 Python, mapping104/104 each, separate replay5/5, protected83 unchanged. Result: no confirmed tokenizer/configuration mismatch; missing source-to-int8 conversion manifest and numerical/acoustic parity leave checkpoint derivation and precise recognition cause unresolved. Bug remains OPEN. See `Feature-marathi-checkpoint-audit-results.md`.

## Follow-up: Decoder Window-Skip Hypothesis Ruled Out On Inspected Clips (2026-10-04)

Unchanged baseline observer records8 generation windows/8 segments, all saved HTTP texts identical, zero no-speech skips. Probability range1.8671e-10..1.9599e-8, avg logprob-0.2723..-0.2010, compression1.5054..2.0438: guards pass despite erroneous emitted words. All token-generated text already equals emitted text; errors are not created by UI or window skipping on these examples. No calibrated-confidence or unique checkpoint defect claim. VAD duration parity8/8; reserved8 untouched. Full231/231 JS,30/30 Python; mapping104/104 each/replay5/5 unchanged;83 protected+61 extra identities stable. No production change, no no-speech/VAD/keyword tweak justified; bug remains OPEN. Next single task: current checkpoint provenance/tokenizer/conversion read-only audit. Complete evidence in `Feature-marathi-segment-diagnostic-results.md`.

## Follow-up: VAD Sample-Retention Hypothesis Checked (2026-10-04)

Default installed ordinary-path VAD retained every sample in7/8 inspected clips; mr-332 only loses48ms prefix, no internal/trailing gap. Sample-accurate library parity8/8. VAD removal cannot explain saved errors in the seven intact recordings. Prefix energy is tiny but not a speech annotation; no general VAD-safety/model-root-cause claim. Original run preserves `auditUsable:false` (unavailable power log); separate authorized same-window query empty, no VAD retry or report replacement. No new recognizer transcripts/candidate/settings or production change; reserved8 untouched. Full231/231 JS,26/26 Python, mapping104/104 each/replay5/5;83 protected+53 extra identities unchanged. Bug remains OPEN. Next: segment/skip decisions with unchanged recognizer and saved-text parity, inspected clips only; do not disable VAD or mask errors with retrieval. Details: `Feature-marathi-vad-retention-results.md`.

## Follow-up: Usable Baseline Timing, Not Fidelity Fix (2026-10-04)

One frozen offline baseline pass on the same inspected8 development clips: all transcripts identical to prior HTTP, no power events/overruns/clock drift beyond gate. Inference median6.446s, range4.408..10.789s; almost all request time inside inference rather than audio preparation, substage cause unknown. No accuracy or speed improvement claimed; strict microWER64.44%/CER33.43% unchanged. Production remains beam3/same model; reserved8 calls undecoded. New profiler+3 tests; full231/231 JS,21/21 Python, mapping104/104 each/replay5/5;83 protected+40 distinct extra evidence identities unchanged. Bug remains OPEN. Next single task is VAD retention/segmentation inspection on already-inspected audio, not tuning/holdout/retrieval changes. Full evidence/limitations in `Feature-marathi-baseline-timing-results.md`.

## Follow-up: Timing Tools Hardened (2026-10-04)

Windows standby observed during previous comparison; missing post-wait elapsed check/upper timing bound fixed only in offline diagnostic tools. Original speech outputs/errors/rejection unchanged; no inference or holdout decoding. Timing evidence cannot support a speed comparison, and fidelity remains OPEN. Full231/231 JS,18/18 Python, mapping104/104 each/current replay5/5;83 protected and34 extra model/evidence identities unchanged. Exact finding, limitation, diffs/rollback and next baseline-only timing task: `Bug-speech-benchmark-deadline.md`. No production speech/retrieval/UI change.

## Follow-up: Beam2 Rejected Before Reserved Holdout (2026-10-03)

One preregistered same-model decoder comparison, not a production fix. Eight development clips: beam3 microWER64.44%/CER33.43%, beam2 65.19%/33.57%; two clips regress. All baseline texts exactly match previous actual HTTP outputs. Quality gates fail, so production remains beam3 and eight newly reserved calls stay undecoded. No generalization or speech-quality improvement claimed. Timing outliers include unexplained1702.734s despite intended120s budget; retain raw evidence, investigate separately, no guaranteed speed/deadline claim. Full230/230 JS, decoder Python2/2 and existing readiness7/7; mapping104/104 each, current replay5/5, protected83 and separate29 evidence checks unchanged. Complete problem/implementation/results/limits/next step: `Feature-marathi-decoder-results.md`. The bug remains OPEN; no legal pipeline/UI/model change.

## Follow-up: Fresh Actual HTTP Baseline (2026-10-03)

Tested eight metadata-selected public CC BY4.0 clips from different calls than the original fixtures, using the real production selected-Marathi endpoint. Publisher metadata revision changed from the earlier pin; license remained unchanged. New diagnostic run explicitly pins `aa72c79dbb97644e50ae26cfa267d8fa81a37ce7`, with one regression proving both old/new exact verification and rejection of later changes. No corpus or production edit.

All8 requests completed with native `mr`, user-selected language and the Marathi-tuned small model. 135 reference words,87 word edits:microWER64.44%; microCER33.43%; mean-clipWER65.14%. These strict text rates include Latin-vs-Devanagari spelling differences and spacing, not solely acoustic/meaning errors. Calls are disjoint from the old project set, not proven speaker- or training-disjoint. Published transcripts are not independently verified legal labels. No legal query, dates or statutory sections were tested.

| Clip | Duration | Actual HTTP time | WER |
|---|---:|---:|---:|
| mr-30 | 5.94s | 11.164s | 50.00% |
| mr-64 | 7.70s | 4.627s | 73.68% |
| mr-79 | 7.78s | 8.334s | 90.00% |
| mr-148 | 6.68s | 7.546s | 50.00% |
| mr-262 | 6.70s | 11.061s | 61.54% |
| mr-332 | 9.08s | 14.985s | 65.22% |
| mr-458 | 7.58s | 14.342s | 66.67% |
| mr-539 | 8.40s | 15.382s | 64.00% |

Confirmed text discrepancies: published `तीन हजार` became `तीनधार`; `site visit` became `साळी जिली`; one hypothesis contains additional photo wording absent from the published reference. These are evidence of reference/hypothesis mismatch, not independently adjudicated acoustic errors. Do not invent a legal correction from them. Some requests overlapped npm tests, so timings are not isolated speed measurements. No speed/model-quality improvement is claimed against different old clips.

Decision: keep production settings unchanged. Correct Marathi routing/metadata and successful HTTP requests do not establish faithful transcription. Preserve editable transcript/manual Analyze. Next single engineering step is one predeclared decoder comparison, with additional uninspected licensed calls reserved before tuning; these eight calls are now diagnostic/development evidence, not an untouched future holdout. Do not force Hindi, add legal-answer prompts, rewrite transcripts by expected outcomes or change retrieval to hide ASR errors.

Full225/225 JS, separate existing Python7/7; mappingIPC/BNS104/104 each; separate current legal replay5/5;83/83 protected/current hashes unchanged. Source/test diff read. No production rollback. Evidence:`output/public-speech-validation/fresh-marathi-20261003/`; commands/limits:`Feature-public-speech-validation.md`. Long translation meaning, GU/KN intent, physical microphone and independent expert review remain unfinished.

## Follow-up: Marathi-tuned local model (2026-09-30)

Problem and root cause: the earlier selected-Marathi path used multilingual Whisper small, which made frequent word errors on public Marathi speech; increasing to multilingual medium or adding a neutral language cue was not consistently better. A pinned, separately Marathi-tuned Whisper-small model improved the same samples without changing legal processing. This is an ASR model-domain limitation, not an Applicable Law Check failure.

Investigation: source revision `422f5ad4f5356d3dcd413ee862f09a7a389bebd7` was downloaded and its 966,995,080-byte source weight matched the host's SHA-256 `8e741272f0b627a532075e9e3084a35be4f4b678047f972d79c818c0b42f942f`. A misleading transport tag was not the source checksum. Local CTranslate2 int8 conversion and a local tokenizer enabled offline decoding. With unchanged beam-3/VAD settings, mean CER/WER changed from 0.6597/1.0447 to 0.4379/0.7869 on four telephone development clips, and from 0.5206/0.9691 to 0.4222/0.7749 on four held-out telephone clips. Four read-speech development clips changed 0.2888/0.7976 to 0.1433/0.5071; four read-speech holdouts changed 0.3406/0.7500 to 0.1654/0.4167. These are unweighted means of normalized edit distances on 16 short public recordings, not representative user or legal-speech accuracy. Per-clip results are ignored under `output/voice-verification/`.

Decision and implementation: selected `mr` prefers the converted Marathi-tuned model when its four required files exist, otherwise falls back to the old multilingual small model. The worker now accepts either the legacy text vocabulary or the converter's JSON vocabulary. `scripts/setup_marathi_speech.py` pins and checks source weights before conversion. Hindi, Auto, prompt, timeout, translation, retrieval and legal modules are unchanged. Focused tests cover preferred/fallback/missing-model paths and vocabulary format; a real local worker transcribed a public Marathi clip with the new model. Full-suite, mapping, resolved replay, protected hashes and limitations are recorded in TestChecklist. Physical microphone input, spoken legal dates/sections and translation factual fidelity remain unverified.

Date: 2026-09-29. No Git repository/branch/commit is available.

## Problem

Selected Marathi voice uses local faster-whisper small with explicit `mr` decoding. Prior short read-speech clips had word errors and one medium-model trial worsened the development set. We need evidence on longer, less scripted speech before changing a model or prompt. This investigation does not change production behavior.

## Investigation

Selected eight CC BY 4.0 Marathi utterances from the [IndicTelephony-Bench dataset](https://huggingface.co/datasets/ConvoZenAI/indictelephony-bench), using fixed offsets and metadata only, before decoding. The public dataset API reported revision `d1a7902dd956cd3eb10304d7142df602273d8bd6` and `cc-by-4.0`; the collector verifies identity/license and records the observed revision. Each clip came from a distinct call, lasted 5-15 seconds, had a published transcript of at least 50 characters, and was tagged `en-mr` (code-mixed). The first four were designated development, the last four holdout. The collector and local file hashes are in `scripts/obtain_marathi_telephony_fixtures.mjs` and ignored `output/voice-verification/marathi-telephony/fixtures.json`. Audio is local diagnostic material only, not a legal source or training data.

The existing `scripts/benchmark_speech_decode.py` ran the production-equivalent beam-3/VAD selected-language settings on the same clips. With small, development mean character error was 0.6597 and mean word error 1.0447; holdout means were 0.5206 and 0.9691. These are simple normalized edit distances against the published utterance transcripts. Values above 1 are possible when the hypothesis inserts words. They are not the dataset's own scoring normalization, representative speech accuracy, or a legal-accuracy claim. Per-clip observations are in ignored `output/voice-verification/marathi-telephony/small.json`.

Medium was tested with the identical settings and audio. On the first two development clips it produced repeated Bengali-script characters instead of usable Marathi; character errors were 1.0280 and 0.9919, and word errors were 1.0000 and 2.9600. The medium run was intentionally stopped after these two pathological results; there is no eight-clip medium score. Previous short-clip evidence also showed a Marathi medium regression. This does not prove small is good. It shows that switching to medium is not a supported repair.

## Decision, tests and result

Keep selected Marathi on small. Do not force Hindi, add a legal-word prompt, invent a transcript-confidence score, or route poor speech directly into legal analysis. Preserve the existing editable transcript and manual Analyze step. No production, date-routing, translation, retrieval, corpus, citation, IRAC or evaluation file changed. Only a diagnostic fixture collector and this documentation were added.

`node --check` passed for the collector. Full serialized suite: 157/157 passed; official crosswalk benchmark: IPC/BNS each 104/104 Top-1 and Top-3; no-write resolved official-source replay: 5/5 Top-1 and acceptable Top-3. Nine protected SHA-256 baselines matched. Historical sealed predictions/results were not rerun or modified.

Limitations: these eight utterances are telephone-quality and all English/Marathi code-mixed, not user microphone recordings or spoken legal questions. No dates or IPC/BNS section numbers were verified acoustically. The transcript/reference alignment and speaker consent come from the public dataset card, not an independent project review. Exact next step is a separate, sufficiently varied licensed Marathi speech evaluation set or consented user legal recordings with verified transcripts, followed by same-clip comparison of a Marathi-capable local candidate before any production switch. The user chose public samples only for this session.
