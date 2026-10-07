import test from "node:test";
import assert from "node:assert/strict";
import { transcribeAudio } from "../backend/core/transcriber.js";
import { analyzeMultilingualQuery } from "../backend/core/multilingual.js";
import { analyzeQuery } from "../backend/core/pipeline.js";
import { LANGUAGE_NAMES, normalizeLanguageCode, speechLanguageStatus } from "../backend/core/languages.js";
import { renderLegalPresentation } from "../frontend/legalPresentation.js";

// Controlled ASR/translation outputs test integration, not acoustic or legal accuracy.
const fixtures = [
  ["en", "On 2024-06-20 a person committed theft under IPC 379.", "IPC_ONLY"],
  ["hi", "20 जून 2024 को चोरी हुई। IPC 379", "IPC_ONLY"],
  ["mr", "20 जून 2024 रोजी चोरी झाली. IPC 379", "IPC_ONLY"],
  ["hi", "15 अगस्त 2024 को चोरी हुई। BNS 303", "BNS_PRIMARY"],
  ["mr", "15 ऑगस्ट 2024 रोजी चोरी झाली. BNS 303", "BNS_PRIMARY"],
  ["hi", "घटना की तारीख नहीं दी गई है लेकिन चोरी हुई है।", "CLARIFY"],
  ["mr", "या घटनेची तारीख दिलेली नाही पण चोरी झाली आहे.", "CLARIFY"],
  ["hi", "15 August 2024 ko accused ne mobile phone चोरी किया.", "BNS_PRIMARY"],
  ["mr", "20 जून 2024 रोजी फसवणूक सुरू झाली आणि 10 जुलै 2024 पर्यंत सुरू राहिली.", "MULTI_PERIOD_REVIEW"],
  ["hi", "20 जून 2024 को धोखा शुरू हुआ और 10 जुलाई 2024 तक जारी रहा।", "MULTI_PERIOD_REVIEW"]
];

for (const [language, transcript, route] of fixtures) test(`voice integration ${language}/${route}: ${transcript}`, async () => {
  const speech = await transcribeAudio({ audio: Buffer.from("controlled fixture"), contentType: "audio/wav", exists: () => true,
    runner: async () => ({ text: transcript, originalLanguage: language, languageProbability: 0.99 }) });
  const calls = [];
  const result = await analyzeMultilingualQuery(speech.text, { ...speech, worker: async payload => {
    calls.push(payload);
    assert.notEqual(payload.action, "detect");
    return { texts: payload.texts.map(text => payload.target !== "en" ? language === "hi" ? "अनुवाद" : "भाषांतर"
      : text.includes("__LEGAL_") ? "Conduct started on __LEGAL_0__ and continued until __LEGAL_1__ involving cheating."
      : "a person committed theft.") };
  } });
  assert.equal(result.input.originalInput, transcript);
  assert.equal(result.input.inputMode, "voice");
  assert.equal(result.input.inputLanguage, language);
  assert.equal(result.input.outputLanguage, language);
  assert.equal(result.input.processingLanguage, "en");
  assert.equal(result.gate.route, route);
  const canonical = analyzeQuery(result.input.processedInput);
  for (const field of ["facts", "gate", "retrieved", "irac", "verifier"]) assert.deepEqual(result[field], canonical[field]);
  if (language === "en") assert.equal(calls.length, 0);
  else {
    assert.ok(calls.some(call => call.source === language && call.target === "en"));
    assert.ok(!calls.some(call => call.source === "en" && call.target === language));
    const view = result.multilingual.presentation;
    assert.equal(result.multilingual.detectionMethod, "faster-whisper");
    assert.equal(view.outputLanguage, language);
    assert.equal(view.outputTranslation, "disabled-fast-path");
    view.provisions.forEach((doc, i) => {
      assert.deepEqual(doc.source, result.retrieved[i].source);
      assert.equal(doc.sourceText, result.retrieved[i].excerpt);
      assert.equal(doc.relevance, result.retrieved[i].score);
    });
    const html = renderLegalPresentation(view).retrievalHtml;
    for (const doc of result.retrieved) assert.ok(html.includes(`${doc.code} ${doc.section}`));
  }
  if (route === "CLARIFY") {
    assert.equal(result.irac, null);
    assert.deepEqual(result.gate.allowedCodes, []);
    assert.ok(result.retrieved.some(doc => doc.id === "ipc-378"));
    assert.ok(result.retrieved.some(doc => doc.id === "bns-303"));
  }
});

test("all supported speech codes normalize consistently without script inference", () => {
  for (const code of Object.keys(LANGUAGE_NAMES)) {
    assert.equal(normalizeLanguageCode(`${code.toUpperCase()}_IN`), code);
    assert.equal(speechLanguageStatus(code, 0.99), "detected");
  }
  assert.equal(normalizeLanguageCode(""), null);
});

test("unsupported, absent and uncertain speech metadata preserve transcript without English fallback", async () => {
  for (const [language, probability, code] of [["fr", 0.99, "UNSUPPORTED_LANGUAGE"], [null, null, "LANGUAGE_UNCERTAIN"], ["mr", 0.5, "LANGUAGE_UNCERTAIN"], ["hi", 1.1, "LANGUAGE_UNCERTAIN"]]) {
    const speech = await transcribeAudio({ audio: Buffer.from("fixture"), contentType: "audio/wav", exists: () => true,
      runner: async () => ({ text: "चोरी झाली", originalLanguage: language, languageProbability: probability }) });
    assert.equal(speech.text, "चोरी झाली");
    assert.notEqual(speech.languageStatus, "detected");
    await assert.rejects(analyzeMultilingualQuery(speech.text, { ...speech, worker: () => { throw Error("must not run"); } }), error => error.code === code);
  }
});

