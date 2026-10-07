# Public Speech Validation

Offline/local diagnostic only. No production model, retrieval, routing, UI, legal corpus or evaluation change.

## Latest Run: Fresh Marathi Calls (2026-10-03)

Download approval recovered. Current public dataset revision is `aa72c79dbb97644e50ae26cfa267d8fa81a37ce7`, with the same CC BY4.0 license. The old revision remains available; no previous manifest/result changed. Collector verification accepts an explicit separate new-run pin and checks it before/after collection, rather than silently accepting whatever revision is latest. Added one pin-regression test; current full suite225/225, diagnostic tests8/8.

Successfully collected and tested eight calls not used in the earlier project fixtures, selected before inference. Actual backend `/api/transcribe` returned Marathi-tuned Whisper-small CPUint8, native `mr`, user-selected metadata and no English translation for all8. No training/fine-tuning or new speech setting was applied. Each clip was5.94..9.08s; total59.86s. HTTP times4.627..15.382s, summed87.441s. Some requests overlapped the full software test suite; these are observations, not an isolated speed benchmark, cold/warm comparison or latency guarantee.

Micro WER64.44% (87 edits/135 reference words), micro code-point CER33.43%; mean-clip WER65.14%,CER33.50%. Successful requests8/8 are NOT accurate transcriptions8/8. English-to-Devanagari transliterations/spelling/spacing differences contribute to strict edit rates; no independently checked transliteration-equivalence scoring exists. Number/context discrepancies remain. This tiny telephone sample is not representative legal or microphone validation. It cannot be compared to the older different-call76.10% figure as a quality improvement.

Evidence: `output/public-speech-validation/fresh-marathi-20261003/{fixtures.json,report.json,observations.jsonl,protected-integrity.json}`. Raw viewer pages, audio and before/after public metadata preserved. All83 protected/current source/model hashes unchanged; mapping104/104 each and separate resolved replay5/5. Original sealed/reference evaluation unchanged. No model swap.

## Completed

`scripts/validate_public_speech.mjs rescore` recomputes 48 saved ASR outputs while preserving Indic vowel marks. Verifies published fixture/reference matches and audio hashes; writes a new report without overwriting old results. See `Bug-speech-diagnostic-vowel-marks.md` for results and limitations. Original session had seven regression tests and full224/224; current counts are above.

## Collector And Endpoint Verification

`collect` requests public [IndicTelephony-Bench](https://huggingface.co/datasets/ConvoZenAI/indictelephony-bench) audio/transcripts, CC BY4.0. Pins new collection metadata revision `aa72c79dbb97644e50ae26cfa267d8fa81a37ce7`, checks license/identity before and after, scans ascending100-row windows and takes eight first-eligible different calls,5..25s. Excludes calls/utterances/audio hashes in the three original fixture manifests. Records raw metadata pages and SHA-256 hashes. Dataset viewer is unversioned; metadata checks do not independently prove viewer rows match that revision. Default standalone legacy verifier retains old pin `d1a7902dd956cd3eb10304d7142df602273d8bd6`.

No results are inspected to select clips. Distinct calls do not prove distinct speakers or absence from the model's training data. Published transcripts are not lawyer/bilingual gold labels. These are general telephone recordings, not controlled legal queries. Keep downloaded audio local; do not redistribute or add it to the legal corpus.

`run` hashes each clip and calls the existing localhost3002 `/api/transcribe?mode=transcribe&language=mr`. It checks native-language response metadata and scores the actual editable transcript. It does NOT call Analyze or infer applicable laws from nonlegal calls. Each request has a135s client bound around the existing120s Marathi server deadline. Failures are listed separately and excluded explicitly from edit-rate denominators; a failed request is not a successful answer.

In the previous session, approval failed and no download occurred. This session's approved execution first correctly refused changed repository metadata, then used the separately verified new-run pin. Collection and real HTTP inference now completed. No restriction bypass, credentials or gate acceptance performed.

## Reproduce

From the project root, with a FRESH name every time:

```text
node scripts/validate_public_speech.mjs rescore repeat-rescore-20261003
node --test tests/publicSpeechValidation.test.js
```

When approved public-download access is available, and the unchanged backend is running on3002:

```text
node scripts/validate_public_speech.mjs collect repeat-marathi-20261003
node scripts/validate_public_speech.mjs run repeat-marathi-20261003
```

The same fresh name connects collect/run. Existing directories/logs/reports are refused, not overwritten. Partial collections need a different name after inspecting the failure. Outputs live under ignored `output/public-speech-validation/`. Do not rerun network modes to bypass an approval failure.

A new directory name alone does NOT make a new holdout: repeating this fixed selection and its original exclusions selects the same calls. The eight completed calls have now been inspected. For a future independent candidate comparison, freeze new selection/exclusions that also omit this run before decoding; do not call repeated recordings unseen.

Scoring: NFKC lowercase, punctuation/symbols to spaces, collapse whitespace, preserve combining marks. WER is word Levenshtein edits/reference words; CER uses code-point edits/reference code points. Both micro-weighted and mean-clip rates are named separately. Rates above100% are possible with insertions; no numeric equivalence or official dataset normalization is claimed.

Current corrected local measurements cannot certify general Marathi recognition or justify a model switch. Independent language/legal review and a physical microphone remain separate pending tasks; IndicTrans2 access remains a separate human account-holder decision.
