# Feature: Legal Mapper Identity and Cursor

Date: 2026-09-26. Scope: logo, favicon and cursor only. No Git repository/commit available.

## Problem and Investigation

Inspected all four existing frontend files, current header, CSS tokens/breakpoints, structured multilingual renderer and interaction handlers. The app has a light-only forest-green/slate/amber palette, system typography, compact panels, text-only header and empty favicon. No custom cursor existed. Existing task-start suite:114 passed. Translation and legal retrieval limitations are unchanged and outside this branding request.

## Decision and Implementation

Logo: precise scales on the existing forest-green surface, white document-like pans with section lines, an amber pivot node and a rightward mapping bridge. These connect law, statutory text and IPC-to-BNS movement without an official emblem, government identity, glow or stock imagery. Main64px SVG scales cleanly for presentation; independently simplified32px icon remains legible at16px. Header uses64px on desktop and48px on narrow screens. Existing brand text remains the accessible name; decorative image has empty alt/aria-hidden to avoid duplicate announcements.

Cursor: bespoke28px SVG with a white contrast outline and hotspot14,3; interactive30px version with amber bridge and hotspot15,4. Native CSS cursors are chosen over a following DOM overlay: no tracking events, animation frame loop, selection interception, scroll/drag handlers or lag. Default applies only to fine pointers with hover and outside forced-colors mode. Text/inputs retain I-beam; buttons, summaries, checkboxes/radios and future links receive interactive artwork; disabled/progress and draggable states remain recognizable native cursors. Reduced-motion uses familiar native cursors. Touch devices never receive custom-cursor rules. No cursor:none or selection/focus changes.

Initial real browser verification found SVG files failed to load because the existing static server returns application/octet-stream for SVG. Backend edits are explicitly prohibited, so scripts/build_brand_assets.mjs mechanically embeds typed data:image/svg+xml copies of four local editable originals into HTML/CSS. --check verifies exact synchronization and does not write. This is vector data, not raster imagery or an external dependency. Only narrowly identified embedding targets can be regenerated; failure to find exactly one target stops the script.

## Files and Reasons

- frontend/index.html: one decorative header mark/brand-copy wrapper, real compact favicon and isolated branding stylesheet. All controls/IDs/text/API script retained.
- frontend/branding.css: header alignment/sizing and gated native-cursor rules. Existing style.css is unchanged.
- frontend/assets/legal-mapper-logo.svg: reusable main vector.
- frontend/assets/legal-mapper-icon.svg: compact favicon/app icon vector.
- frontend/assets/legal-cursor.svg and legal-cursor-active.svg: matching default/interactive cursor vectors.
- scripts/build_brand_assets.mjs: reproducible MIME-safe frontend embedding, no server modifications.
- tests/branding.test.js: four regressions for embedded-source equality, retained controls, cursor accessibility gates and self-contained assets.
- Decisions.md, Architecture.md, Flow.md, TestChecklist.md, Rollback.md and Handover.md: engineering record, current state and scoped rollback.

## Tests and Result

Full suite118 passed,0 failed,0 skipped (before114). All four SVGs parse as valid XML; embedding --check passes. Live logo loads at natural64px; DOM cursor styles resolve to the expected typed vector/hotspot and text remains text. Actual page checked at1440px desktop,1280px laptop and390px mobile; no horizontal overflow, main mark64px/48px respectively. Header/screenshots inspected. Input Ctrl+A selects27characters; Ctrl+Enter executes unchanged IPC-only analysis/IPC379-first/citations/IRAC. Mouse selection of subtitle text works. Tab focus still reaches recording with visible outline. Scrolling through mobile results works and source text retains I-beam. No microphone recording was initiated for this cosmetic task.

Local diagnostic vector proof: output/branding-verification/vector-proof.png (ignored generated artifact). Inspected logo192px/64px, compact32px/16px, default28px and active30px on white and dark slate. Browser computed rules and vector artwork were checked; native OS pointer pixels are not exposed in browser screenshots. Touch/reduced-motion/forced-colors branches are static-regression checked, not physical device/accessibility-mode certification. No dark theme was introduced because the application is light-only. There are no existing links or drag/drop controls to exercise; their CSS states are supported without new behavior.

All44 backend/evaluation/legal-source files hash-identical. frontend/app.js, legalPresentation.js and style.css unchanged. Mapping benchmark IPC104/104 and BNS104/104 Top-1/Top-3; no-write resolved reference replay5/5 each, unchanged. Historical sealed results/reference labels/reports are not regenerated. No legal accuracy claim arises from branding.

## Maintenance and Rollback

Edit the reusable SVG originals, then run node scripts/build_brand_assets.mjs and npm test. Do not hand-edit generated data copies or add backend MIME changes for this task. Reversal is documented in Rollback.md against .voice-rollback/branding/index.html. No rollback performed. Next single step: review branding in the browser with a physical mouse/touch device; do not proceed to unrelated legal/translation changes automatically.
