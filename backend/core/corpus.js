import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import original from "../data/statutes.json" with { type: "json" };
import supplements from "../data/statute-supplements.json" with { type: "json" };
import manifest from "../../legal-sources/supplements/manifest.json" with { type: "json" };

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const supplementBytes = readFileSync(new URL("../data/statute-supplements.json", import.meta.url));
if (hash(supplementBytes) !== manifest.recordsSha256) throw new Error("Supplement record checksum mismatch.");
for (const record of supplements) {
  const approved = manifest.sources.find(source => source.file === record.source.file && source.sha256 === record.source.sha256);
  const previous = original.find(doc => doc.id === record.id);
  if (!approved || !previous || previous.recordType !== "mapping-reference" || record.code !== previous.code || record.section !== previous.section || JSON.stringify(record.mapsTo) !== JSON.stringify(previous.mapsTo)) {
    throw new Error("Unapproved statute supplement.");
  }
  if (hash(readFileSync(new URL(`../../legal-sources/${approved.file}`, import.meta.url))) !== approved.sha256) throw new Error("Supplement PDF checksum mismatch.");
}

const byId = new Map(supplements.map(doc => [doc.id, doc]));
export const corpus = original.map(doc => byId.get(doc.id) || doc);
