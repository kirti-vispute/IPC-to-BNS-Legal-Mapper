import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import { analyzeMultilingualQuery, createStreamingTranslationWorker, translateDisplayText } from "./core/multilingual.js";
import { getCorpus } from "./core/retriever.js";
import { MAX_AUDIO_BYTES, speechStatus, transcribeAudio } from "./core/transcriber.js";
import { analyzeText } from "./core/nlp/index.js";
import { describePipeline } from "./core/nlp/pipeline.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = normalize(join(__dirname, ".."));
const FRONTEND_DIR = join(ROOT, "frontend");
const PORT = Number(process.env.PORT || 3000);
const translationWorker = createStreamingTranslationWorker();
process.once("exit", () => translationWorker.close());

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, {
        ok: true,
        service: "ipc-bns-gateway",
        port: PORT,
        speechConfigured: speechStatus().configured,
        speech: speechStatus()
      });
    }

    if (req.method === "GET" && url.pathname === "/api/corpus") {
      return sendJson(res, { records: getCorpus() });
    }

    if (req.method === "POST" && url.pathname === "/api/analyze") {
      const body = await readJson(req);
      const query = String(body.query || "").trim();

      if (!query) {
        return sendJson(res, { error: "Query is required." }, 400);
      }

      const result = await analyzeMultilingualQuery(query, { originalLanguage: body.originalLanguage,
        inputMode: body.inputMode, inputLanguage: body.inputLanguage, languageProbability: body.languageProbability,
        languageSource: body.languageSource, originalInput: body.originalInput, worker: translationWorker });
      // NLP view of the text exactly as the user wrote or spoke it (the legal analysis itself is unchanged).
      return sendJson(res, { ...result, nlp: analyzeText(query, { language: result.multilingual?.originalLanguage || body.inputLanguage || body.originalLanguage }) });
    }

    if (req.method === "POST" && url.pathname === "/api/nlp/analyze") {
      const body = await readJson(req);
      const text = String(body.text || "");
      if (!text.trim()) return sendJson(res, { error: "Text is required." }, 400);
      if (text.length > 4000) return sendJson(res, { error: "Please keep the text under 4000 characters." }, 413);
      return sendJson(res, analyzeText(text, { language: body.language }));
    }

    if (req.method === "GET" && url.pathname === "/api/nlp/pipeline") {
      return sendJson(res, describePipeline(speechStatus()));
    }

    if (req.method === "POST" && url.pathname === "/api/translate") {
      const body = await readJson(req);
      return sendJson(res, await translateDisplayText(body.text, { source: body.source, target: body.target, worker: translationWorker }));
    }

    if (req.method === "POST" && url.pathname === "/api/transcribe") {
      const audio = await readRaw(req, MAX_AUDIO_BYTES);
      const result = await transcribeAudio({
        audio,
        contentType: req.headers["content-type"],
        mode: url.searchParams.get("mode") || "transcribe",
        language: url.searchParams.get("language") || "auto"
      });

      return sendJson(res, result);
    }

    if (req.method === "GET") {
      return serveStatic(url.pathname, res);
    }

    sendJson(res, { error: "Not found." }, 404);
  } catch (error) {
    sendJson(res, {
      error: error.message || "Unexpected server error.",
      code: error.code || "UNEXPECTED_ERROR"
    }, error.statusCode || 500);
  }
});

server.listen(PORT, () => {
  console.log(`IPC-BNS mapper running at http://localhost:${PORT}`);
  translationWorker.warmup().then(() => console.log("Local translation model ready."),
    () => console.warn("Local translation warmup failed; English analysis remains available."));
});

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

async function readRaw(req, maxBytes) {
  const declaredLength = Number(req.headers["content-length"] || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    const error = new Error("The recording is too large. Keep it under 10 MiB.");
    error.statusCode = 413;
    error.code = "AUDIO_TOO_LARGE";
    throw error;
  }

  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
      const error = new Error("The recording is too large. Keep it under 10 MiB.");
      error.statusCode = 413;
      error.code = "AUDIO_TOO_LARGE";
      throw error;
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

async function serveStatic(pathname, res) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const target = normalize(join(FRONTEND_DIR, requested));

  if (!target.startsWith(FRONTEND_DIR)) {
    return sendJson(res, { error: "Invalid path." }, 400);
  }

  try {
    const content = await readFile(target);
    res.writeHead(200, { "Content-Type": MIME_TYPES[extname(target)] || "application/octet-stream" });
    res.end(content);
  } catch {
    sendJson(res, { error: "Not found." }, 404);
  }
}

function sendJson(res, payload, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}
