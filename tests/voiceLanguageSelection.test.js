import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { transcribeAudio } from "../backend/core/transcriber.js";

const source = (await readFile(new URL("../frontend/app.js", import.meta.url), "utf8"))
  .replace('import { renderLegalPresentation } from "./legalPresentation.js";', "");

async function page(written, spoken, permission, translate) {
  const nodes = new Map(), requests = [], timers = new Map(), workers = [], translations = [];
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
      if (url === "/api/translate") {
        const body = JSON.parse(options.body);
        translations.push(body);
        const reply = await translate(body);
        return { ok: reply.ok !== false, json: async () => reply.body };
      }
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
  return { node, requests, workers, timers, translations,
    change: async value => { node("#input-language").value = value; await node("#input-language").events.change(); await new Promise(setImmediate); },
    start: () => node("#voice-btn").events.click(),
    stop: async () => { now += 1000; await node("#voice-btn").events.click(); await new Promise(setImmediate); } };
}

for (const [spoken, modelPattern, text] of [["hi", /hindi-medium-ct2$/, "आज चोरी हुई।"], ["mr", /marathi-small-ct2$/, "आज चोरी झाली."]]) {
  test(`spoken ${spoken} uses the selected-language request and model whatever the written language is`, async () => {
    const p = await page("en", spoken);
    await p.start(); await p.stop();
    assert.equal(p.requests[1].url, `/api/transcribe?mode=transcribe&language=${spoken}`);
    assert.equal(p.workers[0].config.selectedLanguage, spoken);
    assert.match(p.workers[0].config.modelPath, modelPattern);
    assert.equal(p.node("#query").value, text);
    assert.equal(p.node("#input-language").value, "en");
    assert.equal(p.requests.some(request => request.url === "/api/analyze"), false);
  });
}

for (const [written, spoken] of [["hi", "mr"], ["mr", "hi"], ["en", "ur"], ["hi", "en"], ["gu", "hi"]]) {
  test(`explicit speech ${spoken} takes priority over written ${written}`, async () => {
    const p = await page(written, spoken);
    await p.start(); await p.stop();
    assert.equal(p.workers[0].config.selectedLanguage, spoken);
    assert.equal(p.node("#speech-language").value, spoken);
    assert.equal(p.node("#input-language").value, written);
  });
}

