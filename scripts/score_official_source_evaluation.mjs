import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const [predictionArg, referenceArg, outputArg] = process.argv.slice(2);
const predictionPath = resolve(predictionArg || "evaluation/runs/blind-predictions.json");
const referencePath = resolve(referenceArg || "evaluation/official-source-reference-evaluation/official-source-reference-labels.json");
const outputPath = resolve(outputArg || "evaluation/official-source-reference-evaluation/official-source-reference-report.json");

const predictionText = await readFile(predictionPath, "utf8");
const referenceText = await readFile(referencePath, "utf8");
const predictionFile = JSON.parse(predictionText);
const referenceFile = JSON.parse(referenceText);
verifyPredictionSeal(predictionFile);
validateReferenceFile(referenceFile);

const predictionsById = uniqueByCaseId(predictionFile.predictions, "predictions");
const referencesById = uniqueByCaseId(referenceFile.records, "official-source references");
validateMatchingIds(predictionsById, referencesById);

const rows = referenceFile.records.map((reference) => scoreCase(predictionsById.get(reference.caseId), reference));
const routeRows = rows.filter((row) => row.eligibility.applicableLaw);
const top1Rows = rows.filter((row) => row.eligibility.top1);
const top3Rows = rows.filter((row) => row.eligibility.top3);
const citationRows = rows.filter((row) => row.eligibility.citation);

const report = {
  evaluationType: "OFFICIAL_SOURCE_REFERENCE_EVALUATION",
  validationStatus: "NOT_INDEPENDENT_LAWYER_VALIDATION",
  disclaimer: "This report compares system output with research references derived from official-source text in the local corpus. It is not lawyer validation, expert validation, legal advice, or a measure of correctness in real cases.",
  generatedAt: new Date().toISOString(),
  predictionSealSha256: predictionFile.sealSha256,
  predictionFileSha256: hash(predictionText),
  referenceFileSha256: hash(referenceText),
  totalCases: rows.length,
  referenceCoverage: {
    applicableLawEligibleCases: routeRows.length,
    provisionTop1EligibleCases: top1Rows.length,
    provisionTop3EligibleCases: top3Rows.length,
    citationEligibleCases: citationRows.length,
    requiresExpertReviewCases: rows.filter((row) => row.requiresExpertReview).map((row) => row.caseId),
  },
  metrics: {
    applicableLawAccuracyPercent: percent(count(routeRows, "applicableLawCorrect"), routeRows.length),
    provisionTop1AccuracyPercent: percent(count(top1Rows, "top1Correct"), top1Rows.length),
    acceptableTop3AnyHitPercent: percent(count(top3Rows, "top3AnyHit"), top3Rows.length),
    acceptableProvisionRecallAt3Percent: percent(sum(top3Rows, "matchedAcceptableCount"), sum(top3Rows, "acceptableCount")),
    exactTop1CitationAccuracyPercent: percent(count(citationRows, "top1CitationCorrect"), citationRows.length),
    iracAccuracyPercent: null,
  },
  claimsSupported: [
    "Accuracy of the deterministic pipeline against the documented official-source references on eligible fields in these 10 synthetic cases.",
    "Identification of retrieval errors and coverage gaps relative to the approved local government-source corpus.",
    "Reproducible route, provision, and exact source-page comparison with unresolved cases excluded from ineligible denominators.",
  ],
  claimsNotSupported: [
    "Independent lawyer or professor validation.",
    "Legal correctness for real disputes, charging decisions, or court use.",
    "General model accuracy outside these 10 synthetic cases.",
    "IRAC legal quality, because no independent IRAC reference or expert review exists.",
    "Correctness for records marked requires expert review.",
  ],
  cases: rows,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outputPath, validationStatus: report.validationStatus, referenceCoverage: report.referenceCoverage, metrics: report.metrics }, null, 2));

