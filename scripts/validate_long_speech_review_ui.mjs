import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { access, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";

const root = resolve(import.meta.dirname, "..");
const out = join(root, "output/public-speech-validation/long-review-http-20261006");
const read = async name => JSON.parse(await readFile(join(out, name), "utf8"));
const save = (name, value) => writeFile(join(out, name), `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
const sha = body => createHash("sha256").update(body).digest("hex");
for (const name of ["health.json", "response.json", "http.json", "report.json", "desktop.png", "mobile.png"]) {
  const exists = await access(join(out, name)).then(() => true, error => {
    if (error.code === "ENOENT") return false;
    throw error;
  });
  if (exists) throw new Error(`Refusing occupied evidence: ${name}`);
}
const prepared = await read("prepared.json");
// Large model identities are checked by the streaming Python registrar/audit, not read into Node memory.
for (const [file, expected] of Object.entries(prepared.hashes)) assert.equal(sha(await readFile(join(root, file))), expected);
const registration = await read("registration.json");
for (const file of ["frontend/app.js", "frontend/style.css", "backend/core/transcriber.js",
  "backend/speech/transcribe.py", "backend/speech/review.py", "scripts/validate_long_speech_review_ui.mjs"])
  assert.equal(sha(await readFile(join(root, file))), registration.hashes[file]);
const expected = await read("expected.json");
const body = await readFile(join(out, "stress.wav"));
assert.equal(sha(body), registration.expectedBodySHA256);
if (!process.env.WORKSPACE_NODE_MODULES) throw new Error("Bundled Node package directory required");
const { chromium } = createRequire(import.meta.url)(join(process.env.WORKSPACE_NODE_MODULES, "playwright"));
const started = Date.now(), monotonic = performance.now();
const rows = [], errors = [], requests = [];
let browser, failure = null, responseTextParity = false, reviewParity = false;
try {
  browser = await chromium.launch({ headless: true, channel: "msedge" });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(base64 => {
    const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
    let now = 0;
    Date.now = () => now += 1000;
    Object.defineProperty(navigator, "mediaDevices", { configurable: true,
      value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } });
    window.MediaRecorder = class {
      static isTypeSupported() { return true; }
      constructor() { this.state = "inactive"; this.mimeType = "audio/wav"; this.listeners = {}; }
      addEventListener(name, listener) { this.listeners[name] = listener; }
      start() { this.state = "recording"; }
      stop() {
        this.state = "inactive";
        this.listeners.dataavailable({ data: new Blob([bytes], { type: this.mimeType }) });
        this.listeners.stop();
      }
    };
  }, body.toString("base64"));
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (request.url().includes("/api/analyze") || request.url().includes("/api/transcribe")) {
      const buffer = request.postDataBuffer();
      requests.push({ url: request.url(), method: request.method(), bytes: buffer?.length,
        bodySHA256: buffer ? sha(buffer) : null, contentType: request.headers()["content-type"] });
    }
  });
  await page.goto("http://localhost:3002/");
  const health = await context.request.get("http://localhost:3002/api/health");
  await save("health.json", await health.json());
  assert.equal(health.status(), 200);
  const served = await context.request.get("http://localhost:3002/app.js");
  assert.equal(sha(await served.body()), registration.hashes["frontend/app.js"]);
  await page.locator("#speech-language").selectOption("mr");
  await page.getByRole("button", { name: "Start recording", exact: true }).click();
  const pending = page.waitForResponse(response => response.url().includes("/api/transcribe?"), { timeout: 135000 });
  await page.getByRole("button", { name: "Stop recording", exact: true }).click();
  const response = await pending;
  const raw = await response.text();
  await writeFile(join(out, "response.json"), raw, { flag: "wx" });
  await save("http.json", { status: response.status(), url: response.url(), rawSHA256: sha(raw), requests });
  const data = JSON.parse(raw);
  assert.equal(response.status(), 200);
  responseTextParity = data.text === expected.text;
  reviewParity = JSON.stringify(data.speechReview) === JSON.stringify(expected.speechReview);
  // Object equality is order-independent; never reinterpret a mismatch as a new gold label.
  assert.equal(responseTextParity, true);
  assert.deepEqual(data.speechReview, expected.speechReview);
  reviewParity = true;
  assert.equal(data.inputLanguage, "mr");
  assert.equal(data.languageStatus, "selected");
  await page.waitForFunction(() => !document.querySelector("#analyze-btn").disabled, undefined, { timeout: 10000 });
  assert.equal(await page.locator("#query").inputValue(), data.text);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].bodySHA256, expected.bodySHA256);
  assert.equal(requests[0].contentType, "audio/wav");
  for (const [name, viewport] of [["desktop", { width: 1280, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
    await page.setViewportSize(viewport);
    const state = await page.evaluate(() => {
      const status = document.querySelector("#voice-state"), rect = status.getBoundingClientRect();
      const analyze = document.querySelector("#analyze-btn").getBoundingClientRect();
      return { reviewStatus: status.dataset.reviewStatus, lang: status.lang, role: status.getAttribute("role"),
        message: status.textContent, horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
        statusFits: status.scrollWidth <= status.clientWidth,
        overlapsAnalyze: rect.left < analyze.right && rect.right > analyze.left && rect.top < analyze.bottom && rect.bottom > analyze.top,
        controlsEnabled: ["#voice-btn", "#speech-language", "#analyze-btn"].every(id => !document.querySelector(id).disabled),
        editable: !document.querySelector("#query").readOnly && !document.querySelector("#query").disabled,
        imagesLoaded: [...document.images].every(image => image.complete && image.naturalWidth > 0) };
    });
    await page.screenshot({ path: join(out, `${name}.png`), fullPage: true });
    assert.equal(state.reviewStatus, "incomplete");
    assert.equal(state.lang, "mr");
    assert.equal(state.role, "status");
    assert.ok(state.message.includes("अपूर्ण असू शकते"));
    for (const key of ["controlsEnabled", "editable", "imagesLoaded", "statusFits"]) assert.equal(state[key], true);
    assert.equal(state.horizontalOverflow, false);
    assert.equal(state.overlapsAnalyze, false);
    rows.push({ viewport: name, passed: true, state });
  }
  assert.deepEqual(errors, []);
} catch (error) { failure = { message: error.message, code: error.code || null }; }
finally { await browser?.close(); }
const end = Date.now(), elapsedMs = performance.now() - monotonic;
const clockCoherent = Math.abs((end - started) - elapsedMs) < 2000 && elapsedMs <= 150000;
const result = { type: "LONG_MARATHI_REAL_HTTP_UI_WIRING", startEpoch: started / 1000, endEpoch: end / 1000,
  elapsedMs, clockCoherent, rows, errors, requests, failure, responseTextParity, reviewParity,
  usable: failure === null && clockCoherent && rows.length === 2 && errors.length === 0,
  physicalMicrophoneUsed: false, apiResponsesMocked: false, automaticAnalysis: requests.some(row => row.url.includes("/api/analyze")),
  limitations: "One reconstructed repeated public nonlegal fixture through real frontend/HTTP/local ASR using synthetic MediaRecorder input. Warning wiring/text preservation only, not acoustic correction, unseen/natural speech, speed or legal accuracy." };
await save("report.json", result);
console.log(JSON.stringify(result));
if (!result.usable) process.exitCode = 1;
