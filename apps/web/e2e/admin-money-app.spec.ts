import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import { createClient } from "@supabase/supabase-js";

import type { Database, Json } from "../src/lib/supabase/database.types";

import { addTeamMember, createRealAccount, expect, readCapturedMail, realEnabled, seedPage, service, signIn, test, uniqueName, type RealAccount } from "./real";

/**
 * Team money and permissions (Stage 1 WP1.1) on real accounts, with the local Stripe mock:
 * - a refund goes to Stripe with an idempotency key, and the console says "refunded" only once it is
 *   on record (a refusal changes nothing); the customer gets the e-mail;
 * - cancelling sets cancel_at_period_end at Stripe and on record, with the confirmation e-mail;
 *   taking it back clears it;
 * - the Subscription tab names where Pro comes from (Stripe, Team or Reward), and the plan and trial
 *   buttons by hand are there only without a Stripe subscription;
 * - an editor opens the orders and an order without seeing any customer e-mail address, and the
 *   database no longer lets the browser write "refunded" on its own;
 * - an admin's CSV export is logged, and a cell that a spreadsheet would run stays text.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const MOCK_STRIPE = `http://127.0.0.1:${process.env.MOCK_STRIPE_PORT ?? "54398"}`;
const DAY = 24 * 3600 * 1000;

type Role = Database["public"]["Enums"]["team_role"];
interface StripeCall {
  method: string;
  path: string;
  body: Record<string, unknown>;
  idempotencyKey: string | null;
}

/** A database client acting as this account (row-level security and team functions as that person). */
async function clientAs(email: string) {
  const { data, error } = await service().auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(error.message);
  const client = createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const verified = await client.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
  if (verified.error) throw new Error(verified.error.message);
  return client;
}

async function customer(prefix: string, displayName: string): Promise<RealAccount> {
  const { username, email } = uniqueName(prefix);
  return createRealAccount({ email, username, locale: "de", onboarded: true, page: seedPage(username, "de", { displayName }) });
}

async function teamMember(prefix: string, role: Role): Promise<RealAccount> {
  const { username, email } = uniqueName(prefix);
  const account = await createRealAccount({ email, username, locale: "de", onboarded: true });
  await addTeamMember(email, role);
  return account;
}

/** Stripe Pro as the webhook records it (subscription and one paid invoice), and the same subscription at the mock. */
async function stripePro(account: RealAccount) {
  const db = service();
  const tag = randomUUID().replaceAll("-", "").slice(0, 16);
  const subscription = `sub_e2e_${tag}`;
  const invoice = `in_e2e_${tag}`;
  const paymentIntent = `pi_e2e_${tag}`;
  const periodEnd = new Date(Date.now() + 20 * DAY);
  periodEnd.setUTCMilliseconds(0);
  expect((await db.rpc("upsert_pro_subscription", { account: account.id, customer: "cus_e2e", subscription, next: "active", period_end: periodEnd.toISOString(), cancel_at_end: false })).error).toBeNull();
  expect((await db.rpc("record_invoice", { id: invoice, account: account.id, subscription, amount: 800, state: "paid", payment_intent: paymentIntent })).error).toBeNull();
  await fetch(`${MOCK_STRIPE}/__subscriptions/${subscription}`, {
    method: "POST",
    body: JSON.stringify({ customer: "cus_e2e", metadata: { profile_id: account.id }, current_period_end: periodEnd.getTime() / 1000 }),
  });
  return { subscription, invoice, paymentIntent, periodEnd };
}

async function stripeCalls(query: string): Promise<StripeCall[]> {
  const response = await fetch(`${MOCK_STRIPE}/__requests?${query}`);
  return ((await response.json()) as { requests: StripeCall[] }).requests;
}
const refundsFor = async (paymentIntent: string) => (await stripeCalls(`method=POST&path=${encodeURIComponent("/v1/refunds")}`)).filter((call) => call.body.payment_intent === paymentIntent);
const updatesOf = (subscription: string) => stripeCalls(`method=POST&path=${encodeURIComponent(`/v1/subscriptions/${subscription}`)}`);

