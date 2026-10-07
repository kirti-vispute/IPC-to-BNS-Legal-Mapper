import test from "node:test";
import assert from "node:assert/strict";
import { translationParts, translateInputQuery, translateTexts } from "../backend/core/multilingual.js";

for (const [name, punctuation] of [["Indic danda", "\u0964"], ["double danda", "\u0965"], ["Urdu full stop", "\u06d4"]]) {
  test(`${name} preserves native source bytes and literal date/section around bounded translation parts`, () => {
    const clause = `एक व्यक्ति ने दूसरे व्यक्ति का मोबाइल फोन उसकी अनुमति के बिना लिया और उसे अपने पास रख लिया${punctuation}`;
    const query = `2024-06-20 ${`${clause} `.repeat(5)} IPC 379`;
    const parts = translationParts(query);
    assert.equal(parts.map(p => p.text).join(""), query);
    assert.ok(parts.filter(p => !p.literal).every(p => p.text.length <= 320));
    assert.ok(parts.some(p => p.literal && p.text === "2024-06-20"));
    assert.ok(parts.some(p => p.literal && p.text === "IPC 379"));
  });
}

test("short native passages retain context, whitespace, identifiers and protected URLs", () => {
  const query = "पहला वाक्य।  दूसरा वाक्य॥\tتیسرا جملہ۔\nIPC 379 https://example.gov/act.pdf PDF page 80";
  const parts = translationParts(query);
  assert.equal(parts.map(p => p.text).join(""), query);
  assert.deepEqual(parts.filter(p => !p.literal).map(p => p.text), ["पहला वाक्य।  दूसरा वाक्य॥\tتیسرا جملہ۔"]);
  assert.ok(parts.some(p => p.literal && p.text === "https://example.gov/act.pdf"));
  assert.ok(parts.some(p => p.literal && p.text === "PDF page 80"));
});

test("short single-date input preserves whole context and restores date and section", async () => {
  const sentences = ["एक व्यक्ति ने बिना अनुमति फोन लिया।", "उसने फोन अपने पास रखा।", "मालिक ने पुलिस को घटना की सूचना दी।"];
  const outputs = ["A person took a phone without permission.", "He kept the phone.", "The owner reported the incident to the police."];
  let calls = 0;
  const result = await translateInputQuery(`2024-06-20 ${sentences.join(" ")} IPC 379`, "hi", async payload => {
    calls++;
    assert.deepEqual(payload.texts, [sentences.join(" ")]);
    assert.equal(payload.source, "hi");
    assert.equal(payload.target, "en");
    return { texts: [outputs.join(" ")] };
  });
  assert.equal(calls, 1);
  assert.equal(result, `2024-06-20 ${outputs.join(" ")} IPC 379`);
});

test("long single-date input sends every source character in order without exposing protected literals", async () => {
  const clause = "एक व्यक्ति ने दूसरे व्यक्ति का मोबाइल फोन उसकी अनुमति के बिना लिया और उसे अपने पास रख लिया।";
  const query = `2024-06-20 ${Array(5).fill(clause).join(" ")} IPC 379`;
  const result = await translateInputQuery(query, "hi", async payload => {
    assert.equal(payload.texts.join(" "), Array(5).fill(clause).join(" "));
    assert.ok(payload.texts.every(text => text.length <= 320 && !/2024|IPC|379/.test(text)));
    return { texts: ["First complete passage.", "Second complete passage."] };
  });
  assert.equal(result, "2024-06-20 First complete passage. Second complete passage. IPC 379");
});

test("unpunctuated long sentences still use the existing bounded length fallback", () => {
  const query = "अनुमति फोन लिया ".repeat(80);
  const parts = translationParts(query);
  assert.equal(parts.map(p => p.text).join(""), query);
  assert.ok(parts.filter(p => !p.literal).every(p => p.text.length <= 320));
});

test("ASCII sentences and English display translation keep the same literal protection", async () => {
  const query = "First sentence. Second sentence! Third sentence? Fourth; IPC 379, 2024-06-20";
  assert.deepEqual(translationParts(query).filter(p => !p.literal).map(p => p.text),
    ["First sentence.", "Second sentence!", "Third sentence?", "Fourth;"]);
  const [translated] = await translateTexts(["A sentence. IPC 379 PDF page 80"], "en", "hi",
    async payload => ({ texts: payload.texts.map(() => "अनुवादित वाक्य।") }));
  assert.equal(translated, "अनुवादित वाक्य। IPC 379 PDF page 80");
});
