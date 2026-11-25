import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

import type { Database } from "../src/lib/supabase/database.types";

import { createRealAccount, expect, readCapturedMail, realEnabled, service, signIn, test, uniqueName } from "./real";

/**
 * The page service and the checkouts (plan §1.6, §3.2 WP6): the § 312j block right above
 * "Zahlungspflichtig bestellen", the unticked early-start box, the payment slot without a publishable
 * key, the consent route that fixes the shown date, German-only orders, the webhook that turns a paid
 * session into an order (and only then into the team's queue), the Pro checkout and its "already
 * Pro" state, and the real-mode copy of the homepage. `@real` cases need the real build
 * (NEXT_PUBLIC_PAYMENTS=test), the local stack and the mocks; the demo case runs in the regular suite.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
// The local stack's publishable key (public by design) unless the run names another.
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const MOCK_STRIPE = `http://127.0.0.1:${process.env.MOCK_STRIPE_PORT ?? "54398"}`;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_local_test";
const BERLIN = "Europe/Berlin";

/** An access token for API calls as this account (a magic-link token verified directly). */
async function tokenFor(email: string): Promise<string> {
  const { data, error } = await service().auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(error.message);
  const anon = createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const verified = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
  if (verified.error || !verified.data.session) throw new Error(verified.error?.message ?? "no session");
  return verified.data.session.access_token;
}

/** A signed-in, onboarded customer on the dashboard. */
async function customer(page: Page, prefix: string) {
  const { username, email } = uniqueName(prefix);
  const account = await createRealAccount({ email, username, locale: "de", onboarded: true });
  await signIn(page, email, "/de/app");
  await page.waitForURL(/\/de\/app/);
  // Let the dashboard settle (its session check may refresh the token) before leaving it.
  await page.waitForLoadState("networkidle");
  return account;
}

async function mockRequests(query: Record<string, string>): Promise<{ count: number; requests: { body: Record<string, unknown> }[] }> {
  const response = await fetch(`${MOCK_STRIPE}/__requests?${new URLSearchParams(query).toString()}`);
  return (await response.json()) as { count: number; requests: { body: Record<string, unknown> }[] };
}

/** The checkout session the page opened for this account (its intent row). */
async function intentOf(profileId: string) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const { data } = await service().from("checkout_intents").select("*").eq("profile_id", profileId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (data) return data;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("no checkout intent");
}

const longDate = (iso: string) => new Intl.DateTimeFormat("de", { timeZone: BERLIN, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));

/** Every request the page makes, so tests can prove Stripe.js was never loaded. */
function recordRequests(page: Page): string[] {
  const urls: string[] = [];
  page.on("request", (request) => urls.push(request.url()));
  return urls;
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.map((v) => `${v.id} (${v.impact ?? ""}): ${String(v.nodes.length)}× — ${v.nodes[0]?.target.join(" ") ?? ""}`);
}

