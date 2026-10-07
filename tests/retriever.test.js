import test from "node:test";
import assert from "node:assert/strict";

import { extractFacts } from "../backend/core/dateExtractor.js";
import { routeByTemporalGate } from "../backend/core/gateway.js";
import { retrieveStatutes } from "../backend/core/retriever.js";
import { synthesizeIrac } from "../backend/core/synthesizer.js";
import { verifyGrounding } from "../backend/core/verifier.js";

test("blocks BNS documents for pre-transition routing", () => {
  const query = "The alleged act happened on 2024-06-20 and concerns theft of movable property under IPC 379.";
  const facts = extractFacts(query);
  const gate = routeByTemporalGate(facts);
  const results = retrieveStatutes(query, facts, gate);

  assert.ok(results.length > 0);
  assert.ok(results.every((doc) => doc.code === "IPC"));
});

test("keeps explicit section references at high retrieval priority", () => {
  const query = "The alleged act happened on 2024-06-20 and concerns theft of movable property under IPC 379.";
  const facts = extractFacts(query);
  const gate = routeByTemporalGate(facts);
  const results = retrieveStatutes(query, facts, gate);

  assert.equal(results[0].code, "IPC");
  assert.equal(results[0].section, "379");
});

test("ranks IPC theft provisions above unrelated consent exceptions for strong theft facts", () => {
  const query = "On 20 June 2024, property was dishonestly moved out of another person's possession without consent.";
  const facts = extractFacts(query);
  const gate = routeByTemporalGate(facts);
  const results = retrieveStatutes(query, facts, gate, 5);
  const ids = results.map((result) => result.id);

  assert.equal(results[0].id, "ipc-378");
  assert.ok(ids.includes("ipc-379"));
  assert.ok(ids.indexOf("ipc-378") < ids.indexOf("ipc-92"));
  assert.ok(!ids.slice(0, 2).some((id) => ["ipc-92", "ipc-89", "ipc-88"].includes(id)));
});

test("ranks BNS theft provision for post-transition theft facts", () => {
  const query = "On 12 July 2024, movable property was dishonestly taken from another person's possession without consent.";
  const facts = extractFacts(query);
  const gate = routeByTemporalGate(facts);
  const results = retrieveStatutes(query, facts, gate);

  assert.equal(results[0].code, "BNS");
  assert.equal(results[0].section, "303");
});

test("stole a mobile phone and took it without permission rank theft in the date-allowed corpus", () => {
  for (const [date, code, sections] of [
    ["2024-06-20", "IPC", ["378", "379"]],
    ["2024-07-10", "BNS", ["303"]]
  ]) {
    for (const factsText of [
      "a person stole another person's mobile phone without permission",
      "a person took another person's mobile phone without permission"
    ]) {
      const query = `${date} ${factsText}.`;
      const facts = extractFacts(query);
      const results = retrieveStatutes(query, facts, routeByTemporalGate(facts));
      assert.ok(results.every(doc => doc.code === code));
      assert.ok(sections.includes(results[0].section), query);
      assert.ok(facts.legalPhrases.includes("without permission"));
    }
  }
});

test("does not reduce mobile to mob during keyword extraction", () => {
  const facts = extractFacts("mobile phone theft on 20 June 2024");

  assert.ok(facts.keywords.includes("theft"));
  assert.ok(facts.legalPhrases.includes("mobile phone"));
  assert.ok(!facts.keywords.includes("mob"));
});

test("keeps strong mobile-phone theft matches above unrelated consent exceptions", () => {
  const query = "mobile phone was taken without consent on 20 June 2024";
  const facts = extractFacts(query);
  const gate = routeByTemporalGate(facts);
  const results = retrieveStatutes(query, facts, gate, 5);
  const ids = results.map((result) => result.id);

  assert.equal(results[0].id, "ipc-378");
  assert.ok(ids.indexOf("ipc-379") < ids.indexOf("ipc-92"));
  assert.ok(!ids.slice(0, 2).some((id) => ["ipc-92", "ipc-89", "ipc-88"].includes(id)));
});

