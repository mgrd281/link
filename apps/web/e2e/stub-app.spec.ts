import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * Real-mode screens driven in a browser without the local database stack: public creator pages,
 * the order screen, the checkouts with a payment form, and the texts that only show where contracts
 * can be made. A stand-in answers the Supabase requests (e2e/stub/supabase-stub.mjs), Stripe.js and
 * the checkout routes are answered in the browser. Opt-in, because it needs its own build:
 *
 *   export PORT=3103 STUB_SUPABASE_PORT=55103
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:$STUB_SUPABASE_PORT NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_stub \
 *     NEXT_PUBLIC_PAYMENTS=test NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_stub npx next build
 *   node e2e/stub/supabase-stub.mjs &
 *   E2E_STUB=1 SUPABASE_SECRET_KEY=stub-secret NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:$STUB_SUPABASE_PORT \
 *     npx playwright test stub-app.spec.ts --project desktop --project mobile
 *
 * What the database itself must do (row-level security, the SQL functions) is covered by pgTAP and
 * the `@real` specs; this spec is about what the browser and the page cache do. `STUB_SHOTS=<dir>`
 * also saves screenshots of the screens it opens.
 */

const stubEnabled = process.env.E2E_STUB === "1";
const STUB = `http://127.0.0.1:${process.env.STUB_SUPABASE_PORT ?? "55103"}`;
const SHOTS = process.env.STUB_SHOTS ?? "";
const STRIPE_JS = "https://js.stripe.com/v3/";
const FAR = "2099-01-01T00:00:00Z";
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** No axe violation (WCAG 2.2 AA) on the screen as it stands. */
async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
}

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
/** A bearer token the stand-in reads the account from (unsigned: nothing here checks a signature). */
const tokenFor = (id: string) => `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: id, role: "authenticated", exp: 4_070_908_800 })}.stub`;

interface Account {
  id: string;
  email: string;
  username: string;
  token: string;
}

type Locale = "de" | "en" | "ar";

const profilePage = (username: string, locale: Locale, displayName: string, extra: Record<string, unknown> = {}) => ({
  username,
  displayName,
  bio: "",
  avatar: { src: "none:", alt: "" },
  verified: false,
  locale,
  ...extra,
});

async function seed(data: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${STUB}/__stub/seed`, { method: "POST", body: JSON.stringify(data) });
  if (!response.ok) throw new Error(`stub seed failed: ${String(response.status)}`);
}

/** An active, onboarded account with a page, known to the stand-in. */
async function account(prefix: string, locale: Locale = "de", page?: { profile: Record<string, unknown>; blocks: unknown[] }, status = "active"): Promise<Account> {
  const id = randomUUID();
  const username = `${prefix}-${randomUUID().replaceAll("-", "").slice(0, 8)}`;
  const email = `${username}@example.com`;
  await seed({
    users: { [id]: { id, email } },
    profiles: { [id]: { id, username, locale, status, created_at: "2026-11-01T00:00:00Z" } },
    sites: {
      [id]: {
        profile_id: id,
        kind: null,
        onboarded: true,
        prepared: null,
        page: page ? { ...page, profile: { ...page.profile, username } } : { profile: profilePage(username, locale, "Mila Berg"), blocks: [] },
        theme: { template: "nocturne" },
        legal: { name: "", address: "", email, phone: "" },
        updated_at: "2026-11-20T10:00:00Z",
      },
    },
  });
  return { id, email, username, token: tokenFor(id) };
}

/** Signs the browser in: the session cookie the app's Supabase client reads (no e-mail, no code). */
async function signIn(context: BrowserContext, baseURL: string | undefined, who: Account): Promise<void> {
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

async function order(who: Account, patch: Record<string, unknown> = {}): Promise<string> {
  const id = randomUUID();
  await seed({
    orders: {
      [id]: {
        id,
        profile_id: who.id,
        number: "LK-2026-000123",
        package: "start",
        status: "paid",
        promisedDueAt: FAR,
        dueAt: null,
        briefed: false,
        withdrawalPending: false,
        proposals: [],
        // The same order as the `orders` table shows it (the done page reads it there).
        amount_cents: 4900,
        promised_due_at: FAR,
        due_at: null,
        ...patch,
      },
    },
  });
  return id;
}

async function shot(page: Page, name: string, fullPage = false): Promise<void> {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  // From the top: a sticky header is drawn where the page is scrolled to.
  if (fullPage) await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(SHOTS, `${name}-${test.info().project.name}.png`), fullPage });
}

/** Stripe.js as the checkout uses it, answered locally: a payment field, and a `confirm` that is declined. */
async function fakeStripe(page: Page, declined: { message?: string } = { message: "Ihre Karte wurde abgelehnt." }): Promise<void> {
  const error = JSON.stringify({ type: "error", error: declined });
  await page.route(STRIPE_JS, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.Stripe = () => ({ initCheckout: async () => ({
        createPaymentElement: () => ({ mount(el) { el.innerHTML = '<div data-fake-payment-field>4242 4242 4242 4242</div>'; }, destroy() {}, on(_event, ready) { setTimeout(ready, 0); } }),
        confirm: async () => (${error}),
      }) });`,
    }),
  );
}

