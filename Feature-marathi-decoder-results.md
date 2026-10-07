# Marathi Decoder Assessment Results

Date: 2026-10-03. No Git repository/commit. Offline diagnostic only; candidate rejected, nothing deployed. The frozen plan remains in `Feature-marathi-decoder-assessment.md`.

## Problem And Investigation

The production Marathi-tuned small model still makes word errors on public telephone recordings. Hypothesis: reducing beam size from 3 to 2 might reduce work without degrading transcripts. Only this one candidate was assessed; no prompt, model, translation, retrieval or UI changes.

Reserved eight additional public calls BEFORE candidate decoding. Collection excluded the original three manifests AND the previously inspected `fresh-marathi-20261003` development set by call, utterance and audio hash. Source: ConvoZenAI/indictelephony-bench, CC BY 4.0, repository metadata pin `aa72c79dbb97644e50ae26cfa267d8fa81a37ce7`. The dataset viewer is unversioned; raw pages/audio hashes do not independently certify revision-linked transcripts, distinct speakers or training disjointness. Published references are not legal/expert labels. No training was performed.

## Implementation

- `scripts/validate_public_speech.mjs`: optional bounded `--exclude-run` preserves the original history and excludes additional prior diagnostic runs. Existing revision verification/scoring/HTTP path unchanged.
- `scripts/assess_marathi_decoder.py`: exclusive registration of plan, model and fixture hashes; separate offline CPU int8 worker, four threads, explicit Marathi, transcribe, temperature 0, VAD on, no previous-text conditioning/prompt. Balanced alternating beam-3/beam-2 order. A future holdout run requires development acceptance; no automatic deployment.
- `scripts/score_marathi_decoder.mjs`: mark-preserving paired word/character edits, visible numeral/negation cue losses, baseline parity with saved actual HTTP transcripts, predeclared per-clip no-regression and at least 10% median speed reduction gates. Writes fresh evidence only.
- New JS/Python tests cover selection exclusions, acceptance/rejection and exact option parity with the existing production Marathi worker. Synthetic tests are not recognition accuracy.

## Results And Decision

Eight development clips, 135 reference words, 709 normalized Unicode code points. All baseline transcripts exactly match the prior actual production HTTP outputs. Inference completed 16 paired jobs; `noErrors: true` means nonempty outputs/valid positive timings, NOT semantic accuracy or proof of enforced deadlines.

| Measurement | Existing beam 3 | Candidate beam 2 |
|---|---:|---:|
| Word edits / micro WER | 87 / 64.44% | 88 / 65.19% |
| Character edits / micro CER | 237 / 33.43% | 238 / 33.57% |
| Recorded median decode time | 7.9465s | 8.788s |

`mr-79.wav` worsened character edits from 29 to 30. `mr-332.wav` worsened word edits 15 to 17 and character edits 32 to 33; `mr-539.wav` improved slightly but cannot cancel another clip's regression. No newly lost checked literal-digit/exact-negation cues; this narrow check does not prove preservation of numbers spoken as words or general negation.

**Reject beam 2.** Quality gates fail independently of timing. Recorded median is 10.59% higher, not the required 10% reduction. Candidate timings include 92.666s and an unexplained 1,702.734s observation. The latter exceeds the intended 120s budget despite the parent timed wait returning a result. Cause is unverified; no outlier discarded, no certified deadline or controlled speed comparison claimed. Timing instrumentation/host scheduling must be investigated separately before another latency experiment.

Eight reserved calls remain UNDECODED; no unseen-query/holdout quality or speed result exists. Do not run the public HTTP validator on this reserved set or reuse it as development before choosing the next candidate.

## Verification And Integrity

- Full `npm test`: 230/230, zero failures/skips (previous baseline 225).
- Focused public/decoder JS tests: 13/13; separate decoder-option Python: 2/2; existing readiness Python: 7/7.
- Official mapping benchmark: IPC 104/104 and BNS 104/104 Top-1/Top-3, unchanged. Same-crosswalk consistency, not independent legal accuracy.
- Separate current resolved replay: 5/5 Top-1 and 5/5 Top-3, unchanged, under `output/project-completion/beam2-assessment-replay-20261003.json`. Historical sealed 40% results remain untouched.
- 83/83 protected/current files hash-identical. Separate 29-path plan/model/manifest/audio/prior-evidence audit unchanged; holdout decoding/report absent.
- App health confirms existing service on port 3002. No restart or production rollback needed.

Evidence: `output/public-speech-validation/beam2-assessment-20261003/{registration.json,development-decoding.jsonl,development-assessment.json,protected-integrity.json,evidence-integrity.json}`. Reserved audio/provenance: `output/public-speech-validation/beam2-holdout-20261003/`. New scorer exit 1 is the expected rejection decision, not a failed regression suite. Do not overwrite these files or frozen preregistration.

## Remaining Work And Next Step

Marathi speech fidelity, natural legal dates/sections, physical microphone validation, long native meaning and GU/KN intent failures remain open. No expert legal/bilingual/IRAC review exists; gated IndicTrans2 files/runtime are not available. No model or dictionary repair is justified by this decoder comparison.

Next single engineering task: diagnose the isolated timing/deadline anomaly without decoding the reserved holdout or changing production. Only then preregister another evidence-backed candidate; do not try multiple settings until one looks favourable. Rollback: no production change; retire only isolated tools/history-option/test additions selectively, preserving results. See `Rollback.md`.
