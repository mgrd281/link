import { randomUUID } from "node:crypto";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { enterDemoCode } from "./auth";
import { LOCALES, ROUTES } from "./routes";

/**
 * The Content-Security-Policy (E-05, ADR draft-csp-and-limits), report-only for now: present on every
 * kind of page, Stripe's hosts only on checkout pages, framing only for the example pages the gallery
 * frames, and not one violation on the site's routes, the example pages and the dashboard's and the
 * team area's journeys. Every violation the browser reports (`securitypolicyviolation`, which fires in
 * report-only mode too) is printed in the run's output before the test fails on it. The server's own
 * log of the reports (/api/csp-report, one `csp-report …` line each) shows in the output as well.
 *
 * Also: the old password pages answer 308 to sign-in, and the iPhone app's routes answer a method they
 * do not take with 405 and no-store.
 */

const REPORT_ONLY = "content-security-policy-report-only";
const STUB = process.env.E2E_STUB === "1";
const STUB_URL = `http://127.0.0.1:${process.env.STUB_SUPABASE_PORT ?? "55103"}`;
/** The demo build's team code (as the other team specs use it; real accounts refuse it). */
const TEAM_CODE = "linkyo-team-4827";

interface Violation {
  page: string;
  directive: string;
  blocked: string;
  source: string;
}

/** Collects every violation the policy reports in this page, from the first script on. */
async function collectViolations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seen: Violation[] = [];
    (window as unknown as { __csp: Violation[] }).__csp = seen;
    document.addEventListener("securitypolicyviolation", (event) => {
      seen.push({ page: location.pathname + location.search, directive: event.effectiveDirective, blocked: event.blockedURI, source: `${event.sourceFile}:${String(event.lineNumber)}` });
    });
  });
}

/** Prints the violations in the run's output (also when there are none), then expects none. */
function expectNone(label: string, violations: Violation[]): void {
  console.warn(`[csp] ${label}: ${String(violations.length)} violation(s)${violations.map((v) => `\n[csp]   ${v.directive} blocked=${v.blocked} on ${v.page} (${v.source})`).join("")}`);
  expect(violations, label).toEqual([]);
}

/** Opens a page, scrolls it through (lazy pictures, islands), and returns what the policy reported there. */
async function sweep(page: Page, path: string): Promise<Violation[]> {
  const response = await page.goto(path);
  expect(response?.status(), path).toBeLessThan(400);
  // A signed-in dashboard keeps talking to Supabase: rest is not guaranteed there, the page is loaded.
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  return page.evaluate(() => (window as unknown as { __csp?: Violation[] }).__csp ?? []);
}

