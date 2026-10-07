import test from "node:test";
import assert from "node:assert/strict";
import { REPO, REVISION, MODEL_SHA, MODEL_BYTES, PRIMARY, RESERVE, verifyModelMetadata } from "../scripts/obtain_hindi_turbo.mjs";

test("Turbo candidate metadata requires exact revision, license, size and weight identity", () => {
  const meta = { id: REPO, sha: REVISION, cardData: { license: "mit" }, siblings:
    ["README.md", "config.json", "preprocessor_config.json", "tokenizer.json", "vocabulary.json", "model.bin"].map(name =>
      ({ rfilename: name, blobId: "a".repeat(40), size: name === "model.bin" ? MODEL_BYTES : 1,
        ...(name === "model.bin" ? { lfs: { sha256: MODEL_SHA } } : {}) })) };
  verifyModelMetadata(meta);
  for (const changed of [{ ...meta, sha: "main" }, { ...meta, cardData: { license: "unknown" } },
    { ...meta, siblings: meta.siblings.filter(f => f.rfilename !== "model.bin") }]) {
    assert.throws(() => verifyModelMetadata(changed));
  }
});

test("Fresh confirmation order is fixed and avoids inspected and rejected-cue rows", () => {
  assert.equal(PRIMARY.length, 4);
  assert.equal(new Set([...PRIMARY, ...RESERVE]).size, 12);
  const used = [0,7,14,21,28,35,42,49,56,70,77,98,6,18,29,44,53,67,82,91,60,61,62,63];
  assert.ok([...PRIMARY, ...RESERVE].every(row => !used.includes(row)));
});
