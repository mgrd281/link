import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import type { Database, Json } from "../src/lib/supabase/database.types";

import { addTeamMember, createRealAccount, expect, readCapturedMail, realEnabled, seedPage, service, signIn, test, uniqueName, type RealAccount } from "./real";

/**
 * The team console's page-service queue and the customer's proposal review (plan §1.7, §3.2 WP7):
 * assign, the team's own AI draft (never the customer's run), edit and deliver at once (the delivered
 * proposal is the one on screen), revision rounds per package, Premium's kit, refunds through the
 * mock Stripe, withdrawals that stop the work and are decided in the contracts panel, permissions by
 * role, and axe on every new screen. The customer's live page changes only when they apply.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
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

/** A paid, confirmed order of this account with its briefing (made in the database, as the webhook and the briefing route would). */
async function seededOrder(account: RealAccount, input: { product?: "service-start" | "service-premium"; wishes?: string } = {}) {
  const db = service();
  const session = `cs_e2e_${randomUUID().replaceAll("-", "")}`;
  const product = input.product ?? "service-start";
  await db.rpc("record_checkout_intent", { session, account: account.id, product, locale: "de" });
  await db.rpc("record_checkout_consent", {
    session,
    account: account.id,
    early: true,
    consent_text: "Bitte sofort beginnen.",
    start_after: new Date().toISOString(),
    promised_due: new Date(Date.now() + 2 * DAY).toISOString(),
  });
  const made = (await db.rpc("record_service_order", { session, payment_intent: `pi_${session}`, amount: product === "service-premium" ? 7999 : 2499, email: account.email })).data as {
    id: string;
    number: string;
  };
  // The first five links are read as sources: none of these is a website, so nothing is fetched
  // (the website comes sixth, as a pasted link); the mock answers from the fixture marker.
  const links = ["https://instagram.com/mila.berg", "https://soundcloud.com/mila-berg", "https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy", "https://www.eventim.de/artist/mila-berg/", "https://x.com/milaberg", "https://mila-berg.de/booking"];
  const briefing = { links, photos: [], wishes: input.wishes ?? "Bitte schlicht und hell.", pageLocale: "de" };
  const briefed = await db.rpc("set_order_briefing", { target: made.id, account: account.id, briefing: briefing as unknown as Json, due: new Date(Date.now() + 2 * DAY).toISOString() });
  expect(briefed.data).toBe("ok");
  await db.rpc("mark_confirmation_sent", { target: made.id });
  return { ...made, paymentIntent: `pi_${session}` };
}

async function sitePage(profileId: string): Promise<unknown> {
  return (await service().from("sites").select("page").eq("profile_id", profileId).single()).data?.page;
}

async function proposals(orderId: string) {
  const { data } = await service().from("site_proposals").select("id, round, status, page, extras, story_paths").eq("order_id", orderId).order("round");
  return data ?? [];
}

async function stripeRequests(method: string, path: string): Promise<{ path: string; body: Record<string, unknown> }[]> {
  const response = await fetch(`${MOCK_STRIPE}/__requests?method=${method}&path=${encodeURIComponent(path)}`);
  return ((await response.json()) as { requests: { path: string; body: Record<string, unknown> }[] }).requests;
}

const refundsFor = async (paymentIntent: string) => (await stripeRequests("POST", "/v1/refunds")).filter((call) => call.body.payment_intent === paymentIntent);

/** The order's row in the queue (cards on phones, the table from md). */
const queueRow = (page: Page, number: string) => page.locator(`[data-order="${number}"]:visible`);

async function axe(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(
    results.violations.map((violation) => `${violation.id}: ${violation.nodes[0]?.target.join(" ") ?? ""}`),
    label,
  ).toEqual([]);
}

