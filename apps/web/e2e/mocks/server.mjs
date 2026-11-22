// Local mock APIs for real-mode e2e (started by playwright.config.ts when E2E_MOCKS=1). Every
// `*.handler.mjs` next to this file exports { port, handle(req, res) } and gets its own server on
// 127.0.0.1; GET /health answers 200 on each. Ports come from the environment (MOCK_*_PORT), so two
// worktrees never share a mock.
import { readdir } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const handlers = (await readdir(here)).filter((file) => file.endsWith(".handler.mjs")).sort();

for (const file of handlers) {
  const { port, handle } = await import(pathToFileURL(path.join(here, file)).href);
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("ok");
      return;
    }
    Promise.resolve(handle(req, res)).catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
  server.listen(port, "127.0.0.1", () => {
    console.warn(`mock ${file} on http://127.0.0.1:${String(port)}`);
  });
}
