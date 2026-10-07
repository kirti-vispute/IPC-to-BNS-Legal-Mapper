# Constraints

Last updated: 2026-09-09

This file distinguishes immutable artifacts from normal source code and records project rules that must not be changed without explicit approval.

## Immutable Evaluation Artifacts

These files must not be edited silently. Changing them requires explicit user approval and a clearly documented new evaluation cycle.

| Artifact | Path | Current SHA-256 | Rule |
|---|---|---|---|
| Sealed blind predictions | `evaluation/runs/blind-predictions.json` | `869C7F716261A2080592BA53F06F2E5E86C9907E78309607D5661E645252E91D` | Do not modify. Historical blind run. |
| Official-source reference labels | `evaluation/official-source-reference-evaluation/official-source-reference-labels.json` | `8A83149A1D86C7F958FE9F7542805B3AE8BEE87D3679A53F09E5E01F1E6D71A9` | Do not fabricate or edit to match outputs. |
| Official-source methodology/report | `evaluation/official-source-reference-evaluation/official-source-reference-report.json` | Not immutable like sealed predictions, but do not overwrite casually. | Historical report for sealed predictions. Prefer separate output files for post-fix checks. |

## Legal Corpus Provenance

2026-10-02 explicit remaining-task scope includes obtaining missing primary IPC354D text. This is implemented as separate `legal-sources/supplements/` provenance and `backend/data/statute-supplements.json`, not an edit to any frozen file below. New source is official NCW government IPC PDF/pages80-81, runtime hash-verified by `backend/core/corpus.js`. Further supplements require explicit scope/provenance validation; this is not blanket permission to replace the original corpus or labels.

Approved supplement hashes for subsequent tasks: PDF39a9a403de2a50ff9424d6a874f6fcca209272d466addd35157e809e501e8d7f; records017b663fb73ee979394244bd1470a25f53cba4c8ffbec580b93243799fa764de; supplemental manifest3141475a4f912c9c2d5c63795c770104e70c5bc107f4785523375d23d753f07a. Do not silently replace these sources/texts either.

The corpus must remain based only on official government/legal sources already approved in `legal-sources/manifest.json`.

| Artifact | Current SHA-256 |
|---|---:|
| `legal-sources/manifest.json` | `2FA9C6B343BBEECF97477FDF8FE499644D32B8ECE59B44E4731DF3709E4B1EF5` |
| `backend/data/statutes.json` | `53CCA6AE20A0521638BD5F455F98AC4FA37BB89AAF1DAF30FCCB9C3AB598C988` |
| `legal-sources/ipc-1860-mha.pdf` | `F25D61547212F152DDA8C96B19AC05A286F3A9EB6A95490AB55EC40AA4F53197` |
| `legal-sources/bns-2023-official-gazette.pdf` | `C9DA896E7A16C481A46235789F74F545B7A9ED7F3A5C8049D0B1B9252C6731F4` |
| `legal-sources/bns-commencement-gazette-2024.pdf` | `DFCD5DF23FB711F2996959B13EE6FF6BD32ED38BE1E1F2D1C820CBBA86E2A8C9` |
| `legal-sources/ipc-bns-comparative-chart-bprd.pdf` | `58F019069584DEAB712768ECB4EAF0BB76AABF48E522754752F8E693A3AC4814` |

## Behavior Requiring Explicit Approval

- Do not change the Applicable Law Check in `backend/core/gateway.js` unless explicitly requested.
- Do not weaken date-based routing or allow BNS to override pre-commencement IPC-only conduct.
- Do not modify sealed predictions.
- Do not fabricate legal answers, labels, citations, source pages, or evaluation results.
- Do not describe official-source reference labels as lawyer/professor/expert validation.
- Do not use unresolved `requiresExpertReview` cases as provision-accuracy ground truth.
- Do not add unofficial legal sources to the indexed corpus without documenting provenance and hashes.
- Do not silently overwrite official evaluation reports.

## Normal Source Code

These are normal editable project files, subject to tests and documentation updates:

- `backend/core/*.js`
- `backend/server.js`
- `frontend/*.js`
- `frontend/*.html`
- `frontend/*.css`
- `tests/*.test.js`
- `scripts/*.mjs`
- documentation files

Even for normal source code:

- Read relevant code before changing it.
- Ask why the behavior occurs before deciding what to change.
- Make one logical change per request.
- Avoid speculative refactors.
- Read and explain every diff before considering the change complete.
- Add regression tests for confirmed bug fixes.
- Run existing tests plus relevant new tests.
- Keep comments focused on why when behavior is non-obvious.
