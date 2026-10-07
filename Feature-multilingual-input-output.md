# Feature: Local Multilingual Input and Output

Current runtime update (2026-10-02): the HTTP backend reuses one offline NLLB worker for detection, input translation and allowlisted display translation, instead of reloading the model for every call. Only successful exact English-to-display strings are cached; native query text is not cached. First use after restart remains slower and consumes persistent model memory. The legal query pipeline and source-protection checks are unchanged. See `Feature-fast-local-translation.md` for measurements and limits. Older descriptions of one worker process per call below are historical.

Current update (2026-10-01): Gujarati, Bengali, Tamil, Telugu, Kannada, Malayalam, Punjabi, and Urdu again translate the allowlisted result and interface text by default after analysis. Hindi and Marathi keep the controlled fast result path. `LOCAL_OUTPUT_TRANSLATION=0` disables output model translation; `=1` enables it for HI/MR too. Original English statutory excerpts, citations, PDF pages, dates, scores and law codes remain unchanged. The extra local pass increases analysis time on this laptop. Earlier descriptions of English output for the eight languages are historical; see `Bug-multilingual-result-and-theft-parity.md`.

Updated: 2026-09-26. Academic/noncommercial use only. This is machine translation, not certified legal translation.

Current output boundary: multilingual.presentation is schemaVersion2, not flat translated field names. frontend/legalPresentation.js owns controlled EN/HI/MR labels/system narratives and separate literal/prose nodes. The adapter translates only HI/MR provision titles; other languages translate explicitly allowed prose. Canonical English results, original title/excerpts and all scores/dates/source metadata/citations remain separate and unchanged. The browser renders structured fields, labels translated titles and original sources, and restores English defaults when switching. Existing detector/input translation/local workers are unchanged in this revision. Terminology is not expert-approved. See Bug-structured-multilingual-presentation.md; real acceptance script is now scripts/verify_structured_presentation.mjs. Older flat-field verification observations are historical, not the current contract.

## Problem and Decision

Typed analysis was English-only. Optional Whisper English translation did not retain the original language for output. Inspection covered the frontend/server, speech adapter/worker, legal pipeline, protection constraints and tests. The machine has approximately 16 GB RAM. Add translation before/after the canonical pipeline, not multilingual legal logic or a translated corpus.

Configured language codes: English en; Hindi hi; Marathi mr; Gujarati gu; Bengali bn; Tamil ta; Telugu te; Kannada kn; Malayalam ml; Punjabi pa (Gurmukhi); Urdu ur. Tested support and actual outcomes are recorded below after real-model verification. Romanized/mixed-language text and other scripts are not guaranteed.

py3langid 0.3.0 classifies across its full language inventory. Supported detections normally require probability >= 0.8; known unambiguous English legal terms/section references and clear English sentences bypass translation. A narrow Hindi-first/Marathi-second ambiguity safeguard now additionally requires three independent Marathi grammatical families, zero Hindi families, Hindi probability <0.98 and Marathi >=0.05. The returned selected-language probability remains the actual model probability, not a fabricated consensus confidence. See Bug-marathi-language-detection.md. Short shared-script sentences can still be rejected (for example, short Hindi may be classified as Nepali). Rephrase with more context. Probabilities are not calibrated legal confidence.

