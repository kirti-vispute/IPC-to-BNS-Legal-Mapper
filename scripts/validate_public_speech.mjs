import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, open, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const DATASET = "ConvoZenAI/indictelephony-bench";
const REVISION = "d1a7902dd956cd3eb10304d7142df602273d8bd6";
const COLLECTION_REVISION = "aa72c79dbb97644e50ae26cfa267d8fa81a37ce7";
const SOURCE = `https://huggingface.co/datasets/${DATASET}`;
const PREVIOUS = ["marathi-telephony", "real-speech", "holdout-speech"];
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

export function runDirectory(name) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(name || "")) throw new Error("Use a fresh simple run name");
  return join(ROOT, "output", "public-speech-validation", name);
}

export function historyFiles(extraRuns = []) {
  return [...PREVIOUS.map(folder => `output/voice-verification/${folder}/fixtures.json`),
    ...[...new Set(extraRuns)].map(name => {
      runDirectory(name);
      return `output/public-speech-validation/${name}/fixtures.json`;
    })];
}

export function normalizeSpeech(text) {
  // Indic vowel signs are combining marks: removing non-\w characters corrupts words.
  return String(text).normalize("NFKC").toLowerCase().replace(/[\p{P}\p{S}]/gu, " ").replace(/\s+/gu, " ").trim();
}

function distance(left, right) {
  let previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 0; i < left.length; i++) {
    const current = [i + 1];
    for (let j = 0; j < right.length; j++) {
      current.push(Math.min(current[j] + 1, previous[j + 1] + 1, previous[j] + Number(left[i] !== right[j])));
    }
    previous = current;
  }
  return previous[right.length];
}

export function speechErrors(reference, text) {
  const expected = normalizeSpeech(reference), actual = normalizeSpeech(text);
  if (!expected) throw new Error("A nonempty published reference is required");
  const words = expected.split(" "), chars = Array.from(expected);
  const wordEdits = distance(words, actual ? actual.split(" ") : []);
  const charEdits = distance(chars, Array.from(actual));
  return { wordEdits, referenceWords: words.length, charEdits, referenceChars: chars.length,
    wer: wordEdits / words.length, cer: charEdits / chars.length };
}

export function eligibleRow(item, calls, utterances) {
  const row = item.row;
  return Number.isInteger(item.row_idx) && row?.language === "mr" && typeof row.call_id === "string"
    && typeof row.utterance_id === "string" && !calls.has(row.call_id) && !utterances.has(row.utterance_id)
    && row.duration_sec >= 5 && row.duration_sec <= 25 && typeof row.transcription === "string"
    && row.transcription.length >= 50 && row.audio?.[0]?.type === "audio/wav"
    && typeof row.audio[0].src === "string" && row.audio[0].src.startsWith("https://");
}

export function verifyDataset(info, revision = REVISION) {
  if (info.id !== DATASET || info.sha !== revision || info.cardData?.license !== "cc-by-4.0") {
    throw new Error("Pinned dataset identity/revision/CC BY 4.0 license mismatch");
  }
}

export function summarize(rows) {
  const scored = rows.filter(row => !row.error && row.metrics);
  const sum = key => scored.reduce((total, row) => total + row.metrics[key], 0);
  return { total: rows.length, completed: scored.length, failed: rows.length - scored.length,
    microWER: scored.length ? sum("wordEdits") / sum("referenceWords") : null,
    microCER: scored.length ? sum("charEdits") / sum("referenceChars") : null,
    meanClipWER: scored.length ? sum("wer") / scored.length : null,
    meanClipCER: scored.length ? sum("cer") / scored.length : null,
    failuresExcludedFromEditRates: true,
    // Failed requests remain visible rather than pretending their transcripts were empty.
    allRequestsCompleted: scored.length === rows.length && rows.length > 0 };
}

