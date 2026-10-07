import test from "node:test";
import assert from "node:assert/strict";
import { analyzeMultilingualQuery, normalizeInputDates, translateTexts, translationParts, runTranslationWorker, createStreamingTranslationWorker, translateInputQuery } from "../backend/core/multilingual.js";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { analyzeQuery } from "../backend/core/pipeline.js";

const english = "On 2024-06-20 a person committed theft under IPC 379.";
function fakeWorker(language, facts = "a person committed theft.") {
  return async payload => payload.action === "detect" ? { language, confidence: 0.99 }
    : { texts: payload.texts.map(() => payload.target === "en" ? facts : language === "hi" ? "अनुवादित स्पष्टीकरण" : "अनुवादित माहिती") };
}
function timeless(result) { const { elapsedMs, ...rest } = result; return rest; }

test("English bypass preserves the complete canonical response", async () => {
  assert.deepEqual(timeless(await analyzeMultilingualQuery(english, { worker: () => { throw Error("must skip"); } })), timeless(analyzeQuery(english)));
});
test("short unambiguous English offence names and section references do not require translation", async () => {
  for (const query of ["theft", "cheating", "IPC 379", "BNS 106(2)"]) assert.deepEqual(timeless(await analyzeMultilingualQuery(query, { worker: () => { throw Error("must skip"); } })), timeless(analyzeQuery(query)));
});
for (const [language, query] of [["hi", "20 जून 2024 को चोरी हुई। IPC 379"], ["mr", "20 जून 2024 रोजी चोरी झाली. IPC 379"]]) {
  test(`${language} dated input preserves date, section, language and canonical citations`, async () => {
    const result = await analyzeMultilingualQuery(query, { worker: fakeWorker(language) });
    assert.equal(result.facts.offenseDate, "2024-06-20");
    assert.equal(result.gate.route, "IPC_ONLY");
    assert.equal(result.retrieved[0].section, "379");
    assert.equal(result.multilingual.originalLanguage, language);
    assert.equal(result.multilingual.originalQuery, query);
    assert.equal(result.multilingual.processingLanguage, "en");
    const canonical = analyzeQuery(result.multilingual.englishQuery);
    assert.deepEqual(result.irac.citations, canonical.irac.citations);
    assert.deepEqual(result.retrieved.map(d => d.source), canonical.retrieved.map(d => d.source));
    assert.ok(result.multilingual.presentation.irac.conclusion.length);
  });
  test(`${language} missing date preserves undetermined candidate preview`, async () => {
    const result = await analyzeMultilingualQuery(query.replace(/20 जून 2024/g, ""), { worker: fakeWorker(language) });
    assert.equal(result.candidateOnly, true);
    assert.equal(result.irac, null);
    assert.equal(result.gate.applicability, "UNDETERMINED");
    assert.deepEqual(result.gate.allowedCodes, []);
    assert.ok(result.multilingual.presentation.candidateSummary);
  });
}
test("post-transition Indian-language input retains BNS routing", async () => {
  const result = await analyzeMultilingualQuery("12 जुलै 2024 रोजी चोरी झाली. BNS 303", { worker: fakeWorker("mr") });
  assert.equal(result.facts.offenseDate, "2024-07-12");
  assert.equal(result.gate.route, "BNS_PRIMARY");
  assert.equal(result.retrieved[0].section, "303");
});
test("native digits and localized month names normalize without inventing dates", () => {
  assert.match(normalizeInputDates("२० जून २०२४ रोजी"), /2024-06-20/);
  assert.equal(normalizeInputDates("20 જૂન 2024 ના રોજ મારો મોબાઇલ ફોન ચોરાઈ ગયો."), "2024-06-20  મારો મોબાઇલ ફોન ચોરાઈ ગયો.");
  assert.match(normalizeInputDates("20 జూన్ 2024న నా మొబైల్ ఫోన్ దొంగిలించబడింది."), /2024-06-20\s+న/u);
  assert.match(normalizeInputDates("2024 ജൂൺ 20 ന് എന്റെ മൊബൈൽ ഫോൺ മോഷണം പോയി."), /^2024-06-20\s+ന്/u);
  assert.equal(normalizeInputDates("चोरी झाली"), "चोरी झाली");
  assert.throws(() => normalizeInputDates("31 जून 2024"), e => e.code === "INVALID_TRANSLATED_DATE");
});

