import test from "node:test";
import assert from "node:assert/strict";
import { analyzeQuery } from "../backend/core/pipeline.js";
import { getCorpus } from "../backend/core/retriever.js";

test("phone-taking and owner-consent paraphrases rank theft within the date-selected corpus", () => {
  for (const [date, family] of [["2024-06-20", ["ipc-378", "ipc-379"]], ["2024-07-10", ["bns-303"]]]) {
    for (const text of [
      "a phone was stolen without permission",
      "someone stole a cell phone",
      "one person took his cell phone and kept it with him without the other's permission",
      "one person took his mobile phone without the permission of another person",
      "a man took his cell phone and put it in his hands without permission",
      "someone took his cell phone and put it in his hand without someone else's permission",
      "one person took another person 's phone without that person 's consent"
    ]) {
      const result = analyzeQuery(`${date} ${text}`);
      assert.ok(family.includes(result.retrieved[0].id), `${text}: ${result.retrieved[0].id}`);
      assert.ok(!result.facts.keywords.includes("mob"));
    }
  }
});

test("intentional death facts surface both definition provisions with review rather than choosing a unique offence", () => {
  for (const [date, ids] of [["2024-06-20", ["ipc-299", "ipc-300"]], ["2024-07-10", ["bns-100", "bns-101"]]]) {
    const result = analyzeQuery(`${date} The accused intentionally caused another person's death.`);
    assert.ok(ids.every(id => result.retrieved.some(doc => doc.id === id)));
    assert.equal(result.verifier.status, "NEEDS_REVIEW");
  }
  const medical = analyzeQuery("2024-06-20 A surgeon did not intentionally cause death and acted in good faith with consent.");
  assert.ok(!medical.facts.concepts.includes("intentional_death_review"));
});

test("stalking review uses a complete primary IPC supplement and respects IPC corpus isolation", () => {
  const doc = getCorpus().find(doc => doc.id === "ipc-354d");
  assert.equal(doc.recordType, "primary-statute-supplement");
  assert.match(doc.text, /Provided that/);
  assert.match(doc.text, /second or subsequent conviction/);
  assert.ok(!doc.text.includes("stalking: 81 Provided"));
  assert.equal(doc.source.page, 80);
  assert.equal(doc.source.endPage, 81);
  for (const [date, id] of [["2024-06-20", "ipc-354d"], ["2024-07-10", "bns-78"]]) {
    const result = analyzeQuery(`${date} A person repeatedly followed another person despite clear disinterest and monitored electronic communication.`);
    assert.equal(result.retrieved[0].id, id);
    assert.equal(result.verifier.status, "NEEDS_REVIEW");
  }
  const routine = analyzeQuery("2024-06-20 A network engineer monitored electronic communication to detect faults.");
  assert.ok(!routine.facts.concepts.includes("stalking_review"));
});

test("ambiguous retention surfaces property candidates with an explicit review warning", () => {
  const result = analyzeQuery("2024-06-20 a person left someone else's mobile phone with him without his consent");
  assert.ok(result.retrieved.some(doc => ["ipc-378", "ipc-379"].includes(doc.id)));
  assert.ok(result.retrieved.some(doc => doc.id === "ipc-403"));
  assert.equal(result.verifier.status, "NEEDS_REVIEW");
  assert.match(result.verifier.warnings.join(" "), /does not establish the taking action/);
});

test("short stolen report asks for factual review, while purchase, receipt and permitted borrowing get no theft boost", () => {
  const short = analyzeQuery("2024-06-20 Stolen.");
  assert.ok(["ipc-378", "ipc-379"].includes(short.retrieved[0].id));
  assert.equal(short.verifier.status, "NEEDS_REVIEW");
  for (const text of ["my friend bought a phone that was stolen", "a person received a stolen phone", "a person kept a phone with permission", "a doctor treated a person without the consent of another person"]) {
    const result = analyzeQuery(`2024-06-20 ${text}`);
    assert.ok(!["ipc-378", "ipc-379"].includes(result.retrieved[0].id), text);
  }
  assert.equal(analyzeQuery("2024-06-20 IPC 92 a phone was stolen without permission").retrieved[0].id, "ipc-92");
});
