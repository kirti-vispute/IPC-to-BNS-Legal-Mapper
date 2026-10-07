import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { analyzeMultilingualQuery } from "../backend/core/multilingual.js";
import { analyzeQuery } from "../backend/core/pipeline.js";
import { renderLegalPresentation } from "../frontend/legalPresentation.js";

// User-supplied acceptance inputs, not legal gold labels or translation-quality scores.
const fixtures = [
  ["hi", "IPC_ONLY", "20 जून 2024 को एक व्यक्ति ने दूसरे व्यक्ति का मोबाइल उसकी सहमति के बिना ले लिया।"],
  ["mr", "IPC_ONLY", "20 जून 2024 रोजी एका व्यक्तीने दुसऱ्या व्यक्तीचा मोबाईल त्याच्या संमतीशिवाय घेतला."],
  ["mr", "MULTI_PERIOD_REVIEW", "फसवणुकीचे कृत्य 20 जून 2024 रोजी सुरू झाले आणि 10 जुलै 2024 पर्यंत सुरू राहिले."],
  ["hi", "BNS_PRIMARY", "15 अगस्त 2024 को एक व्यक्ति ने दूसरे व्यक्ति का मोबाइल उसकी अनुमति के बिना ले लिया।"],
  ["mr", "CLARIFY", "एका व्यक्तीने दुसऱ्या व्यक्तीची मालमत्ता त्याच्या संमतीशिवाय घेतली."]
];
const observations = [];
for (const [language, route, query] of fixtures) {
  try {
    const result = await analyzeMultilingualQuery(query);
    const view = result.multilingual.presentation;
    const canonical = analyzeQuery(result.multilingual.englishQuery);
    assert.equal(view.inputLanguage, language);
    assert.equal(view.processingLanguage, "en");
    assert.equal(view.outputLanguage, language);
    assert.equal(result.gate.route, route);
    assert.deepEqual(result.retrieved, canonical.retrieved);
    assert.deepEqual(result.irac, canonical.irac);
    view.provisions.forEach((doc, index) => {
      assert.equal(doc.sourceText, result.retrieved[index].excerpt);
      assert.equal(doc.relevance, result.retrieved[index].score);
      assert.deepEqual(doc.source, result.retrieved[index].source);
    });
    const rendered = renderLegalPresentation(view);
    assert.ok(!rendered.retrievalHtml.includes("IPC 378Relevance"));
    assert.ok(!rendered.explanationText.includes("शुल्क आकारण्याच्या चौकटीत"));
    observations.push({ query, passed: true, result, rendered });
    console.log(JSON.stringify({ language, route, dates: result.facts.dates.map(d => d.value), top3: result.retrieved.map(d => d.id), passed: true }));
  } catch (error) {
    observations.push({ query, passed: false, error: error.code || error.message, reason: error.reason });
    console.log(JSON.stringify(observations.at(-1)));
    process.exitCode = 1;
  }
}
await mkdir("output/multilingual-verification", { recursive: true });
await writeFile("output/multilingual-verification/structured-presentation-results.json", JSON.stringify({ disclaimer: "Real local-model software acceptance checks. Not expert or legal validation.", observations }, null, 2));
