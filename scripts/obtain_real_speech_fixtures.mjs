import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const holdout = process.argv.includes("--holdout");
const DEST = holdout ? "output/voice-verification/holdout-speech" : "output/voice-verification/real-speech";
const SOURCES = [
  {
    dataset: "google/fleurs", config: "hi_in", split: "validation", language: "hi",
    license: "CC BY 4.0", indexes: holdout ? [6, 18, 67, 91] : [29, 44, 53, 82],
    source: "https://huggingface.co/datasets/google/fleurs"
  },
  {
    dataset: "Reubencf/Adaption-low-resource-audio", config: "default", split: "train", language: "mr",
    license: "CC BY-NC 4.0", indexes: holdout ? [4, 9, 10, 18] : [3, 8, 42, 56],
    source: "https://huggingface.co/datasets/Reubencf/Adaption-low-resource-audio"
  }
];

async function get(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} fetching ${new URL(url).origin}`);
  return response;
}

await mkdir(DEST, { recursive: true });
const fixtures = [];
for (const source of SOURCES) {
  const params = new URLSearchParams({ dataset: source.dataset, config: source.config, split: source.split });
  const preview = await (await get(`https://datasets-server.huggingface.co/first-rows?${params}`)).json();
  for (const index of source.indexes) {
    const record = preview.rows?.find(item => item.row_idx === index)?.row;
    if (!record?.audio?.[0]?.src) throw new Error(`Missing audio for ${source.language}/${index}`);
    if (source.language === "mr" && record.audio_license !== source.license) throw new Error(`License mismatch for mr/${index}`);
    if (source.language === "mr" && record.lang !== "mar") throw new Error(`Language mismatch for mr/${index}`);
    if (source.language === "hi" && record.language !== "Hindi") throw new Error(`Language mismatch for hi/${index}`);
    const mimeType = record.audio[0].type;
    const extension = mimeType === "audio/wav" ? "wav" : mimeType === "audio/mpeg" ? "mp3" : null;
    if (!extension) throw new Error(`Unexpected audio type ${mimeType}`);
    const bytes = Buffer.from(await (await get(record.audio[0].src)).arrayBuffer());
    if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new Error(`Invalid size for ${source.language}/${index}`);
    const filename = `${source.language}-${index}.${extension}`;
    await writeFile(join(DEST, filename), bytes);
    const fixture = {
      filename, language: source.language, dataset: source.dataset, source: source.source,
      rowIndex: index, datasetId: source.language === "hi" ? record.id : record._row_id,
      sentenceId: record.sentence_id ?? null, audioId: record.audio_id ?? null,
      recorder: record.recorder ?? null,
      originalSentenceUrl: record.sentence_id ? `https://tatoeba.org/en/sentences/show/${record.sentence_id}` : null,
      transcript: record.raw_transcription ?? record.text,
      license: source.language === "mr" ? record.audio_license : source.license,
      mimeType, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"),
      use: "Temporary local research only; do not commit or redistribute these recordings."
    };
    fixtures.push(fixture);
    console.log(`${filename}: ${bytes.length} bytes, ${fixture.license}`);
  }
}
await writeFile(join(DEST, "fixtures.json"), JSON.stringify({
  note: "Read-speech samples, not controlled spoken legal queries. FLEURS requires attribution; Marathi samples are non-commercial only. Audio remains local and ignored.",
  fixtures
}, null, 2));
