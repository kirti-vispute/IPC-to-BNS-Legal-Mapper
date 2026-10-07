import test from "node:test";
import assert from "node:assert/strict";

import { extractFacts } from "../backend/core/dateExtractor.js";
import { routeByTemporalGate } from "../backend/core/gateway.js";

test("extracts ISO, Indian numeric, and written dates", () => {
  const cases = [
    ["The offence occurred on 2024-06-20.", "2024-06-20"],
    ["The offence occurred on 20/06/2024.", "2024-06-20"],
    ["The offence occurred on June 20, 2024.", "2024-06-20"],
    ["The offence occurred on 20 June 2024.", "2024-06-20"]
  ];

  for (const [query, expected] of cases) {
    assert.equal(extractFacts(query).offenseDate, expected);
  }
});

test("rejects an invalid calendar date", () => {
  assert.equal(extractFacts("The offence occurred on 2024-02-31.").offenseDate, null);
});

test("routes a continuing offence spanning commencement to review", () => {
  const facts = extractFacts("The conduct continued from 20 June 2024 until 12 July 2024.");
  assert.equal(routeByTemporalGate(facts).route, "MULTI_PERIOD_REVIEW");
});
