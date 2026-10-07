import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { transcribeAudio, createStreamingRecognizer, runLocalRecognizer } from "../backend/core/transcriber.js";

const text = "\u092e\u094b\u092c\u093e\u0907\u0932 \u091a\u094b\u0930\u0940 20/06/2024 IPC 379 \ufffd";
const input = { audio: Buffer.from("synthetic"), contentType: "audio/webm", language: "mr", exists: () => true };
const review = () => ({ version: 1, status: "assessed", requiresReview: true, windowCount: 2,
  textModified: false, warningCode: "REVIEW_SATURATED_UNFINISHED_WINDOW", warningWindows: [0, 1],
  silenceConfidenceWindows: [0], compressionWindows: [1] });
const unknown = () => ({ ...review(), status: "unavailable", requiresReview: null, warningCode: null,
  warningWindows: [], silenceConfidenceWindows: [], compressionWindows: [] });

test("Marathi optional review preserves original response and does not retain unknown/raw fields", async () => {
  const payload = { text, speechReview: { ...review(), rawTokens: [123] } };
  const before = structuredClone(payload);
  const actual = await transcribeAudio({ ...input, runner: async () => payload });
  const legacy = await transcribeAudio({ ...input, runner: async () => ({ text }) });
  assert.deepEqual(actual.speechReview, review());
  const { speechReview, ...rest } = actual;
  assert.deepEqual(rest, legacy);
  assert.equal(actual.text, text);
  assert.equal(actual.originalInput, text);
  assert.deepEqual(payload, before);
  actual.speechReview.warningWindows.push(99);
  assert.deepEqual(payload.speechReview.warningWindows, [0, 1]);
});

test("unavailable is unknown rather than clear; assessed clear is distinct", async () => {
  const result = await transcribeAudio({ ...input, runner: async () => ({ text, speechReview: unknown() }) });
  assert.equal(result.speechReview.requiresReview, null);
  const clear = { ...review(), requiresReview: false, warningCode: null, warningWindows: [] };
  const next = await transcribeAudio({ ...input, runner: async () => ({ text, speechReview: clear }) });
  assert.equal(next.speechReview.requiresReview, false);
});

test("invalid review fails closed and the following request recovers", async () => {
  for (const value of [null, [], { ...review(), version: 2 }, { ...review(), textModified: true },
    { ...review(), requiresReview: false }, { ...review(), warningCode: "other" },
    { ...review(), warningWindows: [0, 0] }, { ...review(), warningWindows: [2] },
    { ...review(), windowCount: 129 }, { ...unknown(), requiresReview: false },
    { ...unknown(), warningWindows: [0] }, { ...review(), compressionWindows: "bad" }]) {
    await assert.rejects(transcribeAudio({ ...input, runner: async () => ({ text, speechReview: value }) }),
      error => error.code === "SPEECH_PROCESS_ERROR" && error.statusCode === 502);
  }
  assert.equal((await transcribeAudio({ ...input, runner: async () => ({ text }) })).text, text);
  await assert.rejects(transcribeAudio({ ...input, runner: async () => ({ text: "", speechReview: review() }) }),
    error => error.code === "NO_SPEECH_DETECTED");
});

test("Hindi and Auto retain existing contract without optional Marathi review", async () => {
  for (const language of ["hi", "auto"]) {
    const result = await transcribeAudio({ ...input, language,
      runner: async () => ({ text, originalLanguage: "hi", speechReview: review() }) });
    assert.equal(Object.hasOwn(result, "speechReview"), false);
  }
});

test("both worker transports retain optional review for adapter validation", async () => {
  const spawnMock = streaming => () => {
    const child = new EventEmitter();
    child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.kill = () => child.emit("close", 0);
    child.stdin.on(streaming ? "data" : "finish", () => queueMicrotask(() => {
      child.stdout.write(`${JSON.stringify({ text, speechReview: review() })}${streaming ? "\n" : ""}`);
      if (!streaming) child.emit("close", 0);
    }));
    return child;
  };
  const config = { python: "mock", modelPath: "mock", selectedLanguage: "mr" };
  const runner = createStreamingRecognizer(spawnMock(true));
  try {
    for (let i = 0; i < 2; i++) {
      const result = await transcribeAudio({ ...input, runner: options => runner({ ...options, config }) });
      assert.deepEqual(result.speechReview, review());
      assert.equal(result.text, text);
    }
  } finally { runner.close(); }
  const result = await transcribeAudio({ ...input, runner: options => runLocalRecognizer({ ...options,
    config, spawnImpl: spawnMock(false) }) });
  assert.deepEqual(result.speechReview, review());
});
