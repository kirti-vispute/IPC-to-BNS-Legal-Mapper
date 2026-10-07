import corpus from "../backend/data/statutes.json" with { type: "json" };
import mappings from "../backend/data/ipc-bns-mappings.json" with { type: "json" };

import { extractFacts } from "../backend/core/dateExtractor.js";
import { routeByTemporalGate } from "../backend/core/gateway.js";
import { retrieveStatutes } from "../backend/core/retriever.js";

const availableIds = new Set(corpus.map((record) => record.id));
const eligible = mappings.filter(
  (mapping) => availableIds.has(`ipc-${mapping.ipc.toLowerCase()}`) && availableIds.has(`bns-${mapping.bns.toLowerCase()}`)
);

const postResults = eligible.map((mapping) =>
  evaluate(
    `The offence occurred on 2024-07-12. ${mapping.offence}. The legacy reference is IPC ${mapping.ipc}.`,
    `bns-${mapping.bns.toLowerCase()}`
  )
);

const preResults = eligible.map((mapping) =>
  evaluate(
    `The offence occurred on 2024-06-20. ${mapping.offence}. The applicable reference is IPC ${mapping.ipc}.`,
    `ipc-${mapping.ipc.toLowerCase()}`
  )
);

const report = {
  methodology: "Queries and expected section pairs are derived from the official BPR&D IPC-BNS comparative chart.",
  eligibleOfficialMappings: eligible.length,
  excludedMappingsMissingAParsedSection: mappings.length - eligible.length,
  postCommencementBnsRetrieval: summarize(postResults),
  preCommencementIpcRetrieval: summarize(preResults),
  limitations: [
    "This is a retrieval benchmark, not an independent legal-correctness evaluation.",
    "The expected answers come from the same official crosswalk used by the retrieval system.",
    "A separate expert-labelled blind test set is required for a defensible real-world accuracy claim."
  ]
};

console.log(JSON.stringify(report, null, 2));

function evaluate(query, expectedId) {
  const facts = extractFacts(query);
  const gate = routeByTemporalGate(facts);
  const retrieved = retrieveStatutes(query, facts, gate, 3);
  const ids = retrieved.map((record) => record.id);
  return {
    expectedId,
    top1: ids[0] === expectedId,
    top3: ids.includes(expectedId)
  };
}

function summarize(results) {
  const top1Correct = results.filter((result) => result.top1).length;
  const top3Correct = results.filter((result) => result.top3).length;
  return {
    cases: results.length,
    top1Correct,
    top1AccuracyPercent: percentage(top1Correct, results.length),
    top3Correct,
    top3RecallPercent: percentage(top3Correct, results.length)
  };
}

function percentage(value, total) {
  return total ? Number(((value / total) * 100).toFixed(2)) : 0;
}
