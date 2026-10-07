import test from "node:test";
import assert from "node:assert/strict";

import { extractFacts } from "../backend/core/dateExtractor.js";
import { routeByTemporalGate } from "../backend/core/gateway.js";

test("routes pre-transition offense to IPC only", () => {
  const facts = extractFacts("The theft happened on 2024-06-30 under IPC 379.");
  const gate = routeByTemporalGate(facts);

  assert.equal(gate.route, "IPC_ONLY");
  assert.deepEqual(gate.allowedCodes, ["IPC"]);
});

test("routes commencement-date offense to BNS primary", () => {
  const facts = extractFacts("The theft happened on 2024-07-01.");
  const gate = routeByTemporalGate(facts);

  assert.equal(gate.route, "BNS_PRIMARY");
  assert.deepEqual(gate.allowedCodes, ["BNS", "IPC"]);
});

test("flags continuing conduct spanning the transition", () => {
  const facts = extractFacts("The conduct started on 2024-06-20 and continued until 2024-07-03.");
  const gate = routeByTemporalGate(facts);

  assert.equal(gate.route, "MULTI_PERIOD_REVIEW");
  assert.equal(gate.reviewRequired, true);
});

test("requires clarification when offense date is absent", () => {
  const facts = extractFacts("The case involves cheating and dishonest delivery of property.");
  const gate = routeByTemporalGate(facts);

  assert.equal(gate.route, "CLARIFY");
  assert.equal(gate.reviewRequired, true);
});