test.describe("team orders and the customer's proposal review @real", () => {
  test.skip(!realEnabled, "Needs the local Supabase stack (E2E_SUPABASE=1).");

  test("Start: assign, the team's AI draft, edit and deliver at once, revision, round 1, apply and undo @real", async ({ page, tag }) => {
    test.setTimeout(300_000);
    const owner = await customer("ord-start");
    const order = await seededOrder(owner, { wishes: `Ich bin Mila, Sängerin aus Köln. [[fixture:de-music#${tag}]]` });
    const editor = await teamMember("ord-editor", "editor");
    const before = await sitePage(owner.id);

    // The queue lists it with an SLA chip that has words.
    await signIn(page, editor.email, "/de/admin/orders");
    await page.waitForURL(/\/de\/admin\/orders$/);
    const row = queueRow(page, order.number);
    await expect(row).toBeVisible();
    await expect(row.locator("[data-sla]")).toHaveText(/\S+/);
    await page.goto(`/de/admin/orders/${order.id}`);
    await expect(page.getByRole("heading", { level: 1, name: order.number })).toBeVisible();

    // Assign → in progress.
    await page.getByRole("button", { name: "Mir zuweisen" }).click();
    await expect(page.locator("header").getByText("In Arbeit")).toBeVisible();

    // The team's AI draft is saved as the round's proposal; the run belongs to the team member.
    await page.getByRole("button", { name: "Entwurf mit KI erstellen" }).click();
    await expect(page.locator('[data-proposal-round="0"][data-proposal-status="draft"]')).toBeVisible({ timeout: 90_000 });
    const { data: runs } = await service().from("ai_runs").select("profile_id, route, order_id").eq("order_id", order.id);
    expect(runs).toEqual([{ profile_id: editor.id, route: "team", order_id: order.id }]);
    const { data: customerRuns } = await (await clientAs(owner.email)).from("ai_runs").select("id");
    expect(customerRuns).toEqual([]);
    expect(await sitePage(owner.id)).toEqual(before);

    // Edit a title and deliver at once: the delivered proposal is the one on screen.
    await page.getByRole("link", { name: "Vorschlag bearbeiten" }).click();
    await expect(page.locator("[data-proposal-banner]")).toHaveText("Dieser Vorschlag ändert die veröffentlichte Seite nicht. Übernehmen kann ihn nur das Konto selbst.");
    await page.getByRole("button", { name: "Booking anfragen bearbeiten (Link)" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByLabel("Titel", { exact: true }).fill("Tickets für die Tour E2E");
    await sheet.getByRole("button", { name: "Speichern" }).click();
    await page.getByRole("button", { name: "Vorschlag übergeben" }).click();
    await page.waitForURL(new RegExp(`/de/admin/orders/${order.id}$`));
    await expect(page.locator('[data-proposal-round="0"][data-proposal-status="delivered"]')).toBeVisible();
    const [first] = await proposals(order.id);
    expect(first?.status).toBe("delivered");
    expect(JSON.stringify(first?.page)).toContain("Tickets für die Tour E2E");
    expect(await sitePage(owner.id)).toEqual(before);
    const deliveredMail = await readCapturedMail({ to: owner.email, tag: "proposal-delivered" });
    expect(deliveredMail).toHaveLength(1);
    expect(deliveredMail[0]?.text).toContain("Unsere KI hat deine Seite entworfen, unser Team hat sie geprüft und verfeinert.");
    expect(deliveredMail[0]?.text).not.toContain("Marketing-Paket");

    // Reopening the editor: read-only until the customer asks for changes.
    await page.goto(`/de/admin/orders/${order.id}/proposal`);
    await expect(page.locator("[data-proposal-banner]")).toHaveText("Dieser Vorschlag ist übergeben. Bearbeiten geht erst wieder, wenn das Konto Änderungen anfragt.");
    await expect(page.getByRole("button", { name: "Vorschlag übergeben" })).toHaveCount(0);

    // The customer: Home card, then the review with the AI wording, Before/Draft and the refund line.
    await signIn(page, owner.email, "/de/app");
    const card = page.locator("[data-proposal-card]");
    await expect(card.getByRole("heading", { name: "Dein Seitenvorschlag ist da" })).toBeVisible();
    await expect(card).toContainText("Unsere KI hat deine Seite entworfen");
    await card.getByRole("link", { name: "Vorschlag ansehen" }).click();
    await page.waitForURL(new RegExp(`/de/app/proposals/${first?.id ?? ""}$`));
    await expect(page.locator("[data-proposal-chip]")).toHaveText("Vorschlag · KI-Entwurf, von unserem Team geprüft und verfeinert");
    await expect(page.getByText("Mit KI erstellt. Prüf alles, bevor du veröffentlichst.")).toBeVisible();
    await expect(page.getByRole("radio", { name: "Vorher" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Entwurf" })).toBeVisible();
    await expect(page.locator("[data-refund-line]")).toContainText("Einmal pro Konto.");
    await expect(page.locator("[data-revise-left]")).toHaveText(/Noch 1 Änderungsrunde/);

    // Changes: Start has one round.
    await page.getByRole("button", { name: "Änderungen anfragen" }).click();
    await page.getByRole("dialog").getByLabel("Was sollen wir ändern?").fill("Bitte die Tour-Daten nach oben.");
    await page.getByRole("button", { name: "Änderungen senden" }).click();
    await expect(page.locator("[data-revise-sent]")).toContainText("Danke! Wir liefern die Änderungen bis");
    await expect(page.locator("[data-revise-left]")).toHaveText("Keine Änderungsrunde mehr");
    await expect(page.getByRole("button", { name: "Änderungen anfragen" })).toBeDisabled();
    expect(await readCapturedMail({ to: owner.email, tag: "revision-received" })).toHaveLength(1);
    const { data: revised } = await service().from("orders").select("status, revision_due_at").eq("id", order.id).single();
    expect(revised?.status).toBe("revision_requested");
    // Two working days ahead, 18:00 Berlin.
    expect(new Date(revised?.revision_due_at ?? 0).getTime()).toBeGreaterThan(Date.now() + DAY);
    // A second request is refused.
    const again = await (await clientAs(owner.email)).auth.getSession();
    const refused = await page.request.post(`/api/proposals/${first?.id ?? ""}/revision`, {
      headers: { Authorization: `Bearer ${again.data.session?.access_token ?? ""}` },
      data: { message: "Noch etwas" },
    });
    expect(refused.status()).toBe(409);

    // The team sees the request and delivers round 1.
    await signIn(page, editor.email, `/de/admin/orders/${order.id}`);
    await expect(page.locator("header").getByText("Änderungen angefragt")).toBeVisible();
    await expect(page.getByText("Bitte die Tour-Daten nach oben.")).toBeVisible();
    await page.getByRole("link", { name: "Vorschlag bearbeiten" }).click();
    await expect(page.locator("[data-proposal-banner]")).toHaveText(/ändert die veröffentlichte Seite nicht/);
    await page.getByRole("button", { name: "Vorschlag übergeben" }).click();
    await page.waitForURL(new RegExp(`/de/admin/orders/${order.id}$`));
    await expect.poll(async () => (await proposals(order.id)).map((proposal) => `${String(proposal.round)}:${proposal.status}`)).toEqual(["0:superseded", "1:delivered"]);
    expect(await sitePage(owner.id)).toEqual(before);
    const second = (await proposals(order.id))[1];

    // The customer applies: the page becomes the proposal; Undo brings the old one back.
    await signIn(page, owner.email, `/de/app/proposals/${second?.id ?? ""}`);
    await expect(page.locator("[data-revise-left]")).toHaveCount(0);
    await expect(page.getByText("Alle Änderungsrunden sind genutzt.")).toBeVisible();
    await page.getByRole("button", { name: "Diesen Vorschlag übernehmen" }).click();
    await page.waitForURL(/\/de\/app\/editor$/);
    const secondPage = second?.page as { blocks: { id: string }[] };
    await expect.poll(async () => ((await sitePage(owner.id)) as { blocks: { id: string }[] }).blocks.map((block) => block.id)).toEqual(secondPage.blocks.map((block) => block.id));
    await expect.poll(async () => (await proposals(order.id))[1]?.status).toBe("applied");
    await page.getByRole("button", { name: "Rückgängig" }).first().click();
    await expect.poll(async () => sitePage(owner.id)).toEqual(before);
  });

  test("Premium: delivery waits for the kit; the customer gets the kit; the team designed it @real", async ({ page }) => {
    test.setTimeout(180_000);
    const owner = await customer("ord-premium");
    const order = await seededOrder(owner, { product: "service-premium" });
    const editor = await teamMember("ord-ed-premium", "editor");

    await signIn(page, editor.email, `/de/admin/orders/${order.id}`);
    await expect(page.getByRole("heading", { level: 1, name: order.number })).toBeVisible();
    // No AI button for Premium: a person designs it.
    await expect(page.getByRole("button", { name: "Entwurf mit KI erstellen" })).toHaveCount(0);
    await page.getByRole("link", { name: "Vorschlag bearbeiten" }).click();
    const deliver = page.getByRole("button", { name: "Vorschlag übergeben" });
    await expect(deliver).toBeDisabled();
    await expect(page.getByText("Für Premium fehlt noch das Marketing-Paket: zwei Bios, 4 Wochen Plan, 3 Story-Bilder.")).toBeVisible();

    await page.getByLabel("Bio für Instagram (bis 150 Zeichen)").fill("Sängerin aus Köln · neue Single jetzt");
    await page.getByLabel("Bio für TikTok (bis 80 Zeichen)").fill("Songs aus Köln");
    for (const week of [1, 2, 3, 4]) await page.getByLabel(`Woche ${String(week)}`, { exact: true }).fill(`Idee für Woche ${String(week)}`);
    await expect(deliver).toBeDisabled();
    for (let n = 0; n < 3; n++) {
      const chooser = page.waitForEvent("filechooser");
      await page.getByRole("button", { name: "Story-Bild hochladen" }).click();
      await (await chooser).setFiles("src/assets/samples/mila-avatar.jpg");
      await expect(page.getByRole("button", { name: `Story-Bild ${String(n + 1)} entfernen` })).toBeVisible();
    }
    await expect(deliver).toBeEnabled();
    await deliver.click();
    await page.waitForURL(new RegExp(`/de/admin/orders/${order.id}$`));
    const [delivered] = await proposals(order.id);
    expect(delivered?.status).toBe("delivered");
    expect(delivered?.story_paths).toHaveLength(3);
    expect(delivered?.extras).toMatchObject({ bioInstagram: "Sängerin aus Köln · neue Single jetzt", bioTiktok: "Songs aus Köln" });
    const mail = await readCapturedMail({ to: owner.email, tag: "proposal-delivered" });
    expect(mail[0]?.text).toContain("Unser Team hat deine Seite gestaltet.");
    expect(mail[0]?.text).toContain("Dein Marketing-Paket (zwei Bio-Texte, Posting-Plan für 4 Wochen, 3 Story-Bilder) findest du beim Vorschlag.");

    await signIn(page, owner.email, `/de/app/proposals/${delivered?.id ?? ""}`);
    await expect(page.locator("[data-proposal-chip]")).toHaveText("Vorschlag · von unserem Team gestaltet");
    await expect(page.getByText("Mit KI erstellt. Prüf alles, bevor du veröffentlichst.")).toHaveCount(0);
    const kit = page.locator("[data-kit]");
    await expect(kit.getByRole("heading", { name: "Marketing-Paket" })).toBeVisible();
    await expect(kit).toContainText("Sängerin aus Köln · neue Single jetzt");
    await expect(kit).toContainText("Songs aus Köln");
    await expect(kit.getByRole("button", { name: "Bio für Instagram kopieren" })).toBeVisible();
    await expect(kit.getByRole("button", { name: "Bio für TikTok kopieren" })).toBeVisible();
    await expect(kit.locator("ol li")).toHaveCount(4);
    for (const n of [1, 2, 3]) await expect(kit.getByRole("link", { name: `Story-Bild ${String(n)} herunterladen` })).toHaveAttribute("href", /\/storage\/v1\/object\/sign\/deliverables\//);
    await expect(page.locator("[data-revise-left]")).toHaveText(/Noch 3 Änderungsrunden/);
  });

  test("a viewer sees the queue but no actions; the AI switch is read-only for them @real", async ({ page }) => {
    const owner = await customer("ord-view");
    const order = await seededOrder(owner);
    const viewer = await teamMember("ord-viewer", "viewer");
    await signIn(page, viewer.email, "/de/admin/orders");
    await page.waitForURL(/\/de\/admin\/orders$/);
    await expect(queueRow(page, order.number)).toBeVisible();
    await expect(page.locator("[data-ai-switch]").getByRole("switch")).toBeDisabled();
    await page.goto(`/de/admin/orders/${order.id}`);
    await expect(page.getByRole("heading", { level: 1, name: order.number })).toBeVisible();
    await expect(page.locator("[data-order-actions]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Mir zuweisen" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Erstatten" })).toHaveCount(0);
  });

  test("an owner refunds: Stripe gets the refund, the order is refunded, and the account's next proposal has no refund line @real", async ({ page }) => {
    test.setTimeout(120_000);
    const owner = await customer("ord-refund");
    const order = await seededOrder(owner);
    const boss = await teamMember("ord-owner", "owner");

    await signIn(page, boss.email, `/de/admin/orders/${order.id}`);
    await page.getByRole("button", { name: "Erstatten" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(`24,99 € für ${order.number} erstatten?`);
    await dialog.getByRole("button", { name: "Erstatten" }).click();
    await expect(page.locator("header").getByText("Erstattet")).toBeVisible();
    await expect.poll(async () => (await refundsFor(order.paymentIntent)).length).toBe(1);
    expect((await refundsFor(order.paymentIntent))[0]?.body.amount).toBe("2499");
    const { data } = await service().from("orders").select("status, refund_kind").eq("id", order.id).single();
    expect(data).toEqual({ status: "refunded", refund_kind: "voluntary" });
    const mails = await readCapturedMail({ to: owner.email, tag: "refund-issued" });
    expect(mails).toHaveLength(1);
    expect(mails[0]?.text).toContain("Wir haben 24,99\u00a0€ erstattet.");

    // A second order of the same account, delivered: the money-back was used, so no refund line.
    const next = await seededOrder(owner);
    const site = (await service().from("sites").select("page, theme").eq("profile_id", owner.id).single()).data;
    const asBoss = await clientAs(boss.email);
    const saved = await asBoss.rpc("admin_save_proposal", { target: next.id, page: site?.page ?? {}, theme: site?.theme ?? {} });
    expect(saved.error).toBeNull();
    expect((await asBoss.rpc("admin_deliver_proposal", { proposal: saved.data ?? "" })).error).toBeNull();
    await signIn(page, owner.email, `/de/app/proposals/${saved.data ?? ""}`);
    await expect(page.locator("[data-proposal-chip]")).toBeVisible();
    await expect(page.locator("[data-refund-line]")).toHaveCount(0);
  });

  test("contracts: a pending withdrawal stops the work; accepting it refunds and ends the order; a Pro withdrawal cancels now @real", async ({ page }) => {
    test.setTimeout(180_000);
    const owner = await customer("ord-wd");
    const order = await seededOrder(owner);
    const admin = await teamMember("ord-admin", "admin");
    const db = service();
    await db.rpc("record_withdrawal", { name: "Mila Berg", email: owner.email, contract: order.number, ip_hash: `e2e-${randomUUID()}` });

    // While it is pending, the order's work is locked.
    await signIn(page, admin.email, `/de/admin/orders/${order.id}`);
    await expect(page.locator("[data-withdrawal-lock]")).toBeVisible();
    for (const name of ["Mir zuweisen", "Entwurf mit KI erstellen", "Vorschlag bearbeiten", "Vorschlag übergeben"]) await expect(page.getByRole("button", { name })).toBeDisabled();

    // The contracts tab lists it with its refund deadline; accepting refunds the full price.
    await page.goto("/de/admin/orders?tab=contracts");
    const item = page.locator("[data-contract=withdrawal]").filter({ hasText: order.number });
    await expect(item.locator("[data-refund-due]")).toHaveText(/^Erstattung fällig bis \d{2}\.\d{2}\.\d{4}$/);
    await expect(item.locator("[data-sla]")).toHaveText(/\S+/);
    await item.getByRole("button", { name: "Widerruf annehmen und erstatten" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByLabel("Erstattungsbetrag")).toHaveValue("24,99");
    await dialog.getByRole("button", { name: "Widerruf annehmen und erstatten" }).click();
    await expect.poll(async () => (await refundsFor(order.paymentIntent)).length).toBe(1);
    await expect.poll(async () => (await db.from("orders").select("status, withdrawal_pending").eq("id", order.id).single()).data).toEqual({ status: "withdrawn", withdrawal_pending: false });
    await expect.poll(async () => (await readCapturedMail({ to: owner.email, tag: "contract-decision" })).length).toBe(1);
    expect((await readCapturedMail({ to: owner.email, tag: "contract-decision" }))[0]?.text).toContain(`Wir haben deinen Widerruf für ${order.number} angenommen und 24,99\u00a0€ erstattet.`);

    // A Pro withdrawal: the subscription ends now, the latest invoice is refunded, the entitlement too.
    const { username, email } = uniqueName("ord-pro");
    const pro = await createRealAccount({ email, username, locale: "de", onboarded: true });
    const subscription = `sub_e2e_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
    const invoicePi = `pi_inv_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
    await db.from("entitlements").insert({
      profile_id: pro.id,
      product: "pro",
      source: "stripe",
      status: "active",
      current_period_end: new Date(Date.now() + 20 * DAY).toISOString(),
      stripe_subscription_id: subscription,
      stripe_customer_id: "cus_e2e",
    });
    await db.rpc("record_invoice", { id: `in_${randomUUID().slice(0, 12)}`, account: pro.id, subscription, amount: 800, state: "paid", payment_intent: invoicePi });
    await fetch(`${MOCK_STRIPE}/__subscriptions/${subscription}`, { method: "POST", body: JSON.stringify({ customer: "cus_e2e", metadata: { profile_id: pro.id } }) });
    await db.rpc("record_withdrawal", { name: "Ben Pro", email, contract: "Linkyo Pro", ip_hash: `e2e-${randomUUID()}` });
    await page.reload();
    const proItem = page.locator("[data-contract=withdrawal]").filter({ hasText: email });
    await proItem.getByRole("button", { name: "Widerruf annehmen und erstatten" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Widerruf annehmen und erstatten" }).click();
    await expect.poll(async () => (await stripeRequests("DELETE", `/v1/subscriptions/${subscription}`)).length).toBe(1);
    await expect.poll(async () => (await refundsFor(invoicePi)).length).toBe(1);
    await expect.poll(async () => (await db.from("entitlements").select("status").eq("stripe_subscription_id", subscription).single()).data?.status).toBe("refunded");
  });

  test("contracts: undoing a cancellation needs the account's request as a note @real", async ({ page, request }) => {
    const { username, email } = uniqueName("ord-cx");
    const pro = await createRealAccount({ email, username, locale: "de", onboarded: true });
    const subscription = `sub_e2e_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
    const db = service();
    await db.from("entitlements").insert({
      profile_id: pro.id,
      product: "pro",
      source: "stripe",
      status: "active",
      current_period_end: new Date(Date.now() + 20 * DAY).toISOString(),
      stripe_subscription_id: subscription,
      stripe_customer_id: "cus_e2e",
    });
    const made = (await db.rpc("record_cancellation", {
      kind: "ordinary",
      name: "Ben Pro",
      account_email: email,
      contract: "pro-monthly",
      confirmation_email: email,
      ip_hash: `e2e-${randomUUID()}`,
    })).data as { id: string };
    await db.rpc("confirm_cancellation", { target: made.id, decision: "scheduled", effective: new Date(Date.now() + 20 * DAY).toISOString() });
    const admin = await teamMember("ord-cx-admin", "admin");

    // The sign-in link carries a path only; the tab comes after.
    await signIn(page, admin.email, "/de/admin/orders");
    await page.waitForURL(/\/de\/admin\/orders$/);
    await page.goto("/de/admin/orders?tab=contracts");
    const item = page.locator(`[data-contract-id="${made.id}"]`);
    await item.getByRole("button", { name: "Kündigung zurücknehmen" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByRole("button", { name: "Kündigung zurücknehmen" })).toBeDisabled();
    // The route refuses it too.
    const token = (await (await clientAs(admin.email)).auth.getSession()).data.session?.access_token ?? "";
    const refused = await request.post(`/api/admin/contracts/cancellation/${made.id}`, { headers: { Authorization: `Bearer ${token}` }, data: { action: "resume" } });
    expect(refused.status()).toBe(400);
    expect(await refused.json()).toMatchObject({ error: "noteRequired" });
    expect((await db.from("cancellations").select("decision").eq("id", made.id).single()).data?.decision).toBe("scheduled");
  });

  test("axe: queue, detail, contracts and the customer's review (de/en/ar, light/dark) @real", async ({ page }) => {
    test.setTimeout(240_000);
    const owner = await customer("ord-axe");
    const order = await seededOrder(owner);
    const admin = await teamMember("ord-axe-admin", "admin");
    const asAdmin = await clientAs(admin.email);
    const site = (await service().from("sites").select("page, theme").eq("profile_id", owner.id).single()).data;
    const saved = await asAdmin.rpc("admin_save_proposal", { target: order.id, page: site?.page ?? {}, theme: site?.theme ?? {}, message: "Hallo Mila, hier ist dein Vorschlag." });
    await asAdmin.rpc("admin_deliver_proposal", { proposal: saved.data ?? "" });

    await signIn(page, admin.email, "/de/admin/orders");
    await page.waitForURL(/\/de\/admin\/orders$/);
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      for (const locale of ["de", "en", "ar"]) {
        for (const path of ["/admin/orders?scope=all", `/admin/orders/${order.id}`, "/admin/orders?tab=contracts"]) {
          await page.goto(`/${locale}${path}`);
          await expect(page.locator("h1")).toBeVisible();
          await expect(page.locator("[aria-hidden] .animate-pulse, [data-slot=skeleton]")).toHaveCount(0);
          await page.waitForLoadState("networkidle");
          await axe(page, `/${locale}${path} (${scheme})`);
        }
      }
    }
    await signIn(page, owner.email, `/de/app/proposals/${saved.data ?? ""}`);
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      for (const locale of ["de", "en", "ar"]) {
        await page.goto(`/${locale}/app/proposals/${saved.data ?? ""}`);
        await expect(page.locator("[data-proposal-chip]")).toBeVisible();
        await page.waitForLoadState("networkidle");
        await axe(page, `/${locale}/app/proposals (${scheme})`);
      }
    }
  });
});