test("native voice translation failure does not fall back to English legal processing", async () => {
  await assert.rejects(analyzeMultilingualQuery("चोरी झाली", { inputMode: "voice", inputLanguage: "mr", originalInput: "चोरी झाली", languageProbability: 0.99,
    worker: async () => ({ texts: [] }) }), error => error.code === "TRANSLATION_FAILED");
});

const nativeTerms = { en: "theft", hi: "चोरी", mr: "चोरी", gu: "ચોરી", bn: "চুরি", ta: "திருட்டு", te: "దొంగతనం", kn: "ಕಳ್ಳತನ", ml: "മോഷണം", pa: "ਚੋਰੀ", ur: "چوری" };
for (const language of Object.keys(LANGUAGE_NAMES)) test(`controlled ${language} voice target is isolated and downstream fields match typed input`, async () => {
  const transcript = `2024-06-20 ${nativeTerms[language]}. IPC 379`;
  const speech = await transcribeAudio({ audio: Buffer.from("controlled audio placeholder"), contentType: "audio/wav", exists: () => true,
    runner: async () => ({ text: transcript, originalLanguage: `${language.toUpperCase()}_IN`, languageProbability: 0.99 }) });
  const calls = [];
  const worker = async payload => {
    calls.push(payload);
    if (payload.action === "detect") return { language, confidence: 0.99 };
    if (payload.target === "en") {
      assert.equal(payload.source, language);
      return { texts: payload.texts.map(() => "a person committed theft.") };
    }
    assert.equal(payload.source, "en");
    assert.equal(payload.target, language);
    return { texts: payload.texts.map(() => "localized prose") };
  };
  const voice = await analyzeMultilingualQuery(speech.text, { ...speech, worker });
  const voiceCalls = [...calls];
  assert.equal(voice.input.inputLanguage, language);
  assert.equal(voice.input.outputLanguage, language);
  assert.equal(voice.input.originalInput, transcript);
  assert.ok(!voiceCalls.some(call => call.action === "detect"));
  if (language === "en") assert.equal(voiceCalls.length, 0);
  else {
    assert.equal(voice.multilingual.presentation.outputLanguage, language);
    assert.equal(voice.multilingual.presentation.outputTranslation, ["hi", "mr"].includes(language) ? "disabled-fast-path" : "local-model");
    assert.ok(voiceCalls.some(call => call.source === language && call.target === "en"));
    assert.equal(voiceCalls.some(call => call.source === "en" && call.target === language), !["hi", "mr"].includes(language));
    assert.ok(voiceCalls.every(call => !["el", "ja", "zh"].includes(call.target)));
    renderLegalPresentation(voice.multilingual.presentation);
  }
  const typed = await analyzeMultilingualQuery(transcript, { worker });
  for (const field of ["facts", "gate", "retrieved", "irac", "verifier"]) assert.deepEqual(voice[field], typed[field]);
});

test("Greek, Japanese and Chinese detections remain unsupported and never choose a translation target", async () => {
  for (const language of ["el", "ja", "zh"]) {
    const text = "चोरी झाली";
    const speech = await transcribeAudio({ audio: Buffer.from("controlled fixture"), contentType: "audio/wav", exists: () => true,
      runner: async () => ({ text, originalLanguage: language, languageProbability: 0.99 }) });
    assert.equal(speech.languageStatus, "unsupported");
    assert.equal(speech.text, text);
    assert.equal(speech.inputLanguage, language);
    await assert.rejects(analyzeMultilingualQuery(text, { ...speech, worker: () => { throw Error("unsupported speech must not reach translation"); } }), error => error.code === "UNSUPPORTED_LANGUAGE");
  }
});

test("legacy English output hint cannot overwrite a supported voice source language", async () => {
  const calls = [];
  const result = await analyzeMultilingualQuery("चोरी झाली", { inputMode: "voice", inputLanguage: "mr", originalLanguage: "en",
    originalInput: "चोरी झाली", languageProbability: 0.99, worker: async payload => {
      calls.push(payload);
      assert.notEqual(payload.action, "detect");
      return { texts: payload.texts.map(() => payload.target === "en" ? "theft occurred." : "चोरी") };
    } });
  assert.equal(result.input.outputLanguage, "mr");
  assert.equal(result.multilingual.presentation.outputLanguage, "mr");
  assert.equal(result.multilingual.presentation.outputTranslation, "disabled-fast-path");
  assert.ok(calls.some(call => call.source === "mr" && call.target === "en"));
  assert.ok(!calls.some(call => call.source === "en" && call.target === "mr"));
});

test("selected Hindi and Marathi use the chosen source for translation without claiming ASR certainty", async () => {
  for (const language of ["hi", "mr"]) {
    const speech = await transcribeAudio({ audio: Buffer.from("fixture"), contentType: "audio/wav", exists: () => true,
      language, runner: async () => ({ text: "चोरी झाली", originalLanguage: "si", languageProbability: 0.95 }) });
    const calls = [];
    const result = await analyzeMultilingualQuery(speech.text, { ...speech, worker: async payload => {
      calls.push(payload);
      return { texts: payload.texts.map(() => payload.target === "en" ? "theft occurred." : "अनुवाद") };
    } });
    assert.equal(result.input.inputLanguage, language);
    assert.equal(result.input.languageProbability, null);
    assert.equal(result.multilingual.detectionMethod, "user-selected-speech");
    assert.ok(calls.some(call => call.source === language && call.target === "en"));
    assert.equal(result.gate.route, "CLARIFY");
  }
});
