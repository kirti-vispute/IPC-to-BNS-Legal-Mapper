import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { MAX_AUDIO_BYTES, transcribeAudio, validateAudioInput, runLocalRecognizer, createStreamingRecognizer, speechStatus } from "../backend/core/transcriber.js";
import { analyzeQuery } from "../backend/core/pipeline.js";

const input = { audio: Buffer.from("mock audio"), contentType: "audio/webm;codecs=opus", exists: () => true };
const legalText = "The alleged act happened on 20 June 2024 and concerns theft of movable property under IPC section 379.";

function processMock({ text = legalText, code = 0, error, stall = false, malformed = false } = {}) {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.killed = false;
  child.kill = () => { child.killed = true; queueMicrotask(() => child.emit("close", -1)); };
  child.stdin.on("finish", () => {
    if (stall) return;
    queueMicrotask(() => {
      child.stdout.write(malformed ? "bad json" : JSON.stringify(error ? { error } : { text }));
      child.emit("close", code);
    });
  });
  return child;
}

test("rejects empty, oversized, unsupported audio and invalid mode before local execution", () => {
  for (const [audio, type, mode, code] of [
    [Buffer.alloc(0), "audio/webm", "transcribe", "EMPTY_AUDIO"],
    [Buffer.alloc(MAX_AUDIO_BYTES + 1), "audio/webm", "transcribe", "AUDIO_TOO_LARGE"],
    [Buffer.from("x"), "text/plain", "transcribe", "UNSUPPORTED_AUDIO_TYPE"],
    [Buffer.from("x"), "audio/webm", "invalid", "UNSUPPORTED_SPEECH_MODE"]
  ]) assert.throws(() => validateAudioInput(audio, type, mode), e => e.code === code);
});

test("selected recording language is limited to Hindi or Marathi", () => {
  assert.equal(validateAudioInput(Buffer.from("x"), "audio/webm", "transcribe", "hi").selectedLanguage, "hi");
  assert.equal(validateAudioInput(Buffer.from("x"), "audio/webm", "transcribe", "auto").selectedLanguage, null);
  assert.throws(() => validateAudioInput(Buffer.from("x"), "audio/webm", "transcribe", "fr"), e => e.code === "UNSUPPORTED_SPEECH_LANGUAGE");
});

test("selected Marathi prefers the verified local tuned model without inventing detection confidence", async () => {
  let used;
  const result = await transcribeAudio({ ...input, language: "mr", runner: async options => {
    used = options.config;
    assert.equal(options.timeoutMs, 120_000);
    return { text: "चोरी झाली", originalLanguage: "si", languageProbability: 0.91 };
  } });
  assert.match(used.modelPath, /marathi-small-ct2$/);
  assert.equal(used.selectedLanguage, "mr");
  assert.equal(result.inputLanguage, "mr");
  assert.equal(result.languageSource, "user-selected");
  assert.equal(result.languageProbability, null);
  assert.equal(result.detectedLanguage, "si");
  assert.equal(result.detectedLanguageProbability, 0.91);
  assert.match(result.model, /Marathi-tuned/);
});

test("selected Marathi falls back to the existing local small model when tuning is not installed", async () => {
  const config = { python: "python", modelPath: "tiny", indicModelPath: "small", marathiModelPath: "marathi" };
  const exists = path => !path.includes("marathi");
  let used;
  const result = await transcribeAudio({ ...input, language: "mr", config, exists, runner: async options => {
    used = options.config;
    return { text: "चोरी झाली", originalLanguage: "mr" };
  } });
  assert.equal(used.modelPath, "small");
  assert.match(result.model, /faster-whisper-small/);
});

test("converted Marathi vocabulary format is accepted and missing both Marathi models fails closed", async () => {
  const config = { python: "python", modelPath: "tiny", indicModelPath: "small", marathiModelPath: "marathi" };
  const converted = path => path.includes("marathi") && !path.endsWith("vocabulary.txt");
  assert.equal(speechStatus(config, converted).marathiModelReady, true);
  assert.equal(speechStatus(config, converted).indicModelReady, false);
  const missing = path => !path.includes("marathi") && !path.includes("small");
  await assert.rejects(transcribeAudio({ ...input, language: "mr", config, exists: missing,
    runner: () => { throw Error("must not use another model"); } }), error => error.code === "MODEL_MISSING");
});

