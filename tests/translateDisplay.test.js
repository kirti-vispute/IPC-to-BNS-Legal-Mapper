import test from "node:test";
import assert from "node:assert/strict";
import { translateDisplayText } from "../backend/core/multilingual.js";

const english = "Theft on 20 June 2024 under IPC 379.";

// Fake worker: sentences with digits come back with a changed number when `corrupt` is set;
// everything else is tagged with the target language so the route taken is visible.
function fakeWorker({ corrupt = false, detect = { language: "hi", confidence: 0.95 } } = {}) {
  const calls = [];
  const worker = async payload => {
    calls.push(payload);
    if (payload.action === "detect") return detect;
    return { texts: payload.texts.map(text => (corrupt && /\d/.test(text) ? text.replace(/\d+/g, "99") : `<${payload.target}:${text}>`)) };
  };
  worker.calls = calls;
  return worker;
}

test("an empty box is returned untouched without calling the model", async () => {
  const worker = fakeWorker();
  const result = await translateDisplayText("   ", { target: "hi", worker });
  assert.deepEqual(result, { text: "", sourceLanguage: null, targetLanguage: "hi", changed: false });
  assert.equal(worker.calls.length, 0);
});

test("Auto and unknown targets are rejected instead of guessed", async () => {
  for (const target of ["auto", "xx", undefined]) {
    await assert.rejects(translateDisplayText(english, { target, worker: fakeWorker() }), error => error.code === "UNSUPPORTED_LANGUAGE");
  }
});

test("text already in the chosen language is not translated", async () => {
  const worker = fakeWorker();
  const result = await translateDisplayText("The alleged act happened on 20 June 2024 and concerns theft under the law.", { target: "en", worker });
  assert.equal(result.changed, false);
  assert.equal(result.sourceLanguage, "en");
  assert.equal(worker.calls.length, 0);
});

test("whole-sentence translation is used when every number survives", async () => {
  const worker = fakeWorker();
  const result = await translateDisplayText("The alleged act happened on 20 June 2024 and concerns theft under IPC 379.", { target: "hi", worker });
  assert.equal(result.method, "whole-sentence");
  assert.equal(result.sourceLanguage, "en");
  assert.match(result.text, /^<hi:The alleged act happened on 20 June 2024 and concerns theft under IPC 379\.>$/);
  assert.equal(worker.calls.length, 1);
});

test("a changed number rejects the whole-sentence result and falls back to protected literals", async () => {
  const worker = fakeWorker({ corrupt: true });
  const result = await translateDisplayText("The alleged act happened on 20 June 2024 and concerns theft under IPC 379.", { target: "hi", worker });
  assert.equal(result.method, "protected-literals");
  assert.ok(result.text.includes("20 June 2024"), result.text);
  assert.ok(result.text.includes("IPC 379"), result.text);
  assert.ok(!result.text.includes("99"), result.text);
});

test("a source hint is trusted only when the script matches the text", async () => {
  const worker = fakeWorker();
  // The hint says Gujarati but the text is Devanagari: the hint is ignored and the script decides.
  const result = await translateDisplayText("मेरा फोन चोरी हो गया 20 जून 2024", { source: "gu", target: "en", worker });
  assert.equal(result.sourceLanguage, "hi");
  assert.equal(worker.calls[0].source, "hi");
});

test("ambiguous script falls back to the language detector", async () => {
  const worker = fakeWorker({ detect: { language: "mr", confidence: 0.95 } });
  const result = await translateDisplayText("नमस्कार मित्रा", { target: "en", worker });
  assert.equal(worker.calls[0].action, "detect");
  assert.equal(result.sourceLanguage, "mr");
});

test("an uncertain language is not guessed", async () => {
  const worker = fakeWorker({ detect: { language: "hi", confidence: 0.4 } });
  await assert.rejects(translateDisplayText("नमस्कार मित्रा", { target: "en", worker }), error => error.code === "LANGUAGE_UNCERTAIN");
});

test("overlong text is refused", async () => {
  await assert.rejects(translateDisplayText("word ".repeat(1000), { target: "hi", worker: fakeWorker() }), error => error.code === "TRANSLATION_TEXT_TOO_LONG");
});
