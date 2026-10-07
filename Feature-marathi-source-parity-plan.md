# Marathi Source And Converted Model Diagnostic

Date: 2026-10-04. This is one offline comparison on the eight already inspected public Marathi development recordings. It is not a model selection or production change.

## Question

Do the locally pinned source checkpoint and currently deployed converted int8 checkpoint produce the same token sequences when given identical retained audio features and a Marathi transcription prompt? The prior local consistency audit checked file identities and token IDs, but could not measure model output.

## Fixed procedure

1. Register the exact source/converted model files, fixture WAV hashes, saved default-VAD intervals and segment report, parity tool/tests/plan, relevant runtime code and installed package versions. Verify the previous checkpoint audit passed. Use an exclusive output folder, `output/public-speech-validation/source-parity-20261004/`.
2. Decode only the eight named development WAVs to 16 kHz with the installed speech runtime. Apply the saved retained sample intervals from the prior default-VAD audit; verify decoded and retained sample hashes. Generate the exact same faster-whisper 80 by 3000 log-Mel feature array for both models and save each feature with its hash. No new VAD decision is made.
3. In separate processes, run the current converted int8 checkpoint with CTranslate2 and the pinned source float32 checkpoint with installed Transformers/PyTorch. CPU, four threads. For each feature use prompt `[50258,50320,50359,50363]` (start, Marathi, transcribe, no timestamps), beam width 3, deterministic decoding, maximum 192 generated tokens, no previous-text conditioning or legal prompt. Use the current production suppression list and begin-suppression settings as closely as the two libraries allow. Each job has a 180-second elapsed limit; preserve failures and partial raw rows without overwriting.
4. Require the source generation to begin with the exact registered Marathi prompt. Decode both outputs using the same converted tokenizer. Report per-clip generated token IDs/text, exact token/text parity, input hashes, runtime versions and elapsed time. Exact parity is descriptive, not a preregistered deployment gate. No reference transcript is used to choose a candidate.

## Interpretation limits

The two frameworks may differ in beam stopping, suppression, length scoring or numeric precision even with matched input and prefix. A mismatch alone cannot identify corruption, the responsible layer or a better model. This simplified no-timestamp single-window diagnostic differs from the website's timestamped segmentation and is not a full production replay, performance benchmark or legal/speech accuracy evaluation. An exact match on eight inspected recordings would not prove all output parity or good transcription. No reserved holdout calls are decoded. No downloads, conversions, package installs, source/target model edits, translation/retrieval/routing/UI edits, legal labels or evaluation-method changes.

The plan, tool and tests are frozen after registration. Write findings separately. Run focused/full tests, mapping benchmark, separate current resolved replay and protected/input-hash checks after the experiment. Preserve all historical evidence.