test("selected Hindi alone uses the local medium model and a longer worker deadline", async () => {
  let used;
  const result = await transcribeAudio({ ...input, language: "hi", runner: async options => {
    used = options;
    return { text: "चोरी हुई", originalLanguage: "ur", languageProbability: 0.4 };
  } });
  assert.match(used.config.modelPath, /whisper-medium$/);
  assert.equal(used.config.selectedLanguage, "hi");
  assert.equal(used.timeoutMs, 180_000);
  assert.match(result.model, /medium/);
  assert.equal(result.inputLanguage, "hi");
  assert.equal(result.detectedLanguage, "ur");
  assert.equal(result.languageProbability, null);
});

test("missing Hindi model fails without downgrading to Marathi or Auto", async () => {
  const config = { python: "python", modelPath: "tiny", indicModelPath: "small", hindiModelPath: "medium" };
  const exists = path => !(path.includes("medium") && path.endsWith("model.bin"));
  assert.equal(speechStatus(config, exists).hindiModelReady, false);
  await assert.rejects(transcribeAudio({ ...input, language: "hi", config, exists,
    runner: () => { throw Error("must not use another model"); } }), error => error.code === "MODEL_MISSING");
  const marathi = await transcribeAudio({ ...input, language: "mr", config, exists,
    runner: async () => ({ text: "चोरी झाली", originalLanguage: "mr", languageProbability: 0.95 }) });
  assert.match(marathi.model, /Marathi-tuned/);
});

test("selected Hindi reaches the worker as an explicit decoding language", async () => {
  let args;
  await transcribeAudio({ ...input, language: "hi", runner: opts => runLocalRecognizer({ ...opts,
    spawnImpl: (_exe, passed) => { args = passed; return processMock({ text: "चोरी हुई" }); }
  }) });
  assert.deepEqual(args.slice(-2), ["--language", "hi"]);
});

test("Marathi streaming recognizer reuses one offline worker and recovers after a crash", async () => {
  let starts = 0;
  let lastChild;
  const runner = createStreamingRecognizer((_exe, args, options) => {
    starts++;
    assert.deepEqual(args.slice(-3), ["--language", "mr", "--stream"]);
    assert.equal(options.env.HF_HUB_OFFLINE, "1");
    const child = new EventEmitter();
    lastChild = child;
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => queueMicrotask(() => child.emit("close", -1));
    child.stdin.on("data", chunk => {
      const request = JSON.parse(chunk.toString());
      assert.equal(Buffer.from(request.audio, "base64").toString(), "audio");
      queueMicrotask(() => child.stdout.write(JSON.stringify({ text: "चोरी झाली", originalLanguage: null }) + "\n"));
    });
    return child;
  });
  const options = { bytes: Buffer.from("audio"), mode: "transcribe", config: {
    python: "python", modelPath: "marathi", selectedLanguage: "mr"
  }, timeoutMs: 1000 };
  try {
    assert.equal((await runner(options)).text, "चोरी झाली");
    assert.equal((await runner(options)).originalLanguage, null);
    assert.equal(starts, 1);
    lastChild.emit("close", -1);
    assert.equal((await runner(options)).text, "चोरी झाली");
    assert.equal(starts, 2);
  } finally { runner.close(); }
});

