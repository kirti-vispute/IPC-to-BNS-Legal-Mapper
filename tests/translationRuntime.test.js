import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

test("translation runtime deduplicates only display prose and reuses one tokenizer", () => {
  const python = process.env.LOCAL_TRANSLATION_PYTHON || resolve(".venv-translation/Scripts/python.exe");
  const result = spawnSync(python, ["tests/translation_runtime_test.py"], { encoding: "utf8", windowsHide: true, timeout: 10000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
});
