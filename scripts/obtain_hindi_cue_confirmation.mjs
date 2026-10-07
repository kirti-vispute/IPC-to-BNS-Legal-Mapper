import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const parent = "output/public-speech-validation/hindi-cue-study-20261006";
const report = JSON.parse(await readFile(join(parent, "development-report.json"), "utf8"));
assert.equal(report.assessment?.passed, true, "Do not acquire confirmation after failed development");
const dest = join(parent, "confirmation");
await mkdir(dest);
const get = async url => {
  const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
  assert.equal(response.ok, true, `Source request failed: ${response.status}`);
  return response;
};
const card = await (await get("https://huggingface.co/datasets/google/fleurs/raw/main/README.md")).text();
assert.match(card, /license:\s*cc-by-4\.0/);
await writeFile(join(dest, "source-card.md"), card, { flag: "wx" });
const url = "https://datasets-server.huggingface.co/first-rows?dataset=google%2Ffleurs&config=hi_in&split=validation";
const preview = await (await get(url)).json();
const fixtures = [];
for (const index of [60, 61, 62, 63]) {
  const record = preview.rows.find(row => row.row_idx === index)?.row;
  assert.equal(record?.language, "Hindi");
  assert.equal(record.audio?.[0]?.type, "audio/wav");
  assert.ok(record.raw_transcription?.trim());
  const bytes = Buffer.from(await (await get(record.audio[0].src)).arrayBuffer());
  assert.ok(bytes.length > 0 && bytes.length < 10 * 1024 * 1024);
  const filename = `hi-${index}.wav`;
  await writeFile(join(dest, filename), bytes, { flag: "wx" });
  fixtures.push({ filename, rowIndex: index, datasetId: record.id, language: "hi", dataset: "google/fleurs",
    config: "hi_in", split: "validation", source: "https://huggingface.co/datasets/google/fleurs",
    previewURL: url, transcript: record.raw_transcription, license: "CC BY 4.0", mimeType: "audio/wav",
    bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"),
    sourceCardSHA256: createHash("sha256").update(card).digest("hex"),
    use: "Local diagnostic only; do not commit or redistribute audio; not legal labels." });
}
await writeFile(join(dest, "fixtures.json"), JSON.stringify({ fixtures }, null, 2), { flag: "wx" });
console.log(JSON.stringify({ downloaded: fixtures.length, directory: dest }));
