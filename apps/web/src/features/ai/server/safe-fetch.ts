import { promises as dns, type LookupAddress, type LookupOptions } from "node:dns";
import http, { type IncomingMessage } from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import type { Readable } from "node:stream";
import { domainToASCII } from "node:url";
import zlib from "node:zlib";

import { siteUrl } from "@/lib/site-url";

import { createRobots, ROBOTS_MAX_BYTES, type Robots } from "./robots";

/**
 * Fetches a page someone gave us (their website, their link-in-bio page) without letting the address
 * reach anything it should not (SSRF, OWASP "case 2"):
 * - https on port 443 only, no user name or password, at most 2,048 characters, a real host name
 *   (no IP address, no single label, no .local / .internal / .localhost);
 * - the name is resolved first and refused if ANY address is not public unicast (private, loopback,
 *   link-local, cloud metadata, carrier-grade NAT, documentation, multicast …; IPv6 is an allow-list
 *   of global unicast with 6to4 and Teredo decoded);
 * - the connection is pinned to the address we checked (a custom `lookup` that answers only it), so
 *   a second DNS answer can never be used;
 * - redirects are followed by hand, at most 3, each checked from the top again (and against the
 *   caller's `allowHost` and robots.txt);
 * - 3 s to connect and 8 s in all: one clock for the whole call, every name lookup, every redirect
 *   and every robots.txt on the way included (a lookup is one 2 s try, asked of the DNS servers
 *   directly and cancelled when the time is up);
 * - HTML only, and the decoded body is streamed and cut at 1 MiB.
 * No cookies, no credentials; an honest user agent with a contact address.
 */

export type SafeFetchReason = "blocked" | "robots" | "tooLarge" | "timeout" | "notFound" | "type" | "failed";

export type SafeFetchResult =
  | { ok: true; /** The final address, after redirects: the base for relative links. */ url: string; status: number; contentType: string; body: string }
  | { ok: false; reason: SafeFetchReason; /** The HTTP status, when the server answered with an error. */ status?: number };

export interface SafeFetchOptions {
  /** "text/html" (pages) or "text/plain" (robots.txt). */
  accept: string;
  maxBytes?: number;
  /** Asked for every hop's host: false refuses the address (`blocked`). */
  allowHost?: (host: string) => boolean;
  /** Honour robots.txt for every host on the way. */
  robots?: boolean;
  /** Accept-Language: the owner's language. */
  locale?: string;
}

export type SafeFetch = (url: string, options: SafeFetchOptions) => Promise<SafeFetchResult>;

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export interface FetcherConfig {
  /** Every address of a host name. `signal` aborts when the fetch's time is up. */
  resolve: (host: string, signal: AbortSignal) => Promise<ResolvedAddress[]>;
  protocol: "https:" | "http:";
  /** Tests only: the port of the local test server. */
  port?: number;
  /** Tests only: let loopback addresses through (the local test server). */
  allowLoopbackForTests?: boolean;
  connectTimeoutMs: number;
  totalTimeoutMs: number;
  maxBytes: number;
  maxRedirects: number;
  userAgent: () => string;
  robotsTtlMs?: number;
  now?: () => number;
}

export const DNS_TIMEOUT_MS = 2_000;

/**
 * Every A and AAAA record of a name, asked of the DNS servers directly: one try of `timeoutMs` per
 * server, cancelled when the fetch's time is up. `dns.lookup` (getaddrinfo) has no time limit, cannot
 * be cancelled, and holds one of the four threads that all lookups and all decompression in the
 * process share while a slow name server makes it wait.
 *
 * IPv4 answers come first: the connection goes to the first address, and IPv4 works wherever the
 * server runs. One family failing is fine as long as the other answers (only checked addresses are
 * ever connected to). `servers` is for tests.
 */
export function createDnsResolve(options: { timeoutMs?: number; servers?: string[] } = {}): FetcherConfig["resolve"] {
  return async (host, signal) => {
    const resolver = new dns.Resolver({ timeout: options.timeoutMs ?? DNS_TIMEOUT_MS, tries: 1 });
    if (options.servers) resolver.setServers(options.servers);
    const cancel = () => {
      resolver.cancel();
    };
    signal.addEventListener("abort", cancel, { once: true });
    try {
      const [v4, v6] = await Promise.allSettled([resolver.resolve4(host), resolver.resolve6(host)]);
      const addresses: ResolvedAddress[] = [
        ...(v4.status === "fulfilled" ? v4.value.map((address) => ({ address, family: 4 as const })) : []),
        ...(v6.status === "fulfilled" ? v6.value.map((address) => ({ address, family: 6 as const })) : []),
      ];
      if (addresses.length === 0 && v4.status === "rejected") throw v4.reason;
      return addresses;
    } finally {
      signal.removeEventListener("abort", cancel);
    }
  };
}

