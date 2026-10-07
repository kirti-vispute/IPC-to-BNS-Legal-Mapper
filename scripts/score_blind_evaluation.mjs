import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const [predictionArg, goldArg, reviewArg, outputArg] = process.argv.slice(2);
if (!predictionArg || !goldArg || !reviewArg) {
  throw new Error(
    "Usage: node scripts/score_blind_evaluation.mjs <sealed-predictions.json> <completed-gold-labels.jsonl> <completed-irac-reviews.jsonl> [report.json]",
  );
}

const predictionPath = resolve(predictionArg);
const goldPath = resolve(goldArg);
const reviewPath = resolve(reviewArg);
const outputPath = resolve(outputArg || "evaluation/runs/final-accuracy-report.json");

const predictionText = await readFile(predictionPath, "utf8");
const predictionFile = JSON.parse(predictionText);
verifyPredictionSeal(predictionFile);

const goldText = await readFile(goldPath, "utf8");
const reviewText = await readFile(reviewPath, "utf8");
const goldById = uniqueByCaseId(parseJsonLines(goldText, goldPath), "gold labels");
const reviewsById = uniqueByCaseId(parseJsonLines(reviewText, reviewPath), "IRAC reviews");
validateMatchingIds(predictionFile.predictions, goldById, "gold labels");
validateMatchingIds(predictionFile.predictions, reviewsById, "IRAC reviews");

for (const prediction of predictionFile.predictions) {
  validateGoldLabel(goldById.get(prediction.caseId));
  validateExpertReview(reviewsById.get(prediction.caseId));
}

const rows = predictionFile.predictions.map((prediction) =>
  scoreCase(prediction, goldById.get(prediction.caseId), reviewsById.get(prediction.caseId)),
);
const iracFields = ["issue", "rule", "application", "conclusion"];
const report = {
  protocol: predictionFile.protocol,
  generatedAt: new Date().toISOString(),
  predictionSealSha256: predictionFile.sealSha256,
  predictionFileSha256: hash(predictionText),
  goldLabelFileSha256: hash(goldText),
  iracReviewFileSha256: hash(reviewText),
  caseCount: rows.length,
  metrics: {
    applicableLawAccuracyPercent: percent(count(rows, "applicableLawCorrect"), rows.length),
    provisionTop1AccuracyPercent: percent(count(rows, "top1Correct"), rows.length),
    provisionTop3AllExpectedPresentPercent: percent(count(rows, "allExpectedTop3Present"), rows.length),
    provisionTop3RecallPercent: percent(sum(rows, "matchedTop3Count"), sum(rows, "expectedTop3Count")),
    citationCorrectnessPercent: ordinalPercent(rows.map((row) => row.citationCorrectness), {
      INCORRECT: 0,
      PARTIALLY_CORRECT: 1,
      CORRECT: 2,
    }),
    groundingExpertScorePercent: ordinalPercent(rows.map((row) => row.grounding), {
      UNGROUNDED: 0,
      PARTIALLY_GROUNDED: 1,
      GROUNDED: 2,
    }),
    iracAccuracyPercent: iracPercent(rows, iracFields),
    iracByComponentPercent: Object.fromEntries(
      iracFields.map((field) => [field, iracPercent(rows, [field])]),
    ),
  },
  cases: rows,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outputPath, caseCount: report.caseCount, metrics: report.metrics }, null, 2));

function scoreCase(prediction, gold, review) {
  const predicted = prediction.retrieved.slice(0, 3).map(provisionId);
  const expectedTop1 = gold.correctTop1Provision ? provisionId(gold.correctTop1Provision) : null;
  const expectedTop3 = gold.correctTop3Provisions.map(provisionId);
  const matchedTop3 = expectedTop3.filter((id) => predicted.includes(id));

  return {
    caseId: prediction.caseId,
    predictedApplicableLaw: prediction.applicableRoute,
    expectedApplicableLaw: gold.applicableLaw,
    applicableLawCorrect: prediction.applicableRoute === gold.applicableLaw,
    predictedTop1Provision: predicted[0] || null,
    expectedTop1Provision: expectedTop1,
    top1Correct: (predicted[0] || null) === expectedTop1,
    predictedTop3Provisions: predicted,
    expectedTop3Provisions: expectedTop3,
    matchedTop3Provisions: matchedTop3,
    matchedTop3Count: matchedTop3.length,
    expectedTop3Count: expectedTop3.length,
    allExpectedTop3Present: matchedTop3.length === expectedTop3.length,
    citationCorrectness: review.citationCorrectness,
    grounding: review.grounding,
    iracAccuracy: review.iracAccuracy,
    expertComments: {
      goldLabel: gold.expertComments,
      review: review.expertComments,
    },
  };
}