test("recognizes mobile-phone theft with possessive consent and possession wording", () => {
  const query = "On 20 June 2024, A took B's mobile phone from his possession without B's consent with the intention of keeping it. Which law and section apply?";
  const facts = extractFacts(query);
  const gate = routeByTemporalGate(facts);
  const results = retrieveStatutes(query, facts, gate, 5);
  const ids = results.map((result) => result.id);

  assert.equal(gate.route, "IPC_ONLY");
  assert.ok(facts.keywords.includes("took"));
  assert.ok(facts.legalPhrases.includes("mobile phone"));
  assert.ok(facts.legalPhrases.includes("from possession"));
  assert.ok(facts.legalPhrases.includes("without consent"));
  assert.ok(ids.includes("ipc-378"));
  assert.ok(ids.includes("ipc-379"));
  assert.ok(ids.indexOf("ipc-378") < ids.indexOf("ipc-92"));
  assert.ok(ids.indexOf("ipc-379") < ids.indexOf("ipc-92"));
  assert.ok(!ids.slice(0, 3).some((id) => ["ipc-92", "ipc-474", "ipc-119"].includes(id)));
});

test("victim-reported stolen property surfaces theft without suppressing receiving-stolen-property cases", () => {
  const theft = analyzeRetrieval("On 20 June 2024, my cell phone was stolen.");
  assert.ok(["ipc-378", "ipc-379"].includes(theft[0].id));
  const receiving = analyzeRetrieval("On 20 June 2024, a person was found in possession of stolen property.");
  assert.ok(!["ipc-378", "ipc-379"].includes(receiving[0].id));
  const purchase = analyzeRetrieval("On 20 June 2024, my friend bought a phone that was stolen.");
  assert.ok(!["ipc-378", "ipc-379"].includes(purchase[0].id));
});

function analyzeRetrieval(query) {
  const facts = extractFacts(query);
  return retrieveStatutes(query, facts, routeByTemporalGate(facts));
}

test("keeps consent exception retrieval for non-theft medical consent facts", () => {
  const query = "On 20 June 2024, a surgeon acted in good faith for a person's benefit without consent during an emergency.";
  const facts = extractFacts(query);
  const gate = routeByTemporalGate(facts);
  const results = retrieveStatutes(query, facts, gate, 5);
  const ids = results.map((result) => result.id);

  assert.ok(ids.includes("ipc-92"));
  assert.ok(!ids.slice(0, 3).some((id) => ["ipc-378", "ipc-379"].includes(id)));
});

test("keeps forged-document possession retrieval separate from theft", () => {
  const query = "On 20 June 2024, a person had possession of a forged document described in section 467 and intended to use it as genuine.";
  const facts = extractFacts(query);
  const gate = routeByTemporalGate(facts);
  const results = retrieveStatutes(query, facts, gate, 5);
  const ids = results.map((result) => result.id);

  assert.equal(results[0].id, "ipc-474");
  assert.ok(!ids.slice(0, 3).some((id) => ["ipc-378", "ipc-379"].includes(id)));
});

test("keeps public-servant concealment retrieval separate from theft", () => {
  const query = "On 20 June 2024, a public servant concealed a design to commit an offence which it was his duty to prevent.";
  const facts = extractFacts(query);
  const gate = routeByTemporalGate(facts);
  const results = retrieveStatutes(query, facts, gate, 5);
  const ids = results.map((result) => result.id);

  assert.equal(results[0].id, "ipc-119");
  assert.ok(!ids.slice(0, 3).some((id) => ["ipc-378", "ipc-379"].includes(id)));
});

test("prioritizes BNS documents after commencement", () => {
  const query = "The offense took place on 2024-07-12 and concerns organized crime by a syndicate.";
  const facts = extractFacts(query);
  const gate = routeByTemporalGate(facts);
  const results = retrieveStatutes(query, facts, gate);

  assert.equal(results[0].code, "BNS");
  assert.equal(results[0].section, "111");
});