test("fully spoken Hindi and Marathi dates normalize only when the calendar date is complete", () => {
  assert.match(normalizeInputDates("वीस जून दोन हजार चोवीस रोजी चोरी झाली"), /^2024-06-20/);
  assert.match(normalizeInputDates("बीस जून दो हजार चौबीस को चोरी हुई"), /^2024-06-20/);
  assert.match(normalizeInputDates("पंधरा ऑगस्ट दोन हजार पंचवीस रोजी चोरी झाली"), /^2025-08-15/);
  assert.equal(normalizeInputDates("वीस जून रोजी चोरी झाली"), "वीस जून रोजी चोरी झाली");
  assert.throws(() => normalizeInputDates("इकतीस जून दो हजार चौबीस को चोरी हुई"), error => error.code === "INVALID_TRANSLATED_DATE");
});

test("Marathi stolen-phone wording retains a theft candidate without inventing a section", async () => {
  const query = "२० जून २०२४ रोजी माझा मोबाईल फोन चोरीला गेला.";
  const result = await analyzeMultilingualQuery(query, { inputMode: "voice", inputLanguage: "mr",
    languageSource: "user-selected", originalInput: query, worker: async payload => ({
      texts: payload.texts.map(() => payload.target === "en" ? "My cell phone was stolen." : "माहिती")
    }) });
  assert.equal(result.gate.route, "IPC_ONLY");
  assert.equal(result.facts.offenseDate, "2024-06-20");
  assert.ok(["ipc-378", "ipc-379"].includes(result.retrieved[0].id));
  assert.ok(!result.multilingual.englishQuery.includes("IPC 379"));
});

test("script fallback rescues short Hindi and Marathi text that the detector labels as unsupported", async () => {
  const samples = [
    ["hi", "20 जून 2024 को मेरा मोबाइल फोन चोरी हो गया।"],
    ["mr", "20 जून 2024 रोजी माझा मोबाईल फोन चोरीला गेला."]
  ];
  for (const [language, query] of samples) {
    const result = await analyzeMultilingualQuery(query, { worker: async payload => {
      if (payload.action === "detect") return { language: "ne", confidence: 0.99 };
      return { texts: payload.texts.map(() => payload.target === "en" ? "My cell phone was stolen." : "माहिती") };
    } });
    assert.equal(result.multilingual.originalLanguage, language);
    assert.equal(result.multilingual.detectionMethod, "script-fallback");
    assert.equal(result.facts.offenseDate, "2024-06-20");
    assert.equal(result.gate.route, "IPC_ONLY");
    assert.ok(["ipc-378", "ipc-379"].includes(result.retrieved[0].id));
  }
});

test("selected written language bypasses unreliable detection but rejects script mismatch", async () => {
  const query = "20 जून 2024 को मेरा मोबाइल फोन चोरी हो गया।";
  const result = await analyzeMultilingualQuery(query, { originalLanguage: "hi", worker: async payload => {
    assert.notEqual(payload.action, "detect");
    return { texts: payload.texts.map(() => payload.target === "en" ? "My cell phone was stolen." : "अनुवाद") };
  } });
  assert.equal(result.multilingual.detectionMethod, "user-selected-text");
  assert.equal(result.retrieved[0].id, "ipc-379");
  await assert.rejects(analyzeMultilingualQuery(query, { originalLanguage: "gu", worker: fakeWorker("gu") }), error => error.code === "LANGUAGE_UNCERTAIN");
});

