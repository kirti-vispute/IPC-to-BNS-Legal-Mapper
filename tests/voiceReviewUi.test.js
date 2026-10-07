import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { analyzeQuery } from "../backend/core/pipeline.js";
import { renderLegalPresentation, createLegalPresentation } from "../frontend/legalPresentation.js";

const source = (await readFile(new URL("../frontend/app.js", import.meta.url), "utf8"))
  .replace('import { renderLegalPresentation } from "./legalPresentation.js";', "");
const text = "20 जून 2024 रोजी चोरी झाली. IPC 379 \ufffd";
const review = (requiresReview = true) => ({ version: 1, status: "assessed", requiresReview,
  windowCount: 2, textModified: false, warningCode: requiresReview ? "REVIEW_SATURATED_UNFINISHED_WINDOW" : null,
  warningWindows: requiresReview ? [0] : [], silenceConfidenceWindows: [], compressionWindows: [] });
const payload = extra => ({ text, inputLanguage: "mr", originalLanguage: "mr", languageName: "Marathi",
  languageStatus: "selected", languageSource: "user-selected", languageProbability: null, ...extra });

async function page(responses, language = "mr") {
  const nodes = new Map();
  const requests = [];
  const timers = new Map();
  let now = 0;
  let tracksStopped = 0;
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { value: "", textContent: "", innerHTML: "", dataset: {},
      disabled: false, hidden: false, events: {}, lang: "", focus() {},
      addEventListener(name, handler) { this.events[name] = handler; },
      removeAttribute(name) {
        if (name.startsWith("data-")) delete this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())];
        else if (name === "lang") this.lang = "";
      } });
    return nodes.get(id);
  };
  const demo = node("demo"); demo.dataset.sample = "pre";
  class Recorder {
    static isTypeSupported() { return true; }
    constructor() { this.events = {}; this.mimeType = "audio/webm"; this.state = "inactive"; }
    addEventListener(name, fn) { this.events[name] = fn; }
    start() { this.state = "recording"; }
    stop() {
      this.state = "inactive";
      this.events.dataavailable({ data: new Blob(["synthetic audio"], { type: this.mimeType }) });
      return this.events.stop();
    }
  }
  const context = vm.createContext({ renderLegalPresentation, Blob, AbortController, MediaRecorder: Recorder,
    window: { MediaRecorder: Recorder }, Date: { now: () => now },
    navigator: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => tracksStopped++ }] }) } },
    document: { documentElement: { lang: "en" }, querySelector: node,
      querySelectorAll: selector => selector === ".demo-case" ? [demo] : [] },
    setTimeout(fn, ms) { const id = {}; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (url === "/api/health") return { json: async () => ({ ok: true, speechConfigured: true }) };
      if (url === "/api/analyze") return { ok: true, json: async () => analyzeQuery("Theft on 2024-06-20 IPC 379") };
      const response = responses.shift();
      return { ok: !response.error, json: async () => response };
    } });
  node("#speech-language").value = language;
  vm.runInContext(source, context);
  await new Promise(setImmediate);
  const record = async () => {
    await node("#voice-btn").events.click(); now += 1000;
    await node("#voice-btn").events.click(); await new Promise(setImmediate);
  };
  return { node, requests, context, record, timers, stopped: () => tracksStopped };
}

test("incomplete Marathi notice survives cleanup without changing text or auto-analyzing", async () => {
  const p = await page([payload({ speechReview: review() })]);
  await p.record();
  assert.equal(p.node("#voice-state").dataset.state, "warning");
  assert.equal(p.node("#voice-state").dataset.reviewStatus, "incomplete");
  assert.equal(p.node("#voice-state").lang, "mr");
  assert.match(p.node("#voice-state").textContent, /अपूर्ण असू शकते/);
  assert.equal(p.node("#query").value, text);
  assert.equal(p.stopped(), 1);
  assert.equal(p.node("#analyze-btn").disabled, false);
  assert.equal(p.node("#voice-btn").disabled, false);
  assert.equal(p.node("#speech-language").disabled, false);
  assert.equal(p.node("#cancel-recording-btn").hidden, true);
  assert.equal(p.requests.some(r => r.url === "/api/analyze"), false);
});

