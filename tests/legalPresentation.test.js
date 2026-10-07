import test from "node:test";
import assert from "node:assert/strict";
import { analyzeQuery } from "../backend/core/pipeline.js";
import { analyzeMultilingualQuery } from "../backend/core/multilingual.js";
import { BNS_COMMENCEMENT } from "../backend/core/gateway.js";
import { createLegalPresentation, presentationTranslationTargets, renderLegalPresentation, TERMINOLOGY } from "../frontend/legalPresentation.js";

const canonical = () => analyzeQuery("On 2024-06-20 theft IPC 378");
for (const language of ["hi", "mr"]) {
  test(`${language} structured rendering preserves scores, dates, citations and original source fields`, () => {
    const result = canonical();
    result.retrieved[0].score = 49.148;
    const snapshot = structuredClone(result);
    const view = createLegalPresentation(result, language, BNS_COMMENCEMENT);
    const before = structuredClone(view);
    presentationTranslationTargets(view).forEach(target => target.set("अनुवाद"));
    view.provisions.forEach((doc, index) => assert.deepEqual({ ...doc, title: before.provisions[index].title }, before.provisions[index]));
    assert.deepEqual(view.decision, before.decision);
    assert.deepEqual(view.irac, before.irac);
    assert.deepEqual(result, snapshot);
    const html = renderLegalPresentation(view);
    assert.match(html.retrievalHtml, /class="provision-code"/);
    assert.match(html.retrievalHtml, /class="relevance-value"/);
    assert.ok(html.retrievalHtml.includes(String(result.retrieved[0].score)));
    assert.ok(html.retrievalHtml.includes("49.148"));
    assert.ok(html.retrievalHtml.includes("PDF page 152"));
    assert.ok(html.retrievalHtml.includes(TERMINOLOGY[language].originalStatutorySource));
    assert.ok(html.retrievalHtml.includes("Ministry of Home Affairs, Government of India"));
    assert.ok(html.retrievalHtml.includes("ipc-1860-mha.pdf"));
    assert.ok(html.iracHtml.includes("2024-06-20"));
    assert.ok(html.iracHtml.includes("July 1, 2024"));
    assert.ok(!html.retrievalHtml.includes("IPC 378Relevance"));
    assert.deepEqual(view.irac.citations, result.irac.citations);
    assert.equal(view.inputLanguage, language);
    assert.equal(view.processingLanguage, "en");
    assert.equal(view.outputLanguage, language);
  });
  test(`${language} fast path skips output translation and keeps literal source fields`, async () => {
    let outputCalls = 0;
    const result = await analyzeMultilingualQuery("20 जून 2024 चोरी IPC 378", { worker: async payload => {
      if (payload.action === "detect") return { language, confidence: 0.99 };
      if (payload.target === "en") return { texts: payload.texts.map(() => "theft") };
      outputCalls++;
      assert.equal(payload.source, "en");
      assert.equal(payload.target, language);
      assert.ok(payload.texts.every(text => !/July|2024|IPC|BNS|Relevance|Applicable|Ministry|pdf|dishonestly|charging framework/.test(text)));
      return { texts: payload.texts.map(() => "अनुवाद") };
    } });
    assert.equal(outputCalls, 0);
    assert.equal(result.multilingual.presentation.outputTranslation, "disabled-fast-path");
    assert.deepEqual(result.multilingual.presentation.labels, {
      ...TERMINOLOGY[language],
      translatedTitle: TERMINOLOGY[language].originalTitle
    });
    assert.deepEqual(result.multilingual.presentation.provisions.map(doc => doc.sourceText), result.retrieved.map(doc => doc.excerpt));
  });
}

test("all controlled terminology keys are defined independently for English, Hindi and Marathi", () => {
  for (const language of ["hi", "mr"]) {
    assert.deepEqual(Object.keys(TERMINOLOGY[language]), Object.keys(TERMINOLOGY.en));
    for (const text of Object.values(TERMINOLOGY[language])) assert.ok(/[\u0900-\u097f]/u.test(text));
  }
  assert.notEqual(TERMINOLOGY.hi.applicableLaw, TERMINOLOGY.mr.applicableLaw);
});

