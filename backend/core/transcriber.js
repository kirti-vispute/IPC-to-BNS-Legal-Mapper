import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { LANGUAGE_NAMES, normalizeLanguageCode, speechLanguageStatus } from "./languages.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const WORKER = join(ROOT, "backend", "speech", "transcribe.py");
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
export const WHISPER_MODEL = "faster-whisper-tiny (local CPU int8)";
export const SELECTED_WHISPER_MODEL = "faster-whisper-small (local CPU int8)";
export const MARATHI_WHISPER_MODEL = "Marathi-tuned Whisper small (local CPU int8)";
export const HINDI_WHISPER_MODEL = "faster-whisper-medium (local CPU int8)";
const MODEL_FILES = ["model.bin", "config.json", "tokenizer.json", "vocabulary.txt"];
const SELECTABLE_LANGUAGES = new Set(["hi", "mr"]);
const AUDIO_TYPES = new Set(["audio/flac", "audio/x-flac", "audio/m4a", "audio/x-m4a",
  "audio/mp3", "audio/mpeg", "audio/mpga", "audio/mp4", "audio/ogg", "audio/wav", "audio/x-wav", "audio/webm"]);
const WORKER_ERRORS = {
  RECOGNIZER_UNAVAILABLE: [503, "Local recognizer dependencies are unavailable. Run the local speech setup."],
  MODEL_MISSING: [503, "Local speech model is missing. Run the local speech setup."],
  INVALID_AUDIO: [422, "The recording could not be decoded. Please record again."],
  AUDIO_TOO_LONG: [413, "Keep speech recordings under 90 seconds."],
  MODEL_LOAD_FAILED: [503, "Local speech model could not load. Check model files and available memory."]
};
let running = false;

export class TranscriptionError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name = "TranscriptionError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function localSpeechConfig() {
  return {
    python: process.env.LOCAL_SPEECH_PYTHON || join(ROOT, ".venv-speech", process.platform === "win32" ? "Scripts/python.exe" : "bin/python"),
    modelPath: process.env.LOCAL_SPEECH_MODEL || join(ROOT, "models", "speech", "whisper-tiny"),
    indicModelPath: process.env.LOCAL_SPEECH_INDIC_MODEL || join(ROOT, "models", "speech", "whisper-small"),
    marathiModelPath: process.env.LOCAL_SPEECH_MARATHI_MODEL || process.env.LOCAL_SPEECH_INDIC_MODEL || join(ROOT, "models", "speech", "marathi-small-ct2"),
    hindiModelPath: process.env.LOCAL_SPEECH_HINDI_MODEL || join(ROOT, "models", "speech", "whisper-medium")
  };
}

export function speechStatus(config = localSpeechConfig(), exists = existsSync) {
  const runtimeReady = exists(config.python) && exists(WORKER);
  const modelReady = MODEL_FILES.every(file => exists(join(config.modelPath, file)));
  const indicModelReady = MODEL_FILES.every(file => exists(join(config.indicModelPath || join(ROOT, "models", "speech", "whisper-small"), file)));
  const marathiModelPath = config.marathiModelPath || join(ROOT, "models", "speech", "marathi-small-ct2");
  const marathiModelReady = ["model.bin", "config.json", "tokenizer.json", "vocabulary.json"].every(file => exists(join(marathiModelPath, file)));
  const hindiModelReady = MODEL_FILES.every(file => exists(join(config.hindiModelPath || join(ROOT, "models", "speech", "whisper-medium"), file)));
  return { configured: runtimeReady && modelReady, engine: "faster-whisper (local)", runtimeReady, modelReady, indicModelReady, marathiModelReady, hindiModelReady };
}

export function normalizeAudioType(contentType) {
  return String(contentType || "").split(";", 1)[0].trim().toLowerCase();
}