test("translated stolen-property word order still triggers theft retrieval", () => {
  const result = analyzeQuery("On 2024-06-20 someone got my cell phone stolen.");
  assert.equal(result.gate.route, "IPC_ONLY");
  assert.ok(["ipc-378", "ipc-379"].includes(result.retrieved[0].id));
});

test("Gujarati date connector does not become an invented weekday before legal routing", async () => {
  const query = "20 જૂન 2024 ના રોજ મારો મોબાઇલ ફોન ચોરાઈ ગયો.";
  const result = await analyzeMultilingualQuery(query, { originalLanguage: "gu", worker: async payload => {
    assert.notEqual(payload.action, "detect");
    if (payload.target === "en") {
      assert.equal(payload.texts[0], "મારો મોબાઇલ ફોન ચોરાઈ ગયો.");
      return { texts: ["My mobile phone was stolen."] };
    }
    return { texts: payload.texts.map(() => "અનુવાદ") };
  } });
  assert.equal(result.facts.offenseDate, "2024-06-20");
  assert.equal(result.gate.route, "IPC_ONLY");
  assert.equal(result.retrieved[0].id, "ipc-379");
  assert.ok(!/\bSunday\b/i.test(result.multilingual.englishQuery));
});

test("translated written dates remain parseable when the model glues the next word", async () => {
  const result = await analyzeMultilingualQuery("10 జూలై 2024న నా మొబైల్ ఫోన్ దొంగిలించబడింది.", { originalLanguage: "te", worker: async payload => {
    assert.notEqual(payload.action, "detect");
    if (payload.target === "en") {
      assert.equal(payload.texts[0], "న నా మొబైల్ ఫోన్ దొంగిలించబడింది.");
      return { texts: payload.texts.map(() => "On my mobile phone was stolen.") };
    }
    assert.equal(payload.target, "te");
    return { texts: payload.texts.map(() => "స్థానిక వచనం") };
  } });

  assert.equal(result.multilingual.englishQuery, "2024-07-10 On my mobile phone was stolen.");
  assert.equal(result.facts.offenseDate, "2024-07-10");
  assert.equal(result.gate.route, "BNS_PRIMARY");
  assert.equal(result.retrieved[0].id, "bns-303");
});

test("Kannada ISO date connector is removed before translation without inventing a weekday", async () => {
  const query = "2024-06-20 ರಂದು ಒಬ್ಬ ವ್ಯಕ್ತಿ ಇನ್ನೊಬ್ಬ ವ್ಯಕ್ತಿಯ ಅನುಮತಿಯಿಲ್ಲದೆ ಫೋನ್ ತೆಗೆದುಕೊಂಡನು. IPC 379";
  const result = await analyzeMultilingualQuery(query, { originalLanguage: "kn", worker: async payload => {
    if (payload.target === "en") {
      assert.ok(payload.texts.every(text => !text.includes("ರಂದು")));
      return { texts: payload.texts.map(() => "A person took another person's phone without permission.") };
    }
    return { texts: payload.texts.map(() => "ಸ್ಥಳೀಯ ಪಠ್ಯ") };
  } });
  assert.equal(result.facts.offenseDate, "2024-06-20");
  assert.equal(result.gate.route, "IPC_ONLY");
  assert.equal(result.retrieved[0].id, "ipc-379");
});

test("a translation cannot turn explicit native theft into murder", async () => {
  const query = "२० जून २०२४ रोजी चोरी झाली.";
  await assert.rejects(analyzeMultilingualQuery(query, { inputMode: "voice", inputLanguage: "mr",
    languageSource: "user-selected", originalInput: query, worker: async payload => ({
      texts: payload.texts.map(() => payload.target === "en" ? "Murder happened." : "माहिती")
    }) }), error => error.code === "TRANSLATION_CONCEPT_CHANGED");
});

