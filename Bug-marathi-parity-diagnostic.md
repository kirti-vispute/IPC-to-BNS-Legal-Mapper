# Bug: Marathi checkpoint parity diagnostic output handling

Date: 2026-10-04. Scope: offline diagnostic only; production recognition was not affected.

## Problem And Investigation

The first source-versus-converted experiment timed out after the laptop slept for roughly two hours during the source worker. It yielded no source result. A separately registered retry loaded the source model, but its first row failed a strict expected-prefix check. Inspection of the installed Transformers Whisper generator showed that the plain return tensor excludes decoder input IDs even though the prompt is used internally. The diagnostic incorrectly treated that output format as a prompt failure.

## Decision And Implementation

Preserve both failed reports. Add a new isolated source-only worker requesting structured generation output, whose sequences retain the prompt, and explicitly verify the Marathi prefix on each clip. Reuse hashed shared features and completed converted rows. Do not edit the original frozen tools/plans or the production speech worker. Separate plans and output directories keep every attempt distinguishable.

## Tests And Result

Synthetic prefix and complete-pair tests pass; full Python37/37 and JavaScript231/231. The structured worker loaded the source checkpoint and completed8/8 with the exact prompt. All three registration hash sets and83 protected files stayed unchanged. Source/converted exact generated tokens matched0/8 and text matched1/8, but a17-second sleep occurred during the completed run and the source emitted an attention-mask warning. These are diagnostic observations, not proof of a conversion defect, Marathi accuracy or improved website behavior. Detailed result and limits: `Feature-marathi-source-parity-results.md`. The underlying Marathi speech fidelity bug remains open.
