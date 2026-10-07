import { createHash } from "node:crypto";
import { readFile, writeFile, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { transcribeAudio, closeLocalSpeechWorker } from "../backend/core/transcriber.js";

const root = resolve(import.meta.dirname, "..");
const out = join(root, "output/public-speech-validation/backend-review-20261006");
const read = async name => JSON.parse(await readFile(join(root, name), "utf8"));
const digest = async name => createHash("sha256").update(await readFile(join(root, name))).digest("hex");
const save = async (name, value) => writeFile(join(out, name), `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
const before = await read("output/public-speech-validation/backend-review-20261006/before.json");
const mode = process.argv[2];

if (mode === "smoke") {
  const previous = await read("output/public-speech-validation/segment-diagnostic-20261004/report.json");
  if (!previous.diagnosticUsable || previous.rows.length !== 8) throw new Error("Saved development evidence unavailable");
  const names = previous.rows.map(row => `output/public-speech-validation/fresh-marathi-20261003/${row.filename}`);
  const source = ["backend/speech/transcribe.py", "backend/speech/review.py", "backend/core/transcriber.js",
    "tests/test_backend_speech_review.py", "tests/speech-review.test.js", "scripts/validate_backend_speech_review.mjs",
    "output/public-speech-validation/backend-review-20261006/before.json",
    "output/public-speech-validation/segment-diagnostic-20261004/report.json"];
  const hashes = {};
  for (const name of [...source, ...names]) hashes[name] = await digest(name);
  for (const name of names) {
    const historical = Object.keys(before.historicalCommitments).find(key => key.replaceAll("\\", "/") === name);
    if (!historical || before.historicalCommitments[historical].toLowerCase() !== hashes[name]) {
      throw new Error(`Development audio changed: ${name}`);
    }
  }
  await save("registration.json", { type: "BACKEND_SPEECH_REVIEW_SMOKE", hashes,
    createdAt: new Date().toISOString(), reservedHoldoutSubmitted: false, speechAccuracyEvaluation: false });
  const rows = [];
  let invalidAudioRejected = false;
  let failure = null;
  try {
    for (const [index, row] of [...previous.rows, previous.rows[0]].entries()) {
      if (index === 1) {
        try {
          await transcribeAudio({ audio: Buffer.from("invalid audio"), contentType: "audio/wav", language: "mr" });
          throw new Error("Invalid audio was accepted");
        } catch (error) {
          if (error.code !== "INVALID_AUDIO") throw error;
          invalidAudioRejected = true;
        }
      }
      const name = `output/public-speech-validation/fresh-marathi-20261003/${row.filename}`;
      const response = await transcribeAudio({ audio: await readFile(join(root, name)), contentType: "audio/wav", language: "mr" });
      const passed = response.text === row.text && response.originalInput === row.text
        && response.inputLanguage === "mr" && response.speechReview?.status === "assessed"
        && response.speechReview.requiresReview === false && response.speechReview.windowCount === 1;
      const result = { filename: row.filename, repeated: index === 8, passed, historicalTextParity: response.text === row.text, response };
      rows.push(result);
      await writeFile(join(out, "responses.jsonl"), `${JSON.stringify(result)}\n`, { flag: index === 0 ? "wx" : "a" });
      console.log(JSON.stringify({ filename: row.filename, repeated: index === 8, passed, speechReview: response.speechReview }));
      if (!passed) throw new Error(`Speech contract mismatch: ${row.filename}`);
    }
  } catch (error) { failure = { code: error.code || null, message: error.message }; }
  finally { closeLocalSpeechWorker(); }
  const changed = [];
  for (const [name, hash] of Object.entries(hashes)) if (await digest(name) !== hash) changed.push(name);
  const report = { type: "BACKEND_SPEECH_REVIEW_SMOKE", rows, invalidAudioRejected, failure,
    usable: failure === null && changed.length === 0 && rows.length === 9 && invalidAudioRejected,
    changedRegisteredInputs: changed, neuralInference: true, reservedHoldoutSubmitted: false,
    limitations: "Previously inspected eight Marathi development clips plus one repeat, not unseen speech or legal accuracy. No physical microphone, long live recording or speed comparison. Known recognition errors remain; clear metadata is not a correct-transcript verdict." };
  await save("report.json", report);
  if (!report.usable) process.exitCode = 1;
} else if (mode === "audit") {
  const allowed = new Set(before.allowedProductionChanges);
  const changes = [];
  const unexpected = [];
  for (const [name, hash] of Object.entries(before.historicalCommitments)) {
    const actual = await digest(name);
    if (actual !== hash.toLowerCase()) {
      const normalized = name.replaceAll("\\", "/");
      const row = { file: normalized, beforeSHA256: hash.toLowerCase(), afterSHA256: actual };
      (allowed.has(normalized) ? changes : unexpected).push(row);
    }
  }
  const protectedChanges = [];
  for (const [name, hash] of Object.entries({ ...before.protectedLegal, ...before.registrationFiles })) {
    if (await digest(name) !== hash.toLowerCase()) protectedChanges.push(name);
  }
  const reserved = [];
  for (const name of ["holdout-decoding.jsonl", "holdout-assessment.json"]) {
    const path = `output/public-speech-validation/beam2-assessment-20261003/${name}`;
    try { await stat(join(root, path)); reserved.push(path); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const result = { historicalIdentities: Object.keys(before.historicalCommitments).length,
    protectedLegalAndPipelineFiles: Object.keys(before.protectedLegal).length,
    frozenRegistrations: Object.keys(before.registrationFiles).length,
    authorizedProductionChanges: changes, unexpectedHistoricalChanges: unexpected,
    protectedChanges, reservedHoldoutOutputsPresent: reserved,
    usable: changes.length === 2 && !unexpected.length && !protectedChanges.length && !reserved.length };
  await save("integrity.json", result);
  console.log(JSON.stringify(result));
  if (!result.usable) process.exitCode = 1;
} else throw new Error("Choose smoke or audit; existing evidence is never overwritten");
