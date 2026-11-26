import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { creatorTokens } from "@linkyo/tokens";
import { generatePalette, parseHex, resolveCreatorTheme, type CreatorThemeConfig } from "@linkyo/tokens/creator";
import { expect, test, type BrowserContext, type Download, type Page } from "@playwright/test";

import ar from "../src/messages/ar.json" with { type: "json" };
import de from "../src/messages/de.json" with { type: "json" };

import { enterDemoCode } from "./auth";
import { createRealAccount, realEnabled, service, signIn as realSignIn, test as realTest, uniqueName } from "./real";

/**
 * Plan and billing (D-03) and the share tools (D-16), in the three modes a creator can meet:
 *
 * - the demo (default suite): Settings opens with the plan, the demo is Free and says Pro comes with
 *   the launch, no payment button; the QR code downloads as SVG in the page's accent colour; the
 *   delete dialog exports first; a pasted instagram.com/mila can go to the Social icons row;
 * - payments in test mode without the database (E2E_STUB=1, the build of stub-app.spec.ts with
 *   NEXT_PUBLIC_PAYMENTS=test): Free offers "Pro holen", Pro through Stripe shows renewal, invoices,
 *   "Verträge hier kündigen" and the portal; the plan rows are answered in the browser, the portal
 *   route is the real one (the stand-in has no billing rows, so it says so), and with E2E_MOCKS=1 the
 *   way to Stripe's portal (its local stand-in) and back is followed;
 * - real accounts (@real, the local stack and the mocks): the whole way, the route included.
 *
 * `PLAN_SHOTS=<dir>` also saves the screenshots of the review (phone 390 × 844 and laptop 1440 × 900).
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const stubEnabled = process.env.E2E_STUB === "1";
const STUB = `http://127.0.0.1:${process.env.STUB_SUPABASE_PORT ?? "55103"}`;
const MOCK_STRIPE = `http://127.0.0.1:${process.env.MOCK_STRIPE_PORT ?? "54398"}`;
const SHOTS = process.env.PLAN_SHOTS ?? "";

async function axe(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
}

/** Screenshots for the review, desktop project only: the phone at 390 × 844 and the laptop at 1440 × 900. */
async function shot(page: Page, name: string, size: "phone" | "laptop"): Promise<void> {
  if (!SHOTS || test.info().project.name !== "desktop") return;
  mkdirSync(SHOTS, { recursive: true });
  const before = page.viewportSize();
  await page.setViewportSize(size === "phone" ? { width: 390, height: 844 } : { width: 1440, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, `${name}-${size}.png`) });
  if (before) await page.setViewportSize(before);
}

const downloaded = (download: Download) => download.path().then((file) => readFileSync(file, "utf8"));

// ─── Demo ────────────────────────────────────────────────────────────────────────────────────

const DEMO_STORE = "linkyo.demo.v1";
let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;
const SKIP = { de: "Später", en: "Skip for now", ar: "لاحقًا" } as const;

/** A new demo account past the welcome flow, on Home. */
async function signedIn(page: Page, locale: "de" | "en" | "ar" = "en"): Promise<string> {
  const name = `plan-${unique()}`;
  await page.goto(`/${locale}/signup?name=${name}`);
  await page.waitForLoadState("networkidle");
  await page.locator("#signup-email").fill(`${name}@example.com`);
  await page.locator("form button[type=submit]").click();
  await enterDemoCode(page);
  await page.waitForURL(`**/${locale}/app/welcome`);
  await page.getByRole("button", { name: SKIP[locale] }).click();
  await page.waitForURL(`**/${locale}/app`);
  return name;
}

interface StoredBlock {
  type: string;
  items?: { platform: string; url: string }[];
}

/** The Social icons row of the signed-in demo account, as stored. */
const storedSocials = (page: Page) =>
  page.evaluate((key) => {
    const db = JSON.parse(window.localStorage.getItem(key) ?? "{}") as { session?: { accountId: string }; sites?: Record<string, { page: { blocks: StoredBlock[] } }> };
    const site = db.session ? db.sites?.[db.session.accountId] : undefined;
    return site?.page.blocks.filter((block) => block.type === "socials").map((block) => block.items ?? []) ?? [];
  }, DEMO_STORE);