test("other supported languages translate the result presentation without changing legal decisions or sources", async () => {
  for (const language of ["gu", "bn", "ta", "te", "kn", "ml", "pa", "ur"]) {
    let outputCalls = 0;
    const result = await analyzeMultilingualQuery("Theft on 2024-06-20 IPC 379", {
      originalLanguage: language,
      worker: async payload => {
        assert.equal(payload.source, "en");
        assert.equal(payload.target, language);
        outputCalls++;
        assert.ok(payload.texts.every(text => !/ipc-379|Ministry of Home Affairs|ipc-1860-mha\.pdf|Whoever commits theft/.test(text)));
        return { texts: payload.texts.map(() => "localized prose") };
      }
    });
    const canonical = analyzeQuery(result.multilingual.englishQuery);
    const view = result.multilingual.presentation;
    assert.equal(outputCalls, 1, language);
    assert.equal(view.outputTranslation, "local-model");
    assert.equal(view.labels.applicableLaw, "localized prose");
    assert.equal(view.interfaceText.queryHeading, "localized prose");
    assert.equal(view.decision.route, canonical.gate.route);
    assert.deepEqual(result.retrieved, canonical.retrieved);
    assert.deepEqual(result.irac, canonical.irac);
    assert.deepEqual(view.provisions.map(doc => doc.source), canonical.retrieved.map(doc => doc.source));
    assert.deepEqual(view.irac.citations, canonical.irac.citations);
    assert.match(renderLegalPresentation(view).retrievalHtml, /IPC 379/);
  }
});

test("all-language prose allowlist cannot mutate literal source fields", () => {
  const view = createLegalPresentation(canonical(), "ta", BNS_COMMENCEMENT);
  const before = structuredClone(view);
  presentationTranslationTargets(view, true).forEach(target => target.set("translated"));
  assert.deepEqual(view.provisions.map(({ title, ...rest }) => rest), before.provisions.map(({ title, ...rest }) => rest));
  assert.deepEqual(view.irac.citations, before.irac.citations);
  for (const key of ["issue", "rule", "application", "conclusion"]) assert.deepEqual(view.irac[key].filter(n => n.kind === "literal"), before.irac[key].filter(n => n.kind === "literal"));
});

test("source HTML is escaped without changing the underlying original text or exception", () => {
  const result = canonical();
  result.retrieved[0].excerpt = 'Original <script> & "quoted"\n--footnote';
  result.verifier.warnings.push("IPC 378: original exception");
  const view = createLegalPresentation(result, "mr", BNS_COMMENCEMENT);
  const html = renderLegalPresentation(view);
  assert.equal(view.provisions[0].sourceText, result.retrieved[0].excerpt);
  assert.match(html.retrievalHtml, /Original &lt;script&gt; &amp; &quot;quoted&quot;\n--footnote/);
  assert.ok(!html.retrievalHtml.includes("<script>"));
  assert.match(html.warningsHtml, /IPC 378: original exception/);
});

test("candidate-only and multi-period views retain the actual legal decision without inventing an IRAC", () => {
  const missing = createLegalPresentation(analyzeQuery("theft"), "mr", BNS_COMMENCEMENT);
  assert.equal(missing.irac, null);
  assert.deepEqual(missing.decision.allowedCodes, []);
  assert.equal(missing.decision.applicability, "UNDETERMINED");
  assert.match(renderLegalPresentation(missing).iracHtml, /केवळ उमेदवार/);
  const span = createLegalPresentation(analyzeQuery("Cheating began 2024-06-20 and continued until 2024-07-10"), "mr", BNS_COMMENCEMENT);
  assert.equal(span.decision.route, "MULTI_PERIOD_REVIEW");
  assert.match(renderLegalPresentation(span).iracHtml, /मानवी पुनरावलोकन आवश्यक/);
});