// A written language never forces the recording language: with spoken Auto, recording stays Auto.
for (const written of ["auto", "en", "ta", "hi", "mr", "ur", "gu"]) {
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
  const p = await page("mr", "hi", stream => new Promise(resolve => { grant = () => resolve(stream); }));
  const pending = p.start();
  assert.equal(p.node("#input-language").disabled, true);
  p.node("#speech-language").value = "mr";
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

for (const [language, modelPattern, deadline] of [["ur", /urdu-large-v3-ct2$/, 180000], ["gu", /gujarati-medium-ct2$/, 180000]]) {
  test(`spoken ${language} selects the ${language} model and long deadline independently of the written language`, async () => {
    const p = await page("en", language);
    await p.start(); await p.stop();
    assert.equal(p.requests[1].url, `/api/transcribe?mode=transcribe&language=${language}`);
    assert.equal(p.workers[0].config.selectedLanguage, language);
    assert.match(p.workers[0].config.modelPath, modelPattern);
    assert.equal(p.workers[0].timeoutMs, deadline);
  });
}

const fakeTranslator = ({ detected = "en" } = {}) => async body => {
  if (body.target === "xx") return { ok: false, body: { error: "Local translation could not be verified." } };
  const same = body.target === detected || (body.source !== "auto" && body.source === body.target);
  return { body: same ? { text: body.text, sourceLanguage: detected, targetLanguage: body.target, changed: false }
    : { text: `[${body.target}] ${body.text}`, sourceLanguage: body.source === "auto" ? detected : body.source, targetLanguage: body.target, changed: true } };
};

test("changing the written language with an empty box does nothing", async () => {
  const p = await page("auto", "auto", undefined, fakeTranslator());
  await p.change("hi");
  await p.change("   ");
  assert.equal(p.translations.length, 0);
  assert.equal(p.node("#query").value, "");
});

test("changing the written language translates the text in the box and locks controls meanwhile", async () => {
  let release, seenDisabled;
  const gate = new Promise(resolve => { release = resolve; });
  let p;
  p = await page("auto", "auto", undefined, async body => {
    seenDisabled = [p.node("#input-language").disabled, p.node("#analyze-btn").disabled, p.node("#query").readOnly];
    await gate;
    return fakeTranslator()(body);
  });
  p.node("#query").value = "Theft on 20 June 2024 under IPC 379.";
  const pending = p.change("hi");
  await new Promise(setImmediate);
  release(); await pending;
  assert.deepEqual(p.translations, [{ text: "Theft on 20 June 2024 under IPC 379.", source: "auto", target: "hi" }]);
  assert.equal(p.node("#query").value, "[hi] Theft on 20 June 2024 under IPC 379.");
  assert.deepEqual(seenDisabled, [true, true, true]);
  assert.equal(p.node("#input-language").disabled, false);
  assert.equal(p.node("#analyze-btn").disabled, false);
  assert.equal(p.node("#query").readOnly, false);
  assert.match(p.node("#language-state").textContent, /Machine translation/);
});

test("switching again translates the original text, and returning to the original language restores it exactly", async () => {
  const p = await page("auto", "auto", undefined, fakeTranslator());
  p.node("#query").value = "Original facts.";
  await p.change("hi");
  await p.change("gu");
  assert.deepEqual(p.translations[1], { text: "Original facts.", source: "en", target: "gu" });
  assert.equal(p.node("#query").value, "[gu] Original facts.");
  await p.change("en");
  assert.equal(p.node("#query").value, "Original facts.");
});

test("editing the translated text discards the original so later switches translate the edit", async () => {
  const p = await page("auto", "auto", undefined, fakeTranslator());
  p.node("#query").value = "Original facts.";
  await p.change("hi");
  p.node("#query").value = "[hi] Original facts. Edited.";
  await p.node("#query").events.input();
  await p.change("gu");
  assert.deepEqual(p.translations[1], { text: "[hi] Original facts. Edited.", source: "auto", target: "gu" });
});

test("a failed translation keeps the text and puts the written-language selector back", async () => {
  const p = await page("en", "auto", undefined, fakeTranslator());
  p.node("#query").value = "Keep this text.";
  await p.change("xx");
  assert.equal(p.node("#query").value, "Keep this text.");
  assert.equal(p.node("#input-language").value, "en");
  assert.equal(p.node("#language-state").dataset.state, "error");
  assert.match(p.node("#language-state").textContent, /unchanged/);
  assert.equal(p.node("#input-language").disabled, false);
});

test("choosing Auto detect never translates", async () => {
  const p = await page("hi", "auto", undefined, fakeTranslator());
  p.node("#query").value = "Some text.";
  await p.change("auto");
  assert.equal(p.translations.length, 0);
  assert.equal(p.node("#query").value, "Some text.");
});

test("a written-language change leaves the spoken language and a spoken recording language alone", async () => {
  const p = await page("en", "ur", undefined, fakeTranslator());
  p.node("#query").value = "Some text.";
  await p.change("hi");
  assert.equal(p.node("#speech-language").value, "ur");
  await p.start(); await p.stop();
  assert.equal(p.workers[0].config.selectedLanguage, "ur");
});

test("the robot shows while transcribing and the transcript waits for the running animation loop to finish", async () => {
  const p = await page("en", "hi");
  const robot = p.node("#robot-stage");
  robot.getAnimations = () => [
    { effect: { getComputedTiming: () => ({ duration: 500, iterations: Infinity }) }, currentTime: 100 },
    { effect: { getComputedTiming: () => ({ duration: 4000, iterations: Infinity }) }, currentTime: 9000 },
    { effect: { getComputedTiming: () => ({ duration: 4000, iterations: 1 }) }, currentTime: 0 }
  ];
  await p.start(); await p.stop();
  // 9000 ms into a 4000 ms loop is 1000 ms in, so 3000 ms of the loop remain.
  const wait = [...p.timers.values()].find(timer => timer.ms === 3000);
  assert.ok(wait, "waits for exactly the rest of the longest looping animation");
  assert.equal(robot.hidden, false);
  assert.equal(p.node("#query").readOnly, true);
  assert.equal(p.node("#query").value, "");
  wait.fn(); await new Promise(setImmediate);
  assert.equal(robot.hidden, true);
  assert.equal(p.node("#query").readOnly, false);
  assert.equal(p.node("#query").value, "आज चोरी हुई।");
});

test("the robot is removed immediately when transcription fails and never delays an error", async () => {
  const p = await page("en", "fr");
  p.node("#robot-stage").getAnimations = () => [{ effect: { getComputedTiming: () => ({ duration: 4000, iterations: Infinity }) }, currentTime: 1 }];
  await p.start(); await p.stop();
  assert.equal([...p.timers.values()].some(timer => timer.ms === 3999), false);
  assert.equal(p.node("#robot-stage").hidden, true);
  assert.equal(p.node("#query").readOnly, false);
  assert.equal(p.node("#voice-state").dataset.state, "error");
});
