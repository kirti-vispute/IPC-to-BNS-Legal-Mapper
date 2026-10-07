import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { HINDI_WHISPER_MODEL, MARATHI_WHISPER_MODEL } from "../backend/core/transcriber.js";

const root = resolve(import.meta.dirname, "..");
const out = join(root, "output/public-speech-validation/voice-selection-20261006/live");
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const read = async path => JSON.parse(await readFile(join(root, path), "utf8"));
const fixtures = [
  { manifest: "output/voice-verification/real-speech/fixtures.json", name: "hi-44.wav", language: "hi", model: HINDI_WHISPER_MODEL },
  { manifest: "output/public-speech-validation/fresh-marathi-20261003/fixtures.json", name: "mr-30.wav", language: "mr", model: MARATHI_WHISPER_MODEL }
];
const sourceFiles = ["scripts/verify_voice_language_selection.mjs", "tests/voiceLanguageSelection.test.js",
  "frontend/app.js", "backend/core/transcriber.js", "backend/speech/transcribe.py", "backend/speech/review.py",
  "output/public-speech-validation/voice-selection-20261006/before.json"];
const hashes = {};
for (const path of sourceFiles) hashes[path] = sha(await readFile(join(root, path)));
for (const fixture of fixtures) {
  hashes[fixture.manifest] = sha(await readFile(join(root, fixture.manifest)));
  fixture.record = (await read(fixture.manifest)).fixtures.find(row => row.filename === fixture.name && row.language === fixture.language);
  assert.ok(fixture.record);
  fixture.path = `${fixture.manifest.slice(0, fixture.manifest.lastIndexOf("/"))}/${fixture.name}`;
  const body = await readFile(join(root, fixture.path));
  hashes[fixture.path] = sha(body);
  assert.equal(hashes[fixture.path], fixture.record.sha256);
}
await mkdir(out);
const save = (name, value) => writeFile(join(out, name), `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
await save("registration.json", { type: "SELECTED_LANGUAGE_REAL_HTTP_WIRING", hashes,
  createdAt: new Date().toISOString(), physicalMicrophone: false, acousticAccuracyEvaluation: false,
  fixtures: fixtures.map(item => ({ filename: item.name, language: item.language, source: item.record.source,
    license: item.record.license, sha256: item.record.sha256 })),
  limitations: "Previously inspected public clips, not unseen legal speech. Request-language plumbing only; transcripts can remain wrong. No recording UI injection or legal Analyze request." });
const rows = [];
let failure = null;
try {
  const served = await fetch("http://localhost:3002/app.js");
  assert.equal(sha(Buffer.from(await served.arrayBuffer())), hashes["frontend/app.js"]);
  for (const fixture of fixtures) {
    const response = await fetch(`http://localhost:3002/api/transcribe?mode=transcribe&language=${fixture.language}`, {
      method: "POST", headers: { "Content-Type": fixture.record.mimeType },
      body: await readFile(join(root, fixture.path)), signal: AbortSignal.timeout(195000)
    });
    const raw = await response.text();
    await writeFile(join(out, `${fixture.language}-response.json`), raw, { flag: "wx" });
    const data = JSON.parse(raw);
    const passed = response.ok && data.inputLanguage === fixture.language && data.languageStatus === "selected"
      && data.languageSource === "user-selected" && data.model === fixture.model && data.originalInput === data.text
      && data.translatedToEnglish === false && /\p{Script=Devanagari}/u.test(data.text);
    rows.push({ filename: fixture.name, language: fixture.language, status: response.status,
      model: data.model, languageSource: data.languageSource, passed, rawSHA256: sha(raw) });
    assert.equal(passed, true);
  }
} catch (error) { failure = { message: error.message, code: error.code || null }; }
const changed = [];
for (const [path, expected] of Object.entries(hashes)) if (sha(await readFile(join(root, path))) !== expected) changed.push(path);
const report = { type: "SELECTED_LANGUAGE_REAL_HTTP_WIRING", rows, failure, changedInputs: changed,
  usable: !failure && !changed.length && rows.length === 2, productionBackendChanged: false,
  limitations: "Native metadata/script and text preservation are checked, not correct words or legal accuracy. Written/Spoken selector resolution is separately tested against actual frontend and adapter with a stub recognizer." };
await save("report.json", report);
console.log(JSON.stringify(report));
if (!report.usable) process.exitCode = 1;
