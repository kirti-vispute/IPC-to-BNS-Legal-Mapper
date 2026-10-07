# Frozen Public Hindi Baseline Plan

Date: 2026-10-06. User authorizes public samples only; original failing recording unavailable. This is one offline diagnostic, not a production fix, training run, legal benchmark, or expert validation. No alternative model is selected here.

## Fixed Selection Before Recognition

Source: google/fleurs, hi_in, validation, official dataset-server first-rows endpoint. Published CC BY 4.0 card must be verified and saved. Select 12 recordings using row order 0,7,14,21,28,35,42,49,56,70,77,98, then reserve order 1,8,15,22,36,43,50,57,71,78,92,99 ONLY if overlap prevents 12. Skip solely for previously used or duplicate sentence ID/audio SHA-256; record each skip. Missing/invalid metadata or fewer than 12 eligible recordings fails acquisition, never silently substitutes another row. Exclude prior Hindi development and holdout fixtures by BOTH identities. No content/quality/output-dependent selection, cropping, resynthesis, spelling aliases, or filtering failures.

Save selected published transcripts, sentence IDs, row IDs, recording paths, sample counts, available gender codes and hashes. Gender codes 0 male, 1 female, 2 other follow source card; unique speaker IDs are unavailable, so no distinct-speaker claim. Validate actual audio decoded at 16000 Hz agrees with published sample count and duration is at most 90 seconds. Do not inspect or acquire the rejected cue's unused confirmation or reserved Marathi holdout.

## Unchanged Recognition

Register current 351 committed identities plus this plan, new tools/tests and prior fixture manifests BEFORE acquisition. Register new source card/manifest/audio identities BEFORE recognition, refusing any changed earlier input. One pass in selection order through actual backend.speech.transcribe main streaming Hindi path, existing local whisper-medium, CPU int8/four threads, task transcribe/beam3/temperature0/VADtrue/previous-contextfalse/initial_promptNone. No new model download, decoder adapter or production edits. Worker receives only audio bytes and explicit Hindi, never references or the user's example.

Save each raw response immediately to exclusive JSONL, including errors/empty output; bounded reply 190 seconds. Record end-to-end worker request latency; first request includes model initialization, not comparable to warm requests. Use frozen scripts.study_hindi_beam.scores: NFC/lowercase/punctuation removal/whitespace collapse, word and character Levenshtein micro WER/CER. Empty valid output counts deletions; missing/error replies prevent a complete-set accuracy score. Never discard hard clips. Record per-clip scores and metadata, complete-set totals, total speech duration and observed latency. Published annotation is not independently verified legal gold. New 12-clip WER must NOT be interpreted as improvement over an earlier 4-clip set.

## Integrity And Completion

Exclusive output/public-speech-validation/hindi-broader-baseline-20261006 directory; do not rerun/overwrite occupied output. Preserve all prior evidence, sealed blind predictions, official-source labels/report/methodology, legal corpus/provenance, gateway, app, recognizer/model/runtime and reserved outputs. Run new diagnostic contracts/full JS/Python suites, mapping benchmark and a NEW separate current resolved replay. Record final streamed identity check. Update engineering records/result separately; this plan/tools/tests freeze at registration. No production rollback required. Next single action can be a separately preregistered alternative recognizer comparison after inspecting this baseline; do not automatically tune further here.
