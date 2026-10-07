# Bug: Saved-Window Audit Consumes The Following Window

2026-10-06. Diagnostic collector corrected; production behavior unchanged.

Problem: new read-only replay expected one stub generation, but failed after a saved partial-seek baseline window. Investigation: actual helper advances3000->5216 before the supplied input end6000; fully consuming generate_segments correctly begins another window. The original audit incorrectly treated one generation's input span as one complete clip.

Decision: preserve frozen82-input original tool/registration/failure. Correct only diagnostic consumption in a separate collector, without changing installed splitting/seek/model controls or recreating saved speech results.

Implementation: separately frozen `scripts/audit_first_speech_window.py` delegates the real generator, yields unchanged first-window segments and closes after all nonempty/nonzero-duration first-split segments. Skipped windows end normally. New exclusive87-input output directory; no registered source rewritten after execution.

Tests: two collector contracts verify identical segment objects/forwarded arguments, no next-generation consumption and normal skip/close. Six underlying control tests pass; full70 Python/231 JavaScript. Eight saved real windows match decoded text/raw split/seek8/8. Mapping104/104 each/current replay5/5 unchanged; protected83/255 checked identities stable, holdout absent.

Result: usable CONTROL replay, not neural recognition or model accuracy evidence. Underlying tiny-tail repetition/saturation and short-word fidelity remain unresolved. See `Feature-speech-tail-audit-results.md`. No production rollback; preserve original failed evidence and corrected report.