test("maps an explicit IPC reference to its official BNS counterpart", () => {
  const query = "The offense took place on 2024-07-12 and concerns cheating under IPC 420.";
  const facts = extractFacts(query);
  const gate = routeByTemporalGate(facts);
  const results = retrieveStatutes(query, facts, gate);

  assert.equal(results[0].code, "BNS");
  assert.equal(results[0].section, "318");
  assert.ok(results[0].mapsTo.includes("ipc-420"));
});

test("ranks BNS cheating for post-transition deception and dishonest inducement facts", () => {
  const query = "On 12 July 2024, a person was deceived and dishonestly induced to deliver property.";
  const facts = extractFacts(query);
  const gate = routeByTemporalGate(facts);
  const results = retrieveStatutes(query, facts, gate, 5);

  assert.ok(facts.legalPhrases.includes("dishonestly induced"));
  assert.ok(facts.legalPhrases.includes("deliver property"));
  assert.equal(gate.route, "BNS_PRIMARY");
  assert.equal(results[0].id, "bns-318");
});

test("ranks BNS cheating for translated deception and property-transfer variants", () => {
  const queries = [
    "On 10 July 2024, a person was deceived into giving property unjustly.",
    "On 10 July 2024, a person was tricked into giving property.",
    "On 10 July 2024, a person was deceived and led to hand over property in disloyalty.",
    "On 10 July 2024, a person was deceived into giving property in a dishonest manner.",
    "On 10 July 2024, he cheated on someone and made them give him false property.",
    "On 10 July 2024, the accused deceived a person and unfairly transferred property.",
    "On 10 July 2024, the accused defrauded a person and handed over property with bail.",
    "On 10 July 2024, a defendant was charged with defrauding and forcing him to unjustly sell property.",
    "On 10 July 2024, the accused deceived a man by treasonfully taking property."
  ];

  for (const query of queries) {
    const facts = extractFacts(query);
    const gate = routeByTemporalGate(facts);
    const results = retrieveStatutes(query, facts, gate, 5);

    assert.equal(gate.route, "BNS_PRIMARY");
    assert.ok(facts.concepts.includes("cheating"));
    assert.equal(results[0].id, "bns-318");
  }
});

test("does not treat ordinary giving or unrelated deception as cheating", () => {
  const delivery = analyzeRetrieval("On 10 July 2024, a person gave property after a normal sale agreement.");
  const transfer = analyzeRetrieval("On 10 July 2024, a person transferred property under a registered agreement.");
  const sale = analyzeRetrieval("On 10 July 2024, a person sold property after negotiation.");
  const taking = analyzeRetrieval("On 10 July 2024, a person took property for storage with permission.");
  const nonPropertyDeception = analyzeRetrieval("On 10 July 2024, a person lied about his age.");

  assert.notEqual(delivery[0].id, "bns-318");
  assert.notEqual(transfer[0].id, "bns-318");
  assert.notEqual(sale[0].id, "bns-318");
  assert.notEqual(taking[0].id, "bns-318");
  assert.notEqual(nonPropertyDeception[0].id, "bns-318");
});

test("ranks IPC cheating for pre-transition deception and dishonest inducement facts", () => {
  const query = "On 20 June 2024, a person was deceived and dishonestly induced to deliver property.";
  const facts = extractFacts(query);
  const gate = routeByTemporalGate(facts);
  const results = retrieveStatutes(query, facts, gate, 5);
  const ids = results.map((result) => result.id);

  assert.equal(gate.route, "IPC_ONLY");
  assert.equal(results[0].id, "ipc-420");
  assert.ok(ids.includes("ipc-415"));
});

test("does not treat delivery alone as a cheating fact pattern", () => {
  const query = "On 20 June 2024, a person delivered counterfeit coin to another person.";
  const facts = extractFacts(query);
  const gate = routeByTemporalGate(facts);
  const results = retrieveStatutes(query, facts, gate, 5);

  assert.ok(facts.keywords.some((keyword) => ["deliver", "delivered", "delivering", "delivers", "delivery"].includes(keyword)));
  assert.notEqual(results[0].id, "ipc-420");
});