test("long multi-date input is translated in bounded chunks with exact dates restored", async () => {
  const query = `कृत्य 2024-06-20 रोजी सुरू झाले. ${"घटनेची अधिक माहिती दिली आहे. ".repeat(35)} 2024-07-10 पर्यंत सुरू राहिले.`;
  const translated = await translateInputQuery(query, "mr", async payload => {
    assert.ok(payload.texts.length > 1);
    assert.ok(payload.texts.every(text => text.length <= 320));
    return { texts: payload.texts };
  });
  assert.ok(translated.includes("2024-06-20"));
  assert.ok(translated.includes("2024-07-10"));
  assert.ok(!translated.includes("__LEGAL_"));
});

test("long multi-date marker corruption retries once and still requires exact dates", async () => {
  const query = `कृत्य 2024-06-20 रोजी सुरू झाले. ${"अधिक माहिती आवश्यक आहे. ".repeat(25)} कृत्य 2024-07-10 पर्यंत सुरू राहिले.`;
  let attempts = 0;
  const output = await translateInputQuery(query, "mr", async payload => {
    attempts++;
    return { texts: payload.texts.map(text => attempts === 1 ? text.replace("__LEGAL_1__", "_LEGAL_1__") : text) };
  });
  assert.equal(attempts, 2);
  assert.ok(output.includes("2024-06-20"));
  assert.ok(output.includes("2024-07-10"));
  await assert.rejects(translateInputQuery(query, "mr", async payload => ({
    texts: payload.texts.map(text => text.replace(/__LEGAL_1__|DATE1/g, "DATE2"))
  })), error => error.code === "TRANSLATION_FACT_CHANGED");
});
test("statutory identifiers, numbers, URLs and PDF references never enter translation", async () => {
  const input = "theft IPC 379 BNS 106(2) Section 318 page 42 2024-06-20 https://example.gov/file.pdf";
  const parts = translationParts(input);
  assert.ok(parts.some(p => p.literal && p.text === "BNS 106(2)"));
  const [output] = await translateTexts([input], "en", "mr", async payload => {
    assert.ok(payload.texts.every(t => !/\d|IPC|BNS|https/.test(t)));
    return { texts: payload.texts.map(() => "अनुवाद") };
  });
  for (const value of ["IPC 379", "BNS 106(2)", "Section 318", "42", "2024-06-20", "https://example.gov/file.pdf"]) assert.ok(output.includes(value));
});
test("invented dates, numbers and statutory identifiers are rejected", async () => {
  for (const text of ["on 2024-07-12", "IPC 420", "three people 3"]) {
    await assert.rejects(translateTexts(["चोरी झाली"], "mr", "en", async () => ({ texts: [text] })), e => e.code === "TRANSLATION_FACT_CHANGED");
  }
});
test("complete written dates and numbered legal annotations stay literal", () => {
  const parts = translationParts("before July 1, 2024. Explanation 1. Act 26 of 1955");
  for (const text of ["July 1, 2024", "Explanation 1", "Act 26 of 1955"]) assert.ok(parts.some(p => p.literal && p.text === text));
});
test("written quantities may change notation but not numerical value", async () => {
  const [value] = await translateTexts(["under twelve years of age"], "en", "bn", async () => ({ texts: ["১২ বছর বয়সের নিচে"] }));
  assert.match(value, /১২/);
  for (const text of ["13 years", "-12 years", "12.5 years"]) await assert.rejects(translateTexts(["under twelve years of age"], "en", "bn", async () => ({ texts: [text] })), e => e.code === "TRANSLATION_FACT_CHANGED");
});
test("PDF definition separators stay literal instead of resembling signed translated quantities", async () => {
  const [text] = await translateTexts(["--under twelve years of age"], "en", "bn", async payload => {
    assert.deepEqual(payload.texts, ["under twelve years of age"]);
    return { texts: ["১২ বছর বয়সের নিচে"] };
  });
  assert.ok(text.startsWith("--"));
});

