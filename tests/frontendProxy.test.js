import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { createFrontendProxy } from "../scripts/frontend_proxy.mjs";

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

test("frontend preview forwards page and API requests to the configured backend", async () => {
  const backend = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    if (request.url.startsWith("/api/transcribe")) {
      response.writeHead(202, { "Content-Type": "application/octet-stream" });
      response.end(Buffer.concat(chunks));
      return;
    }
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(`${request.method} ${request.url} ${Buffer.concat(chunks).toString()}`);
  });
  const backendPort = await listen(backend);
  const frontend = createFrontendProxy(backendPort);
  const frontendPort = await listen(frontend);
  try {
    const page = await fetch(`http://127.0.0.1:${frontendPort}/`);
    assert.equal(page.status, 200);
    assert.equal(await page.text(), "GET / ");
    const analysis = await fetch(`http://127.0.0.1:${frontendPort}/api/analyze`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: '{"query":"theft"}'
    });
    assert.equal(analysis.status, 200);
    assert.equal(await analysis.text(), 'POST /api/analyze {"query":"theft"}');
    const audio = Buffer.from([0, 1, 2, 255]);
    const transcription = await fetch(`http://127.0.0.1:${frontendPort}/api/transcribe?language=mr`, {
      method: "POST", headers: { "Content-Type": "audio/wav" }, body: audio
    });
    assert.equal(transcription.status, 202);
    assert.deepEqual(Buffer.from(await transcription.arrayBuffer()), audio);
  } finally {
    await close(frontend);
    await close(backend);
  }
});

test("frontend preview reports a stopped backend instead of hanging", async () => {
  const backend = http.createServer();
  const backendPort = await listen(backend);
  await close(backend);
  const frontend = createFrontendProxy(backendPort);
  const frontendPort = await listen(frontend);
  try {
    const response = await fetch(`http://127.0.0.1:${frontendPort}/api/health`);
    assert.equal(response.status, 502);
    assert.match(await response.text(), /Start Run Backend\.cmd first/);
  } finally {
    await close(frontend);
  }
});
