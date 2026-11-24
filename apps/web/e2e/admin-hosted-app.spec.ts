import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

import ar from "../src/messages/ar.json" with { type: "json" };
import de from "../src/messages/de.json" with { type: "json" };

/**
 * The team console against a database shaped like the hosted one today (before
 * 20261124100100_admin_money.sql), in a real-mode build without the local stack (Stage 2, WP2.6):
 *
 * - S1-R-01: an editor's browser never calls admin_customers() (the old database would send it every
 *   customer's name and e-mail address); Overview and Analytics say figures are not available.
 * - PRE-3: the prepared-pages list is asked for with the member's own session, not without a token.
 * - PRE-2: a real customer's source reads "Echtes Konto", not "Beispieldaten".
 * - OTH-1: the "Free → Pro" hint says what the tile counts.
 * - S1-R-04: Arabic Latin names and numbers sit in <bdi>.
 *
 * The Supabase stand-in (e2e/stub/supabase-stub.mjs) answers the session; the team functions the
 * browser calls are answered here with what the hosted database returns. Opt-in, with the stub build of
 * stub-app.spec.ts (E2E_STUB=1). `ADMIN_SHOTS=<dir>` also saves phone and laptop screenshots.
 */

const stubEnabled = process.env.E2E_STUB === "1";
const STUB = `http://127.0.0.1:${process.env.STUB_SUPABASE_PORT ?? "55103"}`;
const SHOTS = process.env.ADMIN_SHOTS ?? "";
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

type Role = "owner" | "admin" | "editor" | "viewer";
type Locale = "de" | "ar";

/** `role_permissions` on the hosted database (20261119100200_team.sql): nobody has orders.view, editors have customers.view. */
const HOSTED: Record<Role, string[]> = {
  owner: ["activity.view", "analytics.view", "billing.manage", "billing.view", "creators.verify", "customers.delete", "customers.manage", "customers.view", "invites.manage", "pages.create", "pages.delete", "pages.edit", "pages.publish", "security.manage", "security.view", "team.manage"],
  admin: ["activity.view", "analytics.view", "billing.manage", "billing.view", "creators.verify", "customers.manage", "customers.view", "invites.manage", "pages.create", "pages.delete", "pages.edit", "pages.publish", "security.manage", "security.view"],
  editor: ["activity.view", "analytics.view", "customers.view", "pages.create", "pages.edit"],
  viewer: ["activity.view", "analytics.view", "billing.view", "customers.view", "security.view"],
};

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const tokenFor = (id: string) => `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: id, role: "authenticated", exp: 4_070_908_800 })}.stub`;

interface Member {
  id: string;
  email: string;
  username: string;
  token: string;
}

async function seed(data: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${STUB}/__stub/seed`, { method: "POST", body: JSON.stringify(data) });
  if (!response.ok) throw new Error(`stub seed failed: ${String(response.status)}`);
}

/** A team member's own account (signed in, onboarded), known to the stand-in. */
async function member(locale: Locale): Promise<Member> {
  const id = randomUUID();
  const username = `team-${randomUUID().replaceAll("-", "").slice(0, 8)}`;
  const email = `${username}@example.com`;
  await seed({
    users: { [id]: { id, email } },
    profiles: { [id]: { id, username, locale, status: "active", created_at: "2026-11-01T00:00:00Z" } },
    sites: {
      [id]: {
        profile_id: id,
        kind: null,
        onboarded: true,
        prepared: null,
        page: { profile: { username, displayName: "Mara Team", bio: "", avatar: { src: "none:", alt: "" }, verified: false, locale }, blocks: [] },
        theme: { template: "nocturne" },
        legal: { name: "", address: "", email, phone: "" },
        updated_at: "2026-11-20T10:00:00Z",
      },
    },
  });
  return { id, email, username, token: tokenFor(id) };
}

async function signIn(context: BrowserContext, baseURL: string | undefined, who: Member): Promise<void> {
  const session = {
    access_token: who.token,
    refresh_token: "stub-refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: 4_070_908_800,
    user: { id: who.id, aud: "authenticated", role: "authenticated", email: who.email, app_metadata: {}, user_metadata: {}, created_at: "2026-11-01T00:00:00Z" },
  };
  const host = new URL(STUB).hostname.split(".")[0] ?? "127";
  await context.addCookies([{ name: `sb-${host}-auth-token`, value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`, url: baseURL ?? "http://localhost:3100" }]);
}