test("Markdown, spacing and legal metadata survive translation exactly", async () => {
  const input = "### Explanation\n1. **IPC 378 — Relevance: 46.121**\n2. IPC 379\n- PDF page 152\nMinistry of Home Affairs, Government of India\nhttps://example.gov/file.pdf\n----------------------------------------------------------------------\n2024-06-20";
  const [output] = await translateTexts([input], "en", "hi", async payload => {
    assert.deepEqual(payload.texts, ["Explanation"]);
    return { texts: payload.texts.map(text => text === "Explanation" ? "स्पष्टीकरण" : text) };
  });
  assert.equal(output, input.replace("Explanation", "स्पष्टीकरण"));
  assert.ok(!output.includes("IPC 378Relevance"));
});

test("translation cannot inject new Markdown structure into a prose field", async () => {
  for (const text of ["**बदल**", "### शीर्षक", "मजकूर\nदुसरी ओळ", "[बदल]"]) {
    await assert.rejects(translateTexts(["Explanation"], "en", "mr", async () => ({ texts: [text] })), error => error.code === "TRANSLATION_FACT_CHANGED");
  }
});

test("runtime source identities and hashes stay outside the translation model", async () => {
  const values = ["Official Source Authority", "ipc-378", "f".repeat(64)];
  const input = `See ${values.join(" | ")} for IPC Section 378(1)(a).`;
  const [output] = await translateTexts([input], "en", "hi", async payload => {
    assert.ok(payload.texts.every(text => values.every(value => !text.includes(value))));
    return { texts: payload.texts.map(text => text) };
  }, values);
  assert.equal(output, input);
});

test("lettered subsections and day-first written dates are exact literal spans", () => {
  const parts = translationParts("See IPC Section 378(1)(a), BNS 318(4), on 20 June 2024.");
  for (const text of ["IPC Section 378(1)(a)", "BNS 318(4)", "20 June 2024"]) assert.ok(parts.some(part => part.literal && part.text === text));
  assert.equal(parts.map(part => part.text).join(""), "See IPC Section 378(1)(a), BNS 318(4), on 20 June 2024.");
});

test("official excerpts are neither translated nor replaced in the canonical result", async () => {
  const result = await analyzeMultilingualQuery("20 जून 2024 को चोरी हुई। IPC 379", { worker: async payload => {
    if (payload.action === "detect") return { language: "hi", confidence: 1 };
    if (payload.target === "hi") assert.ok(payload.texts.every(text => !text.includes("Retrieved rule material:") && !text.includes("Whoever commits theft")));
    return { texts: payload.texts.map(() => payload.target === "en" ? "a person committed theft." : "स्पष्टीकरण") };
  } });
  const canonical = analyzeQuery(result.multilingual.englishQuery);
  assert.deepEqual(result.retrieved, canonical.retrieved);
  assert.deepEqual(result.irac, canonical.irac);
  assert.equal(result.multilingual.presentation.provisions[0].sourceText, canonical.retrieved[0].excerpt);
});

test("Marathi model disagreement is accepted only with documented multi-signal consensus", async () => {
  const result = await analyzeMultilingualQuery("20 जून 2024 रोजी चोरी झाली.", { worker: async payload => {
    if (payload.action === "detect") return { language: "mr", confidence: 0.072, detection_method: "py3langid+marathi-consensus", reliable: true, model_language: "hi", marathi_signal_groups: 3, hindi_signal_groups: 0 };
    return { texts: payload.texts.map(() => payload.target === "en" ? "theft happened." : "स्पष्टीकरण") };
  } });
  assert.equal(result.multilingual.originalLanguage, "mr");
  assert.equal(result.multilingual.detectionConfidence, 0.072);
  assert.equal(result.multilingual.detectionModelLanguage, "hi");
  assert.equal(result.multilingual.detectionMethod, "py3langid+marathi-consensus");
});

