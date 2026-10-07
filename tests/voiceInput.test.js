import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { analyzeQuery } from "../backend/core/pipeline.js";
import { analyzeMultilingualQuery } from "../backend/core/multilingual.js";
import { LANGUAGE_NAMES, speechLanguageStatus } from "../backend/core/languages.js";
import { renderLegalPresentation, createLegalPresentation } from "../frontend/legalPresentation.js";

const source = (await readFile(new URL("../frontend/app.js", import.meta.url), "utf8")).replace('import { renderLegalPresentation } from "./legalPresentation.js";', "");

test("switching from Marathi to English restores the existing English headings", async () => {
  const label = { dataset: { resultLabel: "applicableLaw" }, textContent: "Applicable law decision" };
  const p = await page({ resultLabels: [label] });
  const result = analyzeQuery("Theft on 2024-06-20 IPC 378");
  p.context.localizedResult = { ...result, multilingual: { languageName: "Marathi", presentation: createLegalPresentation(result, "mr", "2024-07-01") } };
  vm.runInContext("renderResult(localizedResult)", p.context);
  assert.equal(label.textContent, "लागू कायदा");
  p.context.englishResult = result;
  vm.runInContext("renderResult(englishResult)", p.context);
  assert.equal(label.textContent, "Applicable law decision");
  assert.equal(p.node("#route-pill").textContent, "IPC applies");
});

test("localized interface text follows the result language and resets for English", async () => {
  const heading = { dataset: { interfaceText: "queryHeading" }, textContent: "Natural-language legal query" };
  const placeholder = { dataset: { interfacePlaceholder: "queryPlaceholder" }, placeholder: "Enter case facts" };
  const p = await page({ interfaceTexts: [heading], interfacePlaceholders: [placeholder] });
  const result = analyzeQuery("Theft on 2024-06-20 IPC 379");
  const view = createLegalPresentation(result, "gu", "2024-07-01");
  view.interfaceText.queryHeading = "ગુજરાતી કાનૂની પ્રશ્ન";
  view.interfaceText.queryPlaceholder = "અહીં લખો";
  view.interfaceText.analyze = "વિશ્લેષણ કરો";
  view.outputTranslation = "local-model";
  p.context.localizedResult = { ...result, multilingual: { languageName: "Gujarati", presentation: view } };
  vm.runInContext("renderResult(localizedResult)", p.context);
  vm.runInContext("setBusy(false)", p.context);
  assert.equal(heading.textContent, "ગુજરાતી કાનૂની પ્રશ્ન");
  assert.equal(placeholder.placeholder, "અહીં લખો");
  assert.equal(p.node("#analyze-btn").textContent, "વિશ્લેષણ કરો");
  assert.equal(p.documentElement.lang, "gu");
  p.context.englishResult = result;
  vm.runInContext("renderResult(englishResult)", p.context);
  assert.equal(heading.textContent, "Natural-language legal query");
  assert.equal(placeholder.placeholder, "Enter case facts");
  assert.equal(p.documentElement.lang, "en");
});

test("Hindi and Marathi controlled interface drafts apply without model output decoding", async () => {
  for (const language of ["hi", "mr"]) {
    const heading = { dataset: { interfaceText: "queryHeading" }, textContent: "Natural-language legal query" };
    const p = await page({ interfaceTexts: [heading] });
    const result = analyzeQuery("Theft on 2024-06-20 IPC 379");
    const view = createLegalPresentation(result, language, "2024-07-01");
    view.outputTranslation = "disabled-fast-path";
    p.context.localizedResult = { ...result, multilingual: { languageName: language, presentation: view } };
    vm.runInContext("renderResult(localizedResult); setBusy(false)", p.context);
    assert.equal(heading.textContent, view.interfaceText.queryHeading);
    assert.match(heading.textContent, /\p{Script=Devanagari}/u);
    assert.equal(p.node("#analyze-btn").textContent, view.interfaceText.analyze);
    assert.equal(p.documentElement.lang, language);
  }
});

test("legacy flat multilingual output fails safely instead of mixing translation contracts", async () => {
  const p = await page();
  p.context.oldResult = { multilingual: { presentation: { routeLabel: "old" } } };
  vm.runInContext("renderResult(oldResult)", p.context);
  assert.equal(p.node("#route-pill").dataset.route, "ERROR");
  assert.match(p.node("#gate-message").textContent, /version is unsupported/);
});

