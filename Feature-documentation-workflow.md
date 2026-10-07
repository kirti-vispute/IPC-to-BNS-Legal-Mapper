# Feature: Persistent Engineering Documentation Workflow

Date opened: 2026-09-09

Status: Implemented.

## Problem

The project had grown from a prototype into a system with production code, legal source data, sealed predictions, official-source reference labels, evaluation reports, frontend changes, and retrieval bug fixes. Important constraints were spread across conversation history and evaluation notes.

## Investigation

Relevant existing files:

- `README.md`
- `ARCHITECTURE.md`
- `backend/core/*.js`
- `tests/*.test.js`
- `evaluation/official-source-reference-evaluation/*.md`
- `evaluation/runs/blind-predictions.json`
- `legal-sources/manifest.json`

Findings:

- Architecture was documented, but not enough to guide future safe changes.
- No root file clearly separated immutable artifacts from normal source code.
- No root handover, rollback, or test checklist existed.
- Git metadata is unavailable in the current folder.

## Decision

Create a root documentation workflow with dedicated files:

- `Decisions.md`
- `Architecture.md`
- `Flow.md`
- `Constraints.md`
- `Handover.md`
- `TestChecklist.md`
- `Rollback.md`
- `Bug-<short-name>.md`
- `Feature-<short-name>.md`

## Implementation

Added and updated root documentation files only. No production behavior changed during this workflow setup.

## Tests

No production tests were rerun for this documentation-only task.

State recorded:

- latest production test status: `npm run test` passed 23/23 after the retrieval fix
- sealed prediction hash recorded
- official-source reference label hash recorded
- legal corpus/source hashes recorded

## Result

Future work now has a persistent process for:

- architectural decisions
- execution flow
- immutable artifact constraints
- test logging
- rollback planning
- bug and feature histories
- end-of-session handover

## Maintenance Rule

At the end of every session, update `Handover.md`. After every production change, update `Decisions.md`, `TestChecklist.md`, `Rollback.md`, and any relevant bug/feature document. Update `Architecture.md` and `Flow.md` whenever architecture or execution flow changes.