export function validateAudioInput(audio, contentType, mode = "transcribe", language = "auto") {
  const bytes = Buffer.isBuffer(audio) ? audio : Buffer.from(audio || []);
  const mimeType = normalizeAudioType(contentType);
  if (!bytes.length) throw new TranscriptionError("Record some speech before requesting transcription.", 400, "EMPTY_AUDIO");
  if (bytes.length > MAX_AUDIO_BYTES) throw new TranscriptionError("The recording is too large. Keep it under 10 MiB.", 413, "AUDIO_TOO_LARGE");
  if (!AUDIO_TYPES.has(mimeType)) throw new TranscriptionError("Unsupported audio format. Use WebM, OGG, WAV, MP3, MP4, M4A, or FLAC audio.", 415, "UNSUPPORTED_AUDIO_TYPE");
  if (mode !== "transcribe") throw new TranscriptionError("Use native-language transcription; text translation happens during analysis.", 400, "UNSUPPORTED_SPEECH_MODE");
  if (language !== "auto" && !SELECTABLE_LANGUAGES.has(language)) throw new TranscriptionError("Choose Auto, Hindi, or Marathi for recording.", 400, "UNSUPPORTED_SPEECH_LANGUAGE");
  return { bytes, mimeType, mode, selectedLanguage: language === "auto" ? null : language };
}

export function createStreamingRecognizer(spawnImpl = spawn) {
  let session = null;
  const stop = (current, error, kill = false) => {
    if (session !== current) return;
    session = null;
    if (current.pending) {
      clearTimeout(current.pending.timer);
      current.pending.reject(error);
      current.pending = null;
    }
    if (kill) current.child.kill();
  };
  const run = ({ bytes, mode, config, timeoutMs }) => new Promise((resolve, reject) => {
    if (session?.pending) {
      reject(new TranscriptionError("Local speech recognition is busy. Please try again shortly.", 429, "SPEECH_BUSY"));
      return;
    }
    if (session && (session.modelPath !== config.modelPath || session.selectedLanguage !== config.selectedLanguage)) {
      stop(session, new Error("Selected speech model changed"), true);
    }
    if (!session) {
      let child;
      try {
        child = spawnImpl(config.python, [WORKER, "--model", config.modelPath, "--mode", mode,
          "--language", config.selectedLanguage, "--stream"], {
          shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"],
          env: { ...process.env, HF_HUB_OFFLINE: "1", TRANSFORMERS_OFFLINE: "1", HF_HUB_DISABLE_TELEMETRY: "1", PYTHONUTF8: "1" }
        });
      } catch {
        reject(new TranscriptionError("Local speech recognizer could not start. Check the Python installation.", 503, "RECOGNIZER_UNAVAILABLE"));
        return;
      }
      const current = { child, modelPath: config.modelPath, selectedLanguage: config.selectedLanguage,
        buffer: "", pending: null };
      session = current;
      child.stdin.on("error", () => stop(current, new TranscriptionError("Local speech recognizer is unavailable.", 503, "RECOGNIZER_UNAVAILABLE"), true));
      child.stderr.on("data", () => {});
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", chunk => {
        current.buffer += chunk;
        if (current.buffer.length > 64 * 1024) {
          stop(current, new TranscriptionError("Invalid response from local recognizer.", 502, "SPEECH_PROCESS_ERROR"), true);
          return;
        }
        const newline = current.buffer.indexOf("\n");
        if (newline < 0) return;
        const line = current.buffer.slice(0, newline);
        current.buffer = current.buffer.slice(newline + 1);
        const pending = current.pending;
        if (!pending || current.buffer.trim()) {
          stop(current, new TranscriptionError("Invalid response from local recognizer.", 502, "SPEECH_PROCESS_ERROR"), true);
          return;
        }
        current.pending = null;
        clearTimeout(pending.timer);
        let payload;
        try { payload = JSON.parse(line); } catch { /* Malformed worker output fails closed. */ }
        if (!payload || payload.error || typeof payload.text !== "string") {
          const key = WORKER_ERRORS[payload?.error] ? payload.error : "SPEECH_PROCESS_ERROR";
          const [status, message] = WORKER_ERRORS[key] || [502, "Local speech recognition failed. Please try again."];
          pending.reject(new TranscriptionError(message, status, key));
        } else pending.resolve(payload);
      });
      child.on("error", () => stop(current, new TranscriptionError("Local speech recognizer is unavailable.", 503, "RECOGNIZER_UNAVAILABLE"), true));
      child.on("close", () => stop(current, new TranscriptionError("Local speech recognition failed. Please try again.", 502, "SPEECH_PROCESS_ERROR")));
    }
    const current = session;
    const timer = setTimeout(() => stop(current, new TranscriptionError("Local transcription timed out. Try a shorter recording.", 504, "SPEECH_TIMEOUT"), true), timeoutMs);
    current.pending = { resolve, reject, timer };
    try {
      current.child.stdin.write(`${JSON.stringify({ audio: bytes.toString("base64") })}\n`);
    } catch {
      stop(current, new TranscriptionError("Local speech recognizer is unavailable.", 503, "RECOGNIZER_UNAVAILABLE"), true);
    }
  });
  run.close = () => {
    if (session) stop(session, new TranscriptionError("Local recognizer stopped.", 503, "RECOGNIZER_UNAVAILABLE"), true);
  };
  return run;
}