test.describe("the policy header", () => {
  test("is sent report-only on the site, an example page, a creator address, the dashboard and the team area; Stripe only on checkout", async ({ request }) => {
    const policies = new Map<string, string>();
    for (const path of ["/de", "/de/p/ronja-feldkamp", "/u/mira", "/de/app", "/de/admin", "/de/login", "/de/checkout/pro", "/de/checkout/service", "/api/collect"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      const policy = response.headers()[REPORT_ONLY] ?? "";
      expect(policy, path).toContain("default-src 'self'");
      expect(policy, path).toContain("object-src 'none'");
      expect(policy, path).toContain("report-uri /api/csp-report");
      // Report-only first (the lead's decision): nothing is enforced yet.
      expect(response.headers()["content-security-policy"], path).toBeUndefined();
      policies.set(path, policy);
    }
    for (const [path, policy] of policies) {
      const checkout = path.startsWith("/de/checkout/");
      expect(policy.includes("https://js.stripe.com"), path).toBe(checkout);
      expect(policy.includes("api.stripe.com"), path).toBe(checkout);
      // Only the example pages may be framed (by the templates gallery, on our own origin).
      expect(policy, path).toContain(path.startsWith("/de/p/") ? "frame-ancestors 'self'" : "frame-ancestors 'none'");
      expect(policy, path).toContain("frame-src https://www.youtube-nocookie.com");
    }
  });

  test("/de/forgot and /de/reset-password answer 308 to /de/login, with one Location", async ({ request }) => {
    for (const locale of LOCALES) {
      for (const old of ["forgot", "reset-password"]) {
        const response = await request.get(`/${locale}/${old}`, { maxRedirects: 0 });
        expect(response.status(), old).toBe(308);
        const locations = response.headersArray().filter((header) => header.name.toLowerCase() === "location");
        expect(locations, old).toHaveLength(1);
        expect(new URL(locations[0]?.value ?? "", "http://x").pathname, old).toBe(`/${locale}/login`);
      }
    }
  });

  test("the iPhone app's routes answer GET with 405 and no-store, never a cacheable answer", async ({ request }) => {
    for (const path of ["/api/app/page", "/api/auth/handoff"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(405);
      expect(response.headers()["cache-control"], path).toBe("no-store");
      expect(response.headers().allow, path).toBe("POST");
    }
  });

  test("/api/csp-report takes a report in either format, answers 204 and sets no cookie", async ({ request }) => {
    const legacy = await request.post("/api/csp-report", {
      headers: { "content-type": "application/csp-report" },
      data: JSON.stringify({ "csp-report": { "document-uri": "http://localhost/de?x=1", "blocked-uri": "https://evil.example/a.js", "effective-directive": "script-src-elem" } }),
    });
    expect(legacy.status()).toBe(204);
    expect(legacy.headers()["set-cookie"]).toBeUndefined();
    const modern = await request.post("/api/csp-report", {
      headers: { "content-type": "application/reports+json" },
      data: JSON.stringify([{ type: "csp-violation", body: { documentURL: "http://localhost/de", blockedURL: "inline", effectiveDirective: "style-src-attr" } }]),
    });
    expect(modern.status()).toBe(204);
  });
});

test.describe("no violation", () => {
  // The sweep is long; the phone project checks the header above and the journeys below.
  test.skip(({ isMobile }) => isMobile, "One sweep of every route is enough (laptop).");

  for (const locale of LOCALES) {
    test(`on every route of e2e/routes.ts in ${locale}`, async ({ page }) => {
      test.setTimeout(600_000);
      await collectViolations(page);
      const found: Violation[] = [];
      for (const route of ROUTES) found.push(...(await sweep(page, `/${locale}${route}`)));
      expectNone(`routes (${locale}, ${String(ROUTES.length)} pages)`, found);
    });
  }

  test("on example pages, a prepared page with real videos and its player after a tap, and a project page", async ({ page }) => {
    test.setTimeout(240_000);
    await collectViolations(page);
    // The player is answered here: no request reaches YouTube in a test.
    await page.route("https://www.youtube-nocookie.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>player</title>" }));
    const found: Violation[] = [];
    for (const path of ["/de/p/ronja-feldkamp", "/ar/p/elena-novak", "/de/p/lou-ferreira", "/de/p/journalist", "/de/templates", "/de/p/nizar"]) found.push(...(await sweep(page, path)));
    // A YouTube player in its frame (frame-src).
    await page.getByRole("button", { name: /^Video von YouTube abspielen: / }).first().click();
    await expect(page.locator('iframe[src^="https://www.youtube-nocookie.com/embed/"]')).toHaveCount(1);
    found.push(...(await page.evaluate(() => (window as unknown as { __csp?: Violation[] }).__csp ?? [])));
    expectNone("example pages and a player", found);
  });
});

test.describe("no violation in the dashboard and the team area (demo)", () => {
  test.skip(STUB, "The demo journeys need a demo build.");

  test("signing up, the welcome flow, every dashboard screen, and the team area", async ({ page }) => {
    test.setTimeout(240_000);
    await collectViolations(page);
    const found: Violation[] = [];
    const take = async () => found.push(...(await page.evaluate(() => (window as unknown as { __csp?: Violation[] }).__csp ?? [])));
    const name = `csp-${Date.now().toString(36)}`;
    await page.goto(`/de/signup?name=${name}`);
    await page.waitForLoadState("networkidle");
    await page.locator("#signup-email").fill(`${name}@example.com`);
    await page.locator("form button[type=submit]").click();
    await enterDemoCode(page);
    await page.waitForURL("**/de/app/welcome");
    await take();
    for (const path of ["/de/app", "/de/app/editor", "/de/app/work", "/de/app/design", "/de/app/analytics", "/de/app/invite", "/de/app/settings", "/de/app/settings/account", "/de/app/settings/address", "/de/app/settings/legal", "/de/app/settings/plan"]) {
      found.push(...(await sweep(page, path)));
    }
    // The team area: the gate, then the overview with the demo's team code.
    await page.goto("/de/admin");
    await page.waitForLoadState("networkidle");
    await page.locator("#team-name").fill("Mara");
    await page.locator("#team-code").fill(TEAM_CODE);
    await page.locator("form button[type=submit]").click();
    await page.waitForLoadState("networkidle");
    await take();
    for (const path of ["/de/admin/creators", "/de/admin/customers", "/de/admin/subscriptions", "/de/admin/analytics", "/de/admin/activity", "/de/admin/security", "/de/admin/team", "/de/admin/templates", "/de/admin/referrals"]) found.push(...(await sweep(page, path)));
    expectNone("dashboard and team area", found);
  });
});