test("multi-date translation keeps context and restores exact literals before routing", async () => {
  const query = "कृत्य 2024-06-20 रोजी सुरू झाले आणि 2024-07-10 पर्यंत सुरू राहिले. IPC 420";
  const output = await translateInputQuery(query, "mr", async payload => {
    assert.equal(payload.texts.length, 1);
    assert.ok(!payload.texts[0].includes("2024-06-20"));
    assert.ok(!payload.texts[0].includes("IPC 420"));
    return { texts: ["The act began on __LEGAL_0__ and continued until __LEGAL_1__. __LEGAL_2__"] };
  });
  assert.equal(output, "The act began on 2024-06-20 and continued until 2024-07-10. IPC 420");
  assert.equal(analyzeQuery(output).gate.route, "MULTI_PERIOD_REVIEW");
});

test("multi-date context rejects missing, altered, duplicated or reordered markers and invented numbers", async () => {
  for (const output of ["__LEGAL_0__", "__LEGAL_1__ __LEGAL_0__", "__LEGAL_0__ __LEGAL_1__ __LEGAL_1__", "__LEGAL_0__ __LEGAL_1__ July 1", "__LEGAL_X__ __LEGAL_1__"]) {
    await assert.rejects(translateInputQuery("कृत्य 2024-06-20 ते 2024-07-10", "mr", async () => ({ texts: [output] })), error => error.code === "TRANSLATION_FACT_CHANGED");
  }
});
test("translation cannot add an unmentioned weekday while preserving the numeric date", async () => {
  await assert.rejects(analyzeMultilingualQuery("20 जून 2024 रोजी चोरी झाली.", { worker: fakeWorker("mr", "On Monday a person committed theft.") }), e => e.code === "TRANSLATION_FACT_CHANGED");
});
test("unsupported and uncertain languages fail clearly rather than selecting law", async () => {
  for (const [language, confidence, code] of [["fr", 1, "UNSUPPORTED_LANGUAGE"], ["hi", 0.4, "LANGUAGE_UNCERTAIN"]]) {
    await assert.rejects(analyzeMultilingualQuery("अज्ञात", { worker: async () => ({ language, confidence }) }), e => e.code === code);
  }
});
test("translation failure propagates instead of silently falling back to English", async () => {
  await assert.rejects(analyzeMultilingualQuery("चोरी झाली", { worker: async payload => {
    if (payload.action === "detect") return { language: "mr", confidence: 1 };
    throw Error("model missing");
  } }), /model missing/);
});
test("original speech language remains the output target for an English voice translation", async () => {
  const result = await analyzeMultilingualQuery(english, { originalLanguage: "mr", worker: fakeWorker("mr") });
  assert.equal(result.multilingual.originalLanguage, "mr");
  assert.equal(result.multilingual.englishQuery, english);
  assert.equal(result.retrieved[0].section, "379");
});
test("Hindi serious-injury input preserves the same BNS hurt retrieval as English without assuming grievous hurt", async () => {
  const hindi = await analyzeMultilingualQuery("10 जुलाई 2024 को आरोपी ने एक व्यक्ति को गंभीर चोट पहुंचाई।", { originalLanguage: "hi", worker: async payload => {
    if (payload.action === "detect") return { language: "hi", confidence: 1 };
    return { texts: payload.texts.map(() => "The accused seriously injured one person.") };
  } });
  const englishResult = analyzeQuery("On 10 July 2024, the accused seriously injured another person.");

  assert.equal(hindi.multilingual.englishQuery, "2024-07-10  The accused seriously injured one person.");
  assert.equal(hindi.gate.route, "BNS_PRIMARY");
  assert.equal(englishResult.gate.route, "BNS_PRIMARY");
  assert.equal(hindi.retrieved[0].id, "bns-115");
  assert.equal(englishResult.retrieved[0].id, "bns-115");
});
test("oversized query is bounded before loading a model", async () => {
  await assert.rejects(analyzeMultilingualQuery("x".repeat(4001)), e => e.code === "TRANSLATION_TEXT_TOO_LONG");
});

