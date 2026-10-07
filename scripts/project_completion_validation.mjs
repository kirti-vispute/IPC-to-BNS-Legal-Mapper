import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { resolve, relative, join } from "node:path";
import { analyzeQuery } from "../backend/core/pipeline.js";
import { analyzeMultilingualQuery, createStreamingTranslationWorker } from "../backend/core/multilingual.js";

const root = resolve(import.meta.dirname, "..");
const out = join(root, "output/project-completion");
await mkdir(out, { recursive: true });
const mode = process.argv[2] || "replay";
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
async function walk(path) {
  const files = [];
  for (const item of await readdir(path, { withFileTypes: true })) {
    const child = join(path, item.name);
    files.push(...(item.isDirectory() ? await walk(child) : [child]));
  }
  return files;
}
async function protectedHashes() {
  const paths = [...await walk(join(root, "evaluation")), ...await walk(join(root, "legal-sources")),
    join(root, "backend/data/statutes.json"), join(root, "backend/data/ipc-bns-mappings.json"), join(root, "backend/core/gateway.js")];
  return Object.fromEntries(await Promise.all(paths.map(async path => [relative(root, path).replaceAll("\\", "/"), hash(await readFile(path))])));
}
async function save(name, value) {
  await writeFile(join(out, name), `${JSON.stringify(value, null, 2)}\n`);
}
if (mode === "baseline") {
  const path = join(out, "protected-baseline.json");
  try { await readFile(path); throw new Error("Baseline exists; do not overwrite it."); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const hashes = await protectedHashes();
  await save("protected-baseline.json", hashes);
  console.log(JSON.stringify({ baselineFiles: Object.keys(hashes).length }));
} else if (mode === "audit") {
  const before = JSON.parse(await readFile(join(out, "protected-baseline.json")));
  const after = await protectedHashes();
  const changed = Object.keys(before).filter(path => before[path] !== after[path]);
  const result = { checked: Object.keys(before).length, changed, newFiles: Object.keys(after).filter(path => !(path in before)) };
  await save("integrity.json", result);
  console.log(JSON.stringify(result));
  if (changed.length) process.exitCode = 1;
} else if (mode === "replay") {
  const refs = JSON.parse(await readFile(join(root, "evaluation/official-source-reference-evaluation/official-source-reference-labels.json"))).records;
  const cases = (await readFile(join(root, "evaluation/cases/candidate-cases.jsonl"), "utf8")).trim().split(/\r?\n/).map(JSON.parse);
  const rows = refs.filter(ref => ref.eligibility.top1).map(ref => {
    const result = analyzeQuery(cases.find(c => c.caseId === ref.caseId).facts);
    const id = doc => `${doc.code.toLowerCase()}-${doc.section.toLowerCase()}`;
    return { caseId: ref.caseId, route: result.gate.route, top3: result.retrieved.map(id),
      top1Correct: id(result.retrieved[0]) === id(ref.referenceTop1),
      top3Hit: result.retrieved.some(doc => ref.acceptable.some(expected => id(doc) === id(expected))) };
  });
  const report = { type: "CURRENT_SOURCE_REPLAY", validation: "NOT_INDEPENDENT_LAWYER_VALIDATION", rows,
    top1: rows.filter(r => r.top1Correct).length, top3: rows.filter(r => r.top3Hit).length, eligible: rows.length };
  await save(process.argv[3] || "current-replay.json", report);
  console.log(JSON.stringify(report));
} else if (mode === "matrix") {
  const fixtures = JSON.parse(await readFile(join(root, "tests/fixtures/multilingual-completion.json"), "utf8"));
  const worker = createStreamingTranslationWorker();
  const rows = [];
  try {
    await worker.warmup();
    for (const fixture of fixtures) {
      if (process.env.VERIFY_LANGUAGE && !process.env.VERIFY_LANGUAGE.split(",").includes(fixture.language)) continue;
      for (const [kind, date, route, family] of [
        ["theft", "2024-06-20", "IPC_ONLY", ["ipc-378", "ipc-379"]],
        ["theft", "2024-07-10", "BNS_PRIMARY", ["bns-303"]],
        ["injury", "2024-07-10", "BNS_PRIMARY", ["bns-114", "bns-115"]],
        ["cheating", "2024-07-10", "BNS_PRIMARY", ["bns-318"]],
        ["theft", "", "CLARIFY", ["ipc-378", "ipc-379", "bns-303"]]
      ]) {
        const query = `${date} ${fixture[kind]}`.trim();
        const start = performance.now();
        let row;
        try {
          const result = await analyzeMultilingualQuery(query, { originalLanguage: fixture.language, worker });
          const canonical = analyzeQuery(result.multilingual?.englishQuery || query);
          const view = result.multilingual?.presentation;
          const ids = result.retrieved.map(doc => doc.id);
          const sourcePreserved = JSON.stringify(result.retrieved) === JSON.stringify(canonical.retrieved);
          const targetScript = !view || fixture.script === "Latin" || new RegExp(`\\p{Script=${fixture.script}}`, "u").test(view.labels.applicableLaw);
          row = { language: fixture.language, kind, query, english: result.multilingual?.englishQuery || query,
            route: result.gate.route, top3: ids, expectedFamily: family, sourcePreserved, targetScript,
            passed: result.gate.route === route && ids.some(id => family.includes(id)) && sourcePreserved && targetScript,
            candidateOnly: Boolean(result.candidateOnly), warnings: result.verifier.warnings };
        } catch (error) { row = { language: fixture.language, kind, query, passed: false, error: error.code || error.message }; }
        row.elapsedMs = Math.round(performance.now() - start);
        rows.push(row);
        console.log(JSON.stringify(row));
        await save(process.argv[3] || "language-matrix.json", { type: "SYNTHETIC_SOFTWARE_DIAGNOSTIC", disclaimer: "Fixture families are software expectations, not expert labels or general legal accuracy.", rows,
          passed: rows.filter(r => r.passed).length, total: rows.length });
      }
    }
  } finally { worker.close(); }
  if (rows.some(r => !r.passed)) process.exitCode = 1;
} else throw new Error(`Unknown mode: ${mode}`);
