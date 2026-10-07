import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { speechErrors, normalizeSpeech } from "./validate_public_speech.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUTPUT = join(ROOT, "output/public-speech-validation/beam2-assessment-20261003");
const hash = value => createHash("sha256").update(value).digest("hex");
const median = values => {
  const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export function newlyLostCues(reference, baseline, candidate) {
  const cues = [...new Set(reference.match(/\p{Nd}+/gu) || [])];
  if (normalizeSpeech(reference).split(" ").includes("नाही")) cues.push("नाही");
  return cues.filter(cue => baseline.includes(cue) && !candidate.includes(cue));
}

export function assessPairs(rows) {
  const regressions = rows.filter(row => row.candidate.metrics.wordEdits > row.baseline.metrics.wordEdits
    || row.candidate.metrics.charEdits > row.baseline.metrics.charEdits || row.newlyLostCues.length);
  const baselineMedianMs = median(rows.map(row => row.baseline.decodeMs));
  const candidateMedianMs = median(rows.map(row => row.candidate.decodeMs));
  const noErrors = rows.length > 0 && rows.every(row => typeof row.baseline.text === "string" && row.baseline.text.trim()
    && typeof row.candidate.text === "string" && row.candidate.text.trim()
    && Number.isFinite(row.baseline.decodeMs) && row.baseline.decodeMs > 0 && row.baseline.decodeMs <= 120_000
    && Number.isFinite(row.candidate.decodeMs) && row.candidate.decodeMs > 0 && row.candidate.decodeMs <= 120_000);
  const summary = profile => {
    const totals = rows.reduce((sum, row) => ({ words: sum.words + row[profile].metrics.referenceWords,
      chars: sum.chars + row[profile].metrics.referenceChars, wordEdits: sum.wordEdits + row[profile].metrics.wordEdits,
      charEdits: sum.charEdits + row[profile].metrics.charEdits }), { words: 0, chars: 0, wordEdits: 0, charEdits: 0 });
    return { ...totals, microWER: totals.wordEdits / totals.words, microCER: totals.charEdits / totals.chars };
  };
  return { clips: rows.length, baseline: summary("baseline"), candidate: summary("candidate"),
    baselineMedianMs, candidateMedianMs, speedRatio: candidateMedianMs / baselineMedianMs,
    regressions: regressions.map(row => row.filename), noErrors,
    acceptedForNextStage: noErrors && !regressions.length && candidateMedianMs <= baselineMedianMs * 0.9 };
}

async function score(stage) {
  if (!["development", "holdout"].includes(stage)) throw new Error("Use development or holdout");
  const bytes = await readFile(join(OUTPUT, "registration.json"));
  const registration = JSON.parse(bytes);
  const source = registration.stages[stage];
  if (hash(await readFile(join(ROOT, source.manifest))) !== source.sha256) throw new Error("Fixture registration changed");
  const rawBytes = await readFile(join(OUTPUT, `${stage}-decoding.jsonl`));
  const raw = rawBytes.toString().trim().split(/\r?\n/).map(JSON.parse);
  if (raw.length !== source.fixtures.length * 2) throw new Error("Incomplete decoder run; no acceptance claim");
  const httpPath = join(ROOT, "output/public-speech-validation/fresh-marathi-20261003/report.json");
  const httpBytes = await readFile(httpPath);
  if (hash(httpBytes) !== registration.baselineHttpReportSHA256) throw new Error("Original HTTP baseline changed");
  const http = JSON.parse(httpBytes);
  const rows = source.fixtures.map(fixture => {
    const pair = beam => {
      const matches = raw.filter(row => row.filename === fixture.filename && row.beam === beam);
      if (matches.length !== 1 || matches[0].error || typeof matches[0].text !== "string") throw new Error("Invalid decoder pair");
      return { ...matches[0], metrics: speechErrors(fixture.transcript, matches[0].text) };
    };
    const baseline = pair(3), candidate = pair(2);
    return { filename: fixture.filename, baseline, candidate,
      baselineHttpParity: stage === "development" ? baseline.text === http.rows.find(row => row.filename === fixture.filename)?.speech.text : null,
      newlyLostCues: newlyLostCues(fixture.transcript, baseline.text, candidate.text) };
  });
  const result = { type: "PREREGISTERED_OFFLINE_BEAM_COMPARISON", stage, registrationSHA256: hash(bytes),
    rawSHA256: hash(rawBytes), ...assessPairs(rows), rows, productionDeployed: false,
    limitations: "Small public telephone diagnostic; strict spelling/spacing edit rates, not general meaning, legal/physical-microphone accuracy or certified latency improvement. First decode may include lazy initialization." };
  if (stage === "development" && rows.some(row => !row.baselineHttpParity)) result.acceptedForNextStage = false;
  await writeFile(join(OUTPUT, `${stage}-assessment.json`), `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
  console.log(JSON.stringify({ ...result, rows: undefined }));
  if (!result.acceptedForNextStage) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await score(process.argv[2]);