function processMock({ payload = { language: "mr", confidence: 1 }, code = 0, malformed = false, stall = false } = {}) {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => { child.killed = true; queueMicrotask(() => child.emit("close", -1)); };
  child.stdin.on("finish", () => {
    if (stall) return;
    queueMicrotask(() => { child.stdout.write(malformed ? "bad JSON" : JSON.stringify(payload)); child.emit("close", code); });
  });
  return child;
}
test("translation process is offline, shell-free and releases the busy guard", async () => {
  let config;
  const response = await runTranslationWorker({ action: "detect", text: "माहिती" }, 1000, (exe, args, options) => { config = options; return processMock(); });
  assert.equal(response.language, "mr");
  assert.equal(config.shell, false);
  assert.equal(config.windowsHide, true);
  assert.equal(config.env.HF_HUB_OFFLINE, "1");
  assert.equal(config.env.TRANSFORMERS_OFFLINE, "1");
});
test("translation timeout and concurrent request are bounded; next job recovers", async () => {
  const child = processMock({ stall: true });
  const pending = runTranslationWorker({ action: "detect" }, 20, () => child);
  await assert.rejects(runTranslationWorker({ action: "detect" }), e => e.code === "TRANSLATION_BUSY");
  await assert.rejects(pending, e => e.code === "TRANSLATION_TIMEOUT");
  assert.equal(child.killed, true);
  await runTranslationWorker({ action: "detect" }, 1000, () => processMock());
});
test("missing model, malformed worker output and spawn failure are safe errors", async () => {
  await assert.rejects(runTranslationWorker({}, 1000, () => processMock({ code: 1, payload: { error: "TRANSLATION_MODEL_MISSING" } })), e => e.statusCode === 503);
  await assert.rejects(runTranslationWorker({}, 1000, () => processMock({ malformed: true })), e => e.code === "TRANSLATION_FAILED");
  await assert.rejects(runTranslationWorker({}, 1000, () => { throw Error("missing runtime"); }), e => e.code === "TRANSLATION_RUNTIME_UNAVAILABLE");
  await runTranslationWorker({}, 1000, () => processMock());
});

function streamingProcessMock(respond) {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => { child.killed = true; queueMicrotask(() => child.emit("close", -1)); };
  let buffer = "";
  child.stdin.on("data", chunk => {
    buffer += chunk.toString();
    const newline = buffer.indexOf("\n");
    if (newline < 0) return;
    const payload = JSON.parse(buffer.slice(0, newline));
    buffer = buffer.slice(newline + 1);
    const result = respond(payload);
    if (result !== undefined) queueMicrotask(() => child.stdout.write(typeof result === "string" ? `${result}\n` : `${JSON.stringify(result)}\n`));
  });
  return child;
}

test("streaming translation reuses one offline worker across detection and both translation directions", async () => {
  let spawns = 0;
  let child;
  const worker = createStreamingTranslationWorker((exe, args, options) => {
    spawns++;
    assert.equal(args.at(-1), "--stream");
    assert.equal(options.shell, false);
    assert.equal(options.env.HF_HUB_OFFLINE, "1");
    child = streamingProcessMock(payload => payload.action === "detect"
      ? { language: "bn", confidence: 0.99 }
      : { texts: payload.texts.map(text => `${payload.target}:${text}`) });
    return child;
  });
  try {
    assert.equal((await worker({ action: "detect", text: "বাংলা" })).language, "bn");
    assert.deepEqual((await worker({ action: "translate", source: "bn", target: "en", texts: ["query"] })).texts, ["en:query"]);
    assert.deepEqual((await worker({ action: "translate", source: "en", target: "bn", texts: ["result"] })).texts, ["bn:result"]);
    assert.equal(spawns, 1);
  } finally {
    worker.close();
  }
  assert.equal(child.killed, true);
});

