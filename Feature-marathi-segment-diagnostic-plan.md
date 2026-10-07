# Marathi Segment And Skip Diagnostic Plan

Preregistered 2026-10-04 before recognition. Freeze this plan, observer source/tests, existing helpers, installed recognition/tokenizer/feature/VAD code/assets, model identities, development audio and previous evidence before execution. Write findings separately; do not revise this plan after outcomes.

## Question

Do the unchanged recognizer's no-speech window skips explain the saved Marathi transcription errors, or are incorrect words emitted despite keeping the window? Production ordinary `generate_segments` calls `generate_with_fallback`, then skips if no_speech_prob exceeds its threshold unless avg_logprob exceeds the log-probability threshold. Existing defaults0.6/-1.0, with strict comparisons. This is separate from Silero VAD sample trimming already inspected.

## Fixed Scope

Only eight already-inspected development clips, once in manifest order, separate persistent offline worker. Same Marathi-tuned small CPUint8/four threads, explicit mr/transcribe/beam3/temp0/VAD on/previous conditioning off/prompt None and all other timestamp/threshold defaults. No candidate, sampling, retries with other settings, hotwords, word-alignment request, decoding of reserved holdout, network/download, training, deployment, production/UI/date/retrieval/translation or legal-evaluation changes.

Use a diagnostic subclass which calls the original `generate_with_fallback` exactly once and returns its identical result tuple. Observe generated token IDs/text, selected language/task/prompt IDs, average log probability, no-speech probability, compression ratio and returned temperature; mirror the installed skip guard solely as diagnostic annotation. Capture bounded original debug logs and emitted Segment dataclass fields. Never reinterpret probabilities as calibrated accuracy or legal confidence. A guard annotation must agree with actual skip-log count. Explicit mr is forced, not independent language detection.

## Gates And Evidence

Save exclusive registration/observations/report in `output/public-speech-validation/segment-diagnostic-20261004/`. Require complete8 nonempty results, byte-identical saved HTTP/baseline transcript strings, unchanged hashes/default options/runtime versions, valid finite metrics, preserved duration-after-VAD within one sample of saved retention, exact skip-log agreement, no debug truncation, no120s response/elapsed overrun, no UTC drift over1s, available bounded local Kernel-Power506/507 evidence without events. Preserve failed/partial runs; no outcome-driven retry or flag overwrite. No host power-policy/wake-lock change or concurrent agent benchmarks/tests during recognition. Timing includes observer overhead and is NOT a speed comparison.

Words absent from a published reference comparison cannot be assigned to a particular sound/time without alignment or competent review. Emitted incorrect strings can establish a decoding-output mismatch, not prove a unique checkpoint/tokenizer/model-training cause. No-speech skips absent on these short clips do not certify other long/quiet legal or microphone input. If evidence cannot identify a specific fix, say so and retain production unchanged.

After recognition: full JS/Python tests, mapping benchmark, separately named current resolved replay, protected/evidence hashes and health check. Maintain historical sealed results, current replay and same-crosswalk consistency as different claims. Update engineering docs and handover with one next evidence-backed task, not speculative threshold changes or expert labels.