/** A paid, confirmed and briefed page-service order (as the webhook and the briefing route write it). */
async function seededOrder(account: RealAccount) {
  const db = service();
  const session = `cs_e2e_${randomUUID().replaceAll("-", "")}`;
  await db.rpc("record_checkout_intent", { session, account: account.id, product: "service-start", locale: "de" });
  await db.rpc("record_checkout_consent", {
    session,
    account: account.id,
    early: true,
    consent_text: "Bitte sofort beginnen.",
    start_after: new Date().toISOString(),
    promised_due: new Date(Date.now() + 2 * DAY).toISOString(),
  });
  const made = (await db.rpc("record_service_order", { session, payment_intent: `pi_${session}`, amount: 2499, email: account.email, name: "Mila Berg" })).data as { id: string; number: string };
  const briefing = { links: ["https://instagram.com/mila.berg"], photos: [], wishes: "Bitte schlicht und hell.", pageLocale: "de" };
  await db.rpc("set_order_briefing", { target: made.id, account: account.id, briefing: briefing as unknown as Json, due: new Date(Date.now() + 2 * DAY).toISOString() });
  await db.rpc("mark_confirmation_sent", { target: made.id });
  return made;
}

test.describe("team money through Stripe @real", () => {
  test.skip(!realEnabled, "Needs the local Supabase stack (E2E_SUPABASE=1).");

  test("a refund goes to Stripe once, with an idempotency key, and reads 'refunded' only once recorded @real", async ({ page }) => {
    test.setTimeout(120_000);
    const owner = await customer("money-rf", "Lena Stripe");
    const pro = await stripePro(owner);
    const admin = await teamMember("money-rf-admin", "admin");

    await signIn(page, admin.email, `/de/admin/customers/${owner.id}`);
    await expect(page.getByRole("heading", { level: 1, name: "Lena Stripe" })).toBeVisible();
    await page.getByRole("radio", { name: "Abo" }).click();
    await expect(page.locator("[data-plan-source]")).toHaveText("Stripe (bezahlt)");
    // A Stripe subscription changes only through Stripe: no plan or trial by hand.
    await expect(page.getByRole("button", { name: "Plan ändern" })).toHaveCount(0);
    await page.getByRole("button", { name: "Aktionen" }).click();
    await expect(page.getByRole("menuitem", { name: "Testphase um 14 Tage verlängern" })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: "Zum Ende des bezahlten Monats kündigen" })).toBeVisible();
    await page.keyboard.press("Escape");

    // Stripe refuses once: nothing is refunded, nothing says so.
    await fetch(`${MOCK_STRIPE}/__refund_failures/${pro.paymentIntent}`, { method: "POST", body: JSON.stringify({ count: 1 }) });
    const row = page.getByRole("row").filter({ hasText: pro.invoice });
    await row.getByRole("button", { name: "Erstatten" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Diese Rechnung über Stripe erstatten?");
    await expect(dialog).toContainText("8,00");
    await dialog.getByRole("button", { name: "Erstatten" }).click();
    await expect(page.getByText("Stripe hat abgelehnt oder war nicht erreichbar. Es hat sich nichts geändert.").first()).toBeVisible();
    await expect(row.getByText("Bezahlt", { exact: true })).toBeVisible();
    expect((await service().from("invoices").select("status").eq("id", pro.invoice).single()).data?.status).toBe("paid");
    expect(await readCapturedMail({ to: owner.email, tag: "refund-issued" })).toHaveLength(0);
    // Nor does the activity log: a refusal is no refund.
    expect((await service().from("audit_log").select("id").eq("target_id", owner.id).eq("action", "customer.refund")).data).toEqual([]);

    // The second try goes through: refunded at Stripe with the invoice's own key, on record, mailed.
    await row.getByRole("button", { name: "Erstatten" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Erstatten" }).click();
    await expect(page.getByText("Rechnung erstattet").first()).toBeVisible();
    await expect(row.getByText("Erstattet", { exact: true })).toBeVisible();
    const refunds = await refundsFor(pro.paymentIntent);
    expect(refunds).toHaveLength(2);
    expect(refunds.map((call) => call.idempotencyKey)).toEqual([`linkyo-invoice-${pro.invoice}-refund`, `linkyo-invoice-${pro.invoice}-refund`]);
    expect(refunds[1]?.body).toMatchObject({ payment_intent: pro.paymentIntent, amount: "800" });
    expect((await service().from("invoices").select("status").eq("id", pro.invoice).single()).data?.status).toBe("refunded");
    // A month refunded out of goodwill: Pro goes on.
    expect((await service().from("entitlements").select("status").eq("stripe_subscription_id", pro.subscription).single()).data?.status).toBe("active");
    await expect.poll(async () => (await readCapturedMail({ to: owner.email, tag: "refund-issued" })).length).toBe(1);
    expect((await readCapturedMail({ to: owner.email, tag: "refund-issued" }))[0]?.text).toContain("8,00");
    // The activity log says it once, with who did it: one refund, one entry.
    const { data: log } = await service().from("audit_log").select("actor, action, details").eq("target_id", owner.id).eq("action", "customer.refund");
    expect(log).toEqual([{ actor: admin.email, action: "customer.refund", details: { invoice: pro.invoice, amountCents: 800 } }]);
  });

  test("cancelling sets cancel_at_period_end at Stripe and on record, with the e-mail; taking it back clears it @real", async ({ page }) => {
    test.setTimeout(120_000);
    const owner = await customer("money-cx", "Jonas Kündigt");
    const pro = await stripePro(owner);
    const admin = await teamMember("money-cx-admin", "admin");

    await signIn(page, admin.email, `/de/admin/customers/${owner.id}`);
    await page.getByRole("radio", { name: "Abo" }).click();
    await page.getByRole("button", { name: "Aktionen" }).click();
    await page.getByRole("menuitem", { name: "Zum Ende des bezahlten Monats kündigen" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Zum Ende des bezahlten Monats kündigen" }).click();
    await expect(page.getByText(/^Pro endet am /).first()).toBeVisible();
    await expect(page.locator("[data-ends-at]")).toBeVisible();

    const updates = await updatesOf(pro.subscription);
    expect(updates).toHaveLength(1);
    expect(updates[0]?.body).toMatchObject({ cancel_at_period_end: "true" });
    const stored = (await service().from("entitlements").select("cancel_at_period_end, status").eq("stripe_subscription_id", pro.subscription).single()).data;
    expect(stored).toEqual({ cancel_at_period_end: true, status: "active" });
    await expect.poll(async () => (await readCapturedMail({ to: owner.email, tag: "cancellation-confirmation" })).length).toBe(1);
    expect((await readCapturedMail({ to: owner.email, tag: "cancellation-confirmation" }))[0]?.text).toContain("Linkyo Pro endet am");

    // Taken back: Stripe clears it, the record follows, Pro renews.
    await page.getByRole("button", { name: "Aktionen" }).click();
    await page.getByRole("menuitem", { name: "Kündigung zurücknehmen" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Kündigung zurücknehmen" }).click();
    await expect(page.getByText("Abo wieder aktiv").first()).toBeVisible();
    await expect(page.locator("[data-ends-at]")).toHaveCount(0);
    expect((await updatesOf(pro.subscription)).at(-1)?.body).toMatchObject({ cancel_at_period_end: "false" });
    expect((await service().from("entitlements").select("cancel_at_period_end").eq("stripe_subscription_id", pro.subscription).single()).data?.cancel_at_period_end).toBe(false);
    const actions = (await service().from("audit_log").select("action").eq("target_id", owner.id).order("id")).data?.map((entry) => entry.action);
    expect(actions).toEqual(["customer.cancel", "customer.resume"]);
  });

  test("the console never takes back a customer's own cancellation; that is decided under contracts @real", async ({ page }) => {
    test.setTimeout(120_000);
    const owner = await customer("money-own", "Ina Kündigt Selbst");
    const pro = await stripePro(owner);
    const db = service();
    // The customer cancelled through /kuendigen: Stripe ends Pro with the period, the cancellation is scheduled.
    expect((await db.rpc("upsert_pro_subscription", { account: owner.id, customer: "cus_e2e", subscription: pro.subscription, next: "active", period_end: pro.periodEnd.toISOString(), cancel_at_end: true })).error).toBeNull();
    const entitlement = (await db.from("entitlements").select("id").eq("stripe_subscription_id", pro.subscription).single()).data;
    expect(
      (
        await db.from("cancellations").insert({
          kind: "ordinary",
          name: "Ina Kündigt Selbst",
          account_email: owner.email,
          contract: "pro-monthly",
          confirmation_email: owner.email,
          profile_id: owner.id,
          entitlement_id: entitlement?.id ?? null,
          matched: true,
          decision: "scheduled",
          effective_at: pro.periodEnd.toISOString(),
        })
      ).error,
    ).toBeNull();
    const admin = await teamMember("money-own-admin", "admin");

    await signIn(page, admin.email, `/de/admin/customers/${owner.id}`);
    await page.getByRole("radio", { name: "Abo" }).click();
    await expect(page.locator("[data-ends-at]")).toBeVisible();
    // The console does not offer it ...
    const actions = page.getByRole("button", { name: "Aktionen" });
    if ((await actions.count()) > 0) {
      await actions.click();
      await expect(page.getByRole("menuitem", { name: "Kündigung zurücknehmen" })).toHaveCount(0);
      await page.keyboard.press("Escape");
    }
    // ... and the route refuses it, before Stripe is asked.
    const asAdmin = await clientAs(admin.email);
    const token = (await asAdmin.auth.getSession()).data.session?.access_token ?? "";
    expect(token).not.toBe("");
    const answer = await page.request.post(`/api/admin/customers/${owner.id}/billing/resume`, { headers: { Authorization: `Bearer ${token}` }, data: {} });
    expect(answer.status()).toBe(409);
    expect(await answer.json()).toEqual({ ok: false, error: "customerCancelled" });
    expect(await updatesOf(pro.subscription)).toHaveLength(0);
    expect((await db.from("entitlements").select("cancel_at_period_end").eq("stripe_subscription_id", pro.subscription).single()).data?.cancel_at_period_end).toBe(true);
    expect((await db.from("audit_log").select("id").eq("target_id", owner.id).eq("action", "customer.resume")).data).toEqual([]);
  });

  test("the Subscription tab names the source; plan and trial by hand only without Stripe @real", async ({ page }) => {
    const team = await customer("money-team", "Tara Team");
    const reward = await customer("money-reward", "Rico Reward");
    const db = service();
    expect((await db.from("subscriptions").upsert({ profile_id: team.id, plan: "pro", status: "active", started_at: new Date(Date.now() - 3 * DAY).toISOString() })).error).toBeNull();
    expect((await db.from("rewards").insert({ profile_id: reward.id, kind: "pro_for_life", source: "team" })).error).toBeNull();
    const admin = await teamMember("money-src-admin", "admin");

    await signIn(page, admin.email, `/de/admin/customers/${team.id}`);
    await page.getByRole("radio", { name: "Abo" }).click();
    await expect(page.locator("[data-plan-source]")).toHaveText("Team (kostenlos)");
    // The team's Pro brings no money.
    await expect(page.getByText("0,00 €").first()).toBeVisible();
    await page.getByRole("button", { name: "Plan ändern" }).click();
    await expect(page.getByRole("menuitem", { name: "Pro geben (Team)" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Aktionen" }).click();
    await expect(page.getByRole("menuitem", { name: "Testphase um 14 Tage verlängern" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Abo kündigen" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto(`/de/admin/customers/${reward.id}`);
    await page.getByRole("radio", { name: "Abo" }).click();
    await expect(page.locator("[data-plan-source]")).toHaveText("Belohnung (Pro für immer)");
  });

  test("an editor opens the orders and an order, but sees no customer e-mail anywhere @real", async ({ page, request }) => {
    test.setTimeout(120_000);
    const owner = await customer("money-ord", "Mila Berg");
    const order = await seededOrder(owner);
    const editor = await teamMember("money-ed", "editor");

    await signIn(page, editor.email, "/de/admin/orders");
    await page.waitForURL(/\/de\/admin\/orders$/);
    const main = page.locator("main");
    // The queue is a table on wide screens and cards on phones: the visible one.
    await expect(main.getByText(`@${owner.username}`).locator("visible=true").first()).toBeVisible();
    await expect(main).not.toContainText(owner.email);
    await page.goto(`/de/admin/orders/${order.id}`);
    await expect(main.getByText(order.number).locator("visible=true").first()).toBeVisible();
    await expect(main.getByText(`@${owner.username}`).locator("visible=true").first()).toBeVisible();
    await expect(main).not.toContainText(owner.email);
    // No way to the customers: not in the menu, not by address, no export.
    await expect(page.getByRole("link", { name: "Kunden", exact: true })).toHaveCount(0);
    await page.goto(`/de/admin/customers/${owner.id}`);
    await expect(page.getByRole("heading", { level: 1, name: "Kunden sind für deine Rolle nicht sichtbar" })).toBeVisible();
    await expect(main).not.toContainText(owner.email);
    await page.goto("/de/admin/customers");
    await expect(page.getByRole("heading", { level: 1, name: "Kunden sind für deine Rolle nicht sichtbar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "CSV exportieren" })).toHaveCount(0);

    // Nor through the database or our server.
    const asEditor = await clientAs(editor.email);
    const queue = (await asEditor.rpc("admin_orders", { scope: "all" })).data as { id: string; customer: { email: string | null } }[];
    expect(queue.find((entry) => entry.id === order.id)?.customer.email).toBeNull();
    expect((await asEditor.from("orders").select("customer_email").eq("id", order.id)).error?.code).toBe("42501");
    const customers = (await asEditor.rpc("admin_customers")).data as { username: string; email: string | null }[];
    expect(customers.find((entry) => entry.username === owner.username)?.email).toBeNull();
    expect((await asEditor.rpc("admin_customers_exported", { row_count: 1 })).error?.message).toContain("linkyo:forbidden");
    const token = (await asEditor.auth.getSession()).data.session?.access_token ?? "";
    const refused = await request.post(`/api/admin/customers/${owner.id}/billing/cancel`, { headers: { Authorization: `Bearer ${token}` } });
    expect(refused.status()).toBe(403);
  });

  test("nobody marks an invoice refunded without Stripe @real", async () => {
    const owner = await customer("money-db", "Dora Datenbank");
    const pro = await stripePro(owner);
    const owners = await teamMember("money-db-owner", "owner");
    const asOwner = await clientAs(owners.email);
    const direct = await asOwner.rpc("admin_refund_invoice", { invoice: pro.invoice });
    expect(direct.error).not.toBeNull();
    expect((await service().from("invoices").select("status").eq("id", pro.invoice).single()).data?.status).toBe("paid");
  });

  test("an admin's CSV export is logged, and a formula stays text @real", async ({ page }) => {
    const owner = await customer("money-csv", "=SUM(1,2)");
    const admin = await teamMember("money-csv-admin", "admin");
    await signIn(page, admin.email, "/de/admin/customers");
    await page.waitForURL(/\/de\/admin\/customers$/);
    await page.getByLabel("Suchen").fill(owner.username);
    await expect(page.getByRole("status")).toHaveText("1 Kunde");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "CSV exportieren" }).click();
    const file = await (await download).path();
    const csv = await readFile(file, "utf8");
    expect(csv.split("\n")).toHaveLength(2);
    expect(csv).toContain(`"'=SUM(1,2)","${owner.email}","${owner.username}"`);
    expect(csv.split("\n")[0]).not.toContain("views_30d");
    const { data: log } = await service().from("audit_log").select("actor, target, details").eq("action", "customer.export").eq("actor", admin.email);
    expect(log).toEqual([{ actor: admin.email, target: "1", details: { rows: 1 } }]);
  });
});