test("startup warmup loads the model once and waits before processing a first query", async () => {
  const requests = [];
  let child;
  const worker = createStreamingTranslationWorker(() => {
    child = streamingProcessMock(payload => {
      requests.push(payload);
      return payload.texts?.length ? { texts: ["translated"] } : undefined;
    });
    return child;
  });
  try {
    const warming = worker.warmup();
    assert.equal(worker.warmup(), warming);
    const query = worker({ action: "translate", source: "bn", target: "en", texts: ["query"] });
    assert.equal(requests.length, 1);
    assert.deepEqual(requests[0].texts, []);
    child.stdout.write('{"texts":[]}\n');
    await warming;
    assert.deepEqual((await query).texts, ["translated"]);
    assert.equal(requests.length, 2);
  } finally {
    worker.close();
  }
});

test("failed warmup does not block later translation", async () => {
  let child;
  const worker = createStreamingTranslationWorker(() => {
    child = streamingProcessMock(payload => payload.texts?.length ? { texts: ["ok"] } : undefined);
    return child;
  });
  try {
    const warming = worker.warmup();
    const query = worker({ action: "translate", source: "bn", target: "en", texts: ["query"] });
    child.stdout.write('{"error":"TRANSLATION_MODEL_MISSING"}\n');
    await assert.rejects(warming, error => error.code === "TRANSLATION_MODEL_MISSING");
    assert.deepEqual((await query).texts, ["ok"]);
  } finally {
    worker.close();
  }
});

test("streaming translation fails closed on busy, timeout and malformed output, then restarts", async () => {
  let spawns = 0;
  const worker = createStreamingTranslationWorker(() => {
    spawns++;
    return streamingProcessMock(() => spawns === 1 ? undefined : spawns === 2 ? "not JSON" : { texts: ["ok"] });
  });
  try {
    const pending = worker({ action: "translate", source: "en", target: "bn", texts: ["text"] }, 20);
    await assert.rejects(worker({ action: "detect", text: "x" }), e => e.code === "TRANSLATION_BUSY");
    await assert.rejects(pending, e => e.code === "TRANSLATION_TIMEOUT");
    await assert.rejects(worker({ action: "detect", text: "x" }), e => e.code === "TRANSLATION_FAILED");
    assert.deepEqual((await worker({ action: "translate", source: "en", target: "bn", texts: ["text"] })).texts, ["ok"]);
    assert.equal(spawns, 3);
  } finally {
    worker.close();
  }
});

test("streaming translation reports worker validation failures without losing the session", async () => {
  let spawns = 0;
  const worker = createStreamingTranslationWorker(() => {
    spawns++;
    return streamingProcessMock(payload => payload.texts?.[0] === "bad"
      ? { error: "TRANSLATION_UNCERTAIN", segmentIndex: 0, reason: "low score" }
      : { texts: ["ok"] });
  });
  try {
    await assert.rejects(worker({ action: "translate", source: "en", target: "bn", texts: ["bad"] }), error =>
      error.code === "TRANSLATION_UNCERTAIN" && error.segmentIndex === 0 && error.reason === "low score");
    assert.deepEqual((await worker({ action: "translate", source: "en", target: "bn", texts: ["good"] })).texts, ["ok"]);
    assert.equal(spawns, 1);
  } finally {
    worker.close();
  }
});

test("streaming translation restarts after the local worker exits unexpectedly", async () => {
  let spawns = 0;
  let first;
  const worker = createStreamingTranslationWorker(() => {
    spawns++;
    const child = streamingProcessMock(() => spawns === 1 ? undefined : { texts: ["recovered"] });
    if (spawns === 1) first = child;
    return child;
  });
  try {
    const pending = worker({ action: "translate", source: "en", target: "bn", texts: ["text"] });
    first.emit("close", 1);
    await assert.rejects(pending, error => error.code === "TRANSLATION_FAILED");
    assert.deepEqual((await worker({ action: "translate", source: "en", target: "bn", texts: ["text"] })).texts, ["recovered"]);
    assert.equal(spawns, 2);
  } finally {
    worker.close();
  }
});
