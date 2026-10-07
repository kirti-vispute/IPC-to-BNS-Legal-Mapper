import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { pathToFileURL } from "node:url";
import { verifyLicense, overlap } from "./obtain_hindi_baseline.mjs";

export const REPO = "dropbox-dash/faster-whisper-large-v3-turbo";
export const REVISION = "0a363e9161cbc7ed1431c9597a8ceaf0c4f78fcf";
export const MODEL_SHA = "e76620f83d5f5b69efd3d87e3dc180c1bd21df9fbebacfd4335e5e1efcc018da";
export const MODEL_BYTES = 1617884929;
export const PRIMARY = [3, 24, 46, 85];
export const RESERVE = [4, 25, 47, 86, 5, 26, 48, 87];
const root = resolve(import.meta.dirname, "..");
const out = join(root, "output/public-speech-validation/hindi-turbo-study-20261006");
const files = ["README.md", "config.json", "preprocessor_config.json", "tokenizer.json", "vocabulary.json", "model.bin"];
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const save = (path, value) => writeFile(path, JSON.stringify(value, null, 2), { flag: "wx" });

export function verifyModelMetadata(meta) {
  assert.equal(meta.id, REPO);
  assert.equal(meta.sha, REVISION);
  assert.equal(meta.cardData?.license, "mit");
  const weights = meta.siblings.find(f => f.rfilename === "model.bin");
  assert.equal(weights?.size, MODEL_BYTES);
  assert.equal(weights.lfs?.sha256, MODEL_SHA);
  for (const name of files) {
    const item = meta.siblings.find(f => f.rfilename === name);
    assert.ok(item?.size > 0 && /^[a-f0-9]{40}$/.test(item.blobId), `Invalid pinned metadata: ${name}`);
  }
}

async function get(url, timeout = 45000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  assert.equal(response.ok, true, `Public request failed: ${response.status}`);
  return response;
}

async function model() {
  const reg = JSON.parse(await readFile(join(out, "acquisition-registration.json"), "utf8"));
  for (const name of ["scripts/obtain_hindi_turbo.mjs", "Feature-hindi-turbo-study-plan.md"]) {
    assert.equal(sha(await readFile(join(root, name))), reg.hashes[name]);
  }
  const metadata = await (await get(`https://huggingface.co/api/models/${REPO}/revision/${REVISION}?blobs=true`)).json();
  verifyModelMetadata(metadata);
  await save(join(out, "model-metadata.json"), metadata);
  const dest = join(out, "candidate-model");
  await mkdir(dest);
  for (const name of files) {
    const item = metadata.siblings.find(f => f.rfilename === name);
    const response = await get(`https://huggingface.co/${REPO}/resolve/${REVISION}/${name}`, 600000);
    const hash = createHash(item.lfs ? "sha256" : "sha1");
    if (!item.lfs) hash.update(`blob ${item.size}\0`);
    let bytes = 0;
    let milestone = 0;
    await pipeline(Readable.fromWeb(response.body), new Transform({ transform(chunk, _, callback) {
      bytes += chunk.length;
      if (bytes > item.size) return callback(new Error("Pinned size exceeded"));
      hash.update(chunk);
      if (name === "model.bin" && Math.floor(bytes / (128 * 1024 * 1024)) > milestone) {
        milestone = Math.floor(bytes / (128 * 1024 * 1024));
        console.log(JSON.stringify({ file: name, downloadedBytes: bytes, expectedBytes: item.size }));
      }
      callback(null, chunk);
    } }), createWriteStream(join(dest, name), { flags: "wx" }));
    assert.equal(bytes, item.size);
    assert.equal(hash.digest("hex"), item.lfs ? item.lfs.sha256 : item.blobId, "Pinned file hash mismatch");
    if (name === "README.md") assert.match(await readFile(join(dest, name), "utf8"), /^license: mit\s*$/m);
    console.log(JSON.stringify({ verified: name, bytes }));
  }
  await save(join(out, "model-download-complete.json"), { repo: REPO, revision: REVISION, modelSHA256: MODEL_SHA, bytes: MODEL_BYTES });
}

