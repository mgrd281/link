import { violation } from "@/lib/csp";
import { addressKey, MINUTE, rateLimit, retryHeaders } from "@/lib/rate-limit";
import { requestPlace } from "@/lib/request-context";
import { readBody } from "@/lib/server/read-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A report is well under 2 KB; a batch of the Reporting API a few of them. */
const MAX_BODY = 16 * 1024;
/** At most this many lines from one request (a batch). */
const MAX_LINES = 10;
/** A page with many violations sends one report each: 60 requests per address a minute. */
const REPORT_LIMIT = rateLimit({ name: "csp-report", max: 60, windowMs: MINUTE });

const done = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

/**
 * Collects Content-Security-Policy reports (ADR draft-csp-and-limits). Logs one short line per
 * violation (the directive, what was blocked, on which page; never a query string, never the
 * reporter's address) and stores nothing. No cookie is read or set. Always 204, or 429 past its limit.
 */
export async function POST(request: Request) {
  const verdict = REPORT_LIMIT.take(addressKey(requestPlace(request.headers).ip));
  if (!verdict.ok) return new Response(null, { status: 429, headers: retryHeaders(verdict) });
  const raw = await readBody(request, MAX_BODY);
  if (raw === null) return done();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return done();
  }
  const reports = (Array.isArray(parsed) ? parsed : [parsed]).slice(0, MAX_LINES);
  for (const report of reports) {
    const found = violation(report);
    if (found) console.warn(`csp-report ${found.directive.slice(0, 40)} blocked=${found.blocked} page=${found.page}${found.source ? ` source=${found.source}` : ""}`);
  }
  return done();
}
