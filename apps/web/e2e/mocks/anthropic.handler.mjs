// A local stand-in for the Messages API (e2e and unit tests only; never on Vercel: the app refuses a
// non-Anthropic base URL there). It accepts only the request the AI builder must send, and streams a
// recorded answer as raw server-sent events, in 13-byte pieces with the recording's pauses.
//
//   POST /v1/messages   400 unless: model claude-opus-5-5, stream true, output_config.format json_schema,
//                       fallbacks "default", the server-side-fallback-2026-07-01 beta header, and no
//                       thinking, tool_choice or temperature. Then the fixture named by
//                       [[fixture:<name>#<tag>]] in the user turn (default de-music); a fixture with
//                       several calls answers the n-th call of a tag with its n-th entry.
//                       status-429, status-529, status-500 and status-spend answer with that error.
//   GET /__calls?tag=   { count } of calls with that tag (each test uses its own tag).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const port = Number(process.env.MOCK_ANTHROPIC_PORT ?? 54399);

const MODEL = "claude-opus-5-5";
const BETA = "server-side-fallback-2026-07-01";
const MARKER = /\[\[fixture:([a-z0-9-]{1,40})(?:#([a-z0-9_-]{1,64}))?\]\]/i;
const CHUNK = 13;

/** Calls per tag, and per tag and fixture (which entry answers the next call). */
const calls = new Map();
const fixtureCalls = new Map();
/** Every accepted request, for unit tests that run this handler in-process: { tag, fixture, headers, body }. */
export const requests = [];

const fixtures = new Map();
function fixture(name) {
  if (!fixtures.has(name)) {
    if (!/^[a-z0-9-]+$/.test(name)) return null;
    try {
      fixtures.set(name, JSON.parse(readFileSync(path.join(here, "anthropic", `${name}.json`), "utf8")));
    } catch {
      return null;
    }
  }
  return fixtures.get(name);
}

const json = (res, status, body, headers = {}) => {
  res.writeHead(status, { "content-type": "application/json", "request-id": `req_mock_${String(requests.length)}`, ...headers });
  res.end(JSON.stringify(body));
};

const apiError = (res, status, type, message, extra = {}) => json(res, status, { type: "error", error: { type, message, ...extra } }, { "retry-after-ms": "5" });

/** Why the request is not what the AI builder must send, or null when it is. */
export function guard(headers, body) {
  if (!body || typeof body !== "object") return "body is not JSON";
  if (body.model !== MODEL) return "model";
  if (body.stream !== true) return "stream";
  if (body.output_config?.format?.type !== "json_schema") return "output_config.format";
  if (body.fallbacks !== "default") return "fallbacks";
  if (!String(headers["anthropic-beta"] ?? "").split(",").map((value) => value.trim()).includes(BETA)) return "anthropic-beta";
  for (const field of ["thinking", "tool_choice", "temperature", "top_p", "top_k", "tools"]) if (field in body) return field;
  return null;
}

const readBody = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function stream(res, events) {
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", "request-id": `req_mock_${String(requests.length)}` });
  let open = true;
  res.on("close", () => {
    open = false;
  });
  for (const { delayMs, event, data } of events) {
    if (delayMs > 0) await sleep(delayMs);
    if (!open) return;
    const frame = Buffer.from(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`, "utf8");
    for (let at = 0; at < frame.length && open; at += CHUNK) res.write(frame.subarray(at, at + CHUNK));
  }
  if (open) res.end();
}

export async function handle(req, res) {
  const url = new URL(req.url ?? "/", "http://mock.local");
  if (req.method === "GET" && url.pathname === "/__calls") {
    json(res, 200, { count: calls.get(url.searchParams.get("tag") ?? "") ?? 0 });
    return;
  }
  if (req.method !== "POST" || url.pathname !== "/v1/messages") {
    json(res, 404, { type: "error", error: { type: "not_found_error", message: "not found" } });
    return;
  }
  const body = await readBody(req);
  const problem = guard(req.headers, body);
  if (problem) {
    apiError(res, 400, "invalid_request_error", `mock: unexpected request (${problem})`);
    return;
  }
  const marker = MARKER.exec(JSON.stringify(body.messages ?? []));
  const name = (marker?.[1] ?? "de-music").toLowerCase();
  const tag = (marker?.[2] ?? "").toLowerCase();
  calls.set(tag, (calls.get(tag) ?? 0) + 1);
  requests.push({ tag, fixture: name, headers: req.headers, body });

  if (name === "status-429") return apiError(res, 429, "rate_limit_error", "mock: rate limited");
  if (name === "status-529") return apiError(res, 529, "overloaded_error", "mock: overloaded");
  if (name === "status-500") return apiError(res, 500, "api_error", "mock: server error");
  if (name === "status-spend") {
    return json(res, 429, { type: "error", error: { type: "rate_limit_error", message: "mock: spend limit", details: { error_code: "enforced_spend_limit_reached" } } }, { "x-should-retry": "false" });
  }

  const recorded = fixture(name);
  if (!recorded) {
    apiError(res, 400, "invalid_request_error", `mock: no fixture ${name}`);
    return;
  }
  const key = `${tag}|${name}`;
  const index = fixtureCalls.get(key) ?? 0;
  fixtureCalls.set(key, index + 1);
  const entry = recorded.calls[Math.min(index, recorded.calls.length - 1)];
  await stream(res, entry.events);
}