test.describe("payments off (demo build)", () => {
  test.skip(realEnabled, "The demo build has no payments.");

  test("service, checkouts, withdrawal and cancellation do not exist, and no contract link is shown", async ({ page }) => {
    for (const path of ["/de/service", "/de/checkout/service?package=start", "/de/checkout/pro", "/de/checkout/done", "/de/widerruf", "/de/kuendigen"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
    }
    for (const path of ["/api/checkout/plan", "/api/withdrawals", "/api/cancellations", "/api/stripe/webhook"]) {
      const response = await page.request.post(path, { data: {} });
      expect(response.status(), path).toBe(404);
    }
    await page.goto("/de");
    await expect(page.getByRole("link", { name: "Vertrag widerrufen" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Verträge hier kündigen" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Pro bestellen" })).toHaveCount(0);
  });
});

test.describe("page service and checkout @real", () => {
  test.skip(!realEnabled, "Needs the local Supabase stack (E2E_SUPABASE=1).");

  test("the service page: both packages, plain prices, the payment methods and the rights @real", async ({ page }) => {
    const requests = recordRequests(page);
    await page.goto("/de/service");
    await expect(page.getByRole("heading", { level: 1, name: "Wir gestalten deine Seite." })).toBeVisible();
    const main = page.locator("main");
    await expect(main).toContainText(/24,99\s€/);
    await expect(main).toContainText(/79,99\s€/);
    await expect(main).toContainText("Zahlen mit Karte, Apple Pay, Google Pay oder PayPal.");
    await expect(main).toContainText("Deine gesetzlichen Rechte (Widerruf, Gewährleistung) gelten zusätzlich und bleiben unberührt.");
    expect(await page.locator("s, del").count()).toBe(0);
    const struck = await page.evaluate(() => [...document.querySelectorAll("main *")].filter((node) => getComputedStyle(node).textDecorationLine.includes("line-through")).length);
    expect(struck).toBe(0);
    expect(await main.innerText()).not.toContain("Werktag");
    await expect(page.getByRole("link", { name: "Start bestellen" })).toHaveAttribute("href", "/de/checkout/service?package=start");
    await expect(page.getByRole("link", { name: "Premium bestellen" })).toHaveAttribute("href", "/de/checkout/service?package=premium");
    expect(requests.filter((url) => url.includes("js.stripe.com"))).toEqual([]);
  });

  test("the service checkout: the § 312j block right above the button, the unticked box, the not-set-up slot @real", async ({ page }) => {
    const requests = recordRequests(page);
    const account = await customer(page, "co-start");
    await page.goto("/de/checkout/service?package=start");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Deine Bestellung");
    const button = page.getByRole("button", { name: "Zahlungspflichtig bestellen", exact: true });
    await expect(button).toBeVisible();
    await expect(button).toBeDisabled();
    await expect(page.getByRole("status").filter({ hasText: "Zahlung im Testmodus noch nicht eingerichtet" })).toBeVisible();
    expect(await button.getAttribute("aria-describedby")).toBeTruthy();

    // The early-start box: unticked, above the summary.
    const early = page.getByRole("checkbox", { name: /Bitte fangt sofort an/ });
    await expect(early).not.toBeChecked();
    const summary = page.locator("[data-checkout-summary]");
    await expect(summary).toContainText("Gesamtpreis");
    await expect(summary).toContainText(/24,99\s€/);
    await expect(summary).toContainText("Keine weiteren Kosten.");
    const order = await page.evaluate(() => {
      const box = document.querySelector('input[type="checkbox"]');
      const block = document.querySelector("[data-checkout-summary]");
      return box && block ? Boolean(box.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING) : false;
    });
    expect(order).toBe(true);

    // Between the end of the summary and the button: only the three terms links (and the warranty line).
    const between = await page.evaluate(() => {
      const block = document.querySelector("[data-checkout-summary]");
      const target = [...document.querySelectorAll("button")].find((node) => node.textContent.trim() === "Zahlungspflichtig bestellen");
      if (!block || !target) return null;
      const after = (node: Node) => Boolean(block.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) && !block.contains(node);
      const before = (node: Node) => Boolean(target.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING);
      const interactive = [...document.querySelectorAll("a, button, input, select, textarea, [tabindex]")].filter((node) => after(node) && before(node));
      const text = [...document.querySelectorAll("p")].filter((node) => after(node) && before(node)).map((node) => node.textContent);
      return { interactive: interactive.map((node) => `${node.tagName.toLowerCase()} ${node.getAttribute("href") ?? ""}`), text };
    });
    expect(between?.interactive).toEqual(["a /de/agb", "a /de/widerrufsbelehrung", "a /de/datenschutz"]);
    expect(between?.text.join(" ")).toContain("Es gelten die gesetzlichen Gewährleistungsrechte für digitale Inhalte und Dienstleistungen.");

    // The due line follows the box: without it the start waits for the withdrawal period.
    const due = page.locator("[data-due-line]");
    await expect(due).toContainText("Ohne Sofortstart beginnen wir am");
    await early.check();
    await expect(due).toContainText("wenn dein Briefing bis");
    await early.uncheck();
    await expect(due).toContainText("Ohne Sofortstart beginnen wir am");

    // The page opened one Checkout Session (elements) for this account at the mock Stripe.
    await expect.poll(async () => (await mockRequests({ method: "POST", path: "/v1/checkout/sessions", profile: account.id })).count).toBe(1);
    const { requests: sessions } = await mockRequests({ method: "POST", path: "/v1/checkout/sessions", profile: account.id });
    expect(sessions[0]?.body).toMatchObject({ mode: "payment", ui_mode: "elements", invoice_creation: { enabled: "true" } });
    expect(requests.filter((url) => url.includes("js.stripe.com"))).toEqual([]);
  });

  test("the consent route fixes the shown date: stale → 409 with the new plan; current → stored as shown (both branches) @real", async ({ page, request }) => {
    const account = await customer(page, "co-consent");
    await page.goto("/de/checkout/service?package=premium");
    await expect(page.locator("[data-due-line]")).toBeVisible();
    const intent = await intentOf(account.id);
    expect(intent.product).toBe("service-premium");
    const token = await tokenFor(account.email);
    const consent = (earlyStart: boolean, shownDueAt: string) =>
      request.post("/api/checkout/consent", { headers: { Authorization: `Bearer ${token}` }, data: { sessionId: intent.session_id, earlyStart, shownDueAt } });

    for (const earlyStart of [false, true]) {
      const stale = await consent(earlyStart, "2020-01-06T17:00:00.000Z");
      expect(stale.status()).toBe(409);
      let plan = ((await stale.json()) as { plan: { startAt: string; dueAt: string } }).plan;
      // Another order may take the last place of a day meanwhile: the next press sends the new date.
      let answer = await consent(earlyStart, plan.dueAt);
      for (let retry = 0; answer.status() === 409 && retry < 3; retry++) {
        plan = ((await answer.json()) as { plan: typeof plan }).plan;
        answer = await consent(earlyStart, plan.dueAt);
      }
      expect(answer.status()).toBe(200);
      // The date that was on screen is the one stored; the start is the moment of the consent.
      const stored = ((await answer.json()) as { plan: typeof plan }).plan;
      expect(stored.dueAt).toBe(plan.dueAt);
      const { data } = await service().from("checkout_intents").select("*").eq("session_id", intent.session_id).single();
      expect(new Date(data?.promised_due_at ?? "").toISOString()).toBe(plan.dueAt);
      expect(new Date(data?.start_after ?? "").toISOString()).toBe(stored.startAt);
      expect(data?.early_start).toBe(earlyStart);
      if (earlyStart) expect(data?.early_start_text).toContain("Bitte fangt sofort an.");
      else expect(data?.early_start_text).toBeNull();
      expect(data?.consent_at).toBeTruthy();
    }

    // What the page shows for the box is the date the route stores.
    const early = page.getByRole("checkbox", { name: /Bitte fangt sofort an/ });
    await early.check();
    const planned = (await (await request.post("/api/checkout/plan", { data: { product: "service-premium", earlyStart: true } })).json()) as { dueAt: string };
    await expect(page.locator("[data-due-line]")).toContainText(longDate(planned.dueAt));
  });

  test("English and Arabic checkouts take no order: a notice and a link to the German checkout @real", async ({ page }) => {
    await customer(page, "co-locale");
    for (const locale of ["en", "ar"] as const) {
      for (const path of ["/checkout/service?package=start", "/checkout/pro"]) {
        await page.goto(`/${locale}${path}`);
        const link = page.locator("main a[hreflang='de']");
        await expect(link).toHaveAttribute("href", `/de${path}`);
        await expect(page.getByRole("button", { name: /Zahlungspflichtig|Order with obligation|اطلب مع الالتزام/ })).toHaveCount(0);
        await expect(page.locator("main h1")).toHaveText(locale === "en" ? "Ordering is in German only for now" : "الطلب متاح بالألمانية فقط حاليًا");
      }
    }
  });

  test("a signed webhook turns the paid session into an order, e-mails it, and only then queues it @real", async ({ page, request }) => {
    const account = await customer(page, "co-hook");
    await page.goto("/de/checkout/service?package=start");
    await expect(page.locator("[data-due-line]")).toBeVisible();
    const intent = await intentOf(account.id);
    const event = (id: string) => {
      const payload = JSON.stringify({
        id,
        object: "event",
        type: "checkout.session.completed",
        data: {
          object: {
            id: intent.session_id,
            object: "checkout.session",
            mode: "payment",
            payment_status: "paid",
            payment_intent: `pi_${randomUUID().replaceAll("-", "")}`,
            amount_total: 2499,
            customer_email: account.email,
            customer_details: { email: account.email, name: "Real Creator" },
            metadata: { profile_id: account.id, product: "service-start", locale: "de" },
          },
        },
      });
      return { payload, signature: Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET }) };
    };
    const deliver = (id: string, signature?: string) => {
      const { payload, signature: good } = event(id);
      return request.post("/api/stripe/webhook", { headers: { "stripe-signature": signature ?? good, "content-type": "application/json" }, data: payload });
    };

    // A bad signature is refused.
    expect((await deliver(`evt_${randomUUID()}`, "t=1,v1=bad")).status()).toBe(400);
    // Before the customer consented nothing is created: Stripe is asked to retry (500).
    const eventId = `evt_${randomUUID().replaceAll("-", "")}`;
    expect((await deliver(eventId)).status()).toBe(500);
    expect((await service().from("orders").select("id").eq("stripe_session_id", intent.session_id)).data).toEqual([]);

    const start = new Date();
    const due = new Date(Date.now() + 3 * 24 * 3600 * 1000);
    const { error } = await service().rpc("record_checkout_consent", {
      session: intent.session_id,
      account: account.id,
      early: true,
      consent_text: "Bitte fangt sofort an. (e2e)",
      start_after: start.toISOString(),
      promised_due: due.toISOString(),
    });
    expect(error).toBeNull();
    // Stripe's redelivery of the same event now creates the order.
    expect((await deliver(eventId)).status()).toBe(200);
    const { data: order } = await service().from("orders").select("*").eq("stripe_session_id", intent.session_id).single();
    expect(order?.number).toMatch(/^LNK-\d{4}-\d{6}$/);
    expect(order?.status).toBe("awaiting_briefing");
    expect(order?.confirmation_sent_at).toBeTruthy();
    const mails = await readCapturedMail({ to: account.email, tag: "order-confirmation" });
    expect(mails).toHaveLength(1);
    expect(mails[0]?.subject).toContain(order?.number ?? "-");
    expect(mails[0]?.text).toContain("Widerrufsbelehrung");
    expect(mails[0]?.text).toContain("Muster-Widerrufsformular");
    expect(mails[0]?.text).toContain("Bitte fangt sofort an. (e2e)");
    expect(mails[0]?.text).toContain("TESTMODUS");
    // The confirmation file was written before the order joined the queue (confirmation_sent_at).
    const written = Date.parse(mails[0]?.file.slice(0, 24).replace(/^(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "$1:$2:$3.$4Z") ?? "");
    expect(written).toBeLessThanOrEqual(Date.parse(order?.confirmation_sent_at ?? "") + 1);
    // The same event again changes nothing.
    expect((await deliver(eventId)).status()).toBe(200);
    expect(await readCapturedMail({ to: account.email, tag: "order-confirmation" })).toHaveLength(1);

    await page.goto(`/de/checkout/done?session_id=${intent.session_id}`);
    await expect(page.locator("[data-order-line]")).toContainText(order?.number ?? "-");
    await page.getByRole("link", { name: "Briefing ausfüllen" }).click();
    await expect(page).toHaveURL(new RegExp(`/de/app/orders/${order?.id ?? "-"}$`));
  });

  test("the briefing of a Start order names the AI provider and, on time, keeps the promised date on a full day @real", async ({ page }) => {
    const account = await customer(page, "co-brief");
    // A promised working day 4 weeks ahead (on time whatever today is), already at capacity.
    const day = new Date(Date.now() + 28 * 24 * 3600 * 1000);
    while ([0, 6].includes(day.getUTCDay())) day.setUTCDate(day.getUTCDate() + 1);
    const promised = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 17, 0));
    const db = service();
    const session = `cs_e2e_${randomUUID().replaceAll("-", "")}`;
    await db.rpc("record_checkout_intent", { session, account: account.id, product: "service-start", locale: "de" });
    await db.rpc("record_checkout_consent", { session, account: account.id, early: true, consent_text: "x", start_after: new Date().toISOString(), promised_due: promised.toISOString() });
    const made = (await db.rpc("record_service_order", { session, payment_intent: `pi_${session}`, amount: 2499, email: account.email })).data as { id: string };
    await db.rpc("mark_confirmation_sent", { target: made.id });
    const fillers = Array.from({ length: 4 }, (_, index) => ({
      customer_email: `filler-${String(index)}@example.com`,
      package: "start" as const,
      locale: "de",
      amount_cents: 2499,
      vat_mode: "standard19",
      early_start: true,
      start_after: new Date().toISOString(),
      promised_due_at: promised.toISOString(),
      due_at: promised.toISOString(),
      revisions_allowed: 1,
      stripe_session_id: `cs_fill_${randomUUID().replaceAll("-", "")}`,
    }));
    const { data: filled, error } = await db.from("orders").insert(fillers).select("id");
    expect(error).toBeNull();
    try {
      await page.goto(`/de/app/orders/${made.id}`);
      await expect(page.locator("[data-briefing-privacy]")).toContainText("Anthropic");
      await page.getByLabel("Deine Links").fill("https://example.com/me\nhttps://example.com/shop");
      await page.getByLabel("Deine Wünsche").fill("Ruhig und hell, Shop zuerst.");
      const send = page.getByRole("button", { name: "Briefing absenden" });
      // The privacy line sits right above the button.
      const above = await page.evaluate(() => {
        const line = document.querySelector("[data-briefing-privacy]");
        const button = [...document.querySelectorAll("button")].find((node) => node.textContent.includes("Briefing absenden"));
        return line && button ? Boolean(line.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING) : false;
      });
      expect(above).toBe(true);
      await send.click();
      await expect(page.getByRole("status").filter({ hasText: "Danke! Fertig bis" })).toContainText(longDate(promised.toISOString()));
      const { data: briefed } = await db.from("orders").select("due_at, status, briefing").eq("id", made.id).single();
      expect(new Date(briefed?.due_at ?? "").toISOString()).toBe(promised.toISOString());
      expect(briefed?.status).toBe("queued");
      expect(briefed?.briefing).toMatchObject({ links: ["https://example.com/me", "https://example.com/shop"], wishes: "Ruhig und hell, Shop zuerst." });
    } finally {
      await db.from("orders").delete().in("id", (filled ?? []).map((row) => row.id));
    }
  });

  test("Pro: the monthly price, the term, SEPA and the same button; an account with Pro cannot buy it twice @real", async ({ page, request }) => {
    const requests = recordRequests(page);
    const buyer = await customer(page, "co-pro");
    await page.goto("/de/checkout/pro");
    const summary = page.locator("[data-checkout-summary]");
    await expect(summary).toContainText(/8,00\s€ pro Monat/);
    await expect(summary).toContainText("Laufzeit: 1 Monat, verlängert sich jeweils um 1 Monat.");
    await expect(page.locator("main")).toContainText("SEPA-Lastschrift");
    await expect(page.getByRole("button", { name: "Zahlungspflichtig bestellen", exact: true })).toBeDisabled();
    await expect.poll(async () => (await mockRequests({ method: "POST", path: "/v1/checkout/sessions", profile: buyer.id })).count).toBe(1);
    const { requests: sessions } = await mockRequests({ method: "POST", path: "/v1/checkout/sessions", profile: buyer.id });
    expect(sessions[0]?.body).toMatchObject({ mode: "subscription", subscription_data: { metadata: { profile_id: buyer.id } } });

    // "Pro für immer" from the invite programme: no second subscription.
    const { username, email } = uniqueName("co-life");
    const forever = await createRealAccount({ email, username, locale: "de", onboarded: true });
    const { error } = await service().from("rewards").insert({ profile_id: forever.id, kind: "pro_for_life", source: "team" });
    expect(error).toBeNull();
    const answer = await request.post("/api/checkout/pro", { headers: { Authorization: `Bearer ${await tokenFor(email)}` }, data: { locale: "de" } });
    expect(answer.status()).toBe(409);
    expect(await answer.json()).toMatchObject({ error: "alreadyPro" });
    await page.context().clearCookies();
    await signIn(page, email, "/de/app");
    await page.waitForURL(/\/de\/app/);
    await page.waitForLoadState("networkidle");
    await page.goto("/de/checkout/pro");
    await expect(page.getByRole("heading", { level: 1, name: "Du hast Pro bereits" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Zahlungspflichtig bestellen" })).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "Zahlung im Testmodus" })).toHaveCount(0);
    expect((await mockRequests({ method: "POST", path: "/v1/checkout/sessions", profile: forever.id })).count).toBe(0);
    expect(requests.filter((url) => url.includes("js.stripe.com"))).toEqual([]);
  });

  test("the homepage in a paid real build: Pro to buy, the page service linked, the statistics as the build counts them, no Stripe.js anywhere @real", async ({ page }) => {
    const requests = recordRequests(page);
    await page.goto("/de");
    const pricing = page.locator("#pricing");
    const card = (plan: string) => pricing.locator(`[data-plan="${plan}"]`);
    await expect(card("pro").locator("[data-price]")).toContainText(/8,00\s€/);
    await expect(card("pro").getByRole("link", { name: "Pro bestellen" })).toHaveAttribute("href", "/de/checkout/pro");
    await expect(card("service").getByRole("link", { name: "Zum Seitenservice" })).toHaveAttribute("href", "/de/service");
    await expect(page.locator("#faq")).toContainText("Pro enthält KI-Entwürfe; eigene Domain, Verkauf und E-Mail-Liste sind geplant.");
    // The cookie-free statistics: a Free line that is there today where the build counts pages
    // (LINKYO_ANALYTICS), listed as planned where it does not; never "in Arbeit" beside a live line.
    const statistics = card("free").locator("li", { hasText: "Analytics ohne Cookies" });
    await expect(statistics).toHaveCount(1);
    await expect(pricing).not.toContainText("in Arbeit");
    if ((await statistics.getAttribute("data-when")) !== "now") {
      // Not counted: "Analytics ohne Cookies" only as planned or qualified, or as the analytics section's own title.
      const unqualified = await page.evaluate(() => {
        const clone = document.body.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('#analytics h2, #analytics h3, [data-when="planned"], script, style').forEach((node) => node.remove());
        const text = clone.textContent;
        const phrase = "Analytics ohne Cookies";
        let count = 0;
        for (let at = text.indexOf(phrase); at !== -1; at = text.indexOf(phrase, at + phrase.length)) {
          const rest = text.slice(at + phrase.length, at + phrase.length + 14);
          if (!rest.startsWith(" (in Arbeit)") && !rest.startsWith(" ist in Arbeit")) count += 1;
        }
        return count;
      });
      expect(unqualified).toBe(0);
    }
    for (const path of ["/de/templates", "/de/impressum", "/de/datenschutz", "/de/agb", "/de/widerrufsbelehrung", "/de/widerruf", "/de/kuendigen"]) await page.goto(path);
    const { username, email } = uniqueName("co-public");
    await createRealAccount({ email, username, locale: "de", onboarded: true });
    await page.goto(`/${username}`);
    expect(requests.filter((url) => url.includes("js.stripe.com"))).toEqual([]);
  });

  test("axe: service, both checkouts and the German-only notice (de/en/ar, light/dark) @real", async ({ page }) => {
    await customer(page, "co-axe");
    const paths = ["/de/service", "/en/service", "/ar/service", "/de/checkout/service?package=start", "/de/checkout/pro", "/en/checkout/service?package=start", "/ar/checkout/pro"];
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      for (const path of paths) {
        await page.goto(path);
        await page.waitForLoadState("load");
        if (path.includes("/de/checkout/")) await expect(page.locator("[data-checkout-summary]")).toBeVisible();
        expect(await axe(page), `${path} (${scheme})`).toEqual([]);
      }
    }
  });
});
