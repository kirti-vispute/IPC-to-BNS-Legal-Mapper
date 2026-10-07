# First-Window Collector Correction

2026-10-06. Preserve original82-input audit registration and failure. The saved baseline paired unfinished window advances3000->5216, before its6000-frame input end; the full generator naturally asks for another encoder result. Original diagnostic incorrectly expected only one generation after consuming the whole synthetic clip.

One correction to DIAGNOSTIC consumption only: delegate actual installed generate_segments, yield original first-window emitted segments, then close the iterator once all nonempty/nonzero-duration split segments from its first splitting call have been yielded. Do not change split/seek/tokens/options/scores, invoke new inference or initialize a model. A skipped window has no split and ends normally. The first-window collector does not simulate the rest of the recording.

Freeze original tool/plan/tests/registration/failure and separate collector/plan/two tests before retry. Exclusive `tail-audit-first-window-20261006/`; preserve original directory without rewriting it. Repeat same eight saved windows and matching split-event checks. All read-only task constraints and original plan limitations remain. Actual control behavior, not acoustic cause or production fix.