Translation uses [official NLLB-200 distilled 600M](https://huggingface.co/facebook/nllb-200-distilled-600M), revision f8d333a098d19b4fd9a8b18f94170487ad3f821d, converted by CTranslate2 4.8.2 to CPU/int8. Official source weights SHA-256 c266c2cfd19758b6d09c1fc31ecdf1e485509035f6b51dfe84f1ada83eefcc42. Model license CC-BY-NC 4.0 restricts commercial use. No API key/account is required. The legal PDFs are retrieval data, not training data for this pretrained translation model.

## Flow and Safety

Original query -> language detection -> explicit localized month/digit normalization -> literal date/statute/number spans protected outside model -> English translation -> date-set check -> unchanged analyzeQuery -> canonical citations/IRAC/grounding -> natural-language display translation back to stored originalLanguage -> UI. Canonical English fields remain available alongside multilingual.presentation; source authority/file/page/URL/hash and bound citation strings remain original. Input textarea is never replaced with the internal English query.

Missing dates still return UNDETERMINED, IPC/BNS candidates only and no governing-law IRAC. There is no invented offence date. Low detection confidence, unsupported language, failed/empty/truncated/low-score translation, unexpected numerical/statutory output and date-set mismatch stop analysis. No cloud or silent English fallback. Numeric/identifier checks cannot prove that intention, negation, actors or other legal facts were translated correctly. Every translated result has a review warning; grounding PASSED refers to the canonical English synthesis only.

Only explanation text and titles are localized; navigation and citation/source labels remain the existing UI. Retrieved excerpts and IRAC Rule source material are now unmodified original English text in labelled expandable source blocks, not machine-translated statutory wording. Canonical source metadata/citations remain exact. English baseline legal results are unchanged.

Update 2026-09-26: multiple-date input now retains sentence context using strict __LEGAL_N__ markers for original literal facts. Changed/missing/duplicated/reordered markers or invented numerals/identifiers reject the translation. Exact restoration is followed by the existing date-set/weekday checks. Ordinary input/display translation keeps literal spans outside the model, including Markdown/whitespace, relevance/page phrases and runtime source identities. This supersedes the earlier exclusively literal-span implementation; no legal rule is changed. Reproduce current bug checks with node scripts/verify_multilingual_bugs.mjs; these are software acceptance fixtures, not expert labels. See both multilingual bug documents for results. Earlier session counts and smoke results below are historical.

Numerical notation: English source number words zero through twenty may be rendered as equivalent digits (for example twelve -> Bengali ১২). A different number, sign or fractional value is rejected. Other written/compound quantities may conservatively fail. This value check does not verify the number's grammatical role or legal meaning. Urdu query/results use automatic text direction; canonical English citations remain unchanged.

Observed limitations, not hypothetical: one Kannada input generated an unmentioned Monday; the adapter now rejects unmentioned weekdays before legal analysis. Some Telugu/Malayalam/Bengali translations had awkward actor/ownership/action wording. A Marathi missing-date explanation used wording resembling a filing date despite the canonical offence-date requirement. Numeric/date/identifier checks do not reliably catch those semantic errors. Do not treat these translated explanations as legally reliable; use the original source/English canonical result and obtain bilingual review. A Hindi missing-date example translated consent-related wording to "permission" and the unchanged lexical retriever returned IPC 182 first rather than theft candidates. No retrieval synonym rule or legal-code modification was made to conceal that failure. End-to-end language smoke success is not translation fidelity or legal accuracy.

## Windows Setup

Use Python 3.12 x64 and Node 20+ from the project root:

```powershell
py -3.12 -m venv .venv-translation
.\.venv-translation\Scripts\python.exe -m pip install -r backend/translation/requirements.txt
.\.venv-translation\Scripts\python.exe scripts/setup_local_translation.py
npm start
```

Setup downloads only the pinned official repository and verifies source weights before conversion. Source weights are about 2.46 GB; converted weights and Python dependencies need additional disk space. Conversion has a higher memory peak than CPU/int8 inference; this machine has 16 GB RAM. No GPU required. Internet is needed only for initial package/model setup. Runtime forces offline mode and local_files_only. Keep both runtimes separate (.venv-speech and .venv-translation). Optional LOCAL_TRANSLATION_PYTHON and LOCAL_TRANSLATION_MODEL select trusted local paths. Only Windows tested.

One translation worker at a time, 180-second worker deadline, 400-second frontend analysis deadline, query cap 4000 characters, segmented text cap 400 tokenizer tokens per segment. Long/uncertain text may fail instead of producing partial answers. Extra jobs receive busy responses. No permanent input logging by the production adapter. Model is loaded per worker and released afterward; latency includes cold loading. Converted weights: 622,596,105 bytes, SHA-256 398726640cc2a02cc6a35277fa3cf2159ce8a1a66b48aa1b6c8837a47e3dd00c. Observed translation-process working set approximately 1.1 GB; full explanations take tens of seconds, not instant response.

## Voice

Local faster-whisper auto-detects spoken language. Native transcription enters the same adapter. Optional English speech translation returns originalLanguage metadata for output localization. Frontend forwards that hint only for an unchanged transcript; editing triggers ordinary text detection. Review transcription before manually selecting Analyze. No real human Indian-language microphone evaluation has been completed; tiny ASR can change dates/names/sections, and translation cannot repair those reliably.

## Tests and Results

Reproduce software regressions with npm test, mapping consistency with npm run evaluate, and actual offline model smoke tests with node scripts/verify_local_translation.mjs. Add --extra for fact-only, missing-date and post-transition fixtures. Set VERIFY_LANGUAGE=bn,kn to restrict a diagnostic run. The latter stores separate generated observations in output/multilingual-verification, never in protected evaluation files. Synthetic fixtures are not expert-labelled legal or translation accuracy data. No multilingual accuracy percentage is claimed.

| Check | Before | After |
|---|---|---|
| Full Node suite | 62 passed | 86 passed, 0 failed |
| IPC official mapping Top-1 / Top-3 | 104/104 each | 104/104 each |
| BNS official mapping Top-1 / Top-3 | 104/104 each | 104/104 each |
| Current resolved-source replay Top-1 / acceptable Top-3 | 5/5 each | 5/5 each, no-write wrapper replay |
| Typed English regression | 2024-06-20, IPC, IPC 379, PASSED | Same |
| Real synthetic English voice, verified host loopback | 20 June, IPC 379 | 20 June, originalLanguage=en, IPC 379, PASSED |

Actual local model ran for Hindi, Marathi, Gujarati, Bengali, Tamil, Telugu, Kannada, Malayalam, Punjabi and Urdu. Date/identifier/output-language plumbing was exercised, not certified linguistic fidelity. Each language produced a dated IPC 379 response on at least one smoke fixture; this is largely an explicit-section test, not fact-only retrieval accuracy. Original Kannada wording was subsequently rejected because of invented Monday; the date-separated alternative completed, but ownership wording remained ambiguous. Initial Bengali notation/separator failures were resolved in the bn-results.json rerun. Earlier smoke/mr/bn,kn files record earlier failed attempts, not final accuracy reports.

Additional real inference: provided fact-only Marathi example -> 2024-06-20, IPC_ONLY, IPC 378 first; missing-date Marathi -> CLARIFY, empty governing allowedCodes, IPC/BNS candidate-only preview, no IRAC; missing-date Hindi -> same clarification contract but weak IPC 182-first candidates; dated Marathi 12 July -> BNS_PRIMARY, BNS 303 first. All five extra fixtures and the final Bengali rerun retained canonical citation/source objects exactly. Live browser Marathi result confirmed original textarea, automatic language indicator, date, IPC 378/379, original pages/citations and a translated review warning; visible layout was checked. Physical Indian-language speech remains untested. Repeated direct old/current English recognizers agreed on 20 June; some isolated localhost diagnostic responses returned 22, whereas the verified host 127.0.0.1 endpoint matched 20. The connection-path discrepancy was not conclusively explained; do not infer ASR accuracy from this fixture.

Tests added: English bypass/full canonical equivalence, short English references, Hindi/Marathi dated and missing-date contracts, BNS routing, native digits/months, invalid dates, statutory/subsection/date/annotation/URL preservation, number-word notation validation, PDF separator preservation, invented weekday rejection, unsupported/uncertain language, failed translation, original speech-language output, query bounds, offline/shell-free process, concurrency/timeout/kill/recovery and safe worker errors. Frontend/speech tests cover language hints, invalidation after edits, local output rendering/citations and returned speech-language metadata.

Integrity: 38 protected baseline files matched SHA-256 after this change, including all evaluation files, corpus/provenance, six legal modules and benchmark/scorer scripts. Historical sealed accuracy remains untouched; current replay and mapping consistency are separate results, not expert or multilingual legal validation.

## Exact Change Inventory

| Files | Change and reason |
|---|---|
| backend/core/multilingual.js (new) | Bounded local input/output adapter, date/entity safeguards, canonical pipeline call, separate presentation |
| backend/translation/worker.py, requirements.txt (new) | Offline language detection and NLLB inference; pinned compatible dependencies |
| scripts/setup_local_translation.py (new) | Pinned official download, hash check, CPU/int8 conversion |
| scripts/verify_local_translation.mjs (new) | Separate synthetic real-model observations, not evaluation labels |
| backend/server.js | Await multilingual adapter at the existing Analyze endpoint |
| backend/core/transcriber.js, backend/speech/transcribe.py | Speech language detection/metadata with explicit-language decoding; no paid provider |
| frontend/app.js, frontend/index.html | Localized display fields, voice-language hint, stale status clearing, request deadline, automatic direction; no redesign |
| tests/multilingual.test.js (new), tests/transcriber.test.js, tests/voiceInput.test.js | 24 added regressions and process/UI safety checks |
| .gitignore | Ignore local translation environment/weights and generated verification output |
| Architecture.md, Flow.md, README.md | Current boundaries/flow and setup link |
| Decisions.md, TestChecklist.md, Rollback.md, Handover.md | Reasons, reproducible results, scoped reversal and handoff |
| Feature-multilingual-input-output.md (new), Feature-whisper-voice-input.md, models/MODEL_CARD.md | Models/licenses/setup, real limits and current voice integration |

Generated, ignored local assets: .venv-translation; models/translation/source and nllb-int8; .voice-rollback/multilingual production backups; output/multilingual-verification observation files. None is an expert label, a legal corpus addition or a sealed benchmark artifact.

## Cost Check

OpenAI API key: NO. Paid translation API: NO. Paid speech API: NO. Cloud translation dependency: NO. Subscription: NO. Per-request API/cloud translation cost: NO. Local hardware, electricity, storage and initial internet traffic remain ordinary costs.