/** Gives the signed-in demo account's page this accent (as the Design screen would) and answers its look. */
async function setAccent(page: Page, accent: string): Promise<CreatorThemeConfig> {
  const theme = await page.evaluate(
    ([key, colour]) => {
      const db = JSON.parse(window.localStorage.getItem(key) ?? "{}") as { session: { accountId: string }; sites: Record<string, { theme: Record<string, unknown> }> };
      const site = db.sites[db.session.accountId];
      if (!site) throw new Error("no site");
      site.theme = { ...site.theme, accent: colour };
      window.localStorage.setItem(key, JSON.stringify(db));
      return site.theme;
    },
    [DEMO_STORE, accent] as const,
  );
  await page.reload();
  return theme;
}

/** A hex colour as the browser computes it ("rgb(r, g, b)"). */
const rgb = (hex: string) => {
  const { r, g, b } = parseHex(hex);
  return `rgb(${String(Math.round(r * 255))}, ${String(Math.round(g * 255))}, ${String(Math.round(b * 255))})`;
};

test.describe("plan and share tools (demo)", () => {
  test.skip(stubEnabled || realEnabled, "Runs on the demo build.");

  test("Settings opens with the plan; the demo is Free, says Pro comes with the launch and offers no payment", async ({ page }) => {
    await signedIn(page, "de");
    await page.goto("/de/app/settings");
    // The Settings list's row (on a laptop the section panel lists Plan too).
    const row = page.locator("#main").getByRole("link", { name: /^Plan/ }).first();
    await expect(row).toContainText("Kostenlos");
    // At the top: above the page's own rows (Profil, Seitenadresse).
    const [plan, profile] = await Promise.all([row.boundingBox(), page.getByRole("button", { name: /^Profil/ }).first().boundingBox()]);
    expect(plan?.y ?? Infinity).toBeLessThan(profile?.y ?? -Infinity);
    await row.click();
    await page.waitForURL("**/de/app/settings/plan");
    await expect(page.getByRole("heading", { name: "Dein Plan" })).toBeVisible();
    await expect(page.getByText("Ohne Kosten und ohne Ablauf")).toBeVisible();
    await expect(page.getByText("Pro kommt mit dem Start.")).toBeVisible();
    await expect(page.getByText("Deine Seite mit allen Designs")).toBeVisible();
    await expect(page.getByText("KI-Entwürfe gibt es nur mit echten Konten.")).toBeVisible();
    // Nothing that could only fail here: no portal, no upgrade, no payment group.
    await expect(page.getByText("Zahlungen und Rechnungen")).toHaveCount(0);
    await expect(page.getByText("Pro holen")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Zahlung" })).toHaveCount(0);
    expect(await axe(page)).toEqual([]);
    await shot(page, "plan-demo-de", "phone");
    await shot(page, "plan-demo-de", "laptop");
  });

  test("in Arabic the pane is mirrored and says the same", async ({ page }) => {
    await signedIn(page, "ar");
    await page.goto("/ar/app/settings/plan");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText("الخطة المجانية").first()).toBeVisible();
    await expect(page.getByText("بلا تكلفة وبلا تاريخ انتهاء")).toBeVisible();
    await expect(page.getByText("مع الإطلاق")).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await shot(page, "plan-demo-ar", "phone");
  });

  test("the QR code downloads as SVG in the page's accent colour, and as PNG", async ({ page }) => {
    const name = await signedIn(page, "en");
    // A purple page: its code is printed purple, darkened only as far as white paper needs (4.5:1).
    const theme = await setAccent(page, creatorTokens.swatches.grape);
    const expected = rgb(generatePalette({ accent: resolveCreatorTheme(theme).palette.accent, mode: "light" }).accentText);
    await page.getByRole("button", { name: "QR code" }).first().click();
    const sheet = page.getByRole("dialog", { name: "Your QR code" });
    await expect(sheet).toBeVisible();
    const holder = sheet.locator("[data-qr-ink]");
    await expect(holder).toHaveAttribute("data-qr-ink", "accent");
    const [ink, paper] = await holder.evaluate((element) => [getComputedStyle(element).color, getComputedStyle(element).backgroundColor]);
    expect(ink).toBe(expected);
    expect(paper).toBe("rgb(255, 255, 255)");
    // The code on screen is drawn in that colour too.
    expect(await holder.locator("svg path").evaluate((element) => getComputedStyle(element).fill)).toBe(ink);
    await expect(sheet.getByText("In your page's color. As SVG it stays sharp at any size.")).toBeVisible();
    await shot(page, "qr-sheet-en", "phone");

    const [svg] = await Promise.all([page.waitForEvent("download"), sheet.getByRole("button", { name: "Download SVG" }).click()]);
    expect(svg.suggestedFilename()).toBe(`linkyo-${name}-qr.svg`);
    const file = await downloaded(svg);
    expect(file.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(file).toContain(`fill="${ink}"`);
    expect(file).toContain(`fill="${paper}"`);
    expect(file).toContain(`<title>QR code for linkyo.app/${name}</title>`);

    const [png] = await Promise.all([page.waitForEvent("download"), sheet.getByRole("button", { name: "Download PNG" }).click()]);
    expect(png.suggestedFilename()).toBe(`linkyo-${name}-qr.png`);
    expect(await axe(page)).toEqual([]);
  });

  test("the delete dialog exports the data first and stays open", async ({ page }) => {
    const name = await signedIn(page, "en");
    await page.goto("/en/app/settings/account");
    await page.getByRole("button", { name: "Delete account" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Delete your account?" });
    await expect(dialog).toBeVisible();
    // The field that confirms still takes the focus first.
    await expect(dialog.getByRole("textbox")).toBeFocused();
    const [file] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Export your data first" }).click()]);
    expect(file.suggestedFilename()).toBe(`linkyo-${name}-export.json`);
    const data = JSON.parse(await downloaded(file)) as { account: { username: string } };
    expect(data.account.username).toBe(name);
    await expect(dialog.getByRole("status")).toHaveText(`File created: linkyo-${name}-export.json`);
    await expect(dialog).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await shot(page, "delete-export-en", "phone");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("a pasted instagram.com/mila can go to the Social icons row, once", async ({ page, context }) => {
    await signedIn(page, "en");
    await page.goto("/en/app/editor");
    const before = (await storedSocials(page)).flat().length;
    const add = page.getByRole("button", { name: "Add", exact: true }).first();
    const sheet = page.getByRole("dialog", { name: "Add to your page" });
    await add.click();
    await sheet.getByLabel("Paste a link").fill("instagram.com/mila");
    await expect(sheet.getByText("Link detected")).toBeVisible();
    await shot(page, "add-socials-en", "phone");
    await sheet.getByRole("button", { name: "Add to social icons" }).click();
    await expect(sheet).toBeHidden();
    await expect.poll(async () => (await storedSocials(page)).flat().map((item) => item.url)).toContain("https://instagram.com/mila");
    expect((await storedSocials(page)).flat().length).toBe(before + 1);
    // The same profile again is said, not added twice.
    await add.click();
    await sheet.getByLabel("Paste a link").fill("https://www.instagram.com/mila/");
    await sheet.getByRole("button", { name: "Add to social icons" }).click();
    await expect(page.getByText("Already in your social icons", { exact: true })).toBeVisible();
    expect((await storedSocials(page)).flat().length).toBe(before + 1);

    // A real paste of one profile waits in the field for the choice instead of adding a plain link.
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await add.click();
    await page.evaluate(() => navigator.clipboard.writeText("https://www.tiktok.com/@mila.berg"));
    const field = sheet.getByLabel("Paste a link");
    await field.focus();
    await page.keyboard.press("ControlOrMeta+V");
    await expect(field).toHaveValue("https://www.tiktok.com/@mila.berg");
    await expect(sheet.getByRole("button", { name: "Add to social icons" })).toBeVisible();
    // A post is no profile: Add adds it as before, and no social-icon choice is offered.
    await field.fill("https://www.instagram.com/p/C0abc123/");
    await expect(sheet.getByRole("button", { name: "Add to social icons" })).toHaveCount(0);
    expect(await axe(page)).toEqual([]);
  });
});

// ─── Payments in test mode, without the database (stub) ──────────────────────────────────────

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const tokenFor = (id: string) => `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: id, role: "authenticated", exp: 4_070_908_800 })}.stub`;

interface StubAccount {
  id: string;
  email: string;
  username: string;
  token: string;
}

/** An active, onboarded account the Supabase stand-in knows. */
async function stubAccount(locale: "de" | "ar"): Promise<StubAccount> {
  const id = randomUUID();
  const username = `plan-${randomUUID().replaceAll("-", "").slice(0, 8)}`;
  const email = `${username}@example.com`;
  const response = await fetch(`${STUB}/__stub/seed`, {
    method: "POST",
    body: JSON.stringify({
      users: { [id]: { id, email } },
      profiles: { [id]: { id, username, locale, status: "active", created_at: "2026-11-01T00:00:00Z" } },
      sites: {
        [id]: {
          profile_id: id,
          kind: null,
          onboarded: true,
          prepared: null,
          page: { profile: { username, displayName: "Mila Berg", bio: "", avatar: { src: "none:", alt: "" }, verified: false, locale }, blocks: [] },
          theme: { template: "nocturne" },
          legal: { name: "", address: "", email, phone: "" },
          updated_at: "2026-11-20T10:00:00Z",
        },
      },
    }),
  });
  if (!response.ok) throw new Error(`stub seed failed: ${String(response.status)}`);
  return { id, email, username, token: tokenFor(id) };
}

async function stubSignIn(context: BrowserContext, baseURL: string | undefined, who: StubAccount): Promise<void> {
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

const LATER = new Date(Date.now() + 20 * 86_400_000).toISOString();

/**
 * The owner's plan rows, answered in the browser (the stand-in keeps no billing tables): what row-level
 * security would hand this owner. Only reads of these four tables are answered; everything else
 * still goes to the stand-in.
 */
async function planRows(page: Page, rows: { entitlements?: unknown[]; invoices?: unknown[]; rewards?: unknown[] } = {}): Promise<void> {
  const answers: Record<string, unknown[]> = { entitlements: rows.entitlements ?? [], invoices: rows.invoices ?? [], rewards: rows.rewards ?? [], subscriptions: [] };
  for (const [table, body] of Object.entries(answers)) {
    await page.route(`${STUB}/rest/v1/${table}?**`, (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-expose-headers": "*" }, body: JSON.stringify(body) })
        : route.continue(),
    );
  }
}

/** The AI drafts as /api/ai/quota answers them where the AI is on (this build has it off). */
const quota = (page: Page, body: Record<string, unknown>) => page.route("**/api/ai/quota", (route) => route.fulfill({ json: body }));

const stripePro = { source: "stripe", status: "active", current_period_end: LATER, cancel_at_period_end: false, cancel_at: null, stripe_customer_id: "cus_planstub1", created_at: "2026-11-01T00:00:00Z" };
const proInvoices = [
  { id: "in_plan_2", at: "2026-11-01T09:00:00Z", amount_cents: 800, status: "paid" },
  { id: "in_plan_1", at: "2026-10-01T09:00:00Z", amount_cents: 800, status: "paid" },
];

test.describe("plan with payments in test mode (stub)", () => {
  test.skip(!stubEnabled, "Needs the stub build and the Supabase stand-in (E2E_STUB=1).");

  test("Free offers Pro at its price, says no real money moves, and has no portal", async ({ page, context, baseURL }) => {
    const who = await stubAccount("de");
    await stubSignIn(context, baseURL, who);
    await planRows(page);
    await quota(page, { enabled: true, plan: "free", allowance: 1, used: 0, left: 1, period: "life", resetsAt: null });
    await page.goto("/de/app/settings/plan");
    await expect(page.getByText("Ohne Kosten und ohne Ablauf")).toBeVisible();
    const upgrade = page.getByRole("link", { name: /Pro holen/ });
    await expect(upgrade).toHaveAttribute("href", "/de/checkout/pro");
    await expect(upgrade).toContainText("8,00 €");
    await expect(page.getByText("Testmodus: Es wird kein echtes Geld bewegt.")).toBeVisible();
    await expect(page.getByText("1 KI-Entwurf kostenlos, einmal pro Konto")).toBeVisible();
    await expect(page.getByText("Noch 1 von 1")).toBeVisible();
    await expect(page.getByText("Zahlungen und Rechnungen")).toHaveCount(0);
    // Payments exist here, so the demo's sentence about the launch is not said.
    await expect(page.getByText("Pro kommt mit dem Start.")).toHaveCount(0);
    expect(await axe(page)).toEqual([]);
    await shot(page, "plan-free-test-de", "phone");
  });

  test("Pro through Stripe: renewal, drafts left, invoices, the statutory cancel link and the portal", async ({ page, context, baseURL }) => {
    const who = await stubAccount("de");
    await stubSignIn(context, baseURL, who);
    await planRows(page, { entitlements: [stripePro], invoices: proInvoices });
    await quota(page, { enabled: true, plan: "pro", allowance: 5, used: 2, left: 3, period: "month", resetsAt: "2026-12-01T00:00:00+01:00" });
    await page.goto("/de/app/settings/plan");
    await expect(page.getByText("Linkyo Pro").first()).toBeVisible();
    await expect(page.getByText("Abo über Stripe, 8,00 € im Monat")).toBeVisible();
    await expect(page.getByText("Aktiv", { exact: true })).toBeVisible();
    await expect(page.getByText("Verlängert sich am")).toBeVisible();
    await expect(page.getByText("Bis zu 5 KI-Entwürfe im Monat")).toBeVisible();
    await expect(page.getByText("Noch 3 von 5")).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "KI-Entwürfe übrig" })).toHaveAttribute("aria-valuenow", "3");
    await expect(page.getByText("Neue Entwürfe ab 1. Dezember")).toBeVisible();
    await expect(page.getByText(/^Rechnung vom/)).toHaveCount(2);
    await expect(page.getByText("Bezahlt", { exact: true })).toHaveCount(2);
    await expect(page.getByRole("link", { name: "Verträge hier kündigen" }).first()).toHaveAttribute("href", "/de/kuendigen");
    await expect(page.getByText("Pro holen")).toHaveCount(0);
    expect(await axe(page)).toEqual([]);
    await shot(page, "plan-pro-test-de", "phone");
    await shot(page, "plan-pro-test-de", "laptop");

    // The real route: the stand-in keeps no billing rows, so Stripe does not know this account. Said, not hidden.
    const portal = page.getByRole("button", { name: /Zahlungen und Rechnungen/ });
    const answer = page.waitForResponse("**/api/billing/portal");
    await portal.click();
    expect((await answer).status()).toBe(409);
    await expect(page.getByText("Für dein Konto gibt es bei unserem Zahlungsdienst noch keine Zahlungen.", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/de\/app\/settings\/plan$/);
  });

  test("the portal button leads to Stripe's portal (its local stand-in) and back to the pane", async ({ page, context, baseURL }) => {
    test.skip(process.env.E2E_MOCKS !== "1", "Needs the Stripe stand-in (E2E_MOCKS=1).");
    const who = await stubAccount("de");
    await stubSignIn(context, baseURL, who);
    await planRows(page, { entitlements: [stripePro] });
    // A session the stand-in made, handed over the way the route does (the route itself is covered
    // against the same stand-in in src/app/api/billing/portal/route.test.ts and by the @real test).
    const form = new URLSearchParams({ customer: "cus_planstub1", return_url: `${baseURL ?? ""}/de/app/settings/plan` });
    const session = (await (await fetch(`${MOCK_STRIPE}/v1/billing_portal/sessions`, { method: "POST", body: form, headers: { "content-type": "application/x-www-form-urlencoded" } })).json()) as { url: string };
    await page.route("**/api/billing/portal", (route) => route.fulfill({ json: { url: session.url } }));
    await page.goto("/de/app/settings/plan");
    await page.getByRole("button", { name: /Zahlungen und Rechnungen/ }).click();
    await page.waitForURL(`${MOCK_STRIPE}/__portal/**`);
    await expect(page.getByText("Customer cus_planstub1")).toBeVisible();
    await page.getByRole("link", { name: "Return to Linkyo" }).click();
    await page.waitForURL("**/de/app/settings/plan");
    await expect(page.getByText("Linkyo Pro").first()).toBeVisible();
  });

  test("in Arabic the Pro pane is mirrored, with Latin names and figures kept in their own direction", async ({ page, context, baseURL }) => {
    const who = await stubAccount("ar");
    await stubSignIn(context, baseURL, who);
    await planRows(page, { entitlements: [stripePro], invoices: proInvoices });
    await quota(page, { enabled: true, plan: "pro", allowance: 5, used: 2, left: 3, period: "month", resetsAt: "2026-12-01T00:00:00+01:00" });
    await page.goto("/ar/app/settings/plan");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText("المدفوعات والفواتير")).toBeVisible();
    // "Linkyo Pro" and the price sit in <bdi>, so they keep their order inside the Arabic line.
    await expect(page.locator("bdi", { hasText: "Linkyo Pro" }).first()).toBeVisible();
    await expect(page.locator("bdi", { hasText: "€" }).first()).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await shot(page, "plan-pro-test-ar", "phone");
  });
});

// ─── The plan pane inside the iPhone app (stub) ──────────────────────────────────────────────

/** WKWebView's user agent with the app's name, and what the app's document-start script sets. */
const APP_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 LinkyoApp/1.0";
const APP_SCRIPT = `(() => {
  const mark = () => { document.documentElement.dataset.app = "ios"; };
  if (document.documentElement) mark();
  else new MutationObserver((_, observer) => { if (document.documentElement) { mark(); observer.disconnect(); } }).observe(document, { childList: true });
  window.linkyoApp = { platform: "ios", version: "1.0", bridge: 1 };
  window.webkit = { messageHandlers: { linkyo: { postMessage: () => undefined } } };
})();`;
const MESSAGES = { de, ar } as const;
const teamPro = { source: "team", status: "active", current_period_end: LATER, cancel_at_period_end: false, cancel_at: null, stripe_customer_id: null, created_at: "2026-11-01T00:00:00Z" };
type PlanStatus = keyof typeof de.app.settings.plan.status;

/**
 * Accounts with Pro from each source, and the one state badge the app may show (null: none). PRO_AVAILABLE
 * is false, so the invite reward is "reserved".
 */
const APP_PLANS: { name: string; rows: Parameters<typeof planRows>[1]; badge: PlanStatus | null; renews?: boolean }[] = [
  { name: "the invite reward (reserved)", rows: { rewards: [{ kind: "pro_for_life", revoked_at: null }] }, badge: "reserved" },
  { name: "Pro given by the team", rows: { entitlements: [teamPro] }, badge: "active" },
  { name: "Pro through Stripe", rows: { entitlements: [stripePro], invoices: proInvoices }, badge: "active", renews: true },
  { name: "Pro through Stripe, canceled", rows: { entitlements: [{ ...stripePro, cancel_at_period_end: true }], invoices: proInvoices }, badge: "ending" },
  // No badge and no "renews on" either: without its state, the date would read as a healthy plan.
  { name: "Pro through Stripe, past due", rows: { entitlements: [{ ...stripePro, status: "past_due" }], invoices: proInvoices }, badge: null, renews: false },
];
/** "Renews on {date}" as the pane writes it, without the date. */
const renewsWords = (locale: "de" | "ar") => MESSAGES[locale].app.settings.plan.renews.replace(/\{[^}]*\}/g, "").trim();

test.describe("the plan pane in the iPhone app (stub)", () => {
  test.skip(!stubEnabled, "Needs the stub build and the Supabase stand-in (E2E_STUB=1).");
  test.use({ userAgent: APP_UA });

  for (const locale of ["de", "ar"] as const) {
    for (const plan of APP_PLANS) {
      test(`${locale}, ${plan.name}: the plan's name and its state only; no price, payment, Stripe or other "Pro"`, async ({ page, context, baseURL }) => {
        const m = MESSAGES[locale].app.settings.plan;
        await page.addInitScript(APP_SCRIPT);
        const who = await stubAccount(locale);
        await stubSignIn(context, baseURL, who);
        await planRows(page, plan.rows);
        await quota(page, { enabled: true, plan: "pro", allowance: 5, used: 2, left: 3, period: "month", resetsAt: "2026-12-01T00:00:00+01:00" });
        await page.goto(`/${locale}/app/settings/plan`);
        await expect(page.getByText("Linkyo Pro").first()).toBeVisible();
        await expect(page.getByRole("heading", { name: m.groups.ai })).toBeVisible();
        // The words a person can see: only the plan's name says "Pro".
        const text = await page.locator("body").innerText();
        const pro = text.split("\n").filter((line) => /\bPro\b/.test(line.replaceAll("Linkyo Pro", "")));
        expect(pro, "Pro").toEqual([]);
        expect(text).not.toContain("€");
        expect(text).not.toContain("Stripe");
        expect(text).not.toMatch(/Zahlung|الدفع/);
        // No source line, no feature list, no payment group.
        for (const source of Object.values(m.source)) expect(text).not.toContain(source.replace(/<\/?bdi>/g, "").replace(/\{[^}]*\}.*$/, "").trim());
        await expect(page.getByRole("heading", { name: m.groups.includes })).toHaveCount(0);
        await expect(page.getByRole("heading", { name: m.groups.billing })).toHaveCount(0);
        // The state: its badge, or none for an account whose payment is due (never a false "active").
        for (const status of Object.keys(m.status) as PlanStatus[]) {
          await expect(page.getByText(m.status[status], { exact: true }), status).toHaveCount(status === plan.badge ? 1 : 0);
        }
        if (plan.renews !== undefined) expect(text.includes(renewsWords(locale)), "renews on").toBe(plan.renews);
        expect(await axe(page)).toEqual([]);
        await shot(page, `plan-app-${locale}-${plan.name.replace(/[^a-z]+/gi, "-").toLowerCase()}`, "phone");
      });
    }
  }

  for (const locale of ["de", "ar"] as const) {
    test(`${locale}: Settings names no plan in its plan row for a Pro account; a browser names it`, async ({ page, context, browser, baseURL }, info) => {
      const settings = MESSAGES[locale].app.settings;
      const who = await stubAccount(locale);
      const rows = { entitlements: [stripePro], invoices: proInvoices };
      // A browser first (not the app's user agent, no app script): the row says "Linkyo Pro" once the plan is read.
      const { viewport, isMobile, hasTouch } = info.project.use;
      const plain = await browser.newContext({ ...(baseURL ? { baseURL } : {}), ...(viewport ? { viewport } : {}), ...(isMobile ? { isMobile } : {}), ...(hasTouch ? { hasTouch } : {}) });
      const web = await plain.newPage();
      await stubSignIn(plain, baseURL, who);
      await planRows(web, rows);
      await web.goto(`/${locale}/app/settings`);
      await expect(web.locator(`a[href$="/${locale}/app/settings/plan"]`).getByText("Linkyo Pro")).toBeVisible();
      await plain.close();

      // The app: the same account, the same rows read; the row reads only "Plan".
      await page.addInitScript(APP_SCRIPT);
      await stubSignIn(context, baseURL, who);
      await planRows(page, rows);
      const read = page.waitForResponse((response) => response.url().includes("/rest/v1/entitlements"));
      await page.goto(`/${locale}/app/settings`);
      await read;
      // The Settings row (the rail's own link to the pane is hidden with the rail in the app).
      const row = page.locator(`a[href$="/${locale}/app/settings/plan"]`).filter({ visible: true });
      await expect(row).toBeVisible();
      await expect(row).toContainText(settings.panes.plan);
      await page.waitForTimeout(500);
      const text = await page.locator("body").innerText();
      expect(text.split("\n").filter((line) => /\bPro\b/.test(line)), "Pro").toEqual([]);
      expect(await axe(page)).toEqual([]);
      await shot(page, `plan-app-${locale}-settings-pro`, "phone");
    });
  }

  test("a browser keeps the whole pane: the past-due badge and note, the source, the feature list and the payment group", async ({ browser, baseURL }, info) => {
    // A browser of this project (not the app's user agent, no app script).
    const { viewport, isMobile, hasTouch } = info.project.use;
    const context = await browser.newContext({ ...(baseURL ? { baseURL } : {}), ...(viewport ? { viewport } : {}), ...(isMobile ? { isMobile } : {}), ...(hasTouch ? { hasTouch } : {}) });
    const page = await context.newPage();
    const m = de.app.settings.plan;
    const who = await stubAccount("de");
    await stubSignIn(context, baseURL, who);
    await planRows(page, { entitlements: [{ ...stripePro, status: "past_due" }], invoices: proInvoices });
    await quota(page, { enabled: true, plan: "pro", allowance: 5, used: 2, left: 3, period: "month", resetsAt: "2026-12-01T00:00:00+01:00" });
    await page.goto("/de/app/settings/plan");
    await expect(page.getByText(m.status.pastDue, { exact: true })).toBeVisible();
    await expect(page.getByText("Abo über Stripe, 8,00 € im Monat")).toBeVisible();
    await expect(page.getByText(/^Die letzte Zahlung ging nicht durch/)).toBeVisible();
    await expect(page.getByRole("heading", { name: m.groups.includes })).toBeVisible();
    await expect(page.getByRole("heading", { name: m.groups.billing })).toBeVisible();
    await context.close();
  });
});

// ─── Real accounts (the local stack and the mocks) ───────────────────────────────────────────

realTest.describe("plan with a Stripe subscription @real", () => {
  realTest.skip(!realEnabled || process.env.E2E_MOCKS !== "1", "Needs the local stack and the mocks (E2E_SUPABASE=1, E2E_MOCKS=1).");

  realTest("the pane reads the owner's subscription and opens Stripe's portal for that customer", async ({ page, tag }) => {
    const names = uniqueName("plan");
    const who = await createRealAccount({ ...names, locale: "de", onboarded: true });
    const customer = `cus_plan${tag}`;
    const db = service();
    const { error } = await db.from("entitlements").insert({
      profile_id: who.id,
      product: "pro",
      source: "stripe",
      status: "active",
      current_period_end: LATER,
      stripe_customer_id: customer,
      stripe_subscription_id: `sub_plan${tag}`,
    });
    if (error) throw new Error(`entitlements: ${error.message}`);
    const invoice = await db.from("invoices").insert({ id: `in_plan${tag}`, profile_id: who.id, amount_cents: 800, status: "paid", subscription: `sub_plan${tag}` });
    if (invoice.error) throw new Error(`invoices: ${invoice.error.message}`);

    await realSignIn(page, who.email, "/de/app/settings/plan");
    await page.waitForURL("**/de/app/settings/plan");
    await expect(page.getByText("Abo über Stripe, 8,00 € im Monat")).toBeVisible();
    await expect(page.getByText("Verlängert sich am")).toBeVisible();
    await expect(page.getByText(/^Rechnung vom/)).toHaveCount(1);
    await page.getByRole("button", { name: /Zahlungen und Rechnungen/ }).click();
    await page.waitForURL(`${MOCK_STRIPE}/__portal/**`);
    await expect(page.getByText(`Customer ${customer}`)).toBeVisible();
    await page.getByRole("link", { name: "Return to Linkyo" }).click();
    await page.waitForURL("**/de/app/settings/plan");
    const sent = (await (await fetch(`${MOCK_STRIPE}/__requests?path=/v1/billing_portal/sessions`)).json()) as { requests: { body: Record<string, string> }[] };
    expect(sent.requests.some((request) => request.body.customer === customer && request.body.return_url?.endsWith("/de/app/settings/plan") === true)).toBe(true);
  });
});
