import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DATASET = "ConvoZenAI/indictelephony-bench";
const DEST = "output/voice-verification/marathi-telephony";
const OFFSETS = [0, 250, 500, 750, 1000, 1250, 1500, 1750];

async function get(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} fetching ${new URL(url).origin}`);
  return response;
}

await mkdir(DEST, { recursive: true });
const datasetInfo = await (await get(`https://huggingface.co/api/datasets/${DATASET}`)).json();
if (datasetInfo.id !== DATASET || datasetInfo.cardData?.license !== "cc-by-4.0" || !datasetInfo.sha) {
  throw new Error("Dataset identity, revision or CC BY 4.0 license could not be verified");
}
const fixtures = [];
const calls = new Set();
for (const offset of OFFSETS) {
  const params = new URLSearchParams({ dataset: DATASET, config: "Marathi", split: "test", offset: String(offset), length: "25" });
  const preview = await (await get(`https://datasets-server.huggingface.co/rows?${params}`)).json();
  const item = preview.rows?.find(({ row }) => row.language === "mr" && !calls.has(row.call_id)
    && row.duration_sec >= 5 && row.duration_sec <= 15 && row.transcription?.length >= 50
    && row.audio?.[0]?.type === "audio/wav" && row.audio[0].src);
  if (!item) throw new Error(`No eligible independent Marathi clip near row ${offset}`);
  const { row } = item;
  calls.add(row.call_id);
  const bytes = Buffer.from(await (await get(row.audio[0].src)).arrayBuffer());
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new Error(`Invalid audio size at row ${item.row_idx}`);
  const filename = `mr-telephony-${item.row_idx}.wav`;
  await writeFile(join(DEST, filename), bytes);
  fixtures.push({ filename, language: "mr", transcript: row.transcription, dataset: DATASET,
    source: `https://huggingface.co/datasets/${DATASET}`, license: "CC BY 4.0",
    rowIndex: item.row_idx, utteranceId: row.utterance_id, callId: row.call_id,
    languageTag: row.language_tag, durationSeconds: row.duration_sec, domain: row.domain,
    mimeType: row.audio[0].type, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"),
    use: "Local ASR research only; do not add to legal corpus or commit audio." });
  console.log(`${filename}: ${row.duration_sec.toFixed(1)}s, ${row.call_id}, ${row.language_tag}`);
}
await writeFile(join(DEST, "fixtures.json"), JSON.stringify({
  note: "Fixed metadata-only selection across distinct calls. First four development, last four holdout. Public CC BY 4.0 telephone speech, not spoken legal queries or project legal corpus.",
  datasetRevision: datasetInfo.sha,
  fixtures
}, null, 2));
