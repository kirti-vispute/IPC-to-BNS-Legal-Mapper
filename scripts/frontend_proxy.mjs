import http from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = "127.0.0.1";

export function createFrontendProxy(backendPort) {
  return http.createServer((request, response) => {
    const upstream = http.request({
      hostname: HOST,
      port: backendPort,
      method: request.method,
      path: request.url || "/",
      headers: { ...request.headers, host: `${HOST}:${backendPort}` }
    }, upstreamResponse => {
      response.writeHead(upstreamResponse.statusCode, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    });

    upstream.on("error", () => {
      if (!response.headersSent) {
        response.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
      }
      response.end(`The backend is not running on port ${backendPort}. Start Run Backend.cmd first.`);
    });
    request.pipe(upstream);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const frontendPort = Number(process.env.FRONTEND_PORT || 3000);
  const backendPort = Number(process.env.BACKEND_PORT || 3001);
  if (![frontendPort, backendPort].every(port => Number.isInteger(port) && port > 0 && port < 65536)) {
    throw new Error("Frontend and backend ports must be valid TCP ports.");
  }
  createFrontendProxy(backendPort).listen(frontendPort, HOST, () => {
    console.log(`Frontend preview running at http://localhost:${frontendPort}/`);
    console.log(`Forwarding page and API requests to http://localhost:${backendPort}/`);
  });
}
