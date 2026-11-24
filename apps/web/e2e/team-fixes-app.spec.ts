import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import { createClient } from "@supabase/supabase-js";

import type { Database, Json } from "../src/lib/supabase/database.types";

import { addTeamMember, createRealAccount, expect, readCapturedMail, realEnabled, seedMedia, seedPage, service, signIn, test, uniqueName, type RealAccount } from "./real";

/**
 * The team console and the proposal review after the review of stage S4: what happens when a step
 * fails or two people act on the same request. Each test is the scenario of one finding:
 * - an accepted withdrawal whose refund failed stays open and can be finished (once);
 * - one order is withdrawn once, however many declarations name it;
 * - "refund" on an order waits while a withdrawal is open, and names its member;
 * - an ordinary cancellation that was held can be carried out, and a decided one stays decided;
 * - a proposal that was used can still be changed; an ended order promises nothing;
 * - a read that failed is not shown as an empty list; a saved draft is not replaced without asking;
 * - a proposal's pictures belong to the customer, and a draft's story pictures stay private.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const MOCK_STRIPE = `http://127.0.0.1:${process.env.MOCK_STRIPE_PORT ?? "54398"}`;
const DAY = 24 * 3600 * 1000;

type Role = Database["public"]["Enums"]["team_role"];

/** A database client acting as this account (row-level security and team functions as that person). */
async function clientAs(email: string) {
  const { data, error } = await service().auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(error.message);
  const client = createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const verified = await client.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
  if (verified.error) throw new Error(verified.error.message);
  return client;
}

async function customer(prefix: string): Promise<RealAccount> {
  const { username, email } = uniqueName(prefix);
  return createRealAccount({ email, username, locale: "de", onboarded: true, page: seedPage(username, "de", { displayName: "Mila Berg", bio: "Sängerin aus Köln" }) });
}

async function teamMember(prefix: string, role: Role): Promise<RealAccount> {
  const { username, email } = uniqueName(prefix);
  const account = await createRealAccount({ email, username, locale: "de", onboarded: true });
  await addTeamMember(email, role);
  return account;
}

/** A paid, confirmed and briefed order of this account (made in the database, as the webhook and the briefing route would). */
async function seededOrder(account: RealAccount, product: "service-start" | "service-premium" = "service-start") {
  const db = service();
  const session = `cs_e2e_${randomUUID().replaceAll("-", "")}`;
  await db.rpc("record_checkout_intent", { session, account: account.id, product, locale: "de" });
  await db.rpc("record_checkout_consent", {
    session,
    account: account.id,
    early: true,
    consent_text: "Bitte sofort beginnen.",
    start_after: new Date().toISOString(),
    promised_due: new Date(Date.now() + 2 * DAY).toISOString(),
  });
  const amount = product === "service-premium" ? 7999 : 2499;
  const made = (await db.rpc("record_service_order", { session, payment_intent: `pi_${session}`, amount, email: account.email })).data as { id: string; number: string };
  const briefing = { links: ["https://instagram.com/mila.berg"], photos: [], wishes: "Bitte schlicht und hell.", pageLocale: "de" };
  const briefed = await db.rpc("set_order_briefing", { target: made.id, account: account.id, briefing: briefing as unknown as Json, due: new Date(Date.now() + 2 * DAY).toISOString() });
  expect(briefed.data).toBe("ok");
  await db.rpc("mark_confirmation_sent", { target: made.id });
  return { ...made, paymentIntent: `pi_${session}`, amount };
}

/** The customer's current page saved as the round's draft; `deliver` hands it over. */
async function proposalFor(member: RealAccount, owner: RealAccount, orderId: string, deliver: boolean): Promise<string> {
  const as = await clientAs(member.email);
  const site = (await service().from("sites").select("page, theme").eq("profile_id", owner.id).single()).data;
  const saved = await as.rpc("admin_save_proposal", { target: orderId, page: site?.page ?? {}, theme: site?.theme ?? {} });
  expect(saved.error).toBeNull();
  if (deliver) expect((await as.rpc("admin_deliver_proposal", { proposal: saved.data ?? "" })).error).toBeNull();
  return saved.data ?? "";
}

