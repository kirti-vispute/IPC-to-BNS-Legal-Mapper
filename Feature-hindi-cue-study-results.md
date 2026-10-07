# Neutral Hindi Cue Results (2026-10-06)

## Scope And Decision

User cannot supply original audio and explicitly authorizes public-speech continuation. Do not ask for that unavailable recording again. The reported exact acoustic failure remains unverified; prior live typed control preserves Hindi meaning. No Git repository/commit. Starting254 JS/97 Python. Current recording/frontend/worker/adapter and previous beam study read; no production change.

One OFFLINE hypothesis: a neutral native Hindi preceding-context cue `यह हिंदी में कही गई बात है।` on current local medium. Actual production recognize delegated with ONLY initial_prompt changed. No case text, legal vocabulary, date, section, name or published answer in prompt. Same language hi/beam3/int8/four threads/VAD/task transcribe/temp0/no previous-text conditioning. Installed source prepends cue tokens to first window; it is not an instruction-following corrector. See frozen Feature-hindi-cue-study-plan.md and upstream source: https://github.com/SYSTRAN/faster-whisper/blob/master/faster_whisper/transcribe.py .

**Rejected. No production deployment or further cue tuning.** Both aggregate spelling metrics worsen and two clips regress. Silent controls passing does not excuse incorrect speech meaning.

## Results

Four previously inspected FLEURS Hindi clips (published CC BY4.0 references), same decoded16k audio per pair, alternating baseline/cue order. No reference words passed to recognizer. Synthetic one-second zero-waveform controls clearly separate from real public speech.

| Clip | Baseline Word/Character Edits | Cue Word/Character Edits | Outcome |
|---|---:|---:|---|
| hi-29 |6/9|6/9|Same score; punctuation differs|
| hi-44 |3/4|4/7|Worse, introduces negation|
| hi-53 |6/11|6/11|Same score; raw spelling differs|
| hi-82 |7/11|9/13|Worse|

90 reference words/429 characters. Baseline22/35 edits:micro WER24.44%, CER8.16%. Cue25/40 edits:WER27.78%, CER9.32%. These are strict normalized edit distances on four development clips, NOT website/legal accuracy or independent native review. Example source `पुलिस ने कहा` versus cue `पूलिस नहीं कहा`: literal negation added, confirming why context guessing is unsafe here.

Both synthetic silence responses empty, no errors/full cue copied into speech; silence/cue gate passes. Recorded speech decoding53.937s versus55.385s (setup excluded), timing gate passes; not a latency guarantee or speed improvement. Quality gate FAILS. All10 raw responses preserved before scoring/decision. No fresh confirmation downloaded/registered/decoded because development failed. Fixed planned rows60-63 were never inspected; acquisition helper not run. Reserved eight Marathi holdout outputs remain absent. No new Marathi recognition study or quality improvement claim; its production path is hash-unchanged.

## Tests And Integrity

- New synthetic tests/test_hindi_cue_study.py:5/5, adapter only changes context, rejects wrong language/arm, strict paired completeness/regression/time/error/empty/silence/cue-copy gates. No acoustic claim.
- Full npm test254/254; full Python unittest discovery102/102, zero failures/skips. Project-local TEMP/TMP/PYTHONUTF8 and approved local JS test servers. Acquisition helper node syntax check passes, not network/provenance acquisition validation.
- Official same-crosswalk mapping IPC104/104 and BNS104/104 each Top-1/Top-3; separate current resolved replay5/5 each output/project-completion/hindi-cue-study-replay-20261006.json, unchanged. Historical sealed40%/official refs/report/methodology untouched, NOT independent lawyer validation.
- Register351 current source/data/model/runtime/tool/plan/test identities before inference, including unchanged previous344. Streaming final audit351 unchanged; no new prior-source override, old registrations preserved. Production/backend/frontend/models/runtime/legal corpus/checksums/evaluations byte-identical. No service/browser/microphone operation or audio upload to third parties. Required command sessions finished.

## Changed Files

New scripts/study_hindi_cue.py:registered gated offline candidate and exact scorer via previous frozen utility. New scripts/obtain_hindi_cue_confirmation.mjs:fixed-row licensed public acquisition ONLY after development pass, unused. New test module/frozen plan/this results record. Update existing Bug-hindi-speech-quality.md and Decisions/Architecture/Flow/TestChecklist/Rollback/ProjectCompletion/Handover with rejection and current public-only next step. All new sources/tests/plan/results and documentation additions read; no production diff or rollback required.

Exclusive evidence output/public-speech-validation/hindi-cue-study-20261006:development-registration.json, development-observations.jsonl, development-report.json, development-integrity.json, full-test logs/mapping result. Do not overwrite occupied outputs or edit frozen tool/test/plan. Preserve prior beam trial and current selection fix.

## Next Single Step

Public-only option remains available: preregister a broader, disjoint Hindi reference set with available speaker/recording metadata and establish the current model's baseline before evaluating a different recognizer. Two rejected decoder tweaks do not establish an acoustic cause or justify another arbitrary cue/beam/VAD/word-correction experiment. No alternate model obtained/trained/validated here. Hindi/Marathi natural legal/date-section/microphone quality and independent bilingual/legal/IRAC review remain unresolved. Do not claim generalized robustness is fixed, rewrite transcript meaning or weaken legal checks to conceal speech errors.