function validateGoldLabel(label) {
  const routes = new Set(["IPC_ONLY", "BNS_PRIMARY", "MULTI_PERIOD_REVIEW", "CLARIFY"]);
  if (!routes.has(label.applicableLaw)) incomplete(label.caseId, "applicableLaw");
  const noProvisionExpected = label.applicableLaw === "CLARIFY" && label.correctTop1Provision === null && label.correctTop3Provisions?.length === 0;
  if (noProvisionExpected) {
    if (typeof label.expertComments !== "string") incomplete(label.caseId, "expertComments");
    return;
  }
  validateProvision(label.correctTop1Provision, label.caseId, "correctTop1Provision");
  if (!Array.isArray(label.correctTop3Provisions) || label.correctTop3Provisions.length < 1 || label.correctTop3Provisions.length > 3) {
    incomplete(label.caseId, "correctTop3Provisions (provide 1 to 3 entries, or use no provisions with CLARIFY)");
  }
  label.correctTop3Provisions.forEach((value, index) =>
    validateProvision(value, label.caseId, `correctTop3Provisions[${index}]`),
  );
  const ids = label.correctTop3Provisions.map(provisionId);
  if (new Set(ids).size !== ids.length) throw new Error(`Duplicate Top-3 provision in ${label.caseId}.`);
  if (!ids.includes(provisionId(label.correctTop1Provision))) {
    throw new Error(`${label.caseId}: correctTop1Provision must also appear in correctTop3Provisions.`);
  }
  if (typeof label.expertComments !== "string") incomplete(label.caseId, "expertComments");
}

function validateExpertReview(review) {
  if (!["CORRECT", "PARTIALLY_CORRECT", "INCORRECT"].includes(review.citationCorrectness)) {
    incomplete(review.caseId, "citationCorrectness");
  }
  if (!["GROUNDED", "PARTIALLY_GROUNDED", "UNGROUNDED"].includes(review.grounding)) {
    incomplete(review.caseId, "grounding");
  }
  for (const field of ["issue", "rule", "application", "conclusion"]) {
    const value = review.iracAccuracy?.[field];
    if (!Number.isInteger(value) || value < 0 || value > 2) incomplete(review.caseId, `iracAccuracy.${field}`);
  }
  if (typeof review.expertComments !== "string") incomplete(review.caseId, "expertComments");
}

function validateProvision(value, caseId, field) {
  if (!value || !["IPC", "BNS"].includes(value.code) || typeof value.section !== "string" || !value.section.trim()) {
    incomplete(caseId, field);
  }
}

function incomplete(caseId, field) {
  throw new Error(`Expert input is incomplete or invalid for ${caseId}: ${field}.`);
}

function verifyPredictionSeal(file) {
  const { sealSha256, ...payload } = file;
  if (!sealSha256 || hash(JSON.stringify(payload, null, 2)) !== sealSha256) {
    throw new Error("Prediction seal verification failed; the blind output may have been changed.");
  }
}

function uniqueByCaseId(items, description) {
  const result = new Map();
  for (const item of items) {
    if (!item.caseId) throw new Error(`${description} entry is missing caseId.`);
    if (result.has(item.caseId)) throw new Error(`Duplicate ${description} caseId: ${item.caseId}`);
    result.set(item.caseId, item);
  }
  return result;
}

function validateMatchingIds(predictions, recordsById, description) {
  const predictionIds = new Set(predictions.map((prediction) => prediction.caseId));
  const missing = [...predictionIds].filter((id) => !recordsById.has(id));
  const extra = [...recordsById.keys()].filter((id) => !predictionIds.has(id));
  if (missing.length || extra.length) {
    throw new Error(`${description} case ID mismatch. Missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"}.`);
  }
}

function parseJsonLines(text, path) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch {
      throw new Error(`Invalid JSON at ${path}:${index + 1}`);
    }
  });
}

function provisionId(value) {
  return `${value.code}-${value.section}`.toUpperCase();
}

function count(rows, field) {
  return rows.filter((row) => row[field]).length;
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + row[field], 0);
}

function iracPercent(rows, fields) {
  const values = rows.flatMap((row) => fields.map((field) => row.iracAccuracy[field]));
  return percent(values.reduce((total, value) => total + value, 0), values.length * 2);
}

function ordinalPercent(values, scale) {
  return percent(values.reduce((total, value) => total + scale[value], 0), values.length * 2);
}

function percent(value, total) {
  return total ? Number(((value / total) * 100).toFixed(2)) : null;
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}
