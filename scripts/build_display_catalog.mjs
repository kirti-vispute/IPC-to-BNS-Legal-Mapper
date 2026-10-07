import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { staticPresentationTexts } from "../frontend/legalPresentation.js";
import { createStreamingTranslationWorker, translateTexts, translationParts } from "../backend/core/multilingual.js";

const root = resolve(import.meta.dirname, "..");
const model = process.env.LOCAL_TRANSLATION_MODEL || join(root, "models/translation/nllb-int8");
async function digest(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
const texts = [...new Set(staticPresentationTexts().flatMap(text => translationParts(text).filter(part => !part.literal).map(part => part.text)))];
const catalog = { type: "STATIC_DISPLAY_TRANSLATIONS", reviewStatus: "MACHINE_GENERATED_UNREVIEWED",
  modelSha256: await digest(join(model, "model.bin")), tokenizerSha256: await digest(join(model, "tokenizer.json")), entries: {}, omitted: {} };
const path = join(root, "backend/data/display-translations.json");
const worker = createStreamingTranslationWorker();
try {
  await worker.warmup();
  for (const language of ["gu", "bn", "ta", "te", "kn", "ml", "pa", "ur"]) {
    catalog.entries[language] = {};
    catalog.omitted[language] = [];
    for (let start = 0; start < texts.length; start += 16) {
      const batch = texts.slice(start, start + 16);
      try {
        const translated = await translateTexts(batch, "en", language, worker);
        batch.forEach((text, i) => { catalog.entries[language][text] = translated[i]; });
      } catch {
        for (const text of batch) {
          try { catalog.entries[language][text] = (await translateTexts([text], "en", language, worker))[0]; }
          catch (error) { catalog.omitted[language].push({ text, code: error.code }); }
        }
      }
    }
    await writeFile(path, `${JSON.stringify(catalog, null, 2)}\n`);
    console.log(JSON.stringify({ language, entries: Object.keys(catalog.entries[language]).length, omitted: catalog.omitted[language].length }));
  }
} finally { worker.close(); }
