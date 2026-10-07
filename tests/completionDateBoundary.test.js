import test from "node:test";
import assert from "node:assert/strict";
import { normalizeInputDates, translateInputQuery } from "../backend/core/multilingual.js";
import { extractFacts } from "../backend/core/dateExtractor.js";
import { routeByTemporalGate } from "../backend/core/gateway.js";

const dates = ["20 June 2024", "२० जून २०२४", "२० जून २०२४", "૨૦ જૂન ૨૦૨૪", "২০ জুন ২০২৪",
  "20 ஜூன் 2024", "౨౦ జూన్ ౨౦౨౪", "೨೦ ಜೂನ್ ೨೦೨೪", "൨൦ ജൂൺ ൨൦൨൪", "੨੦ ਜੂਨ ੨੦੨੪", "۲۰ جون ۲۰۲۴"];
test("complete local-script dates in all11 configured languages retain the same IPC date boundary", () => {
  for (const date of dates) {
    const normalized = normalizeInputDates(`${date} theft`);
    const facts = extractFacts(normalized);
    assert.equal(facts.offenseDate, "2024-06-20", date);
    assert.equal(routeByTemporalGate(facts).route, "IPC_ONLY", date);
  }
});
test("long chunked native passages preserve both dates and explicit identifiers without inventing facts", async () => {
  const query = `2024-06-20 ${"घटनेची नोंद आहे. ".repeat(60)} IPC 379 2024-07-10`;
  let chunks = 0;
  const translated = await translateInputQuery(query, "mr", async payload => {
    chunks += payload.texts.length;
    return { texts: payload.texts.map(text => text.replace(/घटनेची नोंद आहे\./gu, "The incident is recorded.")) };
  });
  assert.ok(chunks > 1);
  assert.deepEqual(extractFacts(translated).dates.map(date => date.value).sort(), ["2024-06-20", "2024-07-10"]);
  assert.deepEqual(extractFacts(translated).sectionRefs, [{ code: "IPC", section: "379" }]);
});