// ─── Real accounts with the Supabase stand-in (E2E_STUB=1, its own build: e2e/stub-app.spec.ts) ───────

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

/** An onboarded account in the stand-in, with a project that moved from `tide-old` to `tidewatch`. */
async function stubAccount(): Promise<{ id: string; username: string; email: string; token: string }> {
  const id = randomUUID();
  const username = `sec-${randomUUID().replaceAll("-", "").slice(0, 8)}`;
  const email = `${username}@example.com`;
  const page = {
    profile: { username, displayName: "Mira Feld", bio: "", avatar: { src: "none:", alt: "" }, verified: false, locale: "de" },
    blocks: [{ id: "p1", type: "project", slug: "tidewatch", was: ["tide-old"], title: "Tidewatch", summary: "Eine Serie am Hafen.", visible: true, highlight: false, cover: { src: "none:", alt: "" } }],
  };
  const seeded = await fetch(`${STUB_URL}/__stub/seed`, {
    method: "POST",
    body: JSON.stringify({
      users: { [id]: { id, email } },
      profiles: { [id]: { id, username, locale: "de", status: "active", created_at: "2026-11-01T00:00:00Z" } },
      sites: { [id]: { profile_id: id, kind: null, onboarded: true, prepared: null, page, theme: { template: "werkbogen" }, legal: { name: "", address: "", email, phone: "" }, updated_at: "2026-11-20T10:00:00Z" } },
    }),
  });
  expect(seeded.ok).toBe(true);
  return { id, username, email, token: `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: id, role: "authenticated", exp: 4_070_908_800 })}.stub` };
}

