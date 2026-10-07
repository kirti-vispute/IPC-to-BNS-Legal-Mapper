# Static Display Translation Catalog

Date: 2026-10-02.

## Problem And Investigation

Every new output language decoded repeated interface/prose phrases. Startup also imported Transformers/Torch merely to tokenize. Neither step improves the canonical legal analysis.

## Decision And Implementation

The standalone installed tokenizer preserves the normal NLLB prefix/content/EOS sequence. `profile_translation_tokenizer.py` verifies33/33 exact encodings/decodings against the original AutoTokenizer. Same model and normal beam2 are retained.

`build_display_catalog.mjs` generates92 distinct exact display fragments per language for GU/BN/TA/TE/KN/ML/PA/UR. Catalog metadata says MACHINE_GENERATED_UNREVIEWED and pins model/tokenizer SHA-256. `worker.py` ignores a stale/malformed catalog; new prose uses ordinary translation. Native legal queries are neither cached nor replaced by catalog text. Canonical English sources/citations remain literal. Controlled HI/MR interface drafts are separate from statutory text.

## Tests And Result

Runtime tests check display-only duplicates/cache, native non-caching, one tokenizer, matching catalog hashes, malformed entries and display-only lookup. Real55-fixture matrix exercises all11 languages and native-script headings. These checks do not certify linguistic quality. Rollback: restore worker/presentation copies; leave generated catalog unreferenced.
