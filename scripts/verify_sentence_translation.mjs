import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { translationParts, translateTexts, translateInputQuery, createStreamingTranslationWorker, analyzeMultilingualQuery } from "../backend/core/multilingual.js";
import { analyzeQuery } from "../backend/core/pipeline.js";

const root = resolve(import.meta.dirname, "..");
const out = join(root, "output/sentence-translation");
const mode = process.argv[2] || "before";
await mkdir(out, { recursive: true });
const hash = data => createHash("sha256").update(data).digest("hex");
async function walk(path) {
  const files = [];
  for (const item of await readdir(path, { withFileTypes: true })) {
    const child = join(path, item.name);
    files.push(...(item.isDirectory() ? await walk(child) : [child]));
  }
  return files;
}
async function hashes() {
  const paths = [...await walk(join(root, "evaluation")), ...await walk(join(root, "legal-sources")),
    ...await walk(join(root, "backend/data")), ...await walk(join(root, "frontend")),
    ...await walk(join(root, "backend/speech")), ...await walk(join(root, "backend/translation")),
    ...(await walk(join(root, "backend/core"))).filter(path => !path.endsWith("multilingual.js"))];
  return Object.fromEntries(await Promise.all(paths.filter(path => !path.includes("__pycache__")).map(async path =>
    [relative(root, path).replaceAll("\\", "/"), hash(await readFile(path))])));
}
const save = (name, data) => writeFile(join(out, name), `${JSON.stringify(data, null, 2)}\n`);
if (mode === "guards") {
  const fixtures = JSON.parse(await readFile(join(root, "tests/fixtures/multilingual-completion.json")));
  const worker = createStreamingTranslationWorker();
  const rows = [];
  try {
    await worker.warmup();
    for (const fixture of fixtures.filter(f => ["gu", "kn"].includes(f.language))) {
      const query = `2024-07-10 ${fixture.cheating}`;
      try {
        const result = await analyzeMultilingualQuery(query, { originalLanguage: fixture.language, worker });
        rows.push({ language: fixture.language, query, error: null, english: result.multilingual.englishQuery });
      } catch (error) { rows.push({ language: fixture.language, query, error: error.code || error.message }); }
    }
    await save("intent-guards.json", { type: "KNOWN_FAILURE_RECHECK_NOT_ACCURACY", rows });
    console.log(JSON.stringify(rows));
  } finally { worker.close(); }
} else if (mode === "audit") {
  const before = JSON.parse(await readFile(join(out, "protected-before.json")));
  const after = await hashes();
  const changed = Object.keys(before).filter(path => before[path] !== after[path]);
  const added = Object.keys(after).filter(path => !(path in before));
  const productionAdapterUnchanged = (await readFile(join(root, "backend/core/multilingual.js")))
    .equals(await readFile(join(out, "multilingual.before.js")));
  const result = { checked: Object.keys(before).length, changed, added, productionAdapterUnchanged };
  await save("integrity.json", result);
  console.log(JSON.stringify(result));
  if (changed.length || added.length || !productionAdapterUnchanged) process.exitCode = 1;
} else {
  if (!["before", "after", "context"].includes(mode)) throw Error("Use before, context, after or audit");
  if (mode === "before") {
    try { await readFile(join(out, "protected-before.json")); throw Error("Before snapshot already exists; do not overwrite"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    await save("protected-before.json", await hashes());
    await copyFile(join(root, "backend/core/multilingual.js"), join(out, "multilingual.before.js"));
  }
  const fixtures = JSON.parse(await readFile(join(root, "tests/fixtures/multilingual-completion.json")));
  const cases = fixtures.map(f => ({ id: `${f.language}-repeated`, language: f.language,
    query: `2024-06-20 ${`${f.theft} `.repeat(5)} IPC 379` }));
  cases.push(
    { id: "hi-distinct", language: "hi", query: "2024-06-20 एक व्यक्ति ने बिना अनुमति मोबाइल फोन लिया। उसने फोन अपने पास रखा। मालिक ने पुलिस को घटना की सूचना दी।" },
    { id: "bn-distinct", language: "bn", query: "2024-06-20 একজন ব্যক্তি অনুমতি ছাড়া একটি ফোন নিয়েছিল। সে ফোনটি নিজের কাছে রেখেছিল। মালিক পুলিশকে ঘটনাটি জানিয়েছিলেন।" },
    { id: "pa-distinct", language: "pa", query: "2024-06-20 ਇੱਕ ਵਿਅਕਤੀ ਨੇ ਬਿਨਾਂ ਇਜਾਜ਼ਤ ਫੋਨ ਲਿਆ। ਉਸ ਨੇ ਫੋਨ ਆਪਣੇ ਕੋਲ ਰੱਖਿਆ। ਮਾਲਕ ਨੇ ਪੁਲਿਸ ਨੂੰ ਘਟਨਾ ਬਾਰੇ ਦੱਸਿਆ।" },
    { id: "ur-distinct", language: "ur", query: "2024-06-20 ایک شخص نے اجازت کے بغیر فون لیا۔ اس نے فون اپنے پاس رکھا۔ مالک نے پولیس کو واقعے کی اطلاع دی۔" }
  );
  const worker = createStreamingTranslationWorker();
  const rows = [];
  const sentenceParts = text => (text.match(/[^.!?;\n\u0964\u0965\u06d4]+[.!?;\n\u0964\u0965\u06d4]*|[.!?;\n\u0964\u0965\u06d4]+/gu) || []).flatMap(part => translationParts(part));
  const contextChunks = text => {
    const chunks = [];
    for (let rest of text.match(/[^.!?;\n]+[.!?;\n]*|[.!?;\n]+/g) || []) {
      while (rest.length) {
        const end = Math.max(...["\u0964", "\u0965", "\u06d4"].map(mark => rest.lastIndexOf(mark, 319)));
        const boundary = rest.length <= 320 ? rest.length : end >= 0 ? end + 1
          : rest.lastIndexOf(" ", 320) > 0 ? rest.lastIndexOf(" ", 320) : 320;
        chunks.push(rest.slice(0, boundary));
        rest = rest.slice(boundary);
      }
    }
    return chunks;
  };
  const run = async (query, language, prototype) => {
    const calls = [];
    const traced = async payload => { calls.push(payload.texts); return worker(payload); };
    const start = performance.now();
    try {
      const english = prototype
        ? (await translateTexts(mode === "context" ? contextChunks(query)
          : query.match(/[^.!?;\n\u0964\u0965\u06d4]+[.!?;\n\u0964\u0965\u06d4]*|[.!?;\n\u0964\u0965\u06d4]+/gu) || [], language, "en", traced)).join("")
        : await translateInputQuery(query, language, traced);
      const canonical = analyzeQuery(english);
      return { english, phrases: calls.flat(), elapsedMs: Math.round(performance.now() - start),
        route: canonical.gate.route, date: canonical.facts.offenseDate, top3: canonical.retrieved.map(d => d.id) };
    } catch (error) { return { error: error.code || error.message, phrases: calls.flat() }; }
  };
  try {
    await worker.warmup();
    for (const item of cases) {
      const row = { ...item, sourceParts: translationParts(item.query), proposedParts: mode === "context"
        ? contextChunks(item.query).flatMap(part => translationParts(part)) : sentenceParts(item.query),
        current: await run(item.query, item.language, false) };
      if (mode !== "after") row.prototype = await run(item.query, item.language, true);
      rows.push(row);
      console.log(JSON.stringify(row));
      await save(`${mode}.json`, { type: "SYNTHETIC_SENTENCE_BOUNDARY_DIAGNOSTIC", limitations:
        "Real-model software probes, not expert labels, natural speech or validated legal/translation accuracy. The English probe calls the translator directly to isolate chunking; production English input bypasses translation.", rows });
    }
  } finally { worker.close(); }
}