/** A customer as the hosted admin_customers() returns it (no `source`: Stripe is read from the invoices). */
function customer(name: string, email: string, paid: boolean) {
  return {
    id: randomUUID(),
    name,
    email,
    username: name.toLowerCase().replace(/\s+/g, "-"),
    locale: "de",
    country: "DE",
    city: "Leipzig",
    createdAt: "2026-11-02T09:00:00Z",
    lastSeenAt: "2026-11-23T09:00:00Z",
    status: "active",
    verified: false,
    subscription: paid
      ? { plan: "pro", status: "active", startedAt: "2026-11-03T09:00:00Z", renewsAt: "2026-12-03T09:00:00Z", invoices: [{ id: "in_hosted_1", at: "2026-11-03T09:00:00Z", amount: 800, status: "paid" }] }
      : { plan: "free", status: null, invoices: [] },
    usage: { kind: "musician", template: "nocturne", blocks: 4, onboarded: true, views30: 0, clicks30: 0 },
    logins: [],
    notes: [],
  };
}

/**
 * The team functions the browser calls, answered as the hosted database does for `role`. Every call is
 * recorded; admin_customers() answers the trap rows, so a leak would show on screen too.
 */
async function hostedDatabase(page: Page, who: Member, role: Role, rows: unknown[]): Promise<string[]> {
  const calls: string[] = [];
  const answers: Record<string, unknown> = {
    admin_me: { role, email: who.email, permissions: HOSTED[role] },
    admin_team: [{ id: who.id, email: who.email, name: "Mara Team", role, addedAt: "2026-11-01T00:00:00Z" }],
    admin_activity: [],
    admin_customers: rows,
    admin_blocked_ips: [],
  };
  await page.route(`${STUB}/rest/v1/rpc/**`, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.continue();
    const name = new URL(request.url()).pathname.split("/").pop() ?? "";
    calls.push(name);
    if (!(name in answers)) return route.continue();
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(answers[name]) });
  });
  return calls;
}

async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
}

/** Arabic texts carry <bdi> tags; on screen they read without them. */
const shown = (text: string) => text.replace(/<\/?bdi>/g, "");

