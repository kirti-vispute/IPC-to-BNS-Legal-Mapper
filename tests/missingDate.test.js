import test from "node:test";
import assert from "node:assert/strict";
import { analyzeQuery } from "../backend/core/pipeline.js";
import { extractFacts } from "../backend/core/dateExtractor.js";
import { routeByTemporalGate } from "../backend/core/gateway.js";
import { retrieveStatutes } from "../backend/core/retriever.js";
import { synthesizeIrac } from "../backend/core/synthesizer.js";
import { verifyGrounding } from "../backend/core/verifier.js";

test("missing-date theft returns both-corpus candidates without a governing law or IRAC", () => {
  const a = analyzeQuery("A person dishonestly took another person's mobile phone without consent.");
  assert.equal(a.facts.offenseDate, null);
  assert.deepEqual(a.facts.dates, []);
  assert.equal(a.gate.route, "CLARIFY");
  assert.deepEqual(a.gate.allowedCodes, []);
  assert.equal(a.gate.applicability, "UNDETERMINED");
  assert.equal(a.candidateOnly, true);
  assert.equal(a.irac, null);
  assert.equal(a.verifier.status, "NEEDS_REVIEW");
  assert.match(a.verifier.warnings.join(" "), /Please state the date/);
  for (const id of ["ipc-378", "ipc-379", "bns-303"]) assert.ok(a.retrieved.some(d => d.id === id));
  for (const doc of a.retrieved) {
    assert.ok(doc.source.file.endsWith(".pdf"));
    assert.ok(Number.isInteger(doc.source.page));
    assert.match(doc.source.sha256, /^[a-f0-9]{64}$/);
  }
  assert.match(a.candidateSummary, /applicability remains undetermined/);
});

test("missing-date cheating surfaces IPC and BNS through existing ranking", () => {
  const a = analyzeQuery("A person was deceived and dishonestly induced to deliver property.");
  for (const id of ["ipc-415", "ipc-420", "bns-318"]) assert.ok(a.retrieved.some(d => d.id === id));
  assert.equal(a.gate.applicability, "UNDETERMINED");
});

test("missing-date explicit section references retain per-corpus priority without applicability", () => {
  for (const [query, id, code] of [["Theft under IPC 379.", "ipc-379", "IPC"], ["Cheating under BNS 318.", "bns-318", "BNS"]]) {
    const a = analyzeQuery(query);
    assert.equal(a.retrieved.filter(d => d.code === code)[0].id, id);
    assert.equal(a.gate.applicability, "UNDETERMINED");
    assert.deepEqual(a.gate.allowedCodes, []);
  }
});

test("missing-date candidate lists exactly reuse per-corpus retrieval scores and order", () => {
  const query = "Theft of movable property without consent.";
  const a = analyzeQuery(query);
  const expected = ["IPC", "BNS"].flatMap(code => retrieveStatutes(query, a.facts, { route: code === "IPC" ? "IPC_ONLY" : "BNS_PRIMARY", allowedCodes: [code] }));
  assert.deepEqual(a.retrieved, expected);
});

test("dated and multi-period paths remain identical to their existing orchestration", () => {
  for (const [query, route] of [
    ["The theft occurred on 20 June 2024 under IPC 379.", "IPC_ONLY"],
    ["The theft occurred on 15 August 2024.", "BNS_PRIMARY"],
    ["The conduct continued from 20 June 2024 until 10 July 2024 and involved cheating.", "MULTI_PERIOD_REVIEW"],
    ["The theft occurred on 2024-06-20 under IPC 379.", "IPC_ONLY"]
  ]) {
    const a = analyzeQuery(query);
    const facts = extractFacts(query), gate = routeByTemporalGate(facts);
    const retrieved = retrieveStatutes(query, facts, gate);
    const irac = synthesizeIrac(query, facts, gate, retrieved);
    assert.equal(a.gate.route, route);
    assert.deepEqual(a.gate, gate);
    assert.deepEqual(a.retrieved, retrieved);
    assert.deepEqual(a.irac, irac);
    assert.deepEqual(a.verifier, verifyGrounding(irac, gate, retrieved));
    if (route === "IPC_ONLY") assert.ok(a.retrieved.every(d => d.code === "IPC"));
    if (route === "BNS_PRIMARY") assert.ok(a.retrieved.every(d => d.code === "BNS"));
    assert.equal(a.candidateOnly, undefined);
  }
});

test("ambiguous dated clarification does not enter the missing-date preview", () => {
  const a = analyzeQuery("The conduct continued from 20 June 2024 until 25 June 2024 and involved theft.");
  assert.equal(a.gate.route, "CLARIFY");
  assert.equal(a.candidateOnly, undefined);
  assert.deepEqual(a.retrieved, []);
});
