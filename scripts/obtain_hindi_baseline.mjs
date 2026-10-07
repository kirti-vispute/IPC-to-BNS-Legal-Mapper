import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const PRIMARY = [0, 7, 14, 21, 28, 35, 42, 49, 56, 70, 77, 98];
export const RESERVE = [1, 8, 15, 22, 36, 43, 50, 57, 71, 78, 92, 99];
const root = resolve(import.meta.dirname, "..");
const out = join(root, "output/public-speech-validation/hindi-broader-baseline-20261006");
const cardURL = "https://huggingface.co/datasets/google/fleurs/raw/main/README.md";
const previewURL = "https://datasets-server.huggingface.co/first-rows?dataset=google%2Ffleurs&config=hi_in&split=validation";
const sha = bytes => createHash("sha256").update(bytes).digest("hex");

export function verifyLicense(card) {
  assert.match(card, /^---\r?\n/);
  const frontmatter = card.split(/^---\s*$/m)[1];
  assert.match(frontmatter, /^license:\s*\r?\n- cc-by-4\.0\s*$/m);
}

export function overlap(record, identity, previous) {
  if (previous.some(f => f.datasetId === record.id)) return "sentence-ID overlap";
  if (previous.some(f => f.sha256 === identity)) return "audio-SHA256 overlap";
  return null;
}

async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
  assert.equal(response.ok, true, `Public source request failed: ${response.status}`);
  return response;
}

async function acquire() {
  const registration = JSON.parse(await readFile(join(out, "pre-acquisition-registration.json"), "utf8"));
  for (const name of ["scripts/obtain_hindi_baseline.mjs", "Feature-hindi-broader-baseline-plan.md"]) {
    assert.equal(sha(await readFile(join(root, name))), registration.hashes[name], "Frozen acquisition input changed");
  }
  const dest = join(out, "fixtures");
  await mkdir(dest);
  const card = await (await get(cardURL)).text();
  verifyLicense(card);
  await writeFile(join(dest, "source-card.md"), card, { flag: "wx" });
  const preview = await (await get(previewURL)).json();
  const previous = [];
  for (const name of ["real-speech", "holdout-speech"]) {
    previous.push(...JSON.parse(await readFile(join(root, "output/voice-verification", name, "fixtures.json"), "utf8")).fixtures.filter(f => f.language === "hi"));
  }
  const fixtures = [];
  const selection = [];
  for (const rowIndex of [...PRIMARY, ...RESERVE]) {
    if (fixtures.length === 12) break;
    const record = preview.rows.find(row => row.row_idx === rowIndex)?.row;
    assert.equal(record?.language, "Hindi", "Missing or invalid frozen row");
    assert.ok(Number.isInteger(record.id));
    assert.equal(record.audio?.[0]?.type, "audio/wav");
    assert.ok(record.raw_transcription?.trim());
    assert.ok(typeof record.path === "string" && record.path.length);
    assert.ok([0, 1, 2].includes(record.gender));
    assert.ok(Number.isInteger(record.num_samples) && record.num_samples > 0 && record.num_samples <= 90 * 16000);
    let reason = overlap(record, null, [...previous, ...fixtures]);
    if (reason) {
      selection.push({ rowIndex, datasetId: record.id, action: "skip", reason });
      continue;
    }
    const bytes = Buffer.from(await (await get(record.audio[0].src)).arrayBuffer());
    assert.ok(bytes.length > 0 && bytes.length < 10 * 1024 * 1024);
    const identity = sha(bytes);
    reason = overlap(record, identity, [...previous, ...fixtures]);
    if (reason) {
      selection.push({ rowIndex, datasetId: record.id, action: "skip", reason });
      continue;
    }
    const filename = `hi-${rowIndex}.wav`;
    await writeFile(join(dest, filename), bytes, { flag: "wx" });
    fixtures.push({ filename, rowIndex, datasetId: record.id, recordingPath: record.path,
      genderCode: record.gender, speakerId: null, numSamples: record.num_samples, language: "hi",
      dataset: "google/fleurs", config: "hi_in", split: "validation", source: "https://huggingface.co/datasets/google/fleurs",
      previewURL, transcript: record.raw_transcription, license: "CC BY 4.0", mimeType: "audio/wav", bytes: bytes.length,
      sha256: identity, sourceCardSHA256: sha(card), use: "Local reference diagnostic; not training or legal labels; do not commit/redistribute audio." });
    selection.push({ rowIndex, datasetId: record.id, action: "select" });
    console.log(JSON.stringify({ selected: fixtures.length, rowIndex, filename }));
  }
  await writeFile(join(dest, "selection.json"), JSON.stringify(selection, null, 2), { flag: "wx" });
  assert.equal(fixtures.length, 12, "Insufficient disjoint recordings; no replacement outside frozen order");
  await writeFile(join(dest, "fixtures.json"), JSON.stringify({ cardURL, fixtures }, null, 2), { flag: "wx" });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await acquire();
}
