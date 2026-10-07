import test from "node:test";
import assert from "node:assert/strict";
import { PRIMARY, RESERVE, overlap, verifyLicense } from "../scripts/obtain_hindi_baseline.mjs";

test("Hindi baseline selection is fixed and excludes prior/unused cue rows", () => {
  assert.equal(PRIMARY.length, 12);
  assert.equal(new Set([...PRIMARY, ...RESERVE]).size, 24);
  for (const row of [6, 18, 29, 44, 53, 60, 61, 62, 63, 67, 82, 91]) {
    assert.ok(![...PRIMARY, ...RESERVE].includes(row));
  }
});

test("Hindi acquisition verifies source-card frontmatter rather than prose", () => {
  verifyLicense("---\nlicense:\n- cc-by-4.0\n---\ncard");
  assert.throws(() => verifyLicense("---\nlicense:\n- unknown\n---\ncc-by-4.0"));
});

test("Hindi recordings reject either sentence or audio overlap", () => {
  const previous = [{ datasetId: 3, sha256: "old" }];
  assert.equal(overlap({ id: 3 }, "new", previous), "sentence-ID overlap");
  assert.equal(overlap({ id: 4 }, "old", previous), "audio-SHA256 overlap");
  assert.equal(overlap({ id: 4 }, "new", previous), null);
});