/** The session cookie the app's Supabase client reads (as e2e/stub-app.spec.ts signs in). */
async function stubSignIn(context: BrowserContext, baseURL: string | undefined, who: Awaited<ReturnType<typeof stubAccount>>): Promise<void> {
  const session = {
    access_token: who.token,
    refresh_token: "stub-refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: 4_070_908_800,
    user: { id: who.id, aud: "authenticated", role: "authenticated", email: who.email, app_metadata: {}, user_metadata: {}, created_at: "2026-11-01T00:00:00Z" },
  };
  const host = new URL(STUB_URL).hostname.split(".")[0] ?? "127";
  await context.addCookies([{ name: `sb-${host}-auth-token`, value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`, url: baseURL ?? "http://localhost:3100" }]);
}

test.describe("real accounts (stub)", () => {
  test.skip(!STUB, "Needs the stub build and the Supabase stand-in (E2E_STUB=1).");

  test("/api/prepared answers 404 to a visitor and to a signed-in account without a team role", async ({ request }) => {
    const who = await stubAccount();
    const body = { email: "someone@example.com", username: "someone", locale: "de" };
    for (const headers of [{}, { authorization: `Bearer ${who.token}` }, { authorization: `Bearer ${"0".repeat(64)}` }]) {
      const response = await request.post("/api/prepared", { headers, data: body });
      expect(response.status()).toBe(404);
      expect(await response.json()).toEqual({ kind: "none" });
      expect(response.headers()["cache-control"]).toBe("no-store");
    }
  });

  test("the policy names this deployment's Supabase project for the browser, and Stripe only on checkout", async ({ request }) => {
    for (const path of ["/de", "/de/app", "/de/checkout/pro"]) {
      const policy = (await request.get(path, { maxRedirects: 0 })).headers()[REPORT_ONLY] ?? "";
      expect(policy, path).toContain(`connect-src 'self' ${new URL(STUB_URL).origin}`);
      expect(policy.includes("js.stripe.com"), path).toBe(path.startsWith("/de/checkout/"));
    }
  });

  test.skip(({ isMobile }) => isMobile, "One sweep is enough (laptop).");

  test("no violation on a real creator page, its project, the dashboard and both checkouts with Stripe's form", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000);
    await collectViolations(page);
    const who = await stubAccount();
    const found: Violation[] = [];
    found.push(...(await sweep(page, `/${who.username}`)), ...(await sweep(page, `/${who.username}/tidewatch`)));
    await stubSignIn(context, baseURL, who);
    for (const path of ["/de/app", "/de/app/editor", "/de/app/design", "/de/app/settings/plan"]) found.push(...(await sweep(page, path)));
    // Stripe.js and the checkout's own routes, answered in the browser: nothing reaches Stripe.
    await page.route("https://js.stripe.com/v3/", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: "window.Stripe = () => ({ initCheckout: async () => ({ createPaymentElement: () => ({ mount(el) { el.innerHTML = '<div data-fake-payment-field>4242</div>'; }, destroy() {}, on(_e, ready) { setTimeout(ready, 0); } }), confirm: async () => ({ type: 'error', error: {} }) }) });",
      }),
    );
    await page.route("**/api/checkout/plan", (route) => route.fulfill({ json: { startAt: "2026-12-08T08:00:00Z", dueAt: "2026-12-10T17:00:00Z", briefingBy: "2026-12-09T11:00:00Z" } }));
    await page.route("**/api/checkout/service", (route) => route.fulfill({ json: { sessionId: "cs_stub_1", clientSecret: "cs_stub_1_secret" } }));
    await page.route("**/api/checkout/pro", (route) => route.fulfill({ json: { sessionId: "cs_stub_2", clientSecret: "cs_stub_2_secret" } }));
    await page.route("**/api/checkout/consent", (route) => route.fulfill({ json: { ok: true } }));
    found.push(...(await sweep(page, "/de/checkout/service?package=start")));
    await expect(page.locator("[data-fake-payment-field]")).toBeVisible();
    found.push(...(await page.evaluate(() => (window as unknown as { __csp?: Violation[] }).__csp ?? [])));
    found.push(...(await sweep(page, "/de/checkout/pro")));
    expectNone("real pages, dashboard and checkouts (stub)", found);
  });

  // Next.js 16.4.6 sends a Location set by redirect() in a cached (ISR) render twice on the cache miss
  // that renders it (once from the render, once from the cache entry it then serves), and once on every
  // hit. The project route must stay ISR and src/proxy.ts is not ours to change, so this is expected to
  // fail until Next.js sends it once (ADR draft-csp-and-limits, "One Location"). Both copies name the same
  // address, which browsers follow.
  test("a renamed project answers 307 with one Location, on the cache miss and on a hit", async ({ request }) => {
    test.fail(true, "Next.js repeats the Location of an ISR redirect on the cache miss (see above).");
    const who = await stubAccount();
    for (const round of ["miss", "hit"]) {
      const response = await request.get(`/${who.username}/tide-old`, { maxRedirects: 0 });
      expect(response.status(), round).toBe(307);
      const locations = response.headersArray().filter((header) => header.name.toLowerCase() === "location");
      for (const header of locations) expect(header.value, round).toBe(`/${who.username}/tidewatch`);
      expect(locations, round).toHaveLength(1);
    }
  });

  test("a renamed project's hit sends one Location (the cache miss is the case above)", async ({ request }) => {
    const who = await stubAccount();
    await request.get(`/${who.username}/tide-old`, { maxRedirects: 0 });
    const hit = await request.get(`/${who.username}/tide-old`, { maxRedirects: 0 });
    expect(hit.status()).toBe(307);
    expect(hit.headers()["x-nextjs-cache"]).toBe("HIT");
    expect(hit.headersArray().filter((header) => header.name.toLowerCase() === "location")).toEqual([expect.objectContaining({ value: `/${who.username}/tidewatch` })]);
  });
});