const withdraw = (owner: RealAccount, number: string) => service().rpc("record_withdrawal", { name: "Mila Berg", email: owner.email, contract: number, ip_hash: `e2e-${randomUUID()}` });

async function refundsFor(paymentIntent: string): Promise<{ body: Record<string, unknown> }[]> {
  const response = await fetch(`${MOCK_STRIPE}/__requests?method=POST&path=${encodeURIComponent("/v1/refunds")}`);
  return ((await response.json()) as { requests: { body: Record<string, unknown> }[] }).requests.filter((call) => call.body.payment_intent === paymentIntent);
}

async function subscriptionCalls(subscription: string): Promise<{ method: string; body: Record<string, unknown> }[]> {
  const response = await fetch(`${MOCK_STRIPE}/__requests?prefix=${encodeURIComponent(`/v1/subscriptions/${subscription}`)}`);
  return ((await response.json()) as { requests: { method: string; body: Record<string, unknown> }[] }).requests;
}

const tokenOf = async (email: string) => (await (await clientAs(email)).auth.getSession()).data.session?.access_token ?? "";

test.describe("team console and proposal review: failures and second clicks @real", () => {
  test.skip(!realEnabled, "Needs the local Supabase stack (E2E_SUPABASE=1).");

  test("an accepted withdrawal whose refund failed stays open and is finished once; a second declaration is only filed @real", async ({ page, request }) => {
    test.setTimeout(180_000);
    const owner = await customer("tf-wd");
    const order = await seededOrder(owner);
    const admin = await teamMember("tf-wd-admin", "admin");
    const db = service();
    const first = (await withdraw(owner, order.number)).data as { id: string };
    const second = (await withdraw(owner, order.number)).data as { id: string };

    // "Refund" on the order waits for the decision: it would be booked as the voluntary money-back.
    await signIn(page, admin.email, `/de/admin/orders/${order.id}`);
    await expect(page.locator("[data-withdrawal-lock]")).toBeVisible();
    await expect(page.getByRole("button", { name: "Erstatten" })).toBeDisabled();
    await expect(page.locator("[data-refund-locked]")).toContainText("Für diesen Auftrag wartet ein Widerruf.");
    const token = await tokenOf(admin.email);
    const direct = await request.post(`/api/admin/orders/${order.id}/refund`, { headers: { Authorization: `Bearer ${token}` } });
    expect(direct.status()).toBe(409);
    expect(await refundsFor(order.paymentIntent)).toHaveLength(0);

    // Stripe refuses the refund once (no balance).
    await fetch(`${MOCK_STRIPE}/__refund_failures/${order.paymentIntent}`, { method: "POST", body: JSON.stringify({ count: 1 }) });
    await page.goto("/de/admin/orders?tab=contracts");
    const item = page.locator(`[data-contract-id="${first.id}"]`);
    await item.getByRole("button", { name: "Widerruf annehmen und erstatten" }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByLabel("Erstattungsbetrag").fill("10,00");
    await dialog.getByRole("button", { name: "Widerruf annehmen und erstatten" }).click();
    // Not "handled": the refund is open, its deadline still shows, and it can be finished. Also after a reload.
    await expect(item.locator("[data-refund-open]")).toHaveText("Erstattung offen");
    await page.reload();
    await expect(item.locator("[data-refund-open]")).toBeVisible();
    await expect(item.locator("[data-refund-due]")).toHaveText(/^Erstattung fällig bis /);
    await expect(item.getByText("Erledigt", { exact: true })).toHaveCount(0);
    expect((await db.from("withdrawals").select("decision, handled_at, refund_cents").eq("id", first.id).single()).data).toEqual({ decision: "accepted", handled_at: null, refund_cents: 1000 });
    expect((await db.from("orders").select("status, withdrawal_pending").eq("id", order.id).single()).data).toEqual({ status: "queued", withdrawal_pending: true });
    expect(await readCapturedMail({ to: owner.email, tag: "contract-decision" })).toHaveLength(0);
    // The other declaration cannot be accepted meanwhile.
    const twice = await request.post(`/api/admin/contracts/withdrawal/${second.id}`, { headers: { Authorization: `Bearer ${token}` }, data: { action: "acceptWithdrawal", refundCents: 1000 } });
    expect(twice.status()).toBe(409);

    // Finishing sends the amount on record (no amount field) and ends the order.
    await item.getByRole("button", { name: "Erstattung abschließen" }).click();
    await expect(dialog.getByLabel("Erstattungsbetrag")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Erstattung abschließen" }).click();
    await expect.poll(async () => (await db.from("orders").select("status, withdrawal_pending, refund_kind").eq("id", order.id).single()).data).toEqual({ status: "withdrawn", withdrawal_pending: false, refund_kind: "withdrawal" });
    await expect.poll(async () => (await db.from("withdrawals").select("handled_at").eq("id", first.id).single()).data?.handled_at).not.toBeNull();
    const refunds = await refundsFor(order.paymentIntent);
    expect(refunds.map((call) => call.body.amount)).toEqual(["1000", "1000"]);
    const mails = await readCapturedMail({ to: owner.email, tag: "contract-decision" });
    expect(mails).toHaveLength(1);
    expect(mails[0]?.text).toContain("10,00 € erstattet");

    // Accepting the finished one again (a stale list), or the second declaration: no refund, no e-mail.
    for (const id of [first.id, second.id]) {
      const again = await request.post(`/api/admin/contracts/withdrawal/${id}`, { headers: { Authorization: `Bearer ${token}` }, data: { action: "acceptWithdrawal", refundCents: 1000 } });
      expect(again.status()).toBe(409);
    }
    expect(await refundsFor(order.paymentIntent)).toHaveLength(2);
    expect(await readCapturedMail({ to: owner.email, tag: "contract-decision" })).toHaveLength(1);
    // The second declaration says why and is only filed.
    await page.reload();
    const other = page.locator(`[data-contract-id="${second.id}"]`);
    await expect(other.locator("[data-contract-ended]")).toBeVisible();
    await expect(other.getByRole("button", { name: "Widerruf annehmen und erstatten" })).toHaveCount(0);
    await other.getByRole("button", { name: "Als erledigt markieren" }).click();
    await dialog.getByRole("button", { name: "Als erledigt markieren" }).click();
    await expect.poll(async () => (await db.from("withdrawals").select("handled_at").eq("id", second.id).single()).data?.handled_at).not.toBeNull();
  });

  test("the team's refund names its member in the timeline and the activity log @real", async ({ page }) => {
    const owner = await customer("tf-refund");
    const order = await seededOrder(owner);
    const boss = await teamMember("tf-owner", "owner");
    await signIn(page, boss.email, `/de/admin/orders/${order.id}`);
    await page.getByRole("button", { name: "Erstatten" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Erstatten" }).click();
    await expect(page.locator("header").getByText("Erstattet")).toBeVisible();
    const asked = page.locator('[data-event="refund_requested"]');
    await expect(asked).toContainText("Erstattung angewiesen");
    await expect(asked.locator("[data-event-actor]")).toHaveText(boss.email);
    const log = await service().from("audit_log").select("actor, target").eq("action", "order.refund").eq("target", order.number);
    expect(log.data).toEqual([{ actor: boss.email, target: order.number }]);
    await page.goto("/de/admin/activity");
    await expect(page.getByText(`für ${order.number} eine Erstattung angewiesen`)).toBeVisible();
  });

  test("an ordinary cancellation that was held is carried out; a decided one stays decided @real", async ({ page, request }) => {
    const { username, email } = uniqueName("tf-cx");
    const pro = await createRealAccount({ email, username, locale: "de", onboarded: true });
    const subscription = `sub_e2e_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
    const periodEnd = new Date(Math.floor((Date.now() + 20 * DAY) / 1000) * 1000);
    const db = service();
    const entitlement = await db
      .from("entitlements")
      .insert({ profile_id: pro.id, product: "pro", source: "stripe", status: "active", current_period_end: periodEnd.toISOString(), stripe_subscription_id: subscription, stripe_customer_id: "cus_e2e" })
      .select("id")
      .single();
    await fetch(`${MOCK_STRIPE}/__subscriptions/${subscription}`, { method: "POST", body: JSON.stringify({ current_period_end: periodEnd.getTime() / 1000, customer: "cus_e2e", metadata: { profile_id: pro.id } }) });
    // Held when it arrived (suspect): stored, no Stripe call, no e-mail.
    const held = await db
      .from("cancellations")
      .insert({ kind: "ordinary", name: "Ben Pro", account_email: email, contract: "pro-monthly", confirmation_email: email, profile_id: pro.id, entitlement_id: entitlement.data?.id ?? null, matched: true, suspect: true })
      .select("id")
      .single();
    const id = held.data?.id ?? "";
    const admin = await teamMember("tf-cx-admin", "admin");

    await signIn(page, admin.email, "/de/admin/orders");
    await page.waitForURL(/\/de\/admin\/orders$/);
    await page.goto("/de/admin/orders?tab=contracts");
    const item = page.locator(`[data-contract-id="${id}"]`);
    await item.getByRole("button", { name: "Kündigung ausführen" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Kündigung ausführen" }).click();
    await expect.poll(async () => (await subscriptionCalls(subscription)).filter((call) => call.method === "POST").map((call) => call.body)).toEqual([{ cancel_at_period_end: "true" }]);
    await expect.poll(async () => (await db.from("cancellations").select("decision").eq("id", id).single()).data?.decision).toBe("scheduled");
    expect((await db.from("entitlements").select("cancel_at_period_end").eq("stripe_subscription_id", subscription).single()).data?.cancel_at_period_end).toBe(true);
    const mails = await readCapturedMail({ to: email, tag: "cancellation-confirmation" });
    expect(mails).toHaveLength(1);
    expect(mails[0]?.text).toContain("Linkyo Pro endet am");
    await expect(item.getByRole("button", { name: "Kündigung zurücknehmen" })).toBeVisible();

    // A second member's stale list: scheduling again, ending or rejecting does nothing and mails nothing.
    const token = await tokenOf(admin.email);
    for (const action of ["schedule", "endNow", "rejectCancellation"]) {
      const again = await request.post(`/api/admin/contracts/cancellation/${id}`, { headers: { Authorization: `Bearer ${token}` }, data: { action, note: "aus einer alten Liste" } });
      expect(again.status(), action).toBe(409);
    }
    expect((await subscriptionCalls(subscription)).filter((call) => call.method !== "GET")).toHaveLength(1);
    expect(await readCapturedMail({ to: email })).toHaveLength(1);
    expect((await db.from("entitlements").select("status").eq("stripe_subscription_id", subscription).single()).data?.status).toBe("active");
  });

  test("a proposal that was used can still be changed; while changes are made the screen says so; an ended order promises nothing @real", async ({ page }) => {
    test.setTimeout(120_000);
    const owner = await customer("tf-apply");
    const order = await seededOrder(owner);
    const editor = await teamMember("tf-apply-ed", "admin");
    const proposal = await proposalFor(editor, owner, order.id, true);

    await signIn(page, owner.email, `/de/app/proposals/${proposal}`);
    await page.getByRole("button", { name: "Diesen Vorschlag übernehmen" }).click();
    await page.waitForURL(/\/de\/app\/editor$/);
    await expect.poll(async () => (await service().from("site_proposals").select("status").eq("id", proposal).single()).data?.status).toBe("applied");

    // Day 3: one change after all. The paid round is still there.
    await page.goto(`/de/app/proposals/${proposal}`);
    await expect(page.locator("[data-revise-left]")).toHaveText(/Noch 1 Änderungsrunde/);
    const revise = page.getByRole("button", { name: "Änderungen anfragen" });
    await expect(revise).toBeEnabled();
    await revise.click();
    await page.getByRole("dialog").getByLabel("Was sollen wir ändern?").fill("Bitte die Tour-Daten nach oben.");
    await page.getByRole("button", { name: "Änderungen senden" }).click();
    await expect(page.locator("[data-revise-sent]")).toContainText("Danke! Wir liefern die Änderungen bis");
    expect((await service().from("orders").select("status").eq("id", order.id).single()).data?.status).toBe("revision_requested");

    // Coming back while the team works: not a dead button under "rounds left", but when the changes arrive.
    await page.reload();
    await expect(page.locator('[data-revise-state="busy"]')).toContainText("Wir arbeiten an deinen Änderungen und liefern sie bis");
    await expect(revise).toBeDisabled();

    // The order is refunded: nothing to use, nothing promised.
    await service().rpc("record_refund", { payment_intent: order.paymentIntent, kind: "voluntary", amount: order.amount });
    await page.reload();
    await expect(page.locator('[data-revise-state="ended"]')).toHaveText("Dieser Auftrag ist beendet. Der Vorschlag lässt sich nicht mehr übernehmen oder ändern.");
    await expect(page.getByRole("button", { name: "Diesen Vorschlag übernehmen" })).toHaveCount(0);
    await expect(page.locator("[data-revise-left]")).toHaveCount(0);
    await expect(revise).toBeDisabled();
  });

  test("a refused change request says so and shows the new state instead of 'try again' @real", async ({ page }) => {
    const owner = await customer("tf-refused");
    const order = await seededOrder(owner);
    const editor = await teamMember("tf-refused-ed", "admin");
    const proposal = await proposalFor(editor, owner, order.id, true);
    await signIn(page, owner.email, `/de/app/proposals/${proposal}`);
    await page.getByRole("button", { name: "Änderungen anfragen" }).click();
    await page.getByRole("dialog").getByLabel("Was sollen wir ändern?").fill("Bitte heller.");
    // Meanwhile the customer's withdrawal arrives (another tab): the request can no longer succeed.
    await withdraw(owner, order.number);
    await page.getByRole("button", { name: "Änderungen senden" }).click();
    // exact: Radix also reads the toast out in a hidden live region ("Notification …") for a moment.
    await expect(page.getByText("Das geht gerade nicht. Wir haben den Stand neu geladen.", { exact: true })).toBeVisible();
    await expect(page.locator('[data-revise-state="paused"]')).toHaveText("Dein Widerruf wird gerade geprüft. Bis dahin ruht der Auftrag.");
    await expect(page.getByText("Das hat nicht geklappt. Versuch es noch mal.")).toHaveCount(0);
    expect((await service().from("orders").select("revisions_used").eq("id", order.id).single()).data?.revisions_used).toBe(0);
  });

  test("a read that failed is not an empty queue, and a saved draft is not replaced without asking @real", async ({ page }) => {
    const owner = await customer("tf-load");
    const order = await seededOrder(owner);
    const editor = await teamMember("tf-load-ed", "editor");
    const draft = await proposalFor(editor, owner, order.id, false);
    const before = (await service().from("site_proposals").select("page, updated_at").eq("id", draft).single()).data;

    await signIn(page, editor.email, "/de/admin/orders");
    await page.waitForURL(/\/de\/admin\/orders$/);
    await expect(page.locator(`[data-order="${order.number}"]:visible`)).toBeVisible();
    // The queue's request fails (an expired session, a dropped connection).
    await page.route("**/rest/v1/rpc/admin_orders*", (route) => route.abort());
    await page.reload();
    const failed = page.locator("[data-load-failed]");
    await expect(failed).toContainText("Diese Ansicht ließ sich nicht laden");
    await expect(page.getByText("Keine Aufträge in dieser Ansicht.")).toHaveCount(0);
    await page.unroute("**/rest/v1/rpc/admin_orders*");
    await failed.getByRole("button", { name: "Neu laden" }).click();
    await expect(page.locator(`[data-order="${order.number}"]:visible`)).toBeVisible();

    // The same for one order: not "no orders in this view".
    await page.route("**/rest/v1/rpc/admin_order", (route) => route.abort());
    await page.goto(`/de/admin/orders/${order.id}`);
    await expect(failed).toBeVisible();
    await page.unroute("**/rest/v1/rpc/admin_order");
    await failed.getByRole("button", { name: "Neu laden" }).click();
    await expect(page.getByRole("heading", { level: 1, name: order.number })).toBeVisible();

    // The round has a draft: the AI button asks before it replaces it, and "keep" changes nothing.
    let runs = 0;
    await page.route(`**/api/admin/orders/${order.id}/ai`, async (route) => {
      runs += 1;
      await route.abort();
    });
    await page.getByRole("button", { name: "Entwurf mit KI erstellen" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Gespeicherten Entwurf ersetzen?");
    await expect(dialog).toContainText("Ein neuer KI-Entwurf ersetzt seine Seite und sein Design.");
    await dialog.getByRole("button", { name: "So lassen" }).click();
    await expect(dialog).toHaveCount(0);
    expect(runs).toBe(0);
    expect((await service().from("site_proposals").select("page, updated_at").eq("id", draft).single()).data).toEqual(before);
  });

  test("a proposal's pictures go into the customer's folder; a draft's story pictures stay private until it is handed over @real", async () => {
    const owner = await customer("tf-media");
    const stranger = await customer("tf-media-other");
    const order = await seededOrder(owner, "service-premium");
    const editor = await teamMember("tf-media-ed", "editor");
    const asEditor = await clientAs(editor.email);
    const asOwner = await clientAs(owner.email);
    const picture = await readFile("src/assets/samples/mila-avatar.jpg");

    // Page pictures: the team writes into the customer's media folder (the open order allows it), nowhere else.
    const path = `${owner.id}/2026/${randomUUID()}.jpg`;
    expect((await asEditor.storage.from("media").upload(path, picture, { contentType: "image/jpeg", upsert: false })).error).toBeNull();
    expect((await asEditor.storage.from("media").upload(`${stranger.id}/2026/${randomUUID()}.jpg`, picture, { contentType: "image/jpeg", upsert: false })).error).not.toBeNull();
    // It is the customer's object: listed in their folder, deleted with their account's folder.
    const listed = await asOwner.storage.from("media").list(`${owner.id}/2026`);
    expect(listed.data?.map((entry) => `${owner.id}/2026/${entry.name}`)).toContain(path);

    // Story pictures: two in the draft, one uploaded by mistake and taken out again.
    const kept = (await seedMedia(owner.id, { bucket: "deliverables", folder: order.id })).path;
    const wrong = (await seedMedia(owner.id, { bucket: "deliverables", folder: order.id })).path;
    const site = (await service().from("sites").select("page, theme").eq("profile_id", owner.id).single()).data;
    const kit = { bioInstagram: "Sängerin aus Köln", bioTiktok: "Songs aus Köln", postingPlan: [1, 2, 3, 4].map((week) => ({ week, idea: `Idee ${String(week)}` })) };
    const saved = await asEditor.rpc("admin_save_proposal", { target: order.id, page: site?.page ?? {}, theme: site?.theme ?? {}, extras: kit, stories: [kept] });
    expect(saved.error).toBeNull();
    // While it is a draft the customer can sign neither file, although both lie in their folder.
    const early = await asOwner.storage.from("deliverables").createSignedUrls([kept, wrong], 60);
    expect((early.data ?? []).filter((entry) => entry.signedUrl)).toEqual([]);
    expect((await asOwner.storage.from("deliverables").list(`${owner.id}/${order.id}`)).data ?? []).toEqual([]);
    // The team removes the mistaken file through Storage (its own right on the bucket).
    expect((await asEditor.storage.from("deliverables").remove([wrong])).error).toBeNull();
    expect(((await service().storage.from("deliverables").list(`${owner.id}/${order.id}`)).data ?? []).map((entry) => `${owner.id}/${order.id}/${entry.name}`)).toEqual([kept]);
    // Handed over (the kit needs three pictures: two more).
    const more = [(await seedMedia(owner.id, { bucket: "deliverables", folder: order.id })).path, (await seedMedia(owner.id, { bucket: "deliverables", folder: order.id })).path];
    expect((await asEditor.rpc("admin_save_proposal", { target: order.id, page: site?.page ?? {}, theme: site?.theme ?? {}, extras: kit, stories: [kept, ...more] })).error).toBeNull();
    expect((await asEditor.rpc("admin_deliver_proposal", { proposal: saved.data ?? "" })).error).toBeNull();
    const after = await asOwner.storage.from("deliverables").createSignedUrls([kept, ...more], 60, { download: true });
    expect((after.data ?? []).filter((entry) => entry.signedUrl)).toHaveLength(3);
  });
});