test("selected Hindi reuses one worker and switching to Marathi replaces it", async () => {
  const children = [];
  const runner = createStreamingRecognizer((_exe, args) => {
    const language = args.at(-2);
    assert.ok(["hi", "mr"].includes(language));
    assert.equal(args.at(-1), "--stream");
    const child = new EventEmitter();
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.killed = false;
    child.kill = () => { child.killed = true; queueMicrotask(() => child.emit("close", -1)); };
    child.stdin.on("data", () => queueMicrotask(() => child.stdout.write(
      JSON.stringify({ text: language === "hi" ? "चोरी हुई" : "चोरी झाली", originalLanguage: null }) + "\n"
    )));
    children.push(child);
    return child;
  });
  const options = { bytes: Buffer.from("audio"), mode: "transcribe", timeoutMs: 1000 };
  try {
    const hindi = { ...options, config: { python: "python", modelPath: "hindi", selectedLanguage: "hi" } };
    const marathi = { ...options, config: { python: "python", modelPath: "marathi", selectedLanguage: "mr" } };
    assert.equal((await runner(hindi)).text, "चोरी हुई");
    assert.equal((await runner(hindi)).originalLanguage, null);
    assert.equal((await runner(hindi)).text, "चोरी हुई");
    assert.equal(children.length, 1);
    assert.equal((await runner(marathi)).text, "चोरी झाली");
    assert.equal(children.length, 2);
    assert.equal(children[0].killed, true);
  } finally { runner.close(); }
});

test("Marathi streaming timeout kills the stalled worker and permits a fresh one", async () => {
  let starts = 0;
  const runner = createStreamingRecognizer(() => {
    starts++;
    const child = new EventEmitter();
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => queueMicrotask(() => child.emit("close", -1));
    if (starts > 1) child.stdin.on("data", () => queueMicrotask(() => child.stdout.write('{"text":"recovered"}\n')));
    return child;
  });
  const options = { bytes: Buffer.from("audio"), mode: "transcribe", config: {
    python: "python", modelPath: "marathi", selectedLanguage: "mr"
  }, timeoutMs: 5 };
  try {
    await assert.rejects(runner(options), error => error.code === "SPEECH_TIMEOUT");
    assert.equal((await runner({ ...options, timeoutMs: 1000 })).text, "recovered");
    assert.equal(starts, 2);
  } finally { runner.close(); }
});

test("automatic recording retains detected-language status and confidence", async () => {
  const result = await transcribeAudio({ ...input, runner: async options => {
    assert.match(options.config.modelPath, /whisper-tiny$/);
    assert.equal(options.timeoutMs, 120_000);
    return { text: "Theft", originalLanguage: "en", languageProbability: 0.98 };
  } });
  assert.equal(result.languageStatus, "detected");
  assert.equal(result.languageSource, "automatic");
  assert.equal(result.inputLanguage, "en");
  assert.equal(result.languageProbability, 0.98);
});

test("recognizer/model availability is independent of cloud credentials", async () => {
  assert.equal(speechStatus(undefined, () => true).configured, true);
  await assert.rejects(transcribeAudio({ ...input, exists: () => false }), e => e.code === "RECOGNIZER_UNAVAILABLE");
  await assert.rejects(transcribeAudio({ ...input, exists: path => !path.endsWith("model.bin") }), e => e.code === "MODEL_MISSING");
});

test("local process receives audio stdin with no shell and forced offline environment", async () => {
  let call;
  const result = await transcribeAudio({ ...input, runner: options => runLocalRecognizer({ ...options,
    spawnImpl: (exe, args, config) => { call = { exe, args, config }; return processMock(); }
  }) });
  assert.equal(result.text, legalText);
  assert.equal(call.config.shell, false);
  assert.equal(call.config.windowsHide, true);
  assert.equal(call.config.env.HF_HUB_OFFLINE, "1");
  assert.ok(call.args.includes("transcribe"));
  assert.ok(!call.args.includes("https://"));
});

test("direct audio translation is rejected before recognition to preserve native input", async () => {
  await assert.rejects(transcribeAudio({ ...input, mode: "translate", runner: () => { throw Error("must not run"); } }), e => e.code === "UNSUPPORTED_SPEECH_MODE");
});

test("local speech returns original language metadata for multilingual analysis", async () => {
  const result = await transcribeAudio({ ...input, runner: async () => ({ text: "मराठी मजकूर", originalLanguage: "mr", languageProbability: 0.95 }) });
  assert.equal(result.originalLanguage, "mr");
  assert.equal(result.languageProbability, 0.95);
});

