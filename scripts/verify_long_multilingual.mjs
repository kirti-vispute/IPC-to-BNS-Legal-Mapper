import { readFile, writeFile } from "node:fs/promises";
import { analyzeMultilingualQuery, createStreamingTranslationWorker } from "../backend/core/multilingual.js";
const fixtures = JSON.parse(await readFile(new URL("../tests/fixtures/multilingual-completion.json", import.meta.url)));
const worker = createStreamingTranslationWorker();
const rows = [];
try {
  await worker.warmup();
  for (const fixture of fixtures.filter(f => f.language !== "en")) {
    const query = `2024-06-20 ${`${fixture.theft} `.repeat(5)} IPC 379`;
    const start = performance.now();
    let row;
    try {
      const result = await analyzeMultilingualQuery(query, { originalLanguage: fixture.language, worker });
      row = { language: fixture.language, length: query.length, english: result.multilingual.englishQuery,
        passed: result.gate.route === "IPC_ONLY" && result.facts.offenseDate === "2024-06-20" && result.retrieved[0]?.id === "ipc-379",
        route: result.gate.route, top3: result.retrieved.map(d => d.id) };
    } catch (error) { row = { language: fixture.language, length: query.length, passed: false, error: error.code || error.message }; }
    row.elapsedMs = Math.round(performance.now() - start);
    rows.push(row);
    await writeFile(new URL("../output/project-completion/long-language-input.json", import.meta.url), JSON.stringify({
      type: "SYNTHETIC_LONG_INPUT_DIAGNOSTIC", limitations: "Repeated native facts test chunk/literal handling, not natural conversation, legal truth or semantic equivalence. Explicit IPC379 tests identifier priority, not fact-only retrieval.", rows }, null, 2));
    console.log(JSON.stringify(row));
  }
} finally { worker.close(); }
if (rows.some(r => !r.passed)) process.exitCode = 1;
