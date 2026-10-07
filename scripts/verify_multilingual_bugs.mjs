import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { analyzeMultilingualQuery, runTranslationWorker, translateTexts } from "../backend/core/multilingual.js";
import { analyzeQuery } from "../backend/core/pipeline.js";

// User-supplied software acceptance fixtures, not legal gold labels or quality scores.
const fixtures = [
  ["mr", "MULTI_PERIOD_REVIEW", "फसवणुकीचे कृत्य 20 जून 2024 रोजी सुरू झाले आणि 10 जुलै 2024 पर्यंत सुरू राहिले."],
  ["hi", "IPC_ONLY", "20 जून 2024 को एक व्यक्ति ने दूसरे व्यक्ति का मोबाइल उसकी सहमति के बिना ले लिया और उसे अपने पास रखने का इरादा था।"],
  ["mr", "IPC_ONLY", "20 जून 2024 रोजी एका व्यक्तीने दुसऱ्या व्यक्तीचा मोबाईल त्याच्या संमतीशिवाय घेतला."],
  ["hi", "IPC_ONLY", "20 जून 2024 को एक व्यक्ति ने दूसरे व्यक्ति का मोबाइल उसकी सहमति के बिना ले लिया।"],
  ["mr", "BNS_PRIMARY", "15 ऑगस्ट 2024 रोजी एका व्यक्तीने दुसऱ्या व्यक्तीचा मोबाईल त्याच्या परवानगीशिवाय घेतला."],
  ["hi", "BNS_PRIMARY", "15 अगस्त 2024 को एक व्यक्ति ने दूसरे व्यक्ति का मोबाइल उसकी अनुमति के बिना ले लिया।"],
  ["mr", "CLARIFY", "एका व्यक्तीने दुसऱ्या व्यक्तीची मालमत्ता त्याच्या संमतीशिवाय घेतली."],
  ["hi", "CLARIFY", "एक व्यक्ति ने दूसरे व्यक्ति का मोबाइल उसकी सहमति के बिना ले लिया।"]
];
const observations = [];
for (const [language, route, query] of fixtures) {
  const start = Date.now();
  let lastPayload;
  try {
    const result = await analyzeMultilingualQuery(query, { worker: payload => {
      lastPayload = payload;
      return runTranslationWorker(payload);
    } });
    assert.equal(result.multilingual.originalLanguage, language);
    assert.equal(result.gate.route, route);
    assert.deepEqual(result.facts.dates.map(date => date.value).sort(), route === "CLARIFY" ? [] : route === "MULTI_PERIOD_REVIEW" ? ["2024-06-20", "2024-07-10"] : [route === "BNS_PRIMARY" ? "2024-08-15" : "2024-06-20"]);
    const canonical = analyzeQuery(result.multilingual.englishQuery);
    assert.deepEqual(result.retrieved, canonical.retrieved);
    assert.deepEqual(result.irac, canonical.irac);
    assert.equal(result.multilingual.presentation["retrieved.0.excerpt"], undefined);
    if (route === "CLARIFY") { assert.equal(result.irac, null); assert.deepEqual(result.gate.allowedCodes, []); }
    observations.push({ query, expectedLanguage: language, language: result.multilingual.originalLanguage,
      confidence: result.multilingual.detectionConfidence, method: result.multilingual.detectionMethod,
      route: result.gate.route, dates: result.facts.dates.map(date => date.value),
      english: result.multilingual.englishQuery, top3: result.retrieved.map(doc => doc.id),
      canonicalFieldsPreserved: true, presentation: result.multilingual.presentation, elapsedMs: Date.now() - start });
  } catch (error) {
    observations.push({ query, error: error.code || error.message, reason: error.reason,
      phase: lastPayload?.action, source: lastPayload?.source,
      rejectedSegment: lastPayload?.texts?.[error.segmentIndex], elapsedMs: Date.now() - start });
    process.exitCode = 1;
  }
  console.log(JSON.stringify(observations.at(-1)));
}
const metadata = "### Explanation\n1. **IPC 378 — Relevance: 46.121**\n2. IPC 379\n- PDF page 152\nMinistry of Home Affairs, Government of India\n2024-06-20\nhttps://example.gov/ipc-1860-mha.pdf";
try {
  const [translated] = await translateTexts([metadata], "en", "hi");
  for (const value of ["IPC 378", "IPC 379", "Relevance: 46.121", "PDF page 152", "Ministry of Home Affairs, Government of India", "2024-06-20", "https://example.gov/ipc-1860-mha.pdf"]) assert.ok(translated.includes(value));
  assert.ok(!translated.includes("IPC 378Relevance"));
  assert.deepEqual(translated.split("\n").slice(1), metadata.split("\n").slice(1));
  observations.push({ metadataTranslated: translated, preserved: true });
  console.log(JSON.stringify(observations.at(-1)));
} catch (error) { observations.push({ metadataError: error.code || error.message }); process.exitCode = 1; }
await mkdir("output/multilingual-verification", { recursive: true });
await writeFile("output/multilingual-verification/multilingual-bugs-results.json", JSON.stringify({
  disclaimer: "Real local-model software checks. Not expert-reviewed translation or legal accuracy.", observations
}, null, 2));