const runStreamingSelected = createStreamingRecognizer();
process.once("exit", () => runStreamingSelected.close());
export function closeLocalSpeechWorker() { runStreamingSelected.close(); }

export function runLocalRecognizer({ bytes, mode, config, timeoutMs, spawnImpl = spawn }) {
  if (["hi", "mr"].includes(config.selectedLanguage) && spawnImpl === spawn) {
    return runStreamingSelected({ bytes, mode, config, timeoutMs });
  }
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawnImpl(config.python, [WORKER, "--model", config.modelPath, "--mode", mode,
        ...(config.selectedLanguage ? ["--language", config.selectedLanguage] : [])], {
        shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, HF_HUB_OFFLINE: "1", TRANSFORMERS_OFFLINE: "1", HF_HUB_DISABLE_TELEMETRY: "1", PYTHONUTF8: "1" }
      });
    } catch {
      reject(new TranscriptionError("Local speech recognizer could not start. Check the Python installation.", 503, "RECOGNIZER_UNAVAILABLE"));
      return;
    }
    let settled = false;
    let output = "";
    const finish = (error, payload) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      error ? reject(error) : resolve(payload);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(new TranscriptionError("Local transcription timed out. Try a shorter recording.", 504, "SPEECH_TIMEOUT"));
    }, timeoutMs);
    child.on("error", () => finish(new TranscriptionError("Local speech recognizer is unavailable. Run the local speech setup.", 503, "RECOGNIZER_UNAVAILABLE")));
    child.stdin.on("error", () => {});
    // Drain diagnostics without retaining audio, transcripts, or internal paths in logs.
    child.stderr.on("data", () => {});
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", chunk => {
      output += chunk;
      if (output.length > 64 * 1024) {
        child.kill();
        finish(new TranscriptionError("Invalid response from local recognizer.", 502, "SPEECH_PROCESS_ERROR"));
      }
    });
    child.on("close", code => {
      if (settled) return;
      let payload;
      try { payload = JSON.parse(output); } catch { /* A crashed worker may not emit JSON. */ }
      if (code !== 0 || payload?.error) {
        const key = WORKER_ERRORS[payload?.error] ? payload.error : "SPEECH_PROCESS_ERROR";
        const [status, message] = WORKER_ERRORS[key] || [502, "Local speech recognition failed. Please try again."];
        finish(new TranscriptionError(message, status, key));
      } else if (!payload || typeof payload.text !== "string") {
        finish(new TranscriptionError("Invalid response from local recognizer.", 502, "SPEECH_PROCESS_ERROR"));
      } else finish(null, payload);
    });
    child.stdin.end(bytes);
  });
}

