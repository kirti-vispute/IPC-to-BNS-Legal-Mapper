import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const html = await readFile(new URL("../frontend/index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../frontend/branding.css", import.meta.url), "utf8");

test("embedded branding vectors exactly match editable assets without a backend MIME change", () => {
  assert.match(execFileSync(process.execPath, ["scripts/build_brand_assets.mjs", "--check"], { encoding: "utf8" }), /match their editable source assets/);
  assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml,/);
  assert.equal((html.match(/class="brand-mark"/g) || []).length, 1);
  assert.match(html, /width="64" height="64" alt="" aria-hidden="true"/);
});

test("branding preserves all existing query, recording, result and demo controls", () => {
  for (const id of ["query", "analyze-btn", "voice-btn", "cancel-recording-btn", "voice-state", "language-state", "service-status", "route-pill", "offense-date", "allowed-corpus", "verifier-status", "gate-message", "elapsed", "retrieval-list", "irac-output", "irac-citations", "citation-count", "warning-list", "warning-count", "demo-heading"]) assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(!html.includes('id="translate-speech"'), "Audio translation is deliberately retired; analysis owns text translation.");
  assert.equal((html.match(/class="demo-case"/g) || []).length, 4);
  assert.match(html, /<script type="module" src="\/app.js"><\/script>/);
  assert.equal((html.match(/<h1>/g) || []).length, 1);
});

test("cursor stays native on touch, forced-colors, reduced motion and selectable/input text", () => {
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\) and \(forced-colors: none\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /textarea[\s\S]+cursor: text/);
  assert.match(css, /input:disabled/);
  assert.match(css, /cursor: progress/);
  assert.match(css, /cursor: grabbing/);
  assert.doesNotMatch(css, /cursor:\s*none|pointer-events|user-select|animation|transition/);
});

test("logo, compact icon and cursors are self-contained geometric SVGs", async () => {
  for (const [file, width] of [["legal-mapper-logo.svg", 64], ["legal-mapper-icon.svg", 32], ["legal-cursor.svg", 28], ["legal-cursor-active.svg", 30]]) {
    const svg = await readFile(new URL(`../frontend/assets/${file}`, import.meta.url), "utf8");
    assert.ok(svg.includes(`width="${width}" height="${width}" viewBox="0 0 ${width} ${width}"`));
    assert.match(svg, /<path/);
    assert.doesNotMatch(svg, /<script|<image|href=|<filter|<linearGradient|<animate/);
  }
});