/** The checkout's own routes, answered in the browser (they need Stripe and the database). */
async function fakeCheckoutRoutes(page: Page, answers: { session?: number; consent?: number } = {}): Promise<void> {
  const plan = { startAt: "2026-12-08T08:00:00Z", dueAt: "2026-12-10T17:00:00Z", briefingBy: "2026-12-09T11:00:00Z" };
  await page.route("**/api/checkout/plan", (route) => route.fulfill({ json: plan }));
  await page.route("**/api/checkout/service", (route) => (answers.session && answers.session !== 200 ? route.fulfill({ status: answers.session, json: { ok: false } }) : route.fulfill({ json: { sessionId: "cs_stub_1", clientSecret: "cs_stub_1_secret" } })));
  await page.route("**/api/checkout/consent", (route) => route.fulfill({ status: answers.consent ?? 200, json: { ok: (answers.consent ?? 200) === 200 } }));
}

test.describe("public creator pages (stub)", () => {
  test.skip(!stubEnabled, "Needs the stub build and the Supabase stand-in (E2E_STUB=1).");

  test("an address that begins with \"api\" is served, and nothing loads from another origin", async ({ page, context, baseURL }) => {
    const who = await account("api", "ar", {
      profile: profilePage("x", "ar", "Nizar Studio (Live!)", {
        bio: "موسيقى وفيديوهات من دبي.",
        tagline: "Music & more.",
        avatar: { src: "https://tracker.example/p.gif", alt: "Nizar" },
        hero: { src: `${STUB}/storage/v1/object/public/media/u/2026/hero.png`, alt: "" },
        motion: { src: "https://cdn.example.com/loop.mp4" },
      }),
      blocks: [
        { id: "l1", type: "link", title: "My YouTube channel (4K)", url: "https://example.com/yt" },
        { id: "l2", type: "link", title: "قناتي على يوتيوب", url: "https://example.com/ar" },
        { id: "t1", type: "text", text: "Booking: hello@example.com." },
        { id: "g1", type: "gallery", images: [{ src: "http://tracker.example/one.jpg", alt: "one" }, { src: `${STUB}/storage/v1/object/public/media/u/2026/two.png`, alt: "two" }] },
      ],
    });
    expect(who.username.startsWith("api-")).toBe(true);
    const origins = new Set<string>();
    page.on("request", (request) => {
      if (/^https?:/.test(request.url())) origins.add(new URL(request.url()).origin);
    });
    const response = await page.goto(`/${who.username}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Nizar Studio (Live!)");
    await page.waitForLoadState("networkidle");
    await page.mouse.wheel(0, 2000);
    await page.waitForLoadState("networkidle");
    // The hero clip on another host is not on the page, and no picture address names another host.
    expect([...origins]).toEqual([new URL(baseURL ?? "").origin]);
    await expect(page.locator("video")).toHaveCount(0);
    expect(await page.content()).not.toContain("tracker.example");
    expect(await page.content()).not.toContain("cdn.example.com");
    expect(await context.cookies()).toEqual([]);

    // Mixed directions: the page is Arabic, the Latin name and title run left to right, the Arabic title right to left.
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const direction = (text: string) => page.locator('[dir="auto"]', { hasText: text }).first().evaluate((element) => getComputedStyle(element).direction);
    expect(await direction("Nizar Studio (Live!)")).toBe("ltr");
    expect(await direction("My YouTube channel (4K)")).toBe("ltr");
    expect(await direction("قناتي على يوتيوب")).toBe("rtl");
    await page.mouse.wheel(0, -4000);
    await expectAccessible(page);
    await shot(page, "creator-ar-mixed", true);
  });

  test("a German page keeps an Arabic title in its own direction", async ({ page }) => {
    const who = await account("mix", "de", {
      profile: profilePage("x", "de", "نزار الحداد", { bio: "Musik und Videos aus Dubai.", tagline: "موسيقى" }),
      blocks: [
        { id: "l1", type: "link", title: "قناتي على يوتيوب (جديد!)", url: "https://example.com/ar" },
        { id: "l2", type: "link", title: "Mein Kanal", url: "https://example.com/de" },
      ],
    });
    await page.goto(`/${who.username}`);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    const title = page.locator('[dir="auto"]', { hasText: "قناتي على يوتيوب (جديد!)" }).first();
    expect(await title.evaluate((element) => getComputedStyle(element).direction)).toBe("rtl");
    expect(await page.getByRole("heading", { level: 1 }).locator("bdi").evaluate((element) => getComputedStyle(element).direction)).toBe("rtl");
    await shot(page, "creator-de-mixed", true);
  });

  test("a deleted account's page is gone on the very next visit", async ({ page }) => {
    const who = await account("gone");
    expect((await page.goto(`/${who.username}`))?.status()).toBe(200);
    // Cached now: a second visit is served from the cache.
    expect((await page.goto(`/${who.username}`))?.status()).toBe(200);
    const deleted = await page.request.post("/api/account/delete", { headers: { Authorization: `Bearer ${who.token}` } });
    expect(deleted.status()).toBe(200);
    expect((await page.goto(`/${who.username}`))?.status()).toBe(404);
    await expect(page.getByText("Mila Berg")).toHaveCount(0);

    // The control: the same deletion behind the app's back (no route that drops the cached copy)
    // leaves the old page up. That is what the routes above prevent.
    const other = await account("stale");
    expect((await page.goto(`/${other.username}`))?.status()).toBe(200);
    await fetch(`${STUB}/rest/v1/rpc/delete_my_account`, { method: "POST", headers: { authorization: `Bearer ${other.token}` } });
    expect((await page.goto(`/${other.username}`))?.status()).toBe(200);
  });

  test("a suspended page is gone on the next visit and back when the account is let in again", async ({ page }) => {
    const who = await account("susp");
    const team = await account("team");
    expect((await page.goto(`/${who.username}`))?.status()).toBe(200);
    const status = (next: string) => page.request.post(`/api/admin/customers/${who.id}/status`, { headers: { Authorization: `Bearer ${team.token}` }, data: { next } });
    expect((await status("suspended")).status()).toBe(200);
    expect((await page.goto(`/${who.username}`))?.status()).toBe(404);
    expect((await status("active")).status()).toBe(200);
    expect((await page.goto(`/${who.username}`))?.status()).toBe(200);
    // The team deletes the customer: gone at once, too.
    expect((await page.request.post(`/api/admin/customers/${who.id}/delete`, { headers: { Authorization: `Bearer ${team.token}` } })).status()).toBe(200);
    expect((await page.goto(`/${who.username}`))?.status()).toBe(404);
  });

  test("after a change of address the old one stops and the new one works at once", async ({ page, context, baseURL }) => {
    const who = await account("move");
    const next = `${who.username}-neu`;
    expect((await page.goto(`/${who.username}`))?.status()).toBe(200);
    // Someone met a 404 at the new address a moment ago: that answer is cached as well.
    expect((await page.goto(`/${next}`))?.status()).toBe(404);
    await signIn(context, baseURL, who);
    await page.goto("/de/app/settings/address");
    const field = page.getByRole("textbox").first();
    await expect(field).toHaveValue(who.username);
    await field.fill(next);
    const refreshed = page.waitForResponse((response) => response.url().endsWith("/api/account/revalidate"));
    await page.locator("#main form").getByRole("button").first().click();
    await page.getByRole("alertdialog").getByRole("button").last().click();
    expect((await refreshed).status()).toBe(200);
    expect((await page.goto(`/${who.username}`))?.status()).toBe(404);
    expect((await page.goto(`/${next}`))?.status()).toBe(200);
  });
});

test.describe("the order screen (stub)", () => {
  test.skip(!stubEnabled, "Needs the stub build and the Supabase stand-in (E2E_STUB=1).");

  test("an empty briefing is not sent, too many links are named, left-out photos are counted", async ({ page, context, baseURL }) => {
    const who = await account("brief");
    const id = await order(who);
    await signIn(context, baseURL, who);
    let sent = 0;
    await page.route(`**/api/orders/${id}/briefing`, async (route) => {
      sent += 1;
      await route.fulfill({ json: { ok: true, dueAt: "2026-12-10T17:00:00Z" } });
    });
    await page.goto(`/de/app/orders/${id}`);
    const submit = page.getByRole("button", { name: "Briefing absenden" });
    await expect(submit).toBeVisible();
    await expect(page.getByText("Ein Link pro Zeile, höchstens 20.")).toBeVisible();

    await submit.click();
    await expect(page.getByText("Schreib mindestens einen Link oder deine Wünsche hinein.", { exact: false })).toBeVisible();
    await expect(page.getByLabel("Deine Links")).toBeFocused();
    expect(sent).toBe(0);
    await expectAccessible(page);
    await shot(page, "order-de-empty-briefing", true);

    await page.getByLabel("Deine Links").fill(Array.from({ length: 21 }, (_, index) => `https://example.com/${String(index)}`).join("\n"));
    await submit.click();
    await expect(page.getByText("Das sind 21 Links, möglich sind höchstens 20.", { exact: false })).toBeVisible();
    expect(sent).toBe(0);

    // One photo is taken; one of 11 MB and one GIF are left out, and the screen says how many.
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Fotos hinzufügen" }).click();
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    await (await chooser).setFiles([
      { name: "ok.png", mimeType: "image/png", buffer: png },
      { name: "gross.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(11 * 1024 * 1024, 1) },
      { name: "bewegt.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") },
    ]);
    await expect(page.locator("[data-photos-skipped]")).toContainText("2 Fotos wurden nicht übernommen");
    await expect(page.getByRole("img", { name: "ok.png" })).toBeVisible();
    await expectAccessible(page);
    await shot(page, "order-de-photos-skipped", true);

    await page.getByLabel("Deine Links").fill("https://example.com/shop");
    await submit.click();
    await expect(page.getByText("Danke! Fertig bis", { exact: false })).toBeVisible();
    expect(sent).toBe(1);
  });

  test("a withdrawn or refunded order promises no ready date and claims no briefing", async ({ page, context, baseURL }) => {
    const who = await account("wd");
    const pending = await order(who, { withdrawalPending: true });
    const ended = await order(who, { status: "withdrawn" });
    const briefed = await order(who, { status: "queued", briefed: true, dueAt: FAR });
    await signIn(context, baseURL, who);

    await page.goto(`/de/app/orders/${pending}`);
    await expect(page.locator('[data-order-note="withdrawalPending"]')).toContainText("Dein Widerruf ist eingegangen.");
    await expect(page.locator("[data-order-due]")).toHaveCount(0);
    await expect(page.getByText("Das Briefing ist abgeschickt.", { exact: false })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Briefing absenden" })).toHaveCount(0);
    await expectAccessible(page);
    await shot(page, "order-de-withdrawal");

    await page.goto(`/de/app/orders/${ended}`);
    await expect(page.locator('[data-order-note="ended"]')).toContainText("Diese Bestellung ist beendet.");
    await expect(page.locator("[data-order-due]")).toHaveCount(0);
    await expect(page.getByText("Das Briefing ist abgeschickt.", { exact: false })).toHaveCount(0);

    // A briefed, running order still says both.
    await page.goto(`/de/app/orders/${briefed}`);
    await expect(page.locator("[data-order-due]")).toContainText("Fertig bis");
    await expect(page.getByText("Das Briefing ist abgeschickt.", { exact: false })).toBeVisible();
  });

  test("in Arabic the screen is mirrored, arrows included", async ({ page, context, baseURL }) => {
    const who = await account("ar", "ar");
    const id = await order(who);
    const pending = await order(who, { withdrawalPending: true });
    await signIn(context, baseURL, who);
    await page.goto(`/ar/app/orders/${id}`);
    await expect(page.getByRole("button", { name: "إرسال التفاصيل" })).toBeVisible();
    // "Back" points to the right in a right-to-left screen: the arrow is mirrored.
    const back = page.locator("#main").getByRole("link", { name: "إلى لوحة التحكم" }).last();
    await expect(back).toBeVisible();
    expect(await back.locator("svg").evaluate((icon) => getComputedStyle(icon).scale)).toBe("-1 1");
    expect(await page.getByRole("button", { name: "إرسال التفاصيل" }).locator("svg").first().evaluate((icon) => getComputedStyle(icon).scale)).toBe("-1 1");
    await shot(page, "order-ar", true);
    await page.goto(`/ar/app/orders/${pending}`);
    await expect(page.locator('[data-order-note="withdrawalPending"]')).toBeVisible();
    await shot(page, "order-ar-withdrawal");
  });
});

test.describe("the checkouts with a payment form (stub)", () => {
  test.skip(!stubEnabled, "Needs the stub build and the Supabase stand-in (E2E_STUB=1).");

  const orderButton = (page: Page) => page.getByRole("button", { name: "Zahlungspflichtig bestellen" });

  test("a declined payment says so, in the provider's words, and never tells to reload", async ({ page, context, baseURL }) => {
    const who = await account("pay");
    await signIn(context, baseURL, who);
    await fakeStripe(page);
    await fakeCheckoutRoutes(page);
    await page.goto("/de/checkout/service?package=start");
    await expect(page.locator("[data-fake-payment-field]")).toBeVisible();
    await expect(orderButton(page)).toBeEnabled();
    await orderButton(page).click();
    // An alert right under the button, in the provider's words.
    await expect(page.locator("main").getByRole("alert").filter({ hasText: "Ihre Karte wurde abgelehnt." })).toBeVisible();
    await expect(page.locator("[data-order-failure]")).toHaveCount(1);
    await expectAccessible(page);
    await expect(page.getByText("Das Zahlungsfeld konnte nicht geladen werden.", { exact: false })).toHaveCount(0);
    await shot(page, "checkout-de-declined", true);
  });

  test("a failure without a reason, and an order that could not be placed, have their own sentences", async ({ page, context, baseURL }) => {
    const who = await account("pay");
    await signIn(context, baseURL, who);
    await fakeStripe(page, {});
    await fakeCheckoutRoutes(page);
    await page.goto("/de/checkout/service?package=start");
    await expect(orderButton(page)).toBeEnabled();
    await orderButton(page).click();
    await expect(page.getByText("Die Zahlung hat nicht geklappt.", { exact: false })).toBeVisible();

    await page.unroute("**/api/checkout/consent");
    await page.route("**/api/checkout/consent", (route) => route.fulfill({ status: 500, json: { ok: false } }));
    await orderButton(page).click();
    await expect(page.getByText("Die Bestellung konnte gerade nicht abgeschickt werden.", { exact: false })).toBeVisible();
    await expect(page.getByText("Das Zahlungsfeld konnte nicht geladen werden.", { exact: false })).toHaveCount(0);
  });

  test("when the session cannot be created, the slot says so instead of loading forever", async ({ page, context, baseURL }) => {
    const who = await account("pay");
    await signIn(context, baseURL, who);
    await fakeStripe(page);
    await fakeCheckoutRoutes(page, { session: 500 });
    await page.goto("/de/checkout/service?package=start");
    const alert = page.locator("main").getByRole("alert").filter({ hasText: "Das Zahlungsfeld konnte nicht geladen werden." });
    await expect(alert).toBeVisible();
    await expect(orderButton(page)).toBeDisabled();
    // The disabled button is described by that alert.
    expect(await orderButton(page).getAttribute("aria-describedby")).toBe(await alert.getAttribute("id"));
    await expectAccessible(page);
    await shot(page, "checkout-de-session-failed", true);

    await page.route("**/api/checkout/pro", (route) => route.fulfill({ status: 429, json: { ok: false } }));
    await page.goto("/de/checkout/pro");
    await expect(page.locator("main").getByRole("alert").filter({ hasText: "Das Zahlungsfeld konnte nicht geladen werden." })).toBeVisible();
    await expect(orderButton(page)).toBeDisabled();
  });

  test("Stripe.js does not follow the visitor out of the checkout", async ({ page, context, baseURL }) => {
    const who = await account("pay");
    await signIn(context, baseURL, who);
    await fakeStripe(page);
    await fakeCheckoutRoutes(page);
    // Whether the document holds Stripe.js; "between" while the page is being replaced by the next one.
    const loaded = () =>
      page
        .evaluate((src) => ({ tag: document.querySelectorAll(`script[src="${src}"]`).length, global: typeof (window as unknown as { Stripe?: unknown }).Stripe }), STRIPE_JS)
        .catch(() => ({ tag: -1, global: "between" }));

    // By a link: the logo leads to the homepage as a fresh document.
    await page.goto("/de/checkout/service?package=start");
    await expect(page.locator("[data-fake-payment-field]")).toBeVisible();
    expect(await loaded()).toEqual({ tag: 1, global: "function" });
    await page.locator("header").getByRole("link", { name: "Linkyo" }).click();
    await page.waitForURL(/\/de\/?$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await loaded()).toEqual({ tag: 0, global: "undefined" });

    // By the back button, after coming in by an in-app navigation.
    await page.goto("/de/service");
    await page.locator('a[href*="/checkout/service?package=start"]').first().click();
    await page.waitForURL(/\/checkout\/service/);
    await expect(page.locator("[data-fake-payment-field]")).toBeVisible();
    expect(await loaded()).toEqual({ tag: 1, global: "function" });
    await page.goBack();
    await page.waitForURL(/\/de\/service/);
    // The page that was reached is loaded afresh, without the script.
    await expect.poll(loaded).toEqual({ tag: 0, global: "undefined" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("the done page says when the order takes longer, and offers a way on", async ({ page, context, baseURL }) => {
    test.slow();
    const who = await account("done");
    await signIn(context, baseURL, who);
    // A session of its own: the stand-in keeps its data between runs.
    const session = `cs_stub_${randomUUID().replaceAll("-", "")}`;
    await page.goto(`/de/checkout/done?session_id=${session}`);
    const state = page.locator("[data-done-state]");
    await expect(state).toHaveAttribute("data-done-state", "pending");
    await expect(state).toContainText("Wir bestätigen deine Zahlung gerade");
    await expect(state).toHaveAttribute("data-done-state", "late", { timeout: 30_000 });
    await expect(state).toContainText("Das dauert länger als sonst.");
    await expect(page.locator("main").getByRole("link", { name: "Zum Dashboard" })).toHaveAttribute("href", "/de/app");
    await expectAccessible(page);
    await shot(page, "checkout-de-done-late");
    // Still looking: once the order is there, the page shows it.
    const late = randomUUID();
    await seed({ orders: { [late]: { id: late, profile_id: who.id, number: "LK-2026-000777", package: "start", amount_cents: 4900, promised_due_at: FAR, due_at: null, stripe_session_id: session } } });
    await expect(page.locator("[data-order-line]")).toContainText("LK-2026-000777", { timeout: 15_000 });
  });
});

test.describe("texts where contracts can be made (stub)", () => {
  test.skip(!stubEnabled, "Needs the stub build and the Supabase stand-in (E2E_STUB=1).");

  for (const locale of ["de", "ar"] as const) {
    test(`sign-up: the terms and the privacy policy are links (${locale})`, async ({ page }) => {
      await page.goto(`/${locale}/signup`);
      const terms = page.locator(`main a[href="/${locale}/agb"]`);
      const privacy = page.locator(`main a[href="/${locale}/datenschutz"]`);
      for (const link of [terms, privacy]) {
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute("target", "_blank");
        await expect(link).toHaveAttribute("rel", "noopener");
        // Marked by colour and weight, never by a line (ADR 0041), also on hover.
        await link.hover();
        expect(await link.evaluate((element) => getComputedStyle(element).textDecorationLine)).toBe("none");
        expect(Number(await link.evaluate((element) => getComputedStyle(element).fontWeight))).toBeGreaterThanOrEqual(600);
      }
      if (locale === "de") {
        await expect(terms).toHaveText("Nutzungsbedingungen");
        await expect(privacy).toHaveText("Datenschutzerklärung");
      }
      await page.mouse.move(0, 0);
      await expectAccessible(page);
      await shot(page, `signup-${locale}`);
    });

    test(`settings: the page's own legal notice and Linkyo's have different names (${locale})`, async ({ page, context, baseURL }) => {
      const who = await account("set", locale);
      await signIn(context, baseURL, who);
      await page.goto(`/${locale}/app/settings`);
      const own = locale === "de" ? "Impressum deiner Seite" : "البيانات القانونية لصفحتك";
      const linkyo = locale === "de" ? "Impressum von Linkyo" : "بيانات النشر لـ Linkyo";
      const main = page.locator("#main");
      await expect(main.getByText(own, { exact: true })).toBeVisible();
      await expect(main.getByText(linkyo, { exact: true })).toBeVisible();
      await expect(main.getByRole("link", { name: linkyo })).toHaveAttribute("href", `/${locale}/impressum`);
      await shot(page, `settings-${locale}-top`);
      await main.getByText(linkyo, { exact: true }).scrollIntoViewIfNeeded();
      await shot(page, `settings-${locale}`);
    });

    test(`pricing: the Pro card promises only what Pro holds (${locale})`, async ({ page }) => {
      await page.goto(`/${locale}`);
      const pricing = page.locator("#pricing");
      await pricing.scrollIntoViewIfNeeded();
      const lead = locale === "de" ? "KI-Entwürfe für deine Seite, Monat für Monat." : "مسودات بالذكاء الاصطناعي لصفحتك، شهرًا بعد شهر.";
      const old = locale === "de" ? "Für alle, die verkaufen und wachsen wollen." : "لكل من يريد أن يبيع وينمو.";
      await expect(pricing.getByText(lead, { exact: true })).toBeVisible();
      await expect(pricing.getByText(old, { exact: true })).toHaveCount(0);
      if (SHOTS) {
        // The Pro card alone, once it has faded in.
        const card = pricing.locator("article").filter({ hasText: lead });
        await card.scrollIntoViewIfNeeded();
        await expect(card).toHaveCSS("opacity", "1");
        mkdirSync(SHOTS, { recursive: true });
        await card.screenshot({ path: path.join(SHOTS, `pricing-${locale}-${test.info().project.name}.png`) });
      }
    });
  }
});
