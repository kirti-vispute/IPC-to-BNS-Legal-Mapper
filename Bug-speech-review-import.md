# Bug: Speech Review Helper File-Spec Import

2026-10-06. Status: fixed within the backend review integration, not a separate architecture change.

Problem: initial helper import selected a sibling import whenever `__package__` was empty. Existing diagnostic loaders use `spec_from_file_location()` from the project root, without putting `backend/speech` on `sys.path`; they could not find `review`.

Investigation: full existing Python suite reproduced `ModuleNotFoundError` in actual diagnostic imports. CLI/package focused tests alone did not cover this path. Separate sandbox temporary-directory failures were environmental, not this bug.

Decision/implementation: attempt `backend.speech.review` first, fall back to sibling `review` only for that missing module/package. Do not mask unrelated import failures, add path mutation or change frozen diagnostic loaders. Direct CLI and package imports still work.

Tests: added file-spec loader -> actual recognize/observer regression, existing direct-CLI help test, full unchanged old Python tests. Final88/88 Python and236/236 JS pass. No transcript/decoding/legal/evaluation change; before copies and rollback in backend-review evidence/`Rollback.md`.
