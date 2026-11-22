import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { gzipSync } from "node:zlib";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createSafeFetcher, DEFAULTS, isPublicAddress, pinnedLookup, type ResolvedAddress } from "./safe-fetch";

// ── A local test server standing in for several sites (told apart by the Host header) ─────────────

let server: Server;
let port = 0;
const MiB = 1_048_576;

beforeAll(async () => {
  server = createServer((req, res) => {
    const host = (req.headers.host ?? "").split(":")[0];
    const url = new URL(req.url ?? "/", "http://x");
    const html = (body: string) => {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(body);
    };
    if (url.pathname === "/robots.txt") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end(host === "blocked.test" ? "User-agent: LinkyoImport\nDisallow: /\n" : "User-agent: *\nDisallow: /secret\n");
      return;
    }
    switch (url.pathname) {
      case "/page":
        html(`<title>${host ?? ""}</title><p>${req.headers["user-agent"] ?? ""}|${req.headers["accept-language"] ?? ""}|${req.headers.cookie ?? "no-cookie"}</p>`);
        return;
      case "/redirect-private":
        res.writeHead(302, { location: `http://private.test:${String(port)}/page` });
        res.end();
        return;
      case "/redirect-outside":
        res.writeHead(301, { location: `http://other.test:${String(port)}/page` });
        res.end();
        return;
      case "/redirect-robots":
        res.writeHead(302, { location: `http://blocked.test:${String(port)}/page` });
        res.end();
        return;
      case "/redirect-relative":
        res.writeHead(307, { location: "/page?from=redirect" });
        res.end();
        return;
      case "/big": {
        res.writeHead(200, { "content-type": "text/html" });
        const chunk = "a".repeat(64 * 1024);
        let sent = 0;
        const pump = () => {
          while (sent < 2 * MiB) {
            sent += chunk.length;
            if (!res.write(chunk)) {
              res.once("drain", pump);
              return;
            }
          }
          res.end();
        };
        pump();
        return;
      }
      case "/gzip-big":
        res.writeHead(200, { "content-type": "text/html", "content-encoding": "gzip" });
        res.end(gzipSync(Buffer.alloc(2 * MiB, "b")));
        return;
      case "/gzip-small":
        res.writeHead(200, { "content-type": "text/html", "content-encoding": "gzip" });
        res.end(gzipSync(Buffer.from("<p>hello</p>")));
        return;
      case "/png":
        res.writeHead(200, { "content-type": "image/png" });
        res.end("png");
        return;
      case "/missing":
        res.writeHead(404, { "content-type": "text/html" });
        res.end("gone");
        return;
      case "/slow":
        // Never answers: the fetcher's total time limit must end it.
        return;
      case "/secret":
        html("secret");
        return;
      default: {
        const hop = /^\/chain\/(\d+)$/.exec(url.pathname);
        if (hop) {
          const next = Number(hop[1]) + 1;
          res.writeHead(302, { location: `/chain/${String(next)}` });
          res.end();
          return;
        }
        res.writeHead(500);
        res.end();
      }
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const ADDRESSES: Record<string, ResolvedAddress[]> = {
  "site.test": [{ address: "127.0.0.1", family: 4 }],
  "other.test": [{ address: "127.0.0.1", family: 4 }],
  "blocked.test": [{ address: "127.0.0.1", family: 4 }],
  "private.test": [{ address: "10.0.0.1", family: 4 }],
  "mixed.test": [
    { address: "93.184.216.34", family: 4 },
    { address: "10.0.0.5", family: 4 },
  ],
};

const resolve = vi.fn((host: string) => {
  const found = ADDRESSES[host];
  return found ? Promise.resolve(found) : Promise.reject(new Error("ENOTFOUND"));
});

const fetcher = (overrides: Parameters<typeof createSafeFetcher>[0] = {}) =>
  createSafeFetcher({ resolve, protocol: "http:", allowLoopbackForTests: true, port, totalTimeoutMs: 3_000, connectTimeoutMs: 1_000, ...overrides });

const at = (host: string, path: string) => `http://${host}:${String(port)}${path}`;

// ── Addresses ────────────────────────────────────────────────────────────────

describe("isPublicAddress", () => {
  it.each([
    "0.0.0.0",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.0.0.1",
    "192.0.2.10",
    "192.168.1.1",
    "198.18.0.1",
    "198.51.100.7",
    "203.0.113.9",
    "224.0.0.1",
    "240.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "::ffff:10.0.0.1",
    "::ffff:93.184.216.34",
    "::a00:1",
    "64:ff9b::a00:1",
    "64:ff9b:1::a00:1",
    "100::1",
    "fc00::1",
    "fd00:ec2::254",
    "fe80::1",
    "fe80::1%eth0",
    "fec0::1",
    "ff02::1",
    "2001:db8::1",
    "2002:a00:1::1",
    "2001:0:4136:e378:8000:63bf:f5ff:fffe",
    "2001:2::1",
    "not an ip",
  ])("refuses %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });

  it.each(["93.184.216.34", "8.8.8.8", "172.32.0.1", "2606:4700::1", "2a00:1450:4001:80b::200e", "2002:5db8:d822::1", "2001:0:4136:e378:8000:63bf:a247:27cb"])("allows %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(true);
  });
});

describe("pinnedLookup", () => {
  it("answers only the checked address, as a list when asked for all and as (address, family) otherwise", () => {
    const lookup = pinnedLookup("93.184.216.34", 4);
    const all = vi.fn();
    lookup("evil.example", { all: true }, all);
    expect(all).toHaveBeenCalledWith(null, [{ address: "93.184.216.34", family: 4 }]);
    const one = vi.fn();
    lookup("evil.example", { all: false }, one);
    expect(one).toHaveBeenCalledWith(null, "93.184.216.34", 4);
  });
});

describe("DEFAULTS", () => {
  it("are production settings: https, 3 s / 8 s, 1 MiB, 3 redirects, no test switches", () => {
    expect(DEFAULTS.protocol).toBe("https:");
    expect(DEFAULTS.connectTimeoutMs).toBe(3_000);
    expect(DEFAULTS.totalTimeoutMs).toBe(8_000);
    expect(DEFAULTS.maxBytes).toBe(MiB);
    expect(DEFAULTS.maxRedirects).toBe(3);
    expect(DEFAULTS).not.toHaveProperty("port");
    expect(DEFAULTS).not.toHaveProperty("allowLoopbackForTests");
    expect(DEFAULTS.resolve).not.toBe(resolve);
    expect(DEFAULTS.userAgent()).toMatch(/^LinkyoImport\/1\.1 \(\+https?:\/\/.+\/de\/impressum\)$/);
  });

  it("refuse unsafe addresses before any DNS lookup", async () => {
    const lookups = vi.fn(() => Promise.resolve<ResolvedAddress[]>([{ address: "93.184.216.34", family: 4 }]));
    const production = createSafeFetcher({ resolve: lookups });
    for (const url of [
      "http://example.com/",
      "https://127.0.0.1/",
      "https://[::1]/",
      "https://user:pw@example.com/",
      "https://example.com:8443/",
      "https://localhost/",
      "https://intranet/",
      "https://printer.local/",
      "https://db.internal/",
      "https://app.localhost/",
      `https://example.com/${"a".repeat(2100)}`,
      "ftp://example.com/",
    ]) {
      expect(await production(url, { accept: "text/html" }), url).toEqual({ ok: false, reason: "blocked" });
    }
    expect(lookups).not.toHaveBeenCalled();
  });
});

// ── Fetching ─────────────────────────────────────────────────────────────────

describe("safe fetcher", () => {
  it("fetches a page with an honest user agent, the owner's language and no cookies", async () => {
    const result = await fetcher()(at("site.test", "/page"), { accept: "text/html", locale: "ar" });
    expect(result).toMatchObject({ ok: true, status: 200, contentType: "text/html", url: at("site.test", "/page") });
    if (!result.ok) return;
    expect(result.body).toContain("<title>site.test</title>");
    expect(result.body).toMatch(/LinkyoImport\/1\.1 \(\+.*\/de\/impressum\)\|ar\|no-cookie/);
  });

  it("refuses a host when any of its addresses is private", async () => {
    expect(await fetcher()(at("mixed.test", "/page"), { accept: "text/html" })).toEqual({ ok: false, reason: "blocked" });
    expect(await fetcher()(at("private.test", "/page"), { accept: "text/html" })).toEqual({ ok: false, reason: "blocked" });
    expect(await fetcher()(at("nowhere.test", "/page"), { accept: "text/html" })).toEqual({ ok: false, reason: "notFound" });
  });

  it("checks every redirect from the top: a private host is refused", async () => {
    expect(await fetcher()(at("site.test", "/redirect-private"), { accept: "text/html" })).toEqual({ ok: false, reason: "blocked" });
  });

  it("asks allowHost on every hop: a redirect outside it is refused", async () => {
    const allowHost = vi.fn((host: string) => host === "site.test");
    expect(await fetcher()(at("site.test", "/redirect-outside"), { accept: "text/html", allowHost })).toEqual({ ok: false, reason: "blocked" });
    expect(allowHost).toHaveBeenCalledWith("site.test");
    expect(allowHost).toHaveBeenCalledWith("other.test");
  });

  it("checks robots.txt for every new host: a redirect to a host that disallows us stops", async () => {
    expect(await fetcher()(at("site.test", "/redirect-robots"), { accept: "text/html", robots: true })).toEqual({ ok: false, reason: "robots" });
    expect(await fetcher()(at("site.test", "/secret"), { accept: "text/html", robots: true })).toEqual({ ok: false, reason: "robots" });
    expect(await fetcher()(at("site.test", "/secret"), { accept: "text/html" })).toMatchObject({ ok: true });
  });

  it("returns the final address after redirects", async () => {
    const result = await fetcher()(at("site.test", "/redirect-relative"), { accept: "text/html", robots: true });
    expect(result).toMatchObject({ ok: true, url: at("site.test", "/page?from=redirect") });
  });

  it("follows at most three redirects", async () => {
    expect(await fetcher()(at("site.test", "/chain/1"), { accept: "text/html" })).toEqual({ ok: false, reason: "failed" });
  });

  it("streams the body and stops at 1 MiB, also when compressed", async () => {
    expect(await fetcher()(at("site.test", "/big"), { accept: "text/html" })).toEqual({ ok: false, reason: "tooLarge", status: 200 });
    expect(await fetcher()(at("site.test", "/gzip-big"), { accept: "text/html" })).toEqual({ ok: false, reason: "tooLarge", status: 200 });
    expect(await fetcher()(at("site.test", "/gzip-small"), { accept: "text/html" })).toMatchObject({ ok: true, body: "<p>hello</p>" });
  });

  it("reads only HTML", async () => {
    expect(await fetcher()(at("site.test", "/png"), { accept: "text/html" })).toEqual({ ok: false, reason: "type", status: 200 });
  });

  it("reports a missing page", async () => {
    expect(await fetcher()(at("site.test", "/missing"), { accept: "text/html" })).toEqual({ ok: false, reason: "notFound", status: 404 });
  });

  it("gives up at its total time limit", async () => {
    const started = Date.now();
    expect(await fetcher({ totalTimeoutMs: 300 })(at("site.test", "/slow"), { accept: "text/html" })).toEqual({ ok: false, reason: "timeout" });
    expect(Date.now() - started).toBeLessThan(2_000);
  });
});