test("unavailable and malformed present metadata show uncertainty rather than a clean verdict", async () => {
  for (const speechReview of [null, {}, { ...review(), version: 2 }, { ...review(), textModified: true },
    { ...review(), requiresReview: "false" }, { ...review(), windowCount: 0 },
    { ...review(), status: "unavailable", requiresReview: null }]) {
    const p = await page([payload({ speechReview })]); await p.record();
    assert.equal(p.node("#voice-state").dataset.reviewStatus, "unavailable");
    assert.match(p.node("#voice-state").textContent, /तपासता आली नाही/);
    assert.equal(p.node("#query").value, text);
  }
});

test("clear assessment and legacy absence retain usual review message without an accuracy claim", async () => {
  for (const extra of [{}, { speechReview: review(false) }]) {
    const p = await page([payload(extra)]); await p.record();
    assert.equal(p.node("#voice-state").dataset.state, undefined);
    assert.match(p.node("#voice-state").textContent, /review the transcript before analysis/);
    assert.doesNotMatch(p.node("#voice-state").textContent, /accurate|correct transcript|verified/i);
  }
});

test("review is not added to analysis payload or used to change date routing/retrieval", async () => {
  const p = await page([payload({ speechReview: review() })]); await p.record();
  p.node("#query").value = text.replace("20 जून", "21 जून");
  p.node("#query").events.input();
  await p.node("#analyze-btn").events.click();
  const body = JSON.parse(p.requests.find(r => r.url === "/api/analyze").options.body);
  assert.equal(body.query, text.replace("20 जून", "21 जून"));
  assert.equal(body.originalInput, text);
  assert.equal(body.inputLanguage, "mr");
  assert.equal(body.languageSource, "user-selected");
  assert.equal(Object.hasOwn(body, "speechReview"), false);
  assert.equal(Object.hasOwn(body, "reviewNotice"), false);
  assert.equal(p.node("#voice-state").dataset.reviewStatus, "incomplete");
});

test("localized result rendering does not erase the transcript warning", async () => {
  const p = await page([payload({ speechReview: review() })]); await p.record();
  const result = analyzeQuery("Theft on 2024-06-20 IPC 379");
  p.context.result = { ...result, multilingual: { languageName: "Marathi",
    presentation: createLegalPresentation(result, "mr", "2024-07-01") } };
  const message = p.node("#voice-state").textContent;
  vm.runInContext("renderResult(result); setBusy(false)", p.context);
  assert.equal(p.node("#voice-state").textContent, message);
  assert.equal(p.node("#voice-state").dataset.state, "warning");
  assert.equal(p.node("#voice-state").lang, "mr");
});

test("new recording clears previous warning, and a clear next response cannot inherit it", async () => {
  const p = await page([payload({ speechReview: review() }), payload({ speechReview: review(false) })]);
  await p.record();
  await p.node("#voice-btn").events.click();
  assert.equal(p.node("#voice-state").dataset.reviewStatus, undefined);
  assert.equal(p.node("#voice-state").dataset.state, undefined);
  await p.node("#cancel-recording-btn").events.click();
  await p.record();
  assert.equal(p.node("#voice-state").dataset.reviewStatus, undefined);
  assert.match(p.node("#voice-state").textContent, /Selected language: Marathi/);
});

test("failed next transcription preserves previous query without inheriting its warning", async () => {
  const p = await page([payload({ speechReview: review() }), { error: "Invalid audio" }]);
  await p.record(); await p.record();
  assert.equal(p.node("#query").value, text);
  assert.equal(p.node("#voice-state").dataset.reviewStatus, undefined);
  assert.match(p.node("#voice-state").textContent, /Invalid audio/);
  assert.equal(p.node("#analyze-btn").disabled, false);
});

test("clearing the query or loading a demo removes obsolete transcript warning", async () => {
  for (const demo of [false, true]) {
    const p = await page([payload({ speechReview: review() })]); await p.record();
    if (demo) p.node("demo").events.click();
    else { p.node("#query").value = ""; p.node("#query").events.input(); }
    assert.equal(p.node("#voice-state").dataset.reviewStatus, undefined);
    assert.equal(p.node("#voice-state").dataset.state, undefined);
    assert.equal(p.node("#voice-state").lang, "en");
    assert.match(p.node("#voice-state").textContent, /recognition ready/);
  }
});

test("Hindi and Auto do not consume selected-Marathi-only review metadata", async () => {
  for (const language of ["hi", "auto"]) {
    const p = await page([payload({ speechReview: review() })], language); await p.record();
    assert.equal(p.node("#voice-state").dataset.state, undefined);
    assert.equal(p.node("#query").value, text);
  }
});