async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).origin}`);
  return response;
}

async function newJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
}

async function collect(directory, extraRuns = []) {
  const prior = [];
  const previousFiles = {};
  for (const name of historyFiles(extraRuns)) {
    const bytes = await readFile(join(ROOT, name));
    previousFiles[name] = hash(bytes);
    prior.push(...JSON.parse(bytes).fixtures);
  }
  const calls = new Set(prior.map(item => item.callId).filter(Boolean));
  const utterances = new Set(prior.map(item => item.utteranceId).filter(Boolean));
  const audioHashes = new Set(prior.map(item => item.sha256));
  const metadataUrl = `https://huggingface.co/api/datasets/${DATASET}`;
  const before = await (await get(metadataUrl)).json();
  verifyDataset(before, COLLECTION_REVISION);
  await mkdir(join(ROOT, "output/public-speech-validation"), { recursive: true });
  await mkdir(directory); // Refuse an existing run, even if it was interrupted.
  await newJson(join(directory, "metadata-before.json"), before);
  const fixtures = [], pages = [];
  // Fixed metadata-only scan order, committed before any speech inference; no outcome selection.
  for (let offset = 0; offset < 2500 && fixtures.length < 8; offset += 100) {
    const params = new URLSearchParams({ dataset: DATASET, config: "Marathi", split: "test",
      offset: String(offset), length: "100" });
    const bytes = Buffer.from(await (await get(`https://datasets-server.huggingface.co/rows?${params}`)).arrayBuffer());
    const page = JSON.parse(bytes);
    await writeFile(join(directory, `rows-${offset}.json`), bytes, { flag: "wx" });
    pages.push({ offset, sha256: hash(bytes) });
    for (const item of page.rows || []) {
      if (!eligibleRow(item, calls, utterances)) continue;
      const row = item.row;
      const response = await get(row.audio[0].src);
      const chunks = [];
      let length = 0;
      for await (const chunk of response.body) {
        length += chunk.length;
        if (length > 10 * 1024 * 1024) throw new Error("Public audio exceeds size limit");
        chunks.push(chunk);
      }
      const audio = Buffer.concat(chunks);
      const sha256 = hash(audio);
      if (!audio.length) throw new Error("Empty public audio");
      if (audioHashes.has(sha256)) continue;
      calls.add(row.call_id); utterances.add(row.utterance_id); audioHashes.add(sha256);
      const filename = `mr-${item.row_idx}.wav`;
      await writeFile(join(directory, filename), audio, { flag: "wx" });
      fixtures.push({ filename, language: "mr", dataset: DATASET, source: SOURCE, license: "CC BY 4.0",
        rowIndex: item.row_idx, callId: row.call_id, utteranceId: row.utterance_id,
        languageTag: row.language_tag, domain: row.domain, durationSeconds: row.duration_sec,
        transcript: row.transcription, mimeType: "audio/wav", bytes: audio.length, sha256 });
      console.log(JSON.stringify({ collected: filename, seconds: row.duration_sec, call: row.call_id }));
      if (fixtures.length === 8) break;
    }
  }
  const after = await (await get(metadataUrl)).json();
  verifyDataset(after, COLLECTION_REVISION);
  await newJson(join(directory, "metadata-after.json"), after);
  if (fixtures.length !== 8) throw new Error(`Only ${fixtures.length} eligible disjoint calls; do not infer yet`);
  await newJson(join(directory, "fixtures.json"), { type: "DISJOINT_PUBLIC_SPEECH_DIAGNOSTIC",
    datasetRevision: COLLECTION_REVISION, previousFiles, excludedPriorCalls: [...new Set(prior.map(item => item.callId).filter(Boolean))],
    excludedPriorAudioHashes: prior.map(item => item.sha256), pages,
    selection: "First eligible row per new call in fixed ascending 100-row windows, 5..25 seconds, at least50 transcript characters,8 calls. No inference used for selection.",
    provenanceLimit: "Dataset viewer is unversioned. Repository revision checked before/after; raw pages and audio hashed. This does not independently authenticate viewer rows at that revision or transcripts.",
    limitations: "Previously untested by this project, not proven absent from model training. Published transcripts, not expert legal labels. Calls are disjoint, speakers not independently identified. Local research only; no audio redistribution or legal-corpus inclusion.",
    fixtures });
}

