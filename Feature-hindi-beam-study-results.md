# Hindi Recording Robustness Study Results (2026-10-06)

## Reported Failure And Diagnosis

User confirms recording with Spoken language Hindi:

Intended: `10 जुलाई 2024 को आरोपी ने एक व्यक्ति को गंभीर चोट पहुंचाई।`

Inserted: `10 जुलाई 2024 को आरोपिने एक यक्तिकों गमभी चौट पोचाई`

Original audio was not attached. These supplied words document a reported ASR failure, not a reproduced acoustic test. The prior Auto/Written selector fix cannot explain a correctly selected Hindi recording. Read actual frontend recording path, complete worker/adapter and multilingual input handler: Hindi selects local medium, task transcribe, beam3, temperature0, VAD, no previous-text context or prompt. Returned transcript is inserted unchanged; translation is separate on manual Analyze. No demonstrated application spelling rewrite causes this output. Underlying microphone/acoustic/model cause remains unresolved.

Live typed-input control preserves the intended Hindi sentence exactly and returns English processing text `2024-07-10  The accused seriously injured one person.`, route BNS_PRIMARY. This is an input-preservation/translation observation, not expert legal validation. Initial sandbox socket attempt failed and produced no valid response; retain `typed-input-check.json` as unusable, use the separate successful approved-localhost `typed-input-retry.json`. No microphone or UI permission/action occurred.

## One General Candidate, Not A Sentence Patch

Preregistered OFFLINE medium beam3 versus5; delegate through actual production recognize with only beam changed. No supplied user text or published annotations enter the model. Four existing licensed FLEURS Hindi recordings, alternate paired order, same decoded16k audio, CPUint8/four threads. Not unseen/physical microphone/legal-date speech. Five synthetic scoring contracts test strict edit counts and rejection gates, not acoustic correctness. Upstream default5 is only motivation, not proof: https://github.com/SYSTRAN/faster-whisper/blob/master/faster_whisper/transcribe.py . Frozen plan: Feature-hindi-beam-study-plan.md.

| Clip | Beam3 Word/Character Edits | Beam5 Word/Character Edits | Outcome |
|---|---:|---:|---|
| hi-29 |6/9|6/9|Same scored quality|
| hi-44 |3/4|4/5|Worse|
| hi-53 |6/11|6/12|Worse characters|
| hi-82 |7/11|7/11|Same scored quality; raw wording differs|

Totals:90 reference words/429 characters. Baseline22 word edits,35 character edits:micro WER24.44%, CER8.16%. Candidate23/37:WER25.56%, CER8.62%. NOT `100 - WER` website/legal accuracy. All eight responses nonempty; quality gate FAILS. Recorded warm decode totals80.873s versus83.011s; timing gate passes but observations are load/order dependent, NOT speed guarantees (test/evaluation processes also ran during this session). **Candidate rejected; production beam remains3.** No second candidate or deployment.

## Verification And Files

- New standalone scripts/study_hindi_beam.py, tests/test_hindi_beam_study.py (five tests), frozen plan and this results record. Backend/frontend/model/runtime/corpus/evaluation source unchanged this session.
- Full JavaScript254/254 and Python97/97, zero failures/skips; project-local TEMP/TMP, approved local JS test ports. Focused new tests5/5.
- Same-crosswalk mapping IPC104/104 and BNS104/104 Top-1/Top-3; separate current resolved replay5/5 Top-1/Top-3, unchanged. Historical sealed40% remains historical, not lawyer validation. No sealed predictions/references/reports/methodology modified.
- Registration344 current identities preserves prior327 with explicitly recorded PREVIOUS authorized app hash override, adds current study/model/fixture identities. Final streaming audit344 unchanged, reserved eight Marathi outputs absent. No original registrations refreshed.
- Evidence directory output/public-speech-validation/hindi-beam-study-20261006: registration.json, observations.jsonl (all raw transcripts/counts/times), report.json, integrity.json, separate full-test logs/mapping result and typed controls. Preserve occupied/frozen artifacts; never rerun there. Separate output/project-completion/hindi-beam-study-replay-20261006.json.
- Updated existing Hindi bug plus Decisions/Architecture/Flow/TestChecklist/Rollback/ProjectCompletion/Handover. Full new tool/test/plan/results and added engineering sections read. No Git commit/repository. No server restart or browser edits; existing3002 used for typed control. All required command sessions finished.

## Remaining Work

General Hindi ASR spelling errors reproduced on public speech; exact reported acoustic failure still untested. No automatic fuzzy/domain dictionary, sentence-specific substitution, legal-answer guessing or translation/retrieval compensation added. Actual intended/inserted words cannot identify microphone/audio quality. Next single step requires the user's failing recording with already supplied intended words and confirmed Hindi selection, or suitable separately scoped referenced natural legal audio; compare raw decoded audio/transcript before proposing another general change. Do not claim the requested robustness improvement is complete.
