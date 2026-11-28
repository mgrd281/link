/**
 * Linkyo's Content-Security-Policy (E-05, ADR draft-csp-and-limits). Static: next.config.ts sends it as
 * a header, so creator pages stay cached (ISR). A nonce would need a fresh render per request.
 *
 * It ships as `Content-Security-Policy-Report-Only` first: browsers report what the policy would
 * block (to /api/csp-report) and block nothing. Enforcing it is the one-line switch `CSP_HEADER`
 * once a week of reports is clean.
 *
 * Why each source is there:
 * - `script-src 'unsafe-inline'`: Next.js streams the page's React payload in inline scripts
 *   (`self.__next_f.push(…)`) whose content differs per page and per request, and the app adds a few
 *   small inline scripts before hydration (lib/theme-script.ts, nav-panel-script.ts and others). With
 *   no nonce (static headers) and no fixed content (no hashes), only `'unsafe-inline'` lets them
 *   run. Every script file still has to come from this origin: no host is allowed besides 'self'.
 * - `style-src 'unsafe-inline'`: React's `style` attributes (creator colours, the hero's focal point)
 *   and the small `<style>` blocks of the creator routes (page background).
 * - `img-src data: blob:`: pictures made in the browser (the QR code and inline sample pictures as
 *   data URLs, the share picture's canvas and a picture being uploaded as blob URLs). Platform and
 *   Storage pictures go through our own image optimizer (/_next/image), so no picture host is listed,
 *   except this deployment's Supabase project where the browser shows a Storage file itself (signed
 *   addresses of order photos in the team area).
 * - `connect-src`: our own routes, and this deployment's Supabase project (the dashboard and the team
 *   area talk to it from the browser with real accounts).
 * - `frame-src 'self' https://www.youtube-nocookie.com`: our own pages in a frame (the templates
 *   gallery shows an example page, `/<locale>/p/…`, in its phone frame), and the only player that
 *   loads on a creator page, only after the visitor's tap.
 * - `frame-ancestors`: 'self' only for the example pages, which the templates gallery shows in a frame
 *   (`/<locale>/p/…`); nothing else may be framed.
 * - Checkout pages (`/<locale>/checkout/…`) only: Stripe.js and its frames (the payment form), its API,
 *   and its pictures (card brands), as Stripe documents for the Payment Element.
 */

export const CSP_HEADER = "Content-Security-Policy-Report-Only";

/** Where browsers send reports (`report-uri`, and `report-to` through `Reporting-Endpoints`). */
export const CSP_REPORT_PATH = "/api/csp-report";
export const CSP_REPORT_GROUP = "csp";

export const YOUTUBE_FRAME = "https://www.youtube-nocookie.com";
/** Stripe's hosts for the Payment Element (Stripe's CSP guide), on checkout pages only. */
export const STRIPE = {
  script: ["https://js.stripe.com", "https://*.js.stripe.com"],
  frame: ["https://js.stripe.com", "https://*.js.stripe.com", "https://hooks.stripe.com"],
  connect: ["https://api.stripe.com"],
  img: ["https://*.stripe.com"],
} as const;

export interface CspOptions {
  /** NEXT_PUBLIC_SUPABASE_URL of this build, when real accounts are on. */
  supabaseUrl?: string | undefined;
  /** A checkout page: Stripe's hosts join the policy. */
  checkout?: boolean;
  /** A page another of our pages shows in a frame (the gallery's example pages). */
  framable?: boolean;
}

/** The origin of an http(s) address, or null. */
function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

/** The policy as one header value: directives in a fixed order, sources once each. */
export function contentSecurityPolicy({ supabaseUrl, checkout = false, framable = false }: CspOptions = {}): string {
  const supabase = originOf(supabaseUrl);
  const own = supabase ? [supabase] : [];
  const directives: [string, string[]][] = [
    ["default-src", ["'self'"]],
    ["script-src", ["'self'", "'unsafe-inline'", ...(checkout ? STRIPE.script : [])]],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", "blob:", ...own, ...(checkout ? STRIPE.img : [])]],
    ["font-src", ["'self'"]],
    ["connect-src", ["'self'", ...own, ...(checkout ? STRIPE.connect : [])]],
    ["media-src", ["'self'"]],
    ["frame-src", ["'self'", YOUTUBE_FRAME, ...(checkout ? STRIPE.frame : [])]],
    ["worker-src", ["'self'"]],
    ["manifest-src", ["'self'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", [framable ? "'self'" : "'none'"]],
    ["report-uri", [CSP_REPORT_PATH]],
    ["report-to", [CSP_REPORT_GROUP]],
  ];
  return directives.map(([name, sources]) => `${name} ${[...new Set(sources)].join(" ")}`).join("; ");
}

// ── Reports (app/api/csp-report) ──────────────────────────────────────────────────────────────

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === "string" ? value : "");

/**
 * Where a report names an address: its origin and path only, no query or fragment (they could carry a
 * token or someone's e-mail address), and the bare keyword for `inline`, `eval`, `data` and the like.
 */
export function reportedPlace(value: unknown): string {
  const raw = text(value);
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return url.protocol.replace(/:$/, "");
    return `${url.origin}${url.pathname}`.slice(0, 200);
  } catch {
    return raw.replace(/[^\w-]/g, "").slice(0, 40);
  }
}

/** A directive's name as a log may hold it: letters, digits and dashes, at most 40 (a report is the sender's text). */
const directiveName = (value: unknown): string => text(value).replace(/[^\w-]/g, "").slice(0, 40);

/** The fields of one violation, from either format: `report-uri` (`csp-report`) or the Reporting API (`body`). */
export function violation(report: unknown): { directive: string; blocked: string; page: string; source: string } | null {
  if (!isRecord(report)) return null;
  const legacy = isRecord(report["csp-report"]) ? report["csp-report"] : null;
  const modern = report.type === "csp-violation" && isRecord(report.body) ? report.body : null;
  if (legacy) {
    return {
      directive: directiveName(legacy["effective-directive"]) || directiveName(text(legacy["violated-directive"]).split(" ")[0]),
      blocked: reportedPlace(legacy["blocked-uri"]),
      page: reportedPlace(legacy["document-uri"]),
      source: reportedPlace(legacy["source-file"]),
    };
  }
  if (modern) {
    return { directive: directiveName(modern.effectiveDirective), blocked: reportedPlace(modern.blockedURL), page: reportedPlace(modern.documentURL), source: reportedPlace(modern.sourceFile) };
  }
  return null;
}