test("local transcript reaches unchanged typed IPC pipeline", async () => {
  const result = await transcribeAudio({ ...input, runner: async () => ({ text: legalText }) });
  const a = analyzeQuery(result.text);
  assert.equal(a.facts.offenseDate, "2024-06-20");
  assert.equal(a.gate.route, "IPC_ONLY");
  assert.equal(a.retrieved[0].section, "379");
  assert.equal(a.verifier.status, "PASSED");
});

test("BNS speech keeps existing legal behavior", async () => {
  for (const [text, route, section] of [
    ["On 12 July 2024, a person was deceived and dishonestly induced to deliver property under BNS Section 318.", "BNS_PRIMARY", "318"]
  ]) {
    const result = await transcribeAudio({ ...input, runner: async () => ({ text }) });
    const a = analyzeQuery(result.text);
    assert.equal(a.gate.route, route);
    assert.equal(a.retrieved[0]?.section, section);
  }
});

test("voice transcript uses exactly the same missing-date candidates as typed input", async () => {
  const text = "The accused took another person's mobile phone without their consent.";
  const transcript = await transcribeAudio({ ...input, runner: async () => ({ text }) });
  const typed = analyzeQuery(text);
  const voice = analyzeQuery(transcript.text);
  delete typed.elapsedMs;
  delete voice.elapsedMs;
  assert.deepEqual(voice, typed);
  assert.equal(voice.facts.offenseDate, null);
  assert.equal(voice.gate.applicability, "UNDETERMINED");
  assert.ok(voice.retrieved.some(doc => doc.id === "ipc-378"));
  assert.ok(voice.retrieved.some(doc => doc.id === "bns-303"));
});

test("empty recognizer transcript is rejected", async () => {
  await assert.rejects(transcribeAudio({ ...input, runner: async () => ({ text: " " }) }), e => e.code === "NO_SPEECH_DETECTED");
});

test("local process crash and malformed output become safe errors", async () => {
  for (const options of [{ code: 1 }, { malformed: true }]) {
    await assert.rejects(transcribeAudio({ ...input, runner: opts => runLocalRecognizer({ ...opts, spawnImpl: () => processMock(options) }) }), e => e.code === "SPEECH_PROCESS_ERROR");
  }
});

test("worker reports decoding, dependency and model loading failures", async () => {
  for (const code of ["INVALID_AUDIO", "RECOGNIZER_UNAVAILABLE", "MODEL_LOAD_FAILED", "AUDIO_TOO_LONG"]) {
    await assert.rejects(transcribeAudio({ ...input, runner: opts => runLocalRecognizer({ ...opts, spawnImpl: () => processMock({ error: code, code: 1 }) }) }), e => e.code === code);
  }
});

test("stalled local process is killed on timeout and next request recovers", async () => {
  const child = processMock({ stall: true });
  await assert.rejects(transcribeAudio({ ...input, timeoutMs: 5, runner: opts => runLocalRecognizer({ ...opts, spawnImpl: () => child }) }), e => e.code === "SPEECH_TIMEOUT");
  assert.equal(child.killed, true);
  const next = await transcribeAudio({ ...input, runner: async () => ({ text: "Recovered" }) });
  assert.equal(next.text, "Recovered");
});

test("spawn errors handle unavailable platform/runtime", async () => {
  await assert.rejects(transcribeAudio({ ...input, runner: opts => runLocalRecognizer({ ...opts, spawnImpl: () => { throw Error("unsupported"); } }) }), e => e.code === "RECOGNIZER_UNAVAILABLE");
});

test("concurrent local model requests are bounded rather than queued indefinitely", async () => {
  let finish;
  const pending = transcribeAudio({ ...input, runner: () => new Promise(resolve => { finish = resolve; }) });
  await assert.rejects(transcribeAudio({ ...input }), e => e.code === "SPEECH_BUSY");
  finish({ text: "Complete" });
  await pending;
});