test("every result is traceable to an official government legal file", () => {
  const query = "The offense took place on 2024-07-12 and concerns theft.";
  const facts = extractFacts(query);
  const gate = routeByTemporalGate(facts);

  for (const result of retrieveStatutes(query, facts, gate)) {
    assert.match(result.source.authority, /(Government of India|Gazette of India)/);
    assert.match(result.source.url, /^https:\/\/(www\.mha\.gov\.in|bprd\.nic\.in|cdn\.ncw\.gov\.in)\//);
    assert.match(result.source.sha256, /^[a-f0-9]{64}$/);
  }
});

test("retrieval excludes repealed provisions and returns bounded excerpts", () => {
  const query = "The act happened on 2024-06-20 and concerns movable property.";
  const facts = extractFacts(query);
  const gate = routeByTemporalGate(facts);

  for (const result of retrieveStatutes(query, facts, gate)) {
    assert.doesNotMatch(`${result.title} ${result.text.slice(0, 80)}`, /\brepealed\b|\[repealed\]/i);
    assert.ok(result.excerpt.length <= 563);
  }
});

test("flags the BNS section 106 commencement exception", () => {
  const query = "The offence occurred on 2024-07-12 and concerns causing death by negligence under BNS 106.";
  const facts = extractFacts(query);
  const gate = routeByTemporalGate(facts);
  const results = retrieveStatutes(query, facts, gate);
  const irac = synthesizeIrac(query, facts, gate, results);
  const verifier = verifyGrounding(irac, gate, results);

  assert.equal(results[0].section, "106");
  assert.equal(verifier.status, "NEEDS_REVIEW");
  assert.match(verifier.warnings.join(" "), /sub-section \(2\)/i);
});

test("retrieves both IPC and BNS cheating provisions for a spanning period", () => {
  const query = "The conduct continued from 20 June 2024 until 12 July 2024 and involved cheating.";
  const facts = extractFacts(query);
  const gate = routeByTemporalGate(facts);
  const results = retrieveStatutes(query, facts, gate);
  const ids = results.map((result) => result.id);

  assert.ok(ids.includes("ipc-415"));
  assert.ok(ids.includes("bns-318"));
});

test("surfaces BNS cheating support for multi-period deceptive delivery facts", () => {
  const query = "A deceptive course of conduct continued from 20 June 2024 until 12 July 2024 and caused delivery of property.";
  const facts = extractFacts(query);
  const gate = routeByTemporalGate(facts);
  const results = retrieveStatutes(query, facts, gate, 5);
  const ids = results.map((result) => result.id);

  assert.equal(gate.route, "MULTI_PERIOD_REVIEW");
  assert.ok(facts.keywords.includes("deceptive"));
  assert.ok(facts.legalPhrases.includes("delivery of property"));
  assert.ok(ids.includes("ipc-420"));
  assert.ok(ids.includes("bns-318"));
});

test("generalizes multi-period cheating support beyond one wording", () => {
  const query = "The deceptive conduct continued from 20 June 2024 until 12 July 2024 and resulted in delivery of property.";
  const facts = extractFacts(query);
  const gate = routeByTemporalGate(facts);
  const results = retrieveStatutes(query, facts, gate, 5);
  const ids = results.map((result) => result.id);

  assert.equal(gate.route, "MULTI_PERIOD_REVIEW");
  assert.ok(ids.includes("bns-318"));
});

test("does not force non-deceptive multi-period delivery facts into cheating", () => {
  const query = "A courier delivery of property continued from 20 June 2024 until 12 July 2024 after a contract dispute.";
  const facts = extractFacts(query);
  const gate = routeByTemporalGate(facts);
  const results = retrieveStatutes(query, facts, gate, 5);

  assert.equal(gate.route, "MULTI_PERIOD_REVIEW");
  assert.ok(!facts.keywords.includes("deceptive"));
  assert.ok(!results.slice(0, 3).some((result) => result.id === "bns-318"));
});

test("ranks BNS hurt provisions for post-transition serious injury facts without assuming grievous hurt", () => {
  const query = "On 10 July 2024, the accused seriously injured another person.";
  const facts = extractFacts(query);
  const gate = routeByTemporalGate(facts);
  const results = retrieveStatutes(query, facts, gate, 5);
  const ids = results.map((result) => result.id);

  assert.equal(gate.route, "BNS_PRIMARY");
  assert.ok(facts.keywords.includes("injured"));
  assert.ok(facts.legalPhrases.includes("seriously injured"));
  assert.equal(results[0].id, "bns-115");
  assert.ok(ids.includes("bns-114"));
  assert.ok(!ids.slice(0, 3).some((id) => ["bns-232", "bns-351", "bns-126", "bns-127"].includes(id)));
});

test("generalized injury concepts keep hurt provisions above unrelated threats", () => {
  const queries = [
    "On 10 July 2024, the accused caused bodily pain to another person.",
    "On 10 July 2024, the accused wounded another person.",
    "On 10 July 2024, the accused beat another person and caused injury.",
    "On 10 July 2024, the accused hit another person and caused physical injury.",
    "On 10 July 2024, the accused attacked another person causing bodily harm."
  ];

  for (const query of queries) {
    const facts = extractFacts(query);
    const gate = routeByTemporalGate(facts);
    const results = retrieveStatutes(query, facts, gate, 5);
    const ids = results.map((result) => result.id);

    assert.equal(gate.route, "BNS_PRIMARY");
    assert.ok(facts.concepts.includes("hurt"));
    assert.ok(["bns-115", "bns-114"].includes(results[0].id));
    assert.ok(ids.includes("bns-114"));
    assert.ok(!ids.slice(0, 3).some((id) => ["bns-232", "bns-351", "bns-126", "bns-127"].includes(id)));
  }
});

test("does not treat non-bodily harm or threat wording as hurt", () => {
  const economic = analyzeRetrieval("On 10 July 2024, the accused caused economic harm through deception.");
  const threat = analyzeRetrieval("On 10 July 2024, the accused threatened another person.");

  assert.ok(!["bns-114", "bns-115", "bns-117"].includes(economic[0].id));
  assert.ok(!["bns-114", "bns-115", "bns-117"].includes(threat[0].id));
});

test("ranks IPC hurt provisions for pre-transition serious injury facts without assuming grievous hurt", () => {
  const query = "On 10 June 2024, the accused seriously injured another person.";
  const facts = extractFacts(query);
  const gate = routeByTemporalGate(facts);
  const results = retrieveStatutes(query, facts, gate, 5);
  const ids = results.map((result) => result.id);

  assert.equal(gate.route, "IPC_ONLY");
  assert.equal(results[0].id, "ipc-321");
  assert.ok(ids.includes("ipc-319"));
  assert.ok(!ids.slice(0, 3).some((id) => ["ipc-189", "ipc-190"].includes(id)));
});

test("explicit grievous hurt wording can still surface grievous hurt provisions", () => {
  const query = "On 10 July 2024, the accused voluntarily caused grievous hurt to another person.";
  const facts = extractFacts(query);
  const gate = routeByTemporalGate(facts);
  const results = retrieveStatutes(query, facts, gate, 5);
  const ids = results.map((result) => result.id);

  assert.equal(gate.route, "BNS_PRIMARY");
  assert.ok(facts.legalPhrases.includes("grievous hurt"));
  assert.equal(results[0].id, "bns-117");
  assert.ok(ids.includes("bns-116"));
});

test("explicit hurt section references still use the official IPC-BNS mapping", () => {
  const query = "The offence occurred on 2024-07-12. Causing grievous hurt by dangerous weapons. The legacy reference is IPC 326.";
  const facts = extractFacts(query);
  const gate = routeByTemporalGate(facts);
  const results = retrieveStatutes(query, facts, gate, 5);

  assert.equal(gate.route, "BNS_PRIMARY");
  assert.equal(results[0].id, "bns-118");
});
