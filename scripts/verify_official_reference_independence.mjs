import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const builderPath = resolve(root, "scripts/build_official_source_references.mjs");
const predictionPath = resolve(root, "evaluation/runs/blind-predictions.json");
const referencePath = resolve(root, "evaluation/official-source-reference-evaluation/official-source-reference-labels.json");
const reportPath = resolve(root, "evaluation/official-source-reference-evaluation/official-source-reference-report.json");
const outputPath = resolve(root, "evaluation/official-source-reference-evaluation/independence-verification.json");

const builderSource = await readFile(builderPath, "utf8");
const predictionText = await readFile(predictionPath, "utf8");
const referenceText = await readFile(referencePath, "utf8");
const reportText = await readFile(reportPath, "utf8");
const predictions = JSON.parse(predictionText);
const references = JSON.parse(referenceText);
const report = JSON.parse(reportText);

const expectedPredictionFileSha256 = "869c7f716261a2080592ba53f06f2e5e86c9907e78309607d5661e645252e91d";
const actualPredictionFileSha256 = hash(predictionText);
const { sealSha256, ...predictionPayload } = predictions;
const internalSealValid = hash(JSON.stringify(predictionPayload, null, 2)) === sealSha256;

const expectedInputs = [
  "evaluation/cases/candidate-cases.jsonl",
  "backend/data/statutes.json",
  "legal-sources/manifest.json",
];
const declaredInputs = references.permittedCreationInputs.map((item) => item.path);
const builderReadBoundaryValid = [
  "readFile(casesPath",
  "readFile(statutesPath",
  "readFile(manifestPath",
].every((fragment) => builderSource.includes(fragment))
  && !/readFile\([^)]*(prediction|blind-predictions)/i.test(builderSource)
  && !/from\s+["'][^"']*(pipeline|retriever|run_blind_evaluation)/i.test(builderSource);
const declaredInputsValid = JSON.stringify(declaredInputs) === JSON.stringify(expectedInputs);
const reportUsesReferenceFile = report.referenceFileSha256 === hash(referenceText);

const verification = {
  verificationType: "PROCEDURAL_INDEPENDENCE_CHECK",
  scope: "Checks the reference-label builder's file-read boundary, declared creation inputs, prediction seal, immutable prediction-file checksum, and report/reference linkage. This is a reproducibility check, not an external audit or expert validation.",
  independentFromModelPredictionsWithinImplementedWorkflow: builderReadBoundaryValid && declaredInputsValid,
  checks: {
    builderReadsOnlyDeclaredReferenceInputs: builderReadBoundaryValid,
    declaredCreationInputsMatchAllowlist: declaredInputsValid,
    blindPredictionInternalSealValid: internalSealValid,
    blindPredictionFileChecksumUnchanged: actualPredictionFileSha256 === expectedPredictionFileSha256,
    reportLinkedToCurrentReferenceFile: reportUsesReferenceFile,
  },
  blindPredictionFileSha256: actualPredictionFileSha256,
  blindPredictionInternalSealSha256: sealSha256,
  officialReferenceFileSha256: hash(referenceText),
  reportFileSha256: hash(reportText),
};

if (Object.values(verification.checks).some((value) => !value)) {
  throw new Error(`Official-reference independence verification failed: ${JSON.stringify(verification.checks)}`);
}

await writeFile(outputPath, `${JSON.stringify(verification, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outputPath, ...verification.checks }, null, 2));

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}