async function confirmation() {
  assert.equal(JSON.parse(await readFile(join(out, "development-report.json"), "utf8")).assessment.passed, true,
    "Development failure forbids confirmation");
  const reg = JSON.parse(await readFile(join(out, "development-registration.json"), "utf8"));
  assert.equal(sha(await readFile(join(root, "scripts/obtain_hindi_turbo.mjs"))), reg.hashes["scripts/obtain_hindi_turbo.mjs"]);
  const dest = join(out, "confirmation");
  await mkdir(dest);
  const card = await (await get("https://huggingface.co/datasets/google/fleurs/raw/main/README.md")).text();
  verifyLicense(card);
  await writeFile(join(dest, "source-card.md"), card, { flag: "wx" });
  const previewURL = "https://datasets-server.huggingface.co/first-rows?dataset=google%2Ffleurs&config=hi_in&split=validation";
  const preview = await (await get(previewURL)).json();
  const previous = [];
  for (const path of ["output/voice-verification/real-speech/fixtures.json", "output/voice-verification/holdout-speech/fixtures.json",
    "output/public-speech-validation/hindi-broader-baseline-20261006/fixtures/fixtures.json"]) {
    previous.push(...JSON.parse(await readFile(join(root, path), "utf8")).fixtures.filter(f => f.language === "hi"));
  }
  const fixtures = [], selection = [];
  for (const rowIndex of [...PRIMARY, ...RESERVE]) {
    if (fixtures.length === 4) break;
    const record = preview.rows.find(row => row.row_idx === rowIndex)?.row;
    assert.equal(record?.language, "Hindi");
    assert.ok(Number.isInteger(record.id) && record.raw_transcription?.trim() && record.path);
    assert.ok([0, 1, 2].includes(record.gender));
    assert.ok(Number.isInteger(record.num_samples) && record.num_samples > 0 && record.num_samples <= 90 * 16000);
    assert.equal(record.audio?.[0]?.type, "audio/wav");
    let reason = overlap(record, null, [...previous, ...fixtures]);
    if (reason) { selection.push({ rowIndex, action: "skip", reason }); continue; }
    const bytes = Buffer.from(await (await get(record.audio[0].src)).arrayBuffer());
    assert.ok(bytes.length > 0 && bytes.length < 10 * 1024 * 1024);
    const identity = sha(bytes);
    reason = overlap(record, identity, [...previous, ...fixtures]);
    if (reason) { selection.push({ rowIndex, action: "skip", reason }); continue; }
    const filename = `hi-${rowIndex}.wav`;
    await writeFile(join(dest, filename), bytes, { flag: "wx" });
    fixtures.push({ filename, rowIndex, datasetId: record.id, sha256: identity, transcript: record.raw_transcription,
      language: "hi", license: "CC BY 4.0", numSamples: record.num_samples, recordingPath: record.path,
      genderCode: record.gender, speakerId: null, dataset: "google/fleurs", config: "hi_in", split: "validation",
      source: "https://huggingface.co/datasets/google/fleurs", previewURL, sourceCardSHA256: sha(card), bytes: bytes.length,
      use: "Local diagnostic only; not training/legal/expert labels; do not redistribute." });
    selection.push({ rowIndex, action: "select", datasetId: record.id });
  }
  await save(join(dest, "selection.json"), selection);
  assert.equal(fixtures.length, 4, "Insufficient fixed disjoint rows");
  await save(join(dest, "fixtures.json"), { fixtures });
  console.log(JSON.stringify({ confirmationClips: fixtures.length }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.ok(["model", "confirmation"].includes(process.argv[2]), "Specify model or confirmation");
  await ({ model, confirmation }[process.argv[2]])();
}