async function run(directory) {
  const manifest = JSON.parse(await readFile(join(directory, "fixtures.json"), "utf8"));
  if (manifest.datasetRevision !== COLLECTION_REVISION || manifest.fixtures.length !== 8) throw new Error("Unexpected fixture manifest");
  for (const [name, expected] of Object.entries(manifest.previousFiles)) {
    if (hash(await readFile(join(ROOT, name))) !== expected) throw new Error("Earlier fixture metadata changed");
  }
  try { await access(join(directory, "report.json")); throw new Error("Do not overwrite a completed report"); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const log = await open(join(directory, "observations.jsonl"), "wx");
  const rows = [];
  try {
    for (const fixture of manifest.fixtures) {
      if (!/^mr-\d+\.wav$/.test(fixture.filename)) throw new Error("Invalid fixture filename");
      const audio = await readFile(join(directory, fixture.filename));
      if (hash(audio) !== fixture.sha256 || manifest.excludedPriorAudioHashes.includes(fixture.sha256)
        || manifest.excludedPriorCalls.includes(fixture.callId)) throw new Error("Fixture checksum/disjointness mismatch");
      const start = performance.now();
      let row;
      try {
        const response = await fetch("http://127.0.0.1:3002/api/transcribe?mode=transcribe&language=mr", {
          method: "POST", headers: { "Content-Type": fixture.mimeType }, body: audio,
          signal: AbortSignal.timeout(135_000) });
        const speech = await response.json();
        if (!response.ok) throw new Error(speech.error?.code || speech.code || `HTTP_${response.status}`);
        if (speech.inputLanguage !== "mr" || speech.languageSource !== "user-selected"
          || speech.translatedToEnglish !== false || typeof speech.text !== "string" || !speech.text.trim()) {
          throw new Error("Native speech contract mismatch");
        }
        row = { filename: fixture.filename, callId: fixture.callId, durationSeconds: fixture.durationSeconds,
          reference: fixture.transcript, speech, metrics: speechErrors(fixture.transcript, speech.text) };
      } catch (error) { row = { filename: fixture.filename, callId: fixture.callId, error: error.message }; }
      row.elapsedMs = Math.round(performance.now() - start);
      rows.push(row);
      await log.write(`${JSON.stringify(row)}\n`);
      console.log(JSON.stringify({ file: row.filename, elapsedMs: row.elapsedMs, wer: row.metrics?.wer, error: row.error }));
    }
  } finally { await log.close(); }
  const report = { type: "ACTUAL_PRODUCTION_HTTP_PUBLIC_ASR_DIAGNOSTIC", createdAt: new Date().toISOString(),
    fixtureManifestSHA256: hash(await readFile(join(directory, "fixtures.json"))),
    normalization: "NFKC lowercase; punctuation/symbols to spaces, collapse whitespace; preserve Indic combining marks. CER uses Unicode code points, not graphemes. No numeral/spoken-number equivalence.",
    limitations: manifest.limitations, legalPipelineInvoked: false, modelTrainingPerformed: false,
    settingsChanged: false, summary: summarize(rows), rows };
  await newJson(join(directory, "report.json"), report);
  console.log(JSON.stringify(report.summary));
  if (!report.summary.allRequestsCompleted) process.exitCode = 1;
}

async function rescore(directory) {
  const sources = ["output/project-completion/public-speech-comparison.json",
    "output/project-completion/public-telephony-comparison.json"];
  const fixtures = [], fixtureHashes = {};
  for (const folder of PREVIOUS) {
    const name = `output/voice-verification/${folder}/fixtures.json`;
    const bytes = await readFile(join(ROOT, name));
    fixtureHashes[name] = hash(bytes);
    for (const fixture of JSON.parse(bytes).fixtures) {
      if (hash(await readFile(join(ROOT, "output/voice-verification", folder, fixture.filename))) !== fixture.sha256) {
        throw new Error("Prior public audio checksum mismatch");
      }
      fixtures.push(fixture);
    }
  }
  const inputHashes = {}, rows = [], groups = new Map();
  for (const name of sources) {
    const bytes = await readFile(join(ROOT, name));
    inputHashes[name] = hash(bytes);
    for (const row of JSON.parse(bytes).rows) {
      const fixture = fixtures.find(f => f.filename === row.file && f.sha256 === row.sha256);
      if (!fixture || fixture.transcript !== row.reference || fixture.language !== row.language) {
        throw new Error("Saved transcript does not match published fixture provenance");
      }
      const scored = { sourceFile: name, language: row.language, split: row.split, profile: row.profile,
        filename: row.file, audioSHA256: row.sha256, reference: row.reference, hypothesis: row.text,
        previousWER: row.wer, previousCER: row.cer, metrics: speechErrors(row.reference, row.text) };
      rows.push(scored);
      const key = `${name}/${row.language}/${row.split}/${row.profile}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(scored);
    }
  }
  await mkdir(join(ROOT, "output/public-speech-validation"), { recursive: true });
  await mkdir(directory);
  const groupSummary = [...groups].map(([group, items]) => ({ group, ...summarize(items),
    previousMeanClipWER: items.reduce((sum, row) => sum + row.previousWER, 0) / items.length,
    previousMeanClipCER: items.reduce((sum, row) => sum + row.previousCER, 0) / items.length }));
  await newJson(join(directory, "rescore.json"), { type: "OFFLINE_SAVED_PUBLIC_SPEECH_RESCORING",
    createdAt: new Date().toISOString(), inputHashes, fixtureHashes,
    normalization: "NFKC lowercase, punctuation/symbols to spaces, preserve combining marks; CER code points. Prior regex removed Indic vowel signs. Neither method is the dataset official scorer.",
    limitations: "Previously tested public read/telephone speech, NOT fresh holdout, physical microphone, legal speech accuracy or model improvement. Published references not independently checked. Saved original metrics/audio/transcripts/settings remain unchanged.",
    modelInferencePerformed: false, productionChanged: false, groupSummary, rows });
  console.log(JSON.stringify({ rescoredRows: rows.length, groupSummary }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, name, ...options] = process.argv.slice(2);
  const directory = runDirectory(name);
  const extraRuns = [];
  for (let index = 0; index < options.length; index += 2) {
    if (mode !== "collect" || options[index] !== "--exclude-run" || !options[index + 1]) {
      throw new Error("Only collect accepts --exclude-run prior-run-name");
    }
    extraRuns.push(options[index + 1]);
  }
  if (mode === "collect") await collect(directory, extraRuns);
  else if (mode === "run") await run(directory);
  else if (mode === "rescore") await rescore(directory);
  else throw new Error("Usage: node scripts/validate_public_speech.mjs collect|run|rescore fresh-run-name");
}
