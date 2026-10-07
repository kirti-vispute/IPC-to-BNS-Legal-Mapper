import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { transcribeAudio } from "../backend/core/transcriber.js";

const source = (await readFile(new URL("../frontend/app.js", import.meta.url), "utf8"))
  .replace('import { renderLegalPresentation } from "./legalPresentation.js";', "");

async function page(written, spoken, permission) {
  const nodes = new Map(), requests = [], timers = new Map(), workers = [];
  let now = 0;
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { value: "", textContent: "", innerHTML: "", dataset: {},
      disabled: false, hidden: false, events: {}, focus() {},
      addEventListener(name, fn) { this.events[name] = fn; },
      removeAttribute(name) { if (name.startsWith("data-")) delete this.dataset[name.slice(5)]; } });
    return nodes.get(id);
  };
  const stream = { getTracks: () => [{ stop() {} }] };
  class Recorder {
    static isTypeSupported() { return true; }
    constructor() { this.state = "inactive"; this.mimeType = "audio/webm"; this.events = {}; }
    addEventListener(name, fn) { this.events[name] = fn; }
    start() { this.state = "recording"; }
    stop() {
      this.state = "inactive";
      this.events.dataavailable({ data: new Blob(["controlled audio"], { type: this.mimeType }) });
      return this.events.stop();
    }
  }
  node("#input-language").value = written;
  node("#speech-language").value = spoken;
  const context = vm.createContext({ Blob, AbortController, MediaRecorder: Recorder,
    renderLegalPresentation() {}, window: { MediaRecorder: Recorder }, Date: { now: () => now },
    navigator: { mediaDevices: { getUserMedia: () => permission ? permission(stream) : Promise.resolve(stream) } },
    document: { documentElement: {}, querySelector: node, querySelectorAll: () => [] },
    setTimeout(fn, ms) { const id = {}; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (url === "/api/health") return { json: async () => ({ ok: true, speechConfigured: true }) };
      const language = new URL(url, "http://localhost").searchParams.get("language");
      const result = await transcribeAudio({ audio: Buffer.from(await options.body.arrayBuffer()),
        contentType: options.headers["Content-Type"], language, exists: () => true,
        runner: async request => {
          workers.push(request);
          return { text: request.selectedLanguage === "hi" ? "आज चोरी हुई।" : request.selectedLanguage === "mr" ? "आज चोरी झाली." : "Original transcript.",
            originalLanguage: request.selectedLanguage || "en", languageProbability: 0.9 };
        } });
      return { ok: true, json: async () => result };
    } });
  vm.runInContext(source, context);
  await new Promise(setImmediate);
  return { node, requests, workers, timers,
    start: () => node("#voice-btn").events.click(),
    stop: async () => { now += 1000; await node("#voice-btn").events.click(); await new Promise(setImmediate); } };
}

for (const language of ["hi", "mr"]) {
  test(`written ${language} with speech Auto uses selected-language request and existing model`, async () => {
    const p = await page(language, "auto");
    await p.start(); await p.stop();
    assert.equal(p.requests[1].url, `/api/transcribe?mode=transcribe&language=${language}`);
    assert.equal(p.workers[0].config.selectedLanguage, language);
    assert.match(p.workers[0].config.modelPath, language === "hi" ? /whisper-medium$/ : /marathi-small-ct2$/);
    assert.equal(p.node("#query").value, language === "hi" ? "आज चोरी हुई।" : "आज चोरी झाली.");
    assert.equal(p.requests.some(request => request.url === "/api/analyze"), false);
  });
}

for (const [written, spoken] of [["hi", "mr"], ["mr", "hi"]]) {
  test(`explicit speech ${spoken} takes priority over written ${written}`, async () => {
    const p = await page(written, spoken);
    await p.start(); await p.stop();
    assert.equal(p.workers[0].config.selectedLanguage, spoken);
    assert.equal(p.node("#speech-language").value, spoken);
    assert.equal(p.node("#input-language").value, written);
  });
}

for (const written of ["auto", "en", "gu"]) {
  test(`written ${written} keeps automatic speech behavior`, async () => {
    const p = await page(written, "auto");
    await p.start(); await p.stop();
    assert.equal(p.requests[1].url, "/api/transcribe?mode=transcribe&language=auto");
    assert.equal(p.workers[0].config.selectedLanguage, undefined);
    assert.equal(p.node("#query").value, "Original transcript.");
  });
}

test("language hint is fixed before permission resolves and controls restore afterward", async () => {
  let grant;
  const p = await page("hi", "auto", stream => new Promise(resolve => { grant = () => resolve(stream); }));
  const pending = p.start();
  assert.equal(p.node("#input-language").disabled, true);
  p.node("#input-language").value = "mr";
  grant(); await pending; await p.stop();
  assert.equal(p.workers[0].config.selectedLanguage, "hi");
  assert.equal(p.node("#input-language").disabled, false);
  assert.equal(p.node("#speech-language").disabled, false);
  assert.equal(p.node("#analyze-btn").disabled, false);
  assert.equal(p.workers[0].timeoutMs, 180000);
});

test("permission failure restores both language controls without uploading audio", async () => {
  const p = await page("mr", "auto", () => Promise.reject(Object.assign(new Error("denied"), { name: "NotAllowedError" })));
  await p.start();
  assert.equal(p.node("#input-language").disabled, false);
  assert.equal(p.node("#speech-language").disabled, false);
  assert.equal(p.requests.length, 1);
  assert.equal(p.node("#voice-state").dataset.state, "error");
});
