import test from "node:test";
import assert from "node:assert/strict";

import { analyzeQuery } from "../backend/core/pipeline.js";

test("complete pipeline returns grounded post-commencement mapping", () => {
  const result = analyzeQuery(
    "On 12 July 2024, a person was deceived and dishonestly induced to deliver property under IPC section 420.",
  );

  assert.equal(result.gate.route, "BNS_PRIMARY");
  assert.equal(result.retrieved[0].id, "bns-318");
  assert.equal(result.retrieved[0].source.file, "bns-2023-official-gazette.pdf");
  assert.ok(Number.isInteger(result.retrieved[0].source.page));
  assert.ok(result.irac.conclusion.length > 0);
  assert.equal(result.verifier.status, "PASSED");
});

test("complete pipeline rejects an empty query", () => {
  assert.throws(() => analyzeQuery("   "), /query is required/i);
});