export async function transcribeAudio({ audio, contentType, mode = "transcribe", language = "auto",
  config = localSpeechConfig(), exists = existsSync, runner = runLocalRecognizer, timeoutMs }) {
  const validated = validateAudioInput(audio, contentType, mode, language);
  const status = speechStatus(config, exists);
  if (!status.runtimeReady) throw new TranscriptionError("Local speech recognizer is unavailable. Run the local speech setup.", 503, "RECOGNIZER_UNAVAILABLE");
  const modelReady = validated.selectedLanguage === "hi" ? status.hindiModelReady
    : validated.selectedLanguage === "mr" ? status.marathiModelReady || status.indicModelReady : status.modelReady;
  if (!modelReady) throw new TranscriptionError("Local speech model is missing. Run the local speech setup.", 503, "MODEL_MISSING");
  if (running) throw new TranscriptionError("Local speech recognition is busy. Please try again shortly.", 429, "SPEECH_BUSY");
  running = true;
  try {
    const selectedModelPath = validated.selectedLanguage === "hi"
      ? config.hindiModelPath || join(ROOT, "models", "speech", "whisper-medium")
      : status.marathiModelReady ? config.marathiModelPath || join(ROOT, "models", "speech", "marathi-small-ct2")
        : config.indicModelPath || join(ROOT, "models", "speech", "whisper-small");
    const workerConfig = validated.selectedLanguage ? { ...config, modelPath: selectedModelPath, selectedLanguage: validated.selectedLanguage } : config;
    const payload = await runner({ ...validated, config: workerConfig,
      timeoutMs: timeoutMs ?? (validated.selectedLanguage === "hi" ? 180_000 : 120_000) });
    const text = String(payload.text || "").trim();
    if (!text) throw new TranscriptionError("No speech was detected. Please record the query again.", 422, "NO_SPEECH_DETECTED");
    const detectedLanguage = normalizeLanguageCode(payload.originalLanguage);
    const resolvedLanguage = validated.selectedLanguage || detectedLanguage;
    const probability = validated.selectedLanguage ? null : payload.languageProbability ?? null;
    const selectedMarathiModel = status.marathiModelReady ? MARATHI_WHISPER_MODEL : SELECTED_WHISPER_MODEL;
    const speechReview = validated.selectedLanguage === "mr" && Object.hasOwn(payload, "speechReview")
      ? validateSpeechReview(payload.speechReview) : null;
    return { text, mode, translatedToEnglish: false,
      model: validated.selectedLanguage === "hi" ? HINDI_WHISPER_MODEL
        : validated.selectedLanguage === "mr" ? selectedMarathiModel : WHISPER_MODEL,
      originalLanguage: resolvedLanguage, inputLanguage: resolvedLanguage, inputMode: "voice", originalInput: text,
      languageName: LANGUAGE_NAMES[resolvedLanguage] || resolvedLanguage || "Unknown",
      languageSource: validated.selectedLanguage ? "user-selected" : "automatic",
      languageStatus: validated.selectedLanguage ? "selected" : speechLanguageStatus(resolvedLanguage, probability),
      languageProbability: probability, detectedLanguage,
      detectedLanguageProbability: payload.languageProbability ?? null,
      ...(speechReview ? { speechReview } : {}) };
  } finally {
    running = false;
  }
}

function validateSpeechReview(review) {
  const invalid = () => { throw new TranscriptionError("Invalid speech review metadata.", 502, "SPEECH_PROCESS_ERROR"); };
  if (!review || typeof review !== "object" || Array.isArray(review) || review.version !== 1
    || !["assessed", "unavailable"].includes(review.status) || review.textModified !== false
    || !Number.isSafeInteger(review.windowCount) || review.windowCount < 0) invalid();
  const assessed = review.status === "assessed";
  if (assessed ? typeof review.requiresReview !== "boolean" || review.windowCount < 1 || review.windowCount > 128
    : review.requiresReview !== null) invalid();
  const arrays = {};
  for (const key of ["warningWindows", "silenceConfidenceWindows", "compressionWindows"]) {
    const values = review[key];
    if (!Array.isArray(values) || values.length > 128 || (!assessed && values.length)
      || values.some((value, index) => !Number.isSafeInteger(value) || value < 0 || value >= review.windowCount
        || (index > 0 && value <= values[index - 1]))) invalid();
    arrays[key] = [...values];
  }
  const warned = assessed && arrays.warningWindows.length > 0;
  if (assessed && review.requiresReview !== warned
    || review.warningCode !== (warned ? "REVIEW_SATURATED_UNFINISHED_WINDOW" : null)) invalid();
  return { version: 1, status: review.status, requiresReview: review.requiresReview,
    windowCount: review.windowCount, textModified: false, warningCode: review.warningCode, ...arrays };
}
