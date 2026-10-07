import assert from "node:assert/strict";
import http from "node:http";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join, extname } from "node:path";

const root = resolve(import.meta.dirname, "..");
const out = join(root, "output/public-speech-validation/frontend-review-20261006/browser-edge");
if (!process.env.WORKSPACE_NODE_MODULES) throw new Error("Set WORKSPACE_NODE_MODULES to the bundled Node package directory");
const { chromium } = createRequire(import.meta.url)(join(process.env.WORKSPACE_NODE_MODULES, "playwright"));
const sourceFiles = ["frontend/app.js", "frontend/style.css", "frontend/index.html", "frontend/legalPresentation.js",
  "tests/voiceReviewUi.test.js", "scripts/validate_speech_review_ui_edge.mjs",
  "output/public-speech-validation/frontend-review-20261006/browser/registration.json",
  "output/public-speech-validation/frontend-review-20261006/browser/report.json"];
const hashes = {};
for (const file of sourceFiles) hashes[file] = createHash("sha256").update(await readFile(join(root, file))).digest("hex");
await mkdir(out);
const save = (name, value) => writeFile(join(out, name), `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
await save("registration.json", { type: "CONTROLLED_FRONTEND_SPEECH_REVIEW", hashes,
  physicalMicrophoneUsed: false, speechAccuracyEvaluation: false, neuralInference: false });
const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/api/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, speechConfigured: true })); return;
    }
    const url = new URL(req.url, "http://localhost");
    const file = join(root, "frontend", url.pathname === "/" ? "index.html" : url.pathname);
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8" }[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
let browser;
const rows = [];
let failure = null;
const text = "20 जून 2024 रोजी चोरी झाली. IPC 379 \ufffd";
const review = requiresReview => ({ version: 1, status: "assessed", requiresReview, windowCount: 2,
  textModified: false, warningCode: requiresReview ? "REVIEW_SATURATED_UNFINISHED_WINDOW" : null,
  warningWindows: requiresReview ? [0] : [], silenceConfidenceWindows: [], compressionWindows: [] });
try {
  browser = await chromium.launch({ headless: true, channel: "msedge" });
  for (const [viewportName, viewport] of [["desktop", { width: 1280, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
    for (const state of ["incomplete", "unavailable", "clear", "legacy"]) {
      const context = await browser.newContext({ viewport });
      try {
        await context.addInitScript(() => {
          let now = 0;
          Date.now = () => now += 1000;
          Object.defineProperty(navigator, "mediaDevices", { configurable: true,
            value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } });
          window.MediaRecorder = class {
            static isTypeSupported() { return true; }
            constructor() { this.state = "inactive"; this.mimeType = "audio/webm"; this.listeners = {}; }
            addEventListener(name, listener) { this.listeners[name] = listener; }
            start() { this.state = "recording"; }
            stop() {
              this.state = "inactive";
              this.listeners.dataavailable({ data: new Blob(["controlled recording"], { type: this.mimeType }) });
              this.listeners.stop();
            }
          };
        });
        const page = await context.newPage();
        const errors = [];
        const analysisBodies = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.route("**/api/transcribe?*", route => route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ text, inputLanguage: "mr", originalLanguage: "mr", languageName: "Marathi",
            languageStatus: "selected", languageSource: "user-selected", languageProbability: null,
            ...(state === "legacy" ? {} : { speechReview: state === "unavailable"
              ? { ...review(false), status: "unavailable", requiresReview: null } : review(state === "incomplete") }) }) }));
        await page.route("**/api/analyze", route => {
          analysisBodies.push(route.request().postDataJSON());
          return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "Controlled UI test response" }) });
        });
        await page.goto(`http://127.0.0.1:${server.address().port}/`);
        await page.locator("#voice-btn").waitFor({ state: "visible" });
        await page.locator("#speech-language").selectOption("mr");
        await page.getByRole("button", { name: "Start recording", exact: true }).click();
        await page.getByRole("button", { name: "Stop recording", exact: true }).click();
        await page.waitForFunction(() => !document.querySelector("#analyze-btn").disabled);
        assert.equal(await page.locator("#query").inputValue(), text);
        assert.equal(analysisBodies.length, 0);
        const geometry = await page.evaluate(() => {
          const status = document.querySelector("#voice-state");
          const rect = status.getBoundingClientRect();
          const analyze = document.querySelector("#analyze-btn").getBoundingClientRect();
          const panel = document.querySelector(".query-panel").getBoundingClientRect();
          return { state: status.dataset.reviewStatus || null, lang: status.lang, message: status.textContent,
            horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
            statusFits: rect.left >= panel.left && rect.right <= panel.right && status.scrollWidth <= status.clientWidth,
            overlapsAnalyze: rect.left < analyze.right && rect.right > analyze.left && rect.top < analyze.bottom && rect.bottom > analyze.top,
            controlsEnabled: !document.querySelector("#voice-btn").disabled && !document.querySelector("#analyze-btn").disabled
              && !document.querySelector("#speech-language").disabled,
            liveRegion: status.getAttribute("role"), imagesLoaded: [...document.images].every(image => image.complete && image.naturalWidth > 0) };
        });
        assert.equal(geometry.state, ["incomplete", "unavailable"].includes(state) ? state : null);
        assert.equal(geometry.horizontalOverflow, false);
        assert.equal(geometry.statusFits, true);
        assert.equal(geometry.overlapsAnalyze, false);
        assert.equal(geometry.controlsEnabled, true);
        assert.equal(geometry.liveRegion, "status");
        assert.equal(geometry.imagesLoaded, true);
        if (["incomplete", "unavailable"].includes(state)) assert.equal(geometry.lang, "mr");
        if (state === "incomplete") assert.ok(geometry.message.includes("अपूर्ण असू शकते"));
        if (state === "unavailable") assert.ok(geometry.message.includes("तपासता आली नाही"));
        await page.screenshot({ path: join(out, `${viewportName}-${state}.png`), fullPage: true });
        if (state === "incomplete") {
          await page.locator("#analyze-btn").click();
          await page.waitForFunction(() => !document.querySelector("#analyze-btn").disabled);
          assert.equal(analysisBodies.length, 1);
          assert.equal(analysisBodies[0].query, text);
          assert.equal(analysisBodies[0].originalInput, text);
          assert.equal(Object.hasOwn(analysisBodies[0], "speechReview"), false);
        }
        rows.push({ viewport: viewportName, state, passed: true, geometry,
          originalTextPreserved: true, automaticAnalysis: false, manualAnalysisChecked: state === "incomplete" });
      } finally { await context.close(); }
    }
  }
} catch (error) { failure = { message: error.message, code: error.code || null }; }
finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
const changed = [];
for (const [file, expected] of Object.entries(hashes)) {
  if (createHash("sha256").update(await readFile(join(root, file))).digest("hex") !== expected) changed.push(file);
}
const result = { type: "CONTROLLED_FRONTEND_SPEECH_REVIEW", rows, failure, changedRegisteredInputs: changed,
  usable: rows.length === 8 && failure === null && changed.length === 0,
  limitations: "Synthetic recorder and controlled responses test actual DOM/controls/wrapping on desktop/mobile. No physical microphone, ASR quality, latency or legal accuracy claim; no production backend request sent." };
await save("report.json", result);
console.log(JSON.stringify(result));
if (!result.usable) process.exitCode = 1;
