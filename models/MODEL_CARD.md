# Model Card

## System Name

IPC to BNS Deterministic Mapping Prototype

## Intended Use

The system helps demonstrate a legal NLP architecture where deterministic rules govern temporal statutory applicability and retrieval supplies grounded statutory candidates.

## Current Models

- Date extraction: rule-based regular expressions
- Routing: deterministic JavaScript logic
- Retrieval: lexical scoring over section-level official legal text with exact and mapped-section boosts
- Generation: template-based IRAC synthesis
- Verification: rule-based grounding checks
- Speech: pretrained local faster-whisper tiny CPU/int8 for Auto detection; pinned medium for user-selected Hindi; a pinned externally Marathi-tuned Whisper small converted locally to CPU/int8 for selected Marathi, with multilingual small fallback when absent. This project did not train the speech model. Public ordinary-speech diagnostics improved but do not establish legal-date/section fidelity; see Bug-marathi-speech-quality.md.
- Input/output translation: pretrained local NLLB-200 distilled 600M CPU/int8 with py3langid language detection; original-language display around the unchanged English legal engine

No statistical model is trained or fine-tuned by this project. The legal PDFs are parsed and indexed for retrieval; they are not used as model-training examples. Speech/translation models are pretrained external models, not legal models trained on this corpus. NLLB has a CC-BY-NC 4.0 noncommercial license; see Feature-multilingual-input-output.md for exact model revision, hashes, setup and limitations.

## Legal Corpus

- 536 section records extracted from the official IPC PDF
- all 358 BNS sections extracted from the official Gazette text
- 104 IPC-to-BNS mappings extracted from the official BPR&D comparison chart
- 7 mapping-only IPC references for later inserted provisions absent from the downloaded IPC compilation
- BNS commencement notification S.O. 850(E), including the section 106(2) exception

## Evaluation

- Functional tests: see the latest TestChecklist.md entry; older counts are historical
- Official-crosswalk benchmark: 104/104 Top-1 for pre-commencement IPC retrieval
- Official-crosswalk benchmark: 104/104 Top-1 for post-commencement BNS retrieval
- Top-3 recall: 104/104 in both routes

These figures measure consistency with the official crosswalk used by retrieval, not independent real-world legal accuracy. A blind expert-labelled dataset is still required.

## Future Model Slots

The architecture can later add:

- a fine-tuned sentence-transformer retriever after the deterministic gateway
- a local instruction model for IRAC rewriting
- a larger verifier for Rule-to-Conclusion consistency checks
- expert-reviewed multilingual translation evaluation (the local adapter is now implemented)

The temporal gateway should remain non-neural.

## Safety Constraints

- The system must not use BNS as the primary charging framework for offenses before July 1, 2024.
- Missing dates must produce clarification instead of a guessed route.
- Continuing offenses that span the transition must produce a review path.
- Generated text must cite retrieved corpus entries only.

## Limitations

- PDF extraction can preserve layout artefacts, so page citations should be checked against the source PDF.
- The official BPR&D comparison covers commonly used provisions rather than every possible IPC-to-BNS relationship.
- The verifier is conservative and may flag valid outputs.
- The prototype does not provide legal advice.
- Production use would still require expert-labelled evaluation data, amendment monitoring, audit logs, and review by qualified legal experts.
