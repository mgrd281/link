import { describe, expect, it } from "vitest";

import { contentSecurityPolicy, CSP_HEADER, reportedPlace, violation } from "./csp";

/** The policy as directive → sources. */
const parse = (policy: string): Record<string, string[] | undefined> =>
  Object.fromEntries(policy.split("; ").map((part) => [part.split(" ")[0] ?? "", part.split(" ").slice(1)]));

describe("contentSecurityPolicy", () => {
  it("ships report-only first (the lead's decision; enforcing is a later one-line switch)", () => {
    expect(CSP_HEADER).toBe("Content-Security-Policy-Report-Only");
  });

  it("allows only this origin for scripts, styles, fonts, frames' parents and connections by default", () => {
    const policy = parse(contentSecurityPolicy());
    expect(policy["default-src"]).toEqual(["'self'"]);
    expect(policy["script-src"]).toEqual(["'self'", "'unsafe-inline'"]);
    expect(policy["style-src"]).toEqual(["'self'", "'unsafe-inline'"]);
    expect(policy["img-src"]).toEqual(["'self'", "data:", "blob:"]);
    expect(policy["font-src"]).toEqual(["'self'"]);
    expect(policy["connect-src"]).toEqual(["'self'"]);
    expect(policy["frame-src"]).toEqual(["'self'", "https://www.youtube-nocookie.com"]);
    expect(policy["object-src"]).toEqual(["'none'"]);
    expect(policy["base-uri"]).toEqual(["'self'"]);
    expect(policy["form-action"]).toEqual(["'self'"]);
    expect(policy["frame-ancestors"]).toEqual(["'none'"]);
    expect(policy["report-uri"]).toEqual(["/api/csp-report"]);
    expect(policy["report-to"]).toEqual(["csp"]);
  });

  it("names Stripe only on checkout pages", () => {
    expect(contentSecurityPolicy()).not.toContain("stripe");
    expect(contentSecurityPolicy({ framable: true, supabaseUrl: "https://abc.supabase.co" })).not.toContain("stripe");
    const checkout = parse(contentSecurityPolicy({ checkout: true }));
    expect(checkout["script-src"]).toEqual(["'self'", "'unsafe-inline'", "https://js.stripe.com", "https://*.js.stripe.com"]);
    expect(checkout["frame-src"]).toEqual(["'self'", "https://www.youtube-nocookie.com", "https://js.stripe.com", "https://*.js.stripe.com", "https://hooks.stripe.com"]);
    expect(checkout["connect-src"]).toEqual(["'self'", "https://api.stripe.com"]);
    expect(checkout["frame-ancestors"]).toEqual(["'none'"]);
  });

  it("lets only the example pages be framed, by our own pages", () => {
    expect(parse(contentSecurityPolicy({ framable: true }))["frame-ancestors"]).toEqual(["'self'"]);
  });

  it("adds this deployment's Supabase origin (never a path) where the browser talks to it, and nothing for a bad value", () => {
    const policy = parse(contentSecurityPolicy({ supabaseUrl: "https://abc.supabase.co/rest/v1" }));
    expect(policy["connect-src"]).toEqual(["'self'", "https://abc.supabase.co"]);
    expect(policy["img-src"]).toEqual(["'self'", "data:", "blob:", "https://abc.supabase.co"]);
    expect(contentSecurityPolicy({ supabaseUrl: "javascript:alert(1)" })).toBe(contentSecurityPolicy());
    expect(contentSecurityPolicy({ supabaseUrl: "not a url" })).toBe(contentSecurityPolicy());
  });
});

describe("reports", () => {
  it("reads both formats: report-uri's csp-report and the Reporting API's csp-violation", () => {
    expect(
      violation({ "csp-report": { "document-uri": "https://linkyo.app/de?email=a@b.c", "blocked-uri": "https://evil.example/x.js?t=1", "effective-directive": "script-src-elem" } }),
    ).toEqual({ directive: "script-src-elem", blocked: "https://evil.example/x.js", page: "https://linkyo.app/de", source: "" });
    expect(
      violation({ type: "csp-violation", body: { documentURL: "https://linkyo.app/u/mira#x", blockedURL: "inline", effectiveDirective: "style-src-attr", sourceFile: "https://linkyo.app/_next/a.js" } }),
    ).toEqual({ directive: "style-src-attr", blocked: "inline", page: "https://linkyo.app/u/mira", source: "https://linkyo.app/_next/a.js" });
    expect(violation({ "csp-report": { "violated-directive": "img-src 'self'", "blocked-uri": "data" } })?.directive).toBe("img-src");
    for (const junk of [null, "x", [], { type: "deprecation", body: {} }]) expect(violation(junk)).toBeNull();
    // A report is the sender's text: no line break or other character can reach the log line.
    const forged = violation({ "csp-report": { "effective-directive": "script-src\ncsp-report forged blocked=https://evil.example page=x", "blocked-uri": "inline" } });
    expect(forged?.directive).toBe("script-srccsp-reportforgedblockedhttpsev");
    expect(forged?.directive).toMatch(/^[\w-]{1,40}$/);
    expect(violation({ type: "csp-violation", body: { effectiveDirective: "img-src\r\nX: y" } })?.directive).toBe("img-srcXy");
  });

  it("never keeps a query, a fragment or anything but a keyword from what is not an address", () => {
    expect(reportedPlace("https://linkyo.app/api/auth/confirm?token_hash=secret")).toBe("https://linkyo.app/api/auth/confirm");
    expect(reportedPlace("eval")).toBe("eval");
    expect(reportedPlace("data:image/png;base64,AAAA")).toBe("data");
    expect(reportedPlace("<script>alert(1)</script>")).toBe("scriptalert1script");
    expect(reportedPlace(42)).toBe("");
  });
});