async function page({ permission, supported = true, audio = "fake audio", transcript, originalLanguage = "en", languageProbability = 0.99, languageSource = "automatic", stall = false, failure = "Local speech model is missing.", resultLabels = [], interfaceTexts = [], interfacePlaceholders = [] } = {}) {
  const nodes = new Map();
  const requests = [];
  const timers = new Map();
  let now = 0;
  let stoppedTracks = 0;
  let starts = 0;
  const stream = { getTracks: () => [{ stop: () => stoppedTracks++ }] };
  class Recorder {
    static isTypeSupported() { return true; }
    constructor() { this.state = "inactive"; this.mimeType = "audio/webm"; this.events = {}; }
    addEventListener(name, handler) { this.events[name] = handler; }
    start() { this.state = "recording"; starts++; }
    stop() {
      this.state = "inactive";
      this.events.dataavailable({ data: new Blob([audio], { type: this.mimeType }) });
      return this.events.stop();
    }
  }
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {
      disabled: false, hidden: false, value: "", checked: false, dataset: {}, events: {},
      textContent: "", innerHTML: "", addEventListener(name, handler) { this.events[name] = handler; },
      removeAttribute(name) { if (name.startsWith("data-")) delete this.dataset[name.slice(5)]; },
      focus() {}
    });
    return nodes.get(id);
  }
  const documentElement = { lang: "en" };
  const context = vm.createContext({
    renderLegalPresentation,
    document: { documentElement, querySelector: node, querySelectorAll: selector => selector === "[data-result-label]" ? resultLabels : selector === "[data-interface-text]" ? interfaceTexts : selector === "[data-interface-placeholder]" ? interfacePlaceholders : [] },
    navigator: { mediaDevices: supported ? { getUserMedia: () => permission ? permission(stream) : Promise.resolve(stream) } : undefined },
    window: { MediaRecorder: supported ? Recorder : undefined }, MediaRecorder: Recorder, Blob, AbortController,
    Date: { now: () => now },
    setTimeout(fn, ms) { const id = {}; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (stall && url.startsWith("/api/transcribe")) return new Promise((resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
      if (url === "/api/analyze") {
        const body = JSON.parse(options.body);
        try {
          const result = await analyzeMultilingualQuery(body.query, { ...body, worker: async payload => {
            assert.notEqual(payload.action, "detect", "Reliable speech language must reach the shared adapter");
            return { texts: payload.texts.map(() => payload.target === "en" ? "a person committed theft." : originalLanguage === "hi" ? "अनुवाद" : "भाषांतर") };
          } });
          return { ok: true, json: async () => result };
        } catch (error) { return { ok: false, json: async () => ({ error: error.message }) }; }
      }
      return url === "/api/health"
        ? { json: async () => ({ ok: true, speechConfigured: false }) }
        : { ok: transcript !== undefined, json: async () => transcript !== undefined ? { text: transcript, originalLanguage, inputLanguage: originalLanguage, languageProbability, languageSource,
          languageName: LANGUAGE_NAMES[originalLanguage] || originalLanguage || "Unknown", languageStatus: languageSource === "user-selected" ? "selected" : speechLanguageStatus(originalLanguage, languageProbability) } : { error: failure } };
    }
  });
  vm.runInContext(source, context);
  await new Promise(setImmediate);
  return { node, documentElement, context, requests, timers, advance: () => { now = 1000; },
    starts: () => starts, stoppedTracks: () => stoppedTracks,
    click: (id) => node(id).events.click() };
}

test("recording remains enabled before and after analysis busy state without cloud configuration", async () => {
  const p = await page();
  assert.equal(p.node("#voice-btn").disabled, false);
  vm.runInContext("setBusy(true); setBusy(false)", p.context);
  assert.equal(p.node("#voice-btn").disabled, false);
});

test("start and stop create an audio Blob and recover from missing local model without analyzing", async () => {
  const p = await page();
  await p.click("#voice-btn");
  assert.equal(p.starts(), 1);
  assert.equal(p.node("#voice-btn").textContent, "Stop recording");
  p.advance();
  await p.click("#voice-btn");
  await new Promise(setImmediate);
  const request = p.requests.find(r => r.url.startsWith("/api/transcribe"));
  assert.ok(request.options.body.size > 0);
  assert.match(p.node("#voice-state").textContent, /model is missing/);
  assert.equal(p.node("#analyze-btn").disabled, false);
  assert.equal(p.requests.some(r => r.url === "/api/analyze"), false);
});

test("microphone denial restores typed input and permits retry", async () => {
  const p = await page({ permission: () => Promise.reject({ name: "NotAllowedError" }) });
  await p.click("#voice-btn");
  assert.match(p.node("#voice-state").textContent, /denied/);
  assert.equal(p.node("#analyze-btn").disabled, false);
  assert.equal(p.node("#voice-btn").disabled, false);
});

test("pending microphone cancellation releases any later granted stream", async () => {
  let grant;
  const p = await page({ permission: stream => new Promise(resolve => { grant = () => resolve(stream); }) });
  const pending = p.click("#voice-btn");
  await p.click("#cancel-recording-btn");
  grant();
  await pending;
  assert.equal(p.starts(), 0);
  assert.equal(p.stoppedTracks(), 1);
  assert.equal(p.node("#analyze-btn").disabled, false);
});

test("unanswered microphone permission times out and restores the page", async () => {
  const p = await page({ permission: () => new Promise(() => {}) });
  const pending = p.click("#voice-btn");
  [...p.timers.values()].find(t => t.ms === 20_000).fn();
  await pending;
  assert.match(p.node("#voice-state").textContent, /still pending/);
  assert.equal(p.node("#analyze-btn").disabled, false);
});

test("unsupported microphone APIs keep the control disabled after typed analysis", async () => {
  const p = await page({ supported: false });
  vm.runInContext("setBusy(true); setBusy(false)", p.context);
  assert.equal(p.node("#voice-btn").disabled, true);
});

test("successful local transcript populates editable textarea and requires manual Analyze", async () => {
  const text = "The alleged act happened on 2024-06-20 and concerns theft of movable property under IPC 379.";
  const p = await page({ transcript: text });
  await p.click("#voice-btn");
  p.advance();
  await p.click("#voice-btn");
  await new Promise(setImmediate);
  assert.equal(p.node("#query").value, text);
  assert.equal(p.requests.some(r => r.url === "/api/analyze"), false);
  await p.click("#analyze-btn");
  assert.equal(p.requests.filter(r => r.url === "/api/analyze").length, 1);
  assert.equal(p.node("#offense-date").textContent, "2024-06-20");
  assert.equal(p.node("#verifier-status").textContent, "Passed");
});

test("selected written language is sent for typed multilingual analysis", async () => {
  const p = await page();
  p.node("#query").value = "20 जून 2024 को मेरा मोबाइल फोन चोरी हो गया।";
  p.node("#input-language").value = "hi";
  await p.click("#analyze-btn");
  const body = JSON.parse(p.requests.find(r => r.url === "/api/analyze").options.body);
  assert.equal(body.originalLanguage, "hi");
  assert.equal(body.inputMode, undefined);
});

test("voice analysis keeps speech metadata instead of written-language selection", async () => {
  const original = "20 जून 2024 रोजी चोरी झाली. IPC 379";
  const p = await page({ transcript: original, originalLanguage: "mr" });
  p.node("#input-language").value = "hi";
  await p.click("#voice-btn");
  p.advance();
  await p.click("#voice-btn");
  await new Promise(setImmediate);
  await p.click("#analyze-btn");
  const body = JSON.parse(p.requests.find(r => r.url === "/api/analyze").options.body);
  assert.equal(body.inputMode, "voice");
  assert.equal(body.inputLanguage, "mr");
  assert.equal(body.originalLanguage, undefined);
});

test("cancelling active recording stops tracks without any transcription upload", async () => {
  const p = await page();
  await p.click("#voice-btn");
  await p.click("#cancel-recording-btn");
  assert.equal(p.stoppedTracks(), 1);
  assert.equal(p.requests.some(r => r.url.startsWith("/api/transcribe")), false);
  assert.equal(p.node("#analyze-btn").disabled, false);
});

test("empty capture is rejected before upload", async () => {
  const p = await page({ audio: "" });
  await p.click("#voice-btn");
  p.advance();
  await p.click("#voice-btn");
  assert.match(p.node("#voice-state").textContent, /No usable speech/);
  assert.equal(p.requests.some(r => r.url.startsWith("/api/transcribe")), false);
});

test("transcription timeout restores normal Analyze and Record controls", async () => {
  const p = await page({ failure: "Local transcription timed out. Try a shorter recording." });
  await p.click("#voice-btn");
  p.advance();
  await p.click("#voice-btn");
  await new Promise(setImmediate);
  assert.match(p.node("#voice-state").textContent, /timed out/);
  assert.equal(p.node("#analyze-btn").disabled, false);
  assert.equal(p.node("#voice-btn").disabled, false);
});

test("unanswered transcription request has a browser deadline", async () => {
  const p = await page({ stall: true });
  await p.click("#voice-btn");
  p.advance();
  await p.click("#voice-btn");
  [...p.timers.values()].find(t => t.ms === 130_000).fn();
  await new Promise(setImmediate);
  assert.match(p.node("#voice-state").textContent, /timed out/);
  assert.equal(p.node("#analyze-btn").disabled, false);
});

test("missing-date voice text requires manual Analyze then shows date-required candidates", async () => {
  const text = "A person dishonestly took another person's mobile phone without consent.";
  const p = await page({ transcript: text });
  await p.click("#voice-btn");
  p.advance();
  await p.click("#voice-btn");
  await new Promise(setImmediate);
  assert.equal(p.requests.some(r => r.url === "/api/analyze"), false);
  await p.click("#analyze-btn");
  assert.equal(p.node("#route-pill").textContent, "DATE REQUIRED");
  assert.equal(p.node("#allowed-corpus").textContent, "IPC + BNS (candidates only)");
  assert.match(p.node("#retrieval-list").innerHTML, /IPC 378/);
  assert.match(p.node("#retrieval-list").innerHTML, /BNS 303/);
  assert.match(p.node("#irac-output").innerHTML, /applicability remains undetermined/);
  assert.equal(p.node("#irac-citations").hidden, true);
});

test("native voice language survives transcript correction and preserves original speech text", async () => {
  const original = "20 जून 2024 रोजी चोरी झाली. IPC 379";
  const p = await page({ transcript: original, originalLanguage: "mr" });
  await p.click("#voice-btn");
  p.advance();
  await p.click("#voice-btn");
  await new Promise(setImmediate);
  await p.click("#analyze-btn");
  const first = JSON.parse(p.requests.find(r => r.url === "/api/analyze").options.body);
  assert.equal(first.inputLanguage, "mr");
  assert.equal(first.inputMode, "voice");
  assert.equal(first.originalInput, original);
  assert.match(p.node("#language-state").textContent, /Marathi.*आवाज.*English.*Marathi/);
  p.node("#query").value = original.replace("20 जून", "21 जून");
  await p.click("#analyze-btn");
  const edited = JSON.parse(p.requests.filter(r => r.url === "/api/analyze").at(-1).options.body);
  assert.equal(edited.inputLanguage, "mr");
  assert.equal(edited.originalInput, original);
  assert.equal(p.node("#offense-date").textContent, "2024-06-21");
  p.node("#query").value = "";
  p.node("#query").events.input();
  p.node("#query").value = "theft";
  await p.click("#analyze-btn");
  assert.equal(JSON.parse(p.requests.filter(r => r.url === "/api/analyze").at(-1).options.body).inputMode, undefined);
});

for (const [language, text] of [["hi", "घटना की तारीख नहीं दी गई है लेकिन चोरी हुई है।"], ["mr", "या घटनेची तारीख दिलेली नाही पण चोरी झाली आहे."]]) {
  test(`${language} native voice reaches shared adapter and localized date-required renderer`, async () => {
    const p = await page({ transcript: text, originalLanguage: language });
    await p.click("#voice-btn"); p.advance(); await p.click("#voice-btn");
    await new Promise(setImmediate);
    assert.equal(p.requests.some(r => r.url === "/api/analyze"), false);
    assert.equal(p.node("#query").value, text);
    assert.equal(p.requests.find(r => r.url.startsWith("/api/transcribe")).url, "/api/transcribe?mode=transcribe&language=auto");
    await p.click("#analyze-btn");
    assert.equal(p.node("#route-pill").dataset.route, "CLARIFY");
    assert.match(p.node("#allowed-corpus").textContent, /IPC \+ BNS/);
    assert.ok(p.node("#language-state").textContent.includes(language === "hi" ? "आवाज़" : "आवाज"));
    assert.equal(p.node("#query").value, text);
    assert.equal(p.node("#irac-citations").hidden, true);
  });
}

test("selected Marathi recording retains source through analysis without a made-up confidence", async () => {
  const p = await page({ transcript: "चोरी झाली", originalLanguage: "mr", languageProbability: null, languageSource: "user-selected" });
  p.node("#speech-language").value = "mr";
  await p.click("#voice-btn"); p.advance(); await p.click("#voice-btn");
  await new Promise(setImmediate);
  assert.equal(p.requests.find(r => r.url.startsWith("/api/transcribe")).url, "/api/transcribe?mode=transcribe&language=mr");
  assert.match(p.node("#voice-state").textContent, /Selected language: Marathi/);
  assert.equal(p.node("#query").value, "चोरी झाली");
  assert.equal(p.requests.some(r => r.url === "/api/analyze"), false);
  await p.click("#analyze-btn");
  const body = JSON.parse(p.requests.find(r => r.url === "/api/analyze").options.body);
  assert.equal(body.languageSource, "user-selected");
  assert.equal(body.languageProbability, null);
  assert.match(p.node("#language-state").textContent, /Marathi \(निवडलेली\).*निकाल: Marathi/);
});

test("selected Hindi has a browser deadline longer than the medium-model worker", async () => {
  const p = await page({ stall: true });
  p.node("#speech-language").value = "hi";
  await p.click("#voice-btn"); p.advance(); await p.click("#voice-btn");
  assert.equal(p.requests.find(r => r.url.startsWith("/api/transcribe")).url, "/api/transcribe?mode=transcribe&language=hi");
  assert.ok([...p.timers.values()].some(timer => timer.ms === 190_000));
  assert.ok(![...p.timers.values()].some(timer => timer.ms === 130_000));
  [...p.timers.values()].find(timer => timer.ms === 190_000).fn();
  await new Promise(setImmediate);
  assert.match(p.node("#voice-state").textContent, /timed out/);
  assert.equal(p.node("#analyze-btn").disabled, false);
});

test("uncertain voice language keeps the editable transcript and exposes clarification", async () => {
  const p = await page({ transcript: "चोरी झाली", originalLanguage: "mr", languageProbability: 0.3 });
  await p.click("#voice-btn"); p.advance(); await p.click("#voice-btn");
  await new Promise(setImmediate);
  assert.match(p.node("#voice-state").textContent, /language uncertain/);
  await p.click("#analyze-btn");
  assert.equal(p.node("#query").value, "चोरी झाली");
  assert.match(p.node("#gate-message").textContent, /spoken language.*reliably/);
  assert.equal(p.node("#analyze-btn").disabled, false);
});

test("unsupported speech preserves text and is never displayed or processed as English", async () => {
  const p = await page({ transcript: "vol de telephone", originalLanguage: "fr" });
  await p.click("#voice-btn"); p.advance(); await p.click("#voice-btn");
  await new Promise(setImmediate);
  assert.match(p.node("#voice-state").textContent, /Unsupported spoken language: fr/);
  await p.click("#analyze-btn");
  assert.equal(p.node("#query").value, "vol de telephone");
  assert.match(p.node("#gate-message").textContent, /spoken language is unsupported/);
  assert.equal(p.node("#language-state").textContent, "");
});

test("localized result display retains literal citation/source metadata and original input", async () => {
  const p = await page();
  p.node("#query").value = "मूळ प्रश्न";
  const result = analyzeQuery("The theft happened on 2024-06-20 under IPC 379.");
  result.multilingual = { languageName: "Marathi", presentation: createLegalPresentation(result, "mr", "2024-07-01") };
  p.context.localizedResult = result;
  vm.runInContext("renderResult(localizedResult)", p.context);
  assert.match(p.node("#irac-output").innerHTML, /निष्कर्ष/);
  assert.match(p.node("#retrieval-list").innerHTML, /IPC 379/);
  assert.ok(p.node("#retrieval-list").innerHTML.includes(result.retrieved[0].source.file));
  assert.equal(p.node("#query").value, "मूळ प्रश्न");
  assert.match(p.node("#warning-list").innerHTML, /मूळ स्रोताशी पडताळणी करा/);
});

test("Hindi rendering separates identifiers and scores and displays only original statutory excerpts", async () => {
  const p = await page();
  const result = analyzeQuery("The theft happened on 2024-06-20 under IPC 378.");
  result.retrieved[0].score = 46.121;
  result.multilingual = { originalLanguage: "hi", languageName: "Hindi", presentation: createLegalPresentation(result, "hi", "2024-07-01") };
  p.context.result = result;
  vm.runInContext("renderResult(result)", p.context);
  const html = p.node("#retrieval-list").innerHTML;
  assert.match(html, /IPC 378/);
  assert.match(html, /प्रासंगिकता/);
  assert.match(html, /46\.121/);
  assert.match(html, /PDF page 152/);
  assert.match(html, /Ministry of Home Affairs, Government of India/);
  assert.match(html, /मूल वैधानिक स्रोत/);
  assert.ok(!html.includes("must not replace source"));
  assert.ok(!html.includes("IPC 378Relevance"));
  assert.ok(html.includes(result.retrieved[0].excerpt.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;")));
  assert.ok(p.node("#irac-output").innerHTML.includes("मूल वैधानिक स्रोत"));
});