test.describe("team console on the hosted database", () => {
  test.skip(!stubEnabled, "Needs the stub build and the Supabase stand-in (E2E_STUB=1).");

  test("an editor's browser never loads customers there; Overview and Analytics say why", async ({ page, context, baseURL }) => {
    const who = await member("de");
    await signIn(context, baseURL, who);
    const trap = customer("Trap Person", `trap-${randomUUID().slice(0, 6)}@example.com`, true);
    const calls = await hostedDatabase(page, who, "editor", [trap]);
    const prepared = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/admin/prepared");

    await page.goto("/de/admin");
    await expect(page.getByRole("heading", { level: 2, name: de.admin.customers.figuresWithheldTitle })).toBeVisible();
    await expect(page.getByText(de.admin.customers.figuresWithheldBody)).toBeVisible();
    // No 0 that reads like a count: no customer tiles at all.
    await expect(page.getByText(de.admin.overview.kpi.customers, { exact: true })).toHaveCount(0);
    // The prepared pages are asked for with the member's own session (PRE-3).
    expect((await prepared).headers().authorization).toBe(`Bearer ${who.token}`);
    await expectAccessible(page);

    await page.goto("/de/admin/analytics");
    await expect(page.getByRole("heading", { level: 2, name: de.admin.customers.figuresWithheldTitle })).toBeVisible();
    await expect(page.locator("main")).not.toContainText(trap.email);
    await expect(page.locator("main")).not.toContainText(trap.name);
    expect(calls).toContain("admin_me");
    expect(calls).not.toContain("admin_customers");
  });

  test("an owner sees real customers with their true source, and what Free → Pro counts", async ({ page, context, baseURL, isMobile }) => {
    const who = await member("de");
    await signIn(context, baseURL, who);
    const paying = customer("Lina Brandt", `lina-${randomUUID().slice(0, 6)}@example.com`, true);
    const calls = await hostedDatabase(page, who, "owner", [paying, customer("Ole Sander", `ole-${randomUUID().slice(0, 6)}@example.com`, false)]);

    await page.goto("/de/admin");
    await expect(page.getByText(de.admin.overview.kpi.conversionHint)).toBeVisible();
    expect(calls).toContain("admin_customers");

    await page.goto(`/de/admin/customers/${paying.id}`);
    await expect(page.getByRole("heading", { level: 1, name: paying.name })).toBeVisible();
    await expect(page.locator("[data-customer-source='live']")).toHaveText(de.admin.customer.liveSource);
    await expect(page.getByText(de.admin.customer.sample)).toHaveCount(0);

    // Viewing as an editor on this database shows what an editor sees: no figures.
    await page.goto("/de/admin");
    await page.getByLabel(de.admin.shell.viewAs).locator("visible=true").selectOption("editor");
    await expect(page.getByRole("heading", { level: 2, name: de.admin.customers.figuresWithheldTitle })).toBeVisible();
    if (!isMobile) await expectAccessible(page);
  });

  test("Arabic: Latin names and numbers in the console are isolated", async ({ page, context, baseURL }) => {
    const who = await member("ar");
    await signIn(context, baseURL, who);
    const paying = customer("Lina Brandt", `lina-${randomUUID().slice(0, 6)}@example.com`, true);
    await hostedDatabase(page, who, "owner", [paying]);

    await page.goto(`/ar/admin/customers/${paying.id}`);
    await expect(page.locator("[data-customer-source='live']")).toHaveText(ar.admin.customer.liveSource);
    await page.getByRole("radio", { name: ar.admin.customer.tabs.billing }).click();
    // "Stripe (مدفوع)": the name inside <bdi>.
    await expect(page.locator("[data-plan-source='stripe'] bdi")).toHaveText("Stripe");
    await expectAccessible(page);

    await page.goto("/ar/admin/subscriptions");
    await expect(page.locator("main bdi", { hasText: "Pro" }).first()).toBeVisible();
    await expect(page.getByText(shown(ar.admin.subscriptions.teamNote))).toBeVisible();
    await expectAccessible(page);
  });
});

/** Phone (390 × 844, 1×) and laptop (1440 × 900) pictures for the review, de and ar. Opt-in. */
test.describe("team console on the hosted database: screenshots", () => {
  test.skip(!stubEnabled || !SHOTS, "Needs E2E_STUB=1 and ADMIN_SHOTS=<dir>.");

  async function capture(browser: Browser, baseURL: string | undefined, locale: Locale, role: Role, size: "phone" | "laptop", address: (paying: { id: string }) => string, name: string) {
    const viewport = size === "phone" ? { width: 390, height: 844 } : { width: 1440, height: 900 };
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, ...(baseURL ? { baseURL } : {}) });
    const page = await context.newPage();
    const who = await member(locale);
    await signIn(context, baseURL, who);
    const paying = customer("Lina Brandt", `lina-${randomUUID().slice(0, 6)}@example.com`, true);
    await hostedDatabase(page, who, role, [paying, customer("Ole Sander", `ole-${randomUUID().slice(0, 6)}@example.com`, false)]);
    await page.goto(address(paying));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // The console keeps a connection open, so no "network idle": wait for its text and the fonts.
    await expect(page.locator("main h2").first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, `${name}-${locale}-${size}.png`), fullPage: true });
    await context.close();
  }

  test("withheld figures, a real customer and the subscriptions", async ({ browser, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "One run makes every size.");
    test.setTimeout(180_000);
    for (const locale of ["de", "ar"] as const) {
      for (const size of ["phone", "laptop"] as const) {
        await capture(browser, baseURL, locale, "editor", size, () => `/${locale}/admin`, "editor-overview");
        await capture(browser, baseURL, locale, "owner", size, (paying) => `/${locale}/admin/customers/${paying.id}`, "owner-customer");
        await capture(browser, baseURL, locale, "owner", size, () => `/${locale}/admin/subscriptions`, "owner-subscriptions");
      }
    }
  });
});