function scoreCase(prediction, reference) {
  const predicted = prediction.retrieved.slice(0, 3).map((record) => ({
    id: provisionId(record),
    file: record.citation.file,
    page: record.citation.page,
  }));
  const expectedTop1 = reference.referenceTop1 ? provisionId(reference.referenceTop1) : null;
  const acceptable = reference.acceptable.map(provisionId);
  const matchedAcceptable = acceptable.filter((id) => predicted.some((item) => item.id === id));
  const expectedCitation = reference.referenceTop1
    ? reference.sources.find((item) => normalizedSection(item.section) === expectedTop1)
    : null;

  return {
    caseId: reference.caseId,
    labelType: reference.labelType,
    requiresExpertReview: reference.requiresExpertReview,
    expertReviewReason: reference.expertReviewReason,
    eligibility: reference.eligibility,
    predictedApplicableLaw: prediction.applicableRoute,
    referenceApplicableLaw: reference.applicableLaw,
    applicableLawCorrect: reference.eligibility.applicableLaw
      ? prediction.applicableRoute === reference.applicableLaw
      : null,
    predictedTop1Provision: predicted[0]?.id || null,
    referenceTop1Provision: expectedTop1,
    top1Correct: reference.eligibility.top1 ? predicted[0]?.id === expectedTop1 : null,
    predictedTop3Provisions: predicted.map((item) => item.id),
    acceptableProvisions: acceptable,
    matchedAcceptableProvisions: matchedAcceptable,
    matchedAcceptableCount: matchedAcceptable.length,
    acceptableCount: acceptable.length,
    top3AnyHit: reference.eligibility.top3 ? matchedAcceptable.length > 0 : null,
    predictedTop1Citation: predicted[0] ? { file: predicted[0].file, pdfPage: predicted[0].page } : null,
    referenceTop1Citation: expectedCitation ? { file: expectedCitation.file, pdfPage: expectedCitation.pdfPage } : null,
    top1CitationCorrect: reference.eligibility.citation
      ? predicted[0]?.file === expectedCitation?.file && predicted[0]?.page === expectedCitation?.pdfPage
      : null,
    briefJustification: reference.justification,
  };
}

function validateReferenceFile(file) {
  if (file.evaluationType !== "OFFICIAL_SOURCE_REFERENCE_EVALUATION") {
    throw new Error("Reference file is not labeled as an official-source reference evaluation.");
  }
  if (file.validationStatus !== "NOT_INDEPENDENT_LAWYER_VALIDATION") {
    throw new Error("Reference file must explicitly disclaim independent lawyer validation.");
  }
  if (!Array.isArray(file.records) || file.records.length !== 10) {
    throw new Error("Expected exactly 10 official-source reference records records.");
  }
  for (const record of file.records) {
    if (record.labelType !== "OFFICIAL_SOURCE_REFERENCE_LABEL") {
      throw new Error(`Invalid label type for ${record.caseId}.`);
    }
    if (record.eligibility.top1 && !record.referenceTop1) {
      throw new Error(`Eligible Top-1 reference is missing for ${record.caseId}.`);
    }
    if (record.requiresExpertReview && !record.expertReviewReason) {
      throw new Error(`Expert-review reason is missing for ${record.caseId}.`);
    }
  }
}

function verifyPredictionSeal(file) {
  const { sealSha256, ...payload } = file;
  if (!sealSha256 || hash(JSON.stringify(payload, null, 2)) !== sealSha256) {
    throw new Error("Prediction seal verification failed; blind-predictions.json may have changed.");
  }
}

function uniqueByCaseId(items, description) {
  const result = new Map();
  for (const item of items) {
    if (!item.caseId || result.has(item.caseId)) throw new Error(`Missing or duplicate caseId in ${description}: ${item.caseId}`);
    result.set(item.caseId, item);
  }
  return result;
}

function validateMatchingIds(predictions, references) {
  const missing = [...predictions.keys()].filter((id) => !references.has(id));
  const extra = [...references.keys()].filter((id) => !predictions.has(id));
  if (missing.length || extra.length) {
    throw new Error(`Case ID mismatch. Missing references: ${missing.join(", ") || "none"}; extra references: ${extra.join(", ") || "none"}.`);
  }
}

function provisionId(value) {
  return `${value.code}-${value.section}`.toUpperCase();
}

function normalizedSection(value) {
  const match = /^(IPC|BNS)\s+(.+)$/i.exec(value || "");
  return match ? `${match[1]}-${match[2]}`.toUpperCase() : "";
}

function count(rows, field) {
  return rows.filter((row) => row[field] === true).length;
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + row[field], 0);
}

function percent(value, total) {
  return total ? Number(((value / total) * 100).toFixed(2)) : null;
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}
