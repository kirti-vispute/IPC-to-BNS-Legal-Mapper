# Feature: Reusable Local Translation Worker

## 2026-10-02 Startup warmup extension

The HTTP server now begins loading the existing local translation worker on startup via an empty translation request. A first user query waits if loading is still in progress. Failure does not prevent a later normal retry. This does not translate or cache native case text and does not alter legal analysis. In a local check after the model-ready log, a Bengali IPC 379 query took 23.9 seconds (including first uncached Bengali display translation); a similar later query took 0.7 seconds with display strings cached. These are different queries and laptop timings, not a controlled before/after latency claim. The earlier live cold request took 46.2 seconds. Startup still pays the model-load cost and keeps its memory resident.

Date: 2026-10-01. This is a translation-runtime performance change, not a retrieval or legal-rule change.

## Problem and Investigation

Each Analyze request started a new Python process for language detection or translation. The local NLLB model and libraries were reloaded for native input and again for localized output. A same-query Bengali profile took 53.4 seconds for input translation and 58.2 seconds for output translation, about 112 seconds total. A direct profile spent 15.4 seconds importing Transformers, 4.3 seconds loading the tokenizer, 3.9 seconds loading the translator, and 3.7 seconds decoding one sample sentence. These are laptop observations, not guaranteed latencies.

## Decision and Implementation

`backend/server.js` now gives `analyzeMultilingualQuery()` one reusable worker created by `createStreamingTranslationWorker()` in `backend/core/multilingual.js`. `backend/translation/worker.py --stream` accepts one JSON request per line, retaining the detector, one offline CPU/int8 NLLB translator, and tokenizers by source language. Model, beam size, token limits, source/target codes, date/identifier/fact checks, Applicable Law Check, retrieval, citations, IRAC, and grounding are unchanged. The original one-shot worker remains for standalone tools.

Only successful English-to-display translations are cached, keyed by source, target, and exact text, with a 4096-entry bound. Native case/query text is translated afresh and never entered into that cache. A busy request still gets `TRANSLATION_BUSY`; malformed output, crash, or timeout stops the worker and allows a later request to start a clean one. No cloud API or disk cache was added.

## Tests and Result

- Full suite: 194/194 passed, including reuse, busy, timeout, malformed-output, validation-error and crash-restart regressions.
- Official crosswalk-derived mapping benchmark: IPC 104/104 and BNS 104/104 Top-1/Top-3. Current no-write five-case official-source replay: 5/5 exact Top-1 and 5/5 acceptable Top-3. Historical sealed results were not regenerated.
- Same Bengali fact-only query: one-shot 112.0 seconds; reusable worker first request 64.5 seconds with the same English processing text, IPC route, Top-3 and first translated title. The latter was measured before restricting the cache to display-only; first-request behavior is unaffected by that restriction.
- Ten controlled native-language inputs with output translation disabled: first cold Hindi request 29.2 seconds; subsequent Marathi, Gujarati, Bengali, Tamil, Telugu, Kannada, Malayalam, Punjabi and Urdu requests 6.4-7.6 seconds. All ten retained date `2024-06-20`, route `IPC_ONLY`, IPC 379 Top-1. Prior one-shot samples took about 31-39 seconds each.
- Real output translation for Gujarati, Bengali, Tamil, Telugu, Kannada, Malayalam, Punjabi and Urdu: target-script interface heading and first title, identical canonical citations/source fields, and unchanged IPC route/Top-3. First cold Gujarati output took 56.5 seconds; subsequent languages took about 10.6-29.5 seconds in that session.
- Restarted live site: first Bengali native request 46.2 seconds; a different Bengali request afterward 8.6 seconds. A warm fact-only Bengali request completed in 4.1 seconds and still returned the pre-existing unrelated IPC 92/89/313 ranking.
- All nine protected prediction/reference/report/corpus/source hashes matched established baselines.

## Limits

The first request after a server restart still loads the model and can take tens of seconds. Keeping the local worker ready uses roughly a gigabyte of memory while the server runs; this should be revisited on low-memory laptops. Output translation for a language not yet used in that server session still has decoding work. Timing varies with hardware and load. Legal retrieval quality is unchanged: fact-only theft wording remains a known issue, and this feature does not establish independent legal or translation accuracy.
