import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import type { APIRequestContext, Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/lib/supabase/database.types";

import { createRealAccount, expect, readCapturedMail, realEnabled, service, signIn, test, uniqueName } from "./real";

/**
 * The statutory contract functions (plan §0.3 #7, §1.6, §3.2 WP6): "Vertrag widerrufen" in two steps
 * that never refuse, "Verträge hier kündigen" with only the legal fields and one button, receipts that
 * never reveal whether an account matched, Stripe calls by kind and date (at the mock), the footer
 * links on every page and in Settings, and the held receipt of the 11th declaration in an hour.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
// The local stack's publishable key (public by design) unless the run names another.
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const MOCK_STRIPE = `http://127.0.0.1:${process.env.MOCK_STRIPE_PORT ?? "54398"}`;
const BERLIN = "Europe/Berlin";

const day = (at: Date) => new Intl.DateTimeFormat("de", { timeZone: BERLIN, day: "2-digit", month: "2-digit", year: "numeric" }).format(at);
const longDate = (at: Date) => new Intl.DateTimeFormat("de", { timeZone: BERLIN, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(at);

/** A database client acting as this account (team functions check the caller's permissions). */
async function clientAs(email: string) {
  const { data, error } = await service().auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(error.message);
  const client = createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const verified = await client.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
  if (verified.error) throw new Error(verified.error.message);
  return client;
}

/** A Pro subscriber: a Stripe entitlement in the database and the same subscription at the mock. */
async function subscriber(prefix: string) {
  const { username, email } = uniqueName(prefix);
  const account = await createRealAccount({ email, username, locale: "de", onboarded: true });
  const subscription = `sub_e2e_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const periodEnd = new Date(Math.floor((Date.now() + 20 * 24 * 3600 * 1000) / 1000) * 1000);
  const { error } = await service().from("entitlements").insert({
    profile_id: account.id,
    product: "pro",
    source: "stripe",
    status: "active",
    current_period_end: periodEnd.toISOString(),
    stripe_subscription_id: subscription,
    stripe_customer_id: "cus_e2e",
  });
  if (error) throw new Error(error.message);
  await fetch(`${MOCK_STRIPE}/__subscriptions/${subscription}`, {
    method: "POST",
    body: JSON.stringify({ current_period_end: periodEnd.getTime() / 1000, customer: "cus_e2e", metadata: { profile_id: account.id } }),
  });
  return { ...account, subscription, periodEnd };
}

async function stripeCalls(subscription: string): Promise<{ method: string; body: Record<string, unknown> }[]> {
  const response = await fetch(`${MOCK_STRIPE}/__requests?prefix=${encodeURIComponent(`/v1/subscriptions/${subscription}`)}`);
  return ((await response.json()) as { requests: { method: string; body: Record<string, unknown> }[] }).requests;
}

/** Fills and sends the cancellation form; answers the API's answer and the done screen's text. */
async function cancel(page: Page, input: { kind?: "ordinary" | "extraordinary"; reason?: string; name: string; account: string; confirmation: string; date?: string }) {
  await page.goto("/de/kuendigen");
  if (input.kind === "extraordinary") {
    await page.getByRole("radio", { name: "Außerordentliche Kündigung", exact: true }).check();
    await page.getByLabel("Grund der außerordentlichen Kündigung").fill(input.reason ?? "");
  }
  await page.getByLabel("Dein Name").fill(input.name);
  await page.getByLabel("E-Mail-Adresse deines Kontos").fill(input.account);
  if (input.date) {
    await page.getByRole("radio", { name: "zu einem bestimmten Datum", exact: true }).check();
    await page.getByLabel("Datum", { exact: true }).fill(input.date);
  }
  await page.getByLabel("E-Mail für die Kündigungsbestätigung").fill(input.confirmation);
  const answer = page.waitForResponse((response) => response.url().endsWith("/api/cancellations"));
  await page.getByRole("button", { name: "Jetzt kündigen", exact: true }).click();
  const body = (await (await answer).json()) as Record<string, unknown>;
  const done = page.locator("[data-cancel-done]");
  await expect(done).toBeVisible();
  return { body, text: await done.innerText() };
}

/** Sends the withdrawal form in its two steps; answers the done screen's text. */
async function withdraw(page: Page, input: { name: string; contract: string; email: string }) {
  await page.goto("/de/widerruf");
  await page.getByLabel("Dein Name").fill(input.name);
  await page.getByLabel("Bestellnummer oder Vertrag").fill(input.contract);
  await page.getByLabel("E-Mail für die Bestätigung").fill(input.email);
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page.locator("[data-withdraw-review]")).toContainText(`${input.name} widerruft den Vertrag ${input.contract}`);
  await page.getByRole("button", { name: "Widerruf bestätigen", exact: true }).click();
  const done = page.locator("[data-withdraw-done]");
  await expect(done).toBeVisible();
  return done.innerText();
}

/** A paid, confirmed service order of this account, made directly in the database. */
async function seededOrder(account: { id: string; email: string }) {
  const db = service();
  const session = `cs_e2e_${randomUUID().replaceAll("-", "")}`;
  await db.rpc("record_checkout_intent", { session, account: account.id, product: "service-start", locale: "de" });
  await db.rpc("record_checkout_consent", {
    session,
    account: account.id,
    early: true,
    consent_text: "x",
    start_after: new Date().toISOString(),
    promised_due: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
  });
  const made = (await db.rpc("record_service_order", { session, payment_intent: `pi_${session}`, amount: 2499, email: account.email })).data as { id: string; number: string };
  await db.rpc("mark_confirmation_sent", { target: made.id });
  return made;
}

const postWithdrawal = (request: APIRequestContext, ip: string, email: string) =>
  request.post("/api/withdrawals", { headers: { "x-forwarded-for": ip }, data: { name: "Flood Test", email, contract: "LNK-2026-999999", locale: "de" } });

test.describe("withdrawal and cancellation @real", () => {
  test.skip(!realEnabled, "Needs the local Supabase stack (E2E_SUPABASE=1).");

  test("withdrawal: two steps, no reason, a receipt with the server's date and time; a matched order stops and leads the queue @real", async ({ page }) => {
    const { username, email } = uniqueName("wd-order");
    const account = await createRealAccount({ email, username, locale: "de", onboarded: true });
    const order = await seededOrder(account);

    await page.goto("/de/widerruf");
    await expect(page.getByRole("heading", { level: 1, name: "Vertrag widerrufen" })).toBeVisible();
    await expect(page.getByLabel(/Grund/)).toHaveCount(0);
    expect(await page.locator("main textarea").count()).toBe(0);
    const text = await withdraw(page, { name: "Mila Berg", contract: order.number, email: email.toUpperCase() });
    const receipt = /eingegangen am (\d{2}\.\d{2}\.\d{4}) um (\d{2}:\d{2}) Uhr/.exec(text);
    expect(receipt).not.toBeNull();
    expect(text).toContain(`Wir haben dir die Bestätigung an ${email.toUpperCase()} geschickt.`);

    const mails = await readCapturedMail({ to: email, tag: "withdrawal-receipt" });
    expect(mails).toHaveLength(1);
    expect(mails[0]?.subject).toBe(`Eingangsbestätigung: dein Widerruf vom ${receipt?.[1] ?? "-"}, ${receipt?.[2] ?? "-"} Uhr`);
    expect(mails[0]?.text).toContain(`Mila Berg widerruft den Vertrag ${order.number}`);

    const { data } = await service().from("orders").select("withdrawal_pending, status").eq("id", order.id).single();
    expect(data?.withdrawal_pending).toBe(true);
    // The team's queue lists it first (a viewer reads the queue).
    const { username: teamName, email: teamEmail } = uniqueName("wd-team");
    const member = await createRealAccount({ email: teamEmail, username: teamName, locale: "de", onboarded: true });
    await service().from("team_members").upsert({ user_id: member.id, role: "viewer" });
    const queue = (await (await clientAs(teamEmail)).rpc("admin_orders", { scope: "open" })).data as { id: string; withdrawalPending: boolean }[];
    const at = queue.findIndex((row) => row.id === order.id);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(queue[at]?.withdrawalPending).toBe(true);
    // Every order before it is a pending withdrawal too (parallel tests may have their own).
    expect(queue.slice(0, at).every((row) => row.withdrawalPending)).toBe(true);
    expect(queue.slice(at).findIndex((row) => !row.withdrawalPending)).not.toBe(0);
  });

  test("cancellation page: only the legal fields and one button; after it, only the PDF button @real", async ({ page }) => {
    await page.goto("/de/kuendigen");
    const buttons = async () => (await page.locator("button:visible").allInnerTexts()).map((label) => label.trim());
    const links = () => page.locator("a:visible");
    expect(await buttons()).toEqual(["Jetzt kündigen"]);
    await expect(links()).toHaveCount(1);
    await expect(links().first()).toHaveAttribute("href", "/de");
    await expect(page.getByRole("radio")).toHaveCount(4);
    await expect(page.getByRole("radio", { name: "Ordentliche Kündigung", exact: true })).toBeChecked();
    await expect(page.getByRole("radio", { name: "zum nächstmöglichen Zeitpunkt", exact: true })).toBeChecked();
    await expect(page.getByLabel("Welcher Vertrag?")).toHaveValue("pro-monthly");
    await expect(page.locator("main input:not([type=radio]), main textarea, main select")).toHaveCount(4);
    await expect(page.locator("footer")).toHaveCount(0);
    await page.getByRole("radio", { name: "Außerordentliche Kündigung", exact: true }).check();
    await expect(page.getByLabel("Grund der außerordentlichen Kündigung")).toBeVisible();
    await page.getByRole("radio", { name: "Ordentliche Kündigung", exact: true }).check();

    const typed = uniqueName("cx-nobody");
    await cancel(page, { name: "Nobody", account: typed.email, confirmation: typed.email });
    expect(await buttons()).toEqual(["Als PDF speichern"]);
    await expect(links()).toHaveCount(1);
  });

  test("matched and unmatched cancellations look the same from outside; only the account learns the date @real", async ({ page }) => {
    const pro = await subscriber("cx-match");
    const typedMatched = uniqueName("cx-typed-a").email;
    const matched = await cancel(page, { name: "Ben Pro", account: pro.email, confirmation: typedMatched });
    const stranger = uniqueName("cx-unknown");
    const typedUnmatched = uniqueName("cx-typed-b").email;
    const unmatched = await cancel(page, { name: "Ben Pro", account: stranger.email, confirmation: typedUnmatched });

    expect(Object.keys(matched.body).sort()).toEqual(["mailed", "receivedAt"]);
    expect(Object.keys(unmatched.body).sort()).toEqual(["mailed", "receivedAt"]);
    const strip = (text: string) => text.replaceAll(/\d{2}\.\d{2}\.\d{4}/g, "D").replaceAll(/\d{2}:\d{2}/g, "T").replaceAll(typedMatched, "E").replaceAll(typedUnmatched, "E");
    expect(strip(matched.text)).toBe(strip(unmatched.text));

    // The matched subscription ends at the period end (at the mock), and the entitlement says so.
    await expect.poll(async () => (await stripeCalls(pro.subscription)).filter((call) => call.method === "POST").length).toBe(1);
    expect((await stripeCalls(pro.subscription))[0]?.body).toEqual({ cancel_at_period_end: "true" });
    const { data } = await service().from("entitlements").select("cancel_at_period_end, cancel_at").eq("stripe_subscription_id", pro.subscription).single();
    expect(data).toEqual({ cancel_at_period_end: true, cancel_at: null });

    // Only the account's own address gets the end date.
    const confirmations = await readCapturedMail({ tag: "cancellation-confirmation", to: pro.email });
    expect(confirmations).toHaveLength(1);
    expect(confirmations[0]?.text).toContain(`Linkyo Pro endet am ${longDate(pro.periodEnd)}.`);
    for (const typed of [typedMatched, typedUnmatched]) {
      expect(await readCapturedMail({ to: typed, tag: "cancellation-confirmation" })).toHaveLength(0);
      const receipts = await readCapturedMail({ to: typed, tag: "cancellation-receipt" });
      expect(receipts).toHaveLength(1);
      expect(receipts[0]?.text).not.toContain(longDate(pro.periodEnd));
    }
    expect(await readCapturedMail({ to: stranger.email })).toHaveLength(0);
  });

  test("a cancellation for a date two months ahead ends that billing period; an extraordinary one calls no Stripe @real", async ({ page }) => {
    const later = await subscriber("cx-later");
    const wanted = new Date(later.periodEnd.getTime() + 60 * 24 * 3600 * 1000);
    const wantedDay = new Intl.DateTimeFormat("en-CA", { timeZone: BERLIN }).format(wanted);
    const done = await cancel(page, { name: "Lea Later", account: later.email, confirmation: later.email, date: wantedDay });
    expect(done.text).toContain(`in den der ${day(wanted)} fällt`);
    await expect.poll(async () => (await stripeCalls(later.subscription)).filter((call) => call.method === "POST").length).toBe(1);
    // The app first reads the subscription (its period end and billing anchor), then schedules the end.
    const body = (await stripeCalls(later.subscription)).find((call) => call.method === "POST")?.body ?? {};
    expect(body.proration_behavior).toBe("none");
    expect(Number(body.cancel_at) * 1000).toBeGreaterThan(wanted.getTime() - 24 * 3600 * 1000);
    const { data } = await service().from("entitlements").select("cancel_at, cancel_at_period_end").eq("stripe_subscription_id", later.subscription).single();
    expect(data?.cancel_at_period_end).toBe(false);
    expect(new Date(data?.cancel_at ?? 0).getTime()).toBe(Number(body.cancel_at) * 1000);
    // One e-mail when the confirmation address is the account's own.
    expect(await readCapturedMail({ to: later.email })).toHaveLength(1);

    const urgent = await subscriber("cx-urgent");
    const extraordinary = await cancel(page, { kind: "extraordinary", reason: "Der Dienst war zwei Wochen nicht erreichbar.", name: "Uwe Urgent", account: urgent.email, confirmation: urgent.email });
    expect(extraordinary.text).toContain("außerordentliche Kündigung mit sofortiger Wirkung");
    expect(await stripeCalls(urgent.subscription)).toEqual([]);
    const { data: kept } = await service().from("entitlements").select("status, cancel_at_period_end").eq("stripe_subscription_id", urgent.subscription).single();
    expect(kept).toEqual({ status: "active", cancel_at_period_end: false });
  });

  test("the 11th withdrawal in an hour from one address is still stored and receipted on screen, without an e-mail @real", async ({ page, request, ip }) => {
    for (let index = 0; index < 10; index++) {
      const response = await postWithdrawal(request, ip, uniqueName("wd-flood").email);
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({ mailed: true });
    }
    const last = uniqueName("wd-eleventh").email;
    const text = await withdraw(page, { name: "Flood Test", contract: "Linkyo Pro", email: last });
    expect(text).toMatch(/eingegangen am \d{2}\.\d{2}\.\d{4} um \d{2}:\d{2} Uhr/);
    expect(text).toContain("Die Bestätigung per E-Mail schicken wir, sobald wir die Anfrage geprüft haben.");
    expect(await readCapturedMail({ to: last })).toHaveLength(0);
    const { data } = await service().from("withdrawals").select("suspect, receipt_sent_at").eq("email", last).single();
    expect(data).toEqual({ suspect: true, receipt_sent_at: null });
  });

  test("the contract links are on every page and in Settings @real", async ({ page }) => {
    for (const path of ["/de", "/de/templates", "/de/signup", "/de/service", "/de/impressum"]) {
      await page.goto(path);
      await expect(page.getByRole("link", { name: "Vertrag widerrufen" }).first(), path).toHaveAttribute("href", "/de/widerruf");
      await expect(page.getByRole("link", { name: "Verträge hier kündigen" }).first(), path).toHaveAttribute("href", "/de/kuendigen");
    }
    const { username, email } = uniqueName("cx-settings");
    await createRealAccount({ email, username, locale: "de", onboarded: true });
    await signIn(page, email, "/de/app/settings");
    await page.waitForURL(/\/de\/app\/settings$/);
    const group = page.getByRole("region", { name: "Verträge und Rechtliches" });
    await expect(group.getByRole("link", { name: "Vertrag widerrufen" })).toHaveAttribute("href", "/de/widerruf");
    await expect(group.getByRole("link", { name: "Verträge hier kündigen" })).toHaveAttribute("href", "/de/kuendigen");
    await expect(group.getByRole("link", { name: "Impressum" })).toHaveAttribute("href", "/de/impressum");
    await expect(page.getByRole("link", { name: `Seitenadresse linkyo.app/${username}` })).toBeVisible();
  });

  test("axe: withdrawal and cancellation (de/en/ar, light/dark) @real", async ({ page }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      for (const locale of ["de", "en", "ar"]) {
        for (const path of ["/widerruf", "/kuendigen"]) {
          await page.goto(`/${locale}${path}`);
          await page.waitForLoadState("load");
          const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
          expect(
            results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ") ?? ""}`),
            `/${locale}${path} (${scheme})`,
          ).toEqual([]);
        }
      }
    }
    // The second step and the receipt, too.
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await withdraw(page, { name: "Axe Test", contract: "Linkyo Pro", email: uniqueName("wd-axe").email });
    expect((await new AxeBuilder({ page }).withTags(WCAG).analyze()).violations.map((v) => v.id)).toEqual([]);
  });
});