export const MAX_BYTES = 1_048_576;

/** Production settings. Tests pass their own (`createSafeFetcher`); nothing here is a test switch. */
export const DEFAULTS: Readonly<FetcherConfig> = Object.freeze({
  resolve: createDnsResolve(),
  protocol: "https:",
  connectTimeoutMs: 3_000,
  totalTimeoutMs: 8_000,
  maxBytes: MAX_BYTES,
  maxRedirects: 3,
  userAgent: () => `LinkyoImport/1.1 (+${new URL("/de/impressum", siteUrl()).toString()})`,
});

// ── Addresses ────────────────────────────────────────────────────────────────

const parseIPv4 = (ip: string): number | null => {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const byte = Number(part);
    if (byte > 255) return null;
    value = value * 256 + byte;
  }
  return value;
};

/** Blocked IPv4 ranges: [network, prefix length]. */
const BLOCKED_V4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];
const BLOCKED_V4_RANGES = BLOCKED_V4.map(([network, bits]) => {
  const size = 2 ** (32 - bits);
  const start = parseIPv4(network) ?? 0;
  return { start, end: start + size - 1 };
});

const publicV4 = (value: number): boolean => !BLOCKED_V4_RANGES.some((range) => value >= range.start && value <= range.end);

/** Eight 16-bit groups, or null. Handles "::" and a dotted IPv4 tail. */
function parseIPv6(input: string): number[] | null {
  let text = input.split("%")[0]?.toLowerCase() ?? "";
  if (isIP(text) !== 6) return null;
  const lastColon = text.lastIndexOf(":");
  const tail = text.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = parseIPv4(tail);
    if (v4 === null) return null;
    text = `${text.slice(0, lastColon + 1)}${Math.floor(v4 / 65536).toString(16)}:${(v4 % 65536).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - rest.length : 0;
  if (fill < 0 || (halves.length === 1 && head.length !== 8)) return null;
  const groups = [...head, ...Array<string>(fill).fill("0"), ...rest].map((group) => (/^[0-9a-f]{1,4}$/.test(group) ? parseInt(group, 16) : NaN));
  return groups.length === 8 && groups.every((group) => !Number.isNaN(group)) ? groups : null;
}

const v4From = (high: number, low: number) => high * 65536 + low;

/**
 * Is this a public unicast address we may connect to? IPv4: everything outside the blocked ranges.
 * IPv6: only global unicast (2000::/3), without documentation and benchmarking prefixes, and 6to4 or
 * Teredo only when the IPv4 inside is public. Mapped, compatible and NAT64 forms never pass.
 */
export function isPublicAddress(ip: string): boolean {
  const kind = isIP(ip.split("%")[0] ?? "");
  if (kind === 4) {
    const value = parseIPv4(ip);
    return value !== null && publicV4(value);
  }
  if (kind !== 6) return false;
  const groups = parseIPv6(ip);
  if (!groups) return false;
  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, , , g6 = 0, g7 = 0] = groups;
  if ((g0 & 0xe000) !== 0x2000) return false; // not 2000::/3 (covers ::, ::1, ::ffff:0:0/96, 64:ff9b::/96, fc00::/7, fe80::/10, ff00::/8 …)
  if (g0 === 0x2001) {
    if (g1 === 0x0db8) return false; // documentation
    if (g1 === 0x0000) return publicV4(v4From(g2, g3)) && publicV4(0xffffffff - v4From(g6, g7)); // Teredo: server and client
    if (g1 === 0x0002 && g2 === 0) return false; // benchmarking
    if ((g1 & 0xfff0) === 0x0010 || (g1 & 0xfff0) === 0x0020) return false; // ORCHID
  }
  if (g0 === 0x2002) return publicV4(v4From(g1, g2)); // 6to4
  if (g0 === 0x3fff && (g1 & 0xf000) === 0) return false; // documentation (3fff::/20)
  return true;
}

const isLoopbackAddress = (ip: string) => ip === "::1" || ip.startsWith("127.");

type LookupCallback = (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/**
 * The `lookup` handed to `https.request`: it answers only the address we already checked, in either
 * calling style (Node asks for `{ all: true }` when it picks an address family itself).
 */
export function pinnedLookup(address: string, family: 4 | 6) {
  return (_hostname: string, options: LookupOptions, callback: LookupCallback): void => {
    if (options.all) callback(null, [{ address, family }]);
    else callback(null, address, family);
  };
}

// ── One request ──────────────────────────────────────────────────────────────

type Hop = { kind: "redirect"; location: string } | { kind: "done"; result: SafeFetchResult };

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

const acceptable = (accept: string, contentType: string): boolean => {
  if (accept === "text/html") return contentType === "text/html" || contentType === "application/xhtml+xml";
  if (accept === "text/plain") return contentType === "" || contentType.startsWith("text/");
  return contentType === accept;
};

const decoderFor = (charset: string | undefined) => {
  try {
    return new TextDecoder(charset ?? "utf-8");
  } catch {
    return new TextDecoder("utf-8");
  }
};

class FetchTimeout extends Error {}

/** `work`, or a `FetchTimeout` as soon as the fetch's time is up (whatever `work` goes on to do). */
const beforeTimeout = <T>(work: Promise<T>, signal: AbortSignal): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const expire = () => {
      reject(new FetchTimeout());
    };
    if (signal.aborted) {
      expire();
      return;
    }
    signal.addEventListener("abort", expire, { once: true });
    work.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", expire);
    });
  });

/** A name lookup that ran out of time (its own 2 s, or the fetch's): not the same as a name that does not exist. */
const lookupTimedOut = (error: unknown): boolean => {
  if (error instanceof FetchTimeout) return true;
  const code = error instanceof Error && "code" in error ? error.code : undefined;
  return code === "ETIMEOUT" || code === "ECANCELLED";
};

function request(url: URL, address: ResolvedAddress, port: number, config: FetcherConfig, options: SafeFetchOptions, signal: AbortSignal): Promise<Hop> {
  return new Promise<Hop>((resolve) => {
    let settled = false;
    const finish = (hop: Hop) => {
      if (settled) return;
      settled = true;
      resolve(hop);
    };
    const fail = (reason: SafeFetchReason, status?: number) => {
      finish({ kind: "done", result: status === undefined ? { ok: false, reason } : { ok: false, reason, status } });
    };
    const secure = url.protocol === "https:";
    const transport = secure ? https : http;
    // `autoSelectFamily: false`: connect to the one address we checked, never race other families.
    const requestOptions: https.RequestOptions & { autoSelectFamily: boolean } = {
      host: url.hostname,
      port,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      agent: false,
      lookup: pinnedLookup(address.address, address.family),
      autoSelectFamily: false,
      ...(secure ? { servername: url.hostname } : {}),
      headers: {
        "User-Agent": config.userAgent(),
        Accept: options.accept,
        "Accept-Language": options.locale ?? "de",
        "Accept-Encoding": "gzip, deflate, br",
      },
      signal,
    };
    const req = transport.request(requestOptions);

    req.on("socket", (socket) => {
      const timer = setTimeout(() => req.destroy(new FetchTimeout()), config.connectTimeoutMs);
      socket.once(secure ? "secureConnect" : "connect", () => {
        clearTimeout(timer);
      });
      socket.once("close", () => {
        clearTimeout(timer);
      });
    });

    req.on("error", (error) => {
      fail(error instanceof FetchTimeout || signal.aborted ? "timeout" : "failed");
    });
    signal.addEventListener(
      "abort",
      () => {
        req.destroy();
        fail("timeout");
      },
      { once: true },
    );

    req.on("response", (res: IncomingMessage) => {
      const status = res.statusCode ?? 0;
      if (REDIRECTS.has(status)) {
        const location = res.headers.location;
        res.resume();
        if (!location) fail("failed", status);
        else finish({ kind: "redirect", location });
        return;
      }
      if (status === 404 || status === 410) {
        res.resume();
        fail("notFound", status);
        return;
      }
      if (status < 200 || status >= 300) {
        res.resume();
        fail("failed", status);
        return;
      }
      const [type = "", ...params] = (res.headers["content-type"] ?? "").split(";");
      const contentType = type.trim().toLowerCase();
      if (!acceptable(options.accept, contentType)) {
        res.destroy();
        fail("type", status);
        return;
      }
      const charset = params
        .map((param) => param.trim().split("="))
        .find(([key]) => key?.toLowerCase() === "charset")?.[1]
        ?.replace(/"/g, "");
      const encoding = (res.headers["content-encoding"] ?? "").trim().toLowerCase();
      let body: Readable = res;
      if (encoding === "gzip" || encoding === "x-gzip") body = res.pipe(zlib.createGunzip());
      else if (encoding === "br") body = res.pipe(zlib.createBrotliDecompress());
      else if (encoding === "deflate") body = res.pipe(zlib.createInflate());
      else if (encoding && encoding !== "identity") {
        res.destroy();
        fail("failed", status);
        return;
      }
      const limit = options.maxBytes ?? config.maxBytes;
      const chunks: Buffer[] = [];
      let size = 0;
      body.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > limit) {
          body.destroy();
          res.destroy();
          fail("tooLarge", status);
          return;
        }
        chunks.push(chunk);
      });
      body.on("error", () => {
        fail(signal.aborted ? "timeout" : "failed", status);
      });
      let received = false;
      res.on("end", () => {
        received = true;
      });
      res.on("error", () => {
        fail(signal.aborted ? "timeout" : "failed", status);
      });
      res.on("close", () => {
        // Closed before the whole body arrived (the connection dropped).
        if (!received) fail(signal.aborted ? "timeout" : "failed", status);
      });
      body.on("end", () => {
        const text = decoderFor(charset).decode(Buffer.concat(chunks));
        finish({ kind: "done", result: { ok: true, url: url.toString(), status, contentType, body: text } });
      });
    });

    req.end();
  });
}

// ── The fetcher ──────────────────────────────────────────────────────────────

type Checked = { ok: true; url: URL; host: string; address: ResolvedAddress; port: number } | { ok: false; reason: SafeFetchReason };

const BLOCKED_SUFFIXES = [".local", ".internal", ".localhost"];

export function createSafeFetcher(overrides: Partial<FetcherConfig> = {}): SafeFetch {
  const config: FetcherConfig = { ...DEFAULTS, ...overrides };
  const expectedPort = config.port ?? (config.protocol === "https:" ? 443 : 80);

  /** Checks one address from the top: the URL, the name, every address it resolves to. */
  async function check(raw: string, signal: AbortSignal): Promise<Checked> {
    if (raw.length > 2048) return { ok: false, reason: "blocked" };
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return { ok: false, reason: "blocked" };
    }
    if (url.protocol !== config.protocol || url.username || url.password) return { ok: false, reason: "blocked" };
    const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
    if (port !== expectedPort) return { ok: false, reason: "blocked" };
    const host = domainToASCII(url.hostname.replace(/\.$/, "")).toLowerCase();
    if (!host || isIP(host.replace(/^\[|\]$/g, "")) || url.hostname.startsWith("[")) return { ok: false, reason: "blocked" };
    if (!host.includes(".") || host === "localhost" || BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) return { ok: false, reason: "blocked" };
    url.hostname = host;
    url.hash = "";
    let addresses: ResolvedAddress[];
    try {
      addresses = await beforeTimeout(config.resolve(host, signal), signal);
    } catch (error) {
      return { ok: false, reason: lookupTimedOut(error) ? "timeout" : "notFound" };
    }
    if (addresses.length === 0) return { ok: false, reason: "notFound" };
    const allowed = (ip: string) => isPublicAddress(ip) || (config.allowLoopbackForTests === true && isLoopbackAddress(ip));
    if (!addresses.every((answer) => allowed(answer.address))) return { ok: false, reason: "blocked" };
    const [address] = addresses;
    if (!address) return { ok: false, reason: "notFound" };
    return { ok: true, url, host, address, port };
  }

  /** One fetch under the caller's clock: `signal` aborts when the whole call's time is up. */
  async function run(raw: string, options: SafeFetchOptions, signal: AbortSignal): Promise<SafeFetchResult> {
    /** Read through a function: the signal aborts while this call awaits. */
    const expired = () => signal.aborted;
    try {
      let next = raw;
      for (let redirects = 0; ; redirects += 1) {
        if (expired()) return { ok: false, reason: "timeout" };
        const checked = await check(next, signal);
        if (!checked.ok) return { ok: false, reason: checked.reason };
        if (options.allowHost && !options.allowHost(checked.host)) return { ok: false, reason: "blocked" };
        if (options.robots) {
          // robots.txt is read on this call's clock: it gets no time of its own.
          const robotsText = (address: string) => run(address, { accept: "text/plain", maxBytes: ROBOTS_MAX_BYTES, ...(options.locale ? { locale: options.locale } : {}) }, signal);
          if (!(await robots.allowed(checked.url, robotsText))) return { ok: false, reason: expired() ? "timeout" : "robots" };
        }
        if (expired()) return { ok: false, reason: "timeout" };
        const hop = await request(checked.url, checked.address, checked.port, config, options, signal);
        if (hop.kind === "done") return hop.result;
        if (redirects >= config.maxRedirects) return { ok: false, reason: "failed" };
        try {
          next = new URL(hop.location, checked.url).toString();
        } catch {
          return { ok: false, reason: "blocked" };
        }
      }
    } catch {
      return { ok: false, reason: expired() ? "timeout" : "failed" };
    }
  }

  const fetcher: SafeFetch = async (raw, options) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, config.totalTimeoutMs);
    try {
      return await run(raw, options, controller.signal);
    } finally {
      clearTimeout(timer);
    }
  };

  const robots: Robots = createRobots({
    fetchText: (address) => fetcher(address, { accept: "text/plain", maxBytes: ROBOTS_MAX_BYTES }),
    ...(config.now ? { now: config.now } : {}),
    ...(config.robotsTtlMs ? { ttlMs: config.robotsTtlMs } : {}),
  });
  return fetcher;
}

/** The production fetcher (its robots.txt answers are kept in this module for 24 hours). */
export const safeFetch: SafeFetch = createSafeFetcher(DEFAULTS);
