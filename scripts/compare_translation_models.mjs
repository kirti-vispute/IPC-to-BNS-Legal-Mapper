// Offline comparison: existing safety checks are evidence, not gold labels.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { translationMeaningIssue } from "../backend/core/translationChecks.js";

const name = process.argv.slice(2).find(arg => arg !== "--check");
if (name && !/^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/.test(name)) throw new Error("Invalid run name");
const root = join(import.meta.dirname, "../output/translation-model-assessment", name || "");
const models = {};
for (const model of ["nllb", "opus"]) {
  models[model] = JSON.parse(await readFile(join(root, `${model}-probes.json`), "utf8"));
}
const originals = new Map(models.nllb.rows.map(row => [row.id, row]));
if (originals.size !== models.nllb.rows.length || models.opus.rows.length !== originals.size
    || new Set(models.opus.rows.map(row => row.id)).size !== originals.size) throw new Error("Mismatched probe IDs");
for (const row of models.opus.rows) {
  const original = originals.get(row.id);
  if (!original || original.text !== row.text || original.language !== row.language) throw new Error("Mismatched probe source");
}
const comparison = { type: "ISOLATED_MODEL_COMPARISON",
  limitations: "Existing synthetic probes; no gold labels or expert review. Guard acceptance is not semantic or legal correctness. Raw decoder timing excludes loading, adapter and display.",
  models: {}, rows: [] };
for (const [model, report] of Object.entries(models)) {
  const rows = report.rows.map(row => ({ ...row, guard: row.translation
    ? translationMeaningIssue(row.text, row.translation, row.language) : { code: "DECODING_ERROR" } }));
  const ms = rows.map(row => row.elapsedMs).sort((a, b) => a - b);
  const middle = Math.floor(ms.length / 2);
  comparison.models[model] = { executions: rows.length, decoderErrors: rows.filter(row => row.error).length,
    guardRejections: rows.filter(row => row.guard).length,
    medianMs: Math.round(ms.length % 2 ? ms[middle] : (ms[middle - 1] + ms[middle]) / 2),
    p95Ms: ms[Math.ceil(0.95 * ms.length) - 1], totalMs: ms.reduce((a, b) => a + b, 0) };
  comparison.rows.push(...rows.map(row => ({ model, ...row })));
}
const destination = join(root, "comparison.json");
if (process.argv.includes("--check")) {
  const saved = JSON.parse(await readFile(destination, "utf8"));
  if (JSON.stringify(saved) !== JSON.stringify(comparison)) throw new Error("Stored comparison differs from source probes/current guards");
} else await writeFile(destination, `${JSON.stringify(comparison, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify(comparison.models));
