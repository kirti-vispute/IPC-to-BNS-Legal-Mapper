# Marathi Decoder Assessment

## Preregistered Plan: 2026-10-03

No Git repository/commit. Current full-suite baseline225 tests. Offline assessment only; no production deployment, model training, UI or legal retrieval change.

Hypothesis: reducing Marathi beam search from3 to2 may reduce CPU work without changing transcripts. This is NOT a proposed dictionary correction or a promise of better accuracy. Change only `beam_size`. Preserve model `models/speech/marathi-small-ct2`,local CPUint8,4 threads,tasktranscribe,explicit`mr`,temperature0,VADon,previous-text conditioningoff,promptNone,timestamp default. Hindi/Auto/English and production code remain untouched.

Development: eight already-inspected calls in `output/public-speech-validation/fresh-marathi-20261003/fixtures.json`. Reserve eight additional calls in `beam2-holdout-20261003`, excluding original fixtures AND this development run, before candidate inference. Fixed metadata-only collector selection; do not change parameters or substitute favourable clips after outcomes. Published references are not legal labels, independent speaker checks or legal acoustic validation. Viewer unversioned; repository metadata/audio/pages checks retain stated provenance limitations.

Comparison: one separate persistent local worker, balanced alternating baseline/candidate order by clip, setup time excluded,120-second deadline per decoding. Hash audio/manifests/model files and log raw text/time into new evidence, never overwrite old runs. Score using existing mark-preserving diagnostic WER/CER. Require development beam3 text to match the recorded real HTTP baseline; disagreement prevents deployment claims.

Predeclared acceptance: every development and reserved-holdout clip must have no increase in either word or character edits; no request/model errors; no newly lost reference-literal digits or exact negation cue `नाही`; candidate median decode time at least10% lower in each split. These are conservative software gates, not general semantic-equivalence or legal-accuracy proof. If development fails, reject beam2 and leave reserved holdout undecoded. Do not tune additional candidates in this request. Do not automatically deploy even if it passes: report evidence and remaining speech/legal limitations first.

A new file/directory name is not unseen data. Keep previously recorded audio/transcripts/evaluation results and all legal data immutable. Collector accepts bounded `--exclude-run prior-run-name` to include earlier diagnostic manifests in known-call/audio exclusions; test its validation. Physical microphone and spontaneous legal dates/sections are separate unfinished work.
