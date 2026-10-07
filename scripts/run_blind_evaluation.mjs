import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { analyzeQuery } from "../backend/core/pipeline.js";

const FORBIDDEN_CASE_FIELDS = new Set([
  "acceptedCitations",
  "acceptedProvisions",
  "applicableLaw",
  "expected",
  "gold",
  "iracReview",
  "label",
  "labels",
  "route"
]);

const casesPath = resolve(process.argv[2] || "evaluation/cases/candidate-cases.jsonl");
const outputPath = resolve(process.argv[3] || "evaluation/runs/blind-predictions.json");

if (existsSync(outputPath)) {
  throw new Error(`Prediction file already exists and is sealed: ${outputPath}`);
}

const caseFile = await readFile(casesPath, "utf8");
const cases = parseJsonLines(caseFile, casesPath);
validateCases(cases);

const predictions = cases.map((item) => {
  const result = analyzeQuery(item.facts);
  return {
    caseId: item.caseId,
    extractedFacts: result.facts,
    applicableRoute: result.gate.route,
    routeMessage: result.gate.message,
    reviewRequired: result.gate.reviewRequired,
    retrieved: result.retrieved.map((record) => ({
      rank: result.retrieved.indexOf(record) + 1,
      id: record.id,
      code: record.code,
      section: record.section,
      title: record.title,
      citation: {
        document: record.source.document,
        authority: record.source.authority,
        file: record.source.file,
        page: record.source.page,
        sha256: record.source.sha256
      }
    })),
    irac: result.irac,
    verifier: result.verifier
  };
});

const payload = {
  protocol: "blind-legal-evaluation-v1",
  generatedAt: new Date().toISOString(),
  casesPath,
  caseFileSha256: hash(caseFile),
  caseCount: cases.length,
  labelAccess: "No label file is imported or accepted by this command.",
  predictions
};

const sealed = { ...payload, sealSha256: hash(JSON.stringify(payload, null, 2)) };
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(sealed, null, 2)}\n`, "utf8");

console.log(JSON.stringify({ outputPath, caseCount: cases.length, sealSha256: sealed.sealSha256 }, null, 2));

function parseJsonLines(text, path) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`Invalid JSON at ${path}:${index + 1}`);
      }
    });
}

function validateCases(items) {
  if (!items.length) throw new Error("At least one blind case is required.");
  const ids = new Set();
  for (const [index, item] of items.entries()) {
    if (!item.caseId || !item.facts) throw new Error(`Case ${index + 1} requires caseId and facts.`);
    if (ids.has(item.caseId)) throw new Error(`Duplicate caseId: ${item.caseId}`);
    ids.add(item.caseId);
    for (const field of Object.keys(item)) {
      if (FORBIDDEN_CASE_FIELDS.has(field)) {
        throw new Error(`Blind case ${item.caseId} contains prohibited label field: ${field}`);
      }
    }
  }
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}
