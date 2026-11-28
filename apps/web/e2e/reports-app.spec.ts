import AxeBuilder from "@axe-core/playwright";
import { expect as baseExpect, test as base, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { COMPANY } from "../src/features/legal/company";
import type { Database } from "../src/lib/supabase/database.types";
import ar from "../src/messages/ar.json" with { type: "json" };
import de from "../src/messages/de.json" with { type: "json" };
import en from "../src/messages/en.json" with { type: "json" };

import { enterDemoCode } from "./auth";
import { addTeamMember, createRealAccount, expect, readCapturedMail, realEnabled, seedPage, service, signIn, test, uniqueName, type RealAccount } from "./real";

/**
 * Notice and action (DSA Art. 16 and 17; Stage 4, WP4.1). The public form at /melden, the team's
 * queue at /admin/reports and the decisions with their statement of reasons.
 *
 * - Demo build (the regular suite): /melden says reports cannot be taken here and names the e-mail
 *   address instead; the console shows made-up reports and decides on them in this browser.
 * - `@real` (E2E_SUPABASE=1, the migration 20261128100000_reports.sql applied, EMAIL_TRANSPORT=capture):
 *   the form files a report and sends the receipt; the team hides a block, takes a page offline,
 *   suspends with a reason and dismisses, each written to the activity log and mailed (captured).
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const MESSAGES = { de, en, ar } as const;
const LOCALES = ["de", "en", "ar"] as const;
const TEAM_CODE = "linkyo-team-4827";

async function axe(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.map((violation) => `${violation.id} (${violation.impact ?? ""}): ${violation.nodes.length}× — ${violation.nodes[0]?.target.join(" ") ?? ""}`);
}

/** Every request the page makes to another origin than the app's (there must be none). */
function foreignRequests(page: Page, baseURL: string | undefined): string[] {
  const foreign: string[] = [];
  const origin = new URL(baseURL ?? "http://localhost:3100").origin;
  page.on("request", (request) => {
    const url = request.url();
    if (/^https?:/.test(url) && new URL(url).origin !== origin) foreign.push(url);
  });
  return foreign;
}

async function noCookies(context: BrowserContext): Promise<void> {
  baseExpect(await context.cookies()).toEqual([]);
}

// ── Demo build ──────────────────────────────────────────────────────────────────────────────────
base.describe("reports in a demo build", () => {
  base.skip(realEnabled, "The demo answers; the @real tests below cover real accounts.");

  for (const locale of LOCALES) {
    base(`/${locale}/melden: no form without a database, the e-mail way instead; no cookie, nothing from elsewhere, axe`, async ({ page, context, baseURL }) => {
      const foreign = foreignRequests(page, baseURL);
      const response = await page.goto(`/${locale}/melden?url=https%3A%2F%2Flinkyo.app%2Fmila`);
      baseExpect(response?.status()).toBe(200);
      await baseExpect(page.getByRole("heading", { level: 1 })).toHaveText(MESSAGES[locale].report.title);
      await baseExpect(page.locator("[data-report-unavailable]")).toBeVisible();
      await baseExpect(page.locator("main form, main textarea")).toHaveCount(0);
      await baseExpect(page.locator("[data-report-unavailable] a")).toHaveAttribute("href", `mailto:${COMPANY.email}`);
      // A form, not a page to find.
      await baseExpect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      await baseExpect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      await page.waitForLoadState("networkidle");
      await noCookies(context);
      baseExpect(foreign).toEqual([]);
      baseExpect(await axe(page)).toEqual([]);
    });
  }

  base("the website's footer and the contact page lead to the form; the demo API refuses honestly (409)", async ({ page, request }) => {
    await page.goto("/de/kontakt");
    await baseExpect(page.locator("footer").getByRole("link", { name: de.legal.nav.report })).toHaveAttribute("href", "/de/melden");
    await baseExpect(page.locator("main").getByRole("link", { name: de.sitePages.contact.report.action })).toHaveAttribute("href", "/de/melden");
    const answer = await request.post("/api/reports", {
      data: { page: "mila", category: "fraud", explanation: "The ticket link sells tickets that do not exist.", name: "Kai", email: "kai@example.com", goodFaith: true, locale: "de" },
    });
    baseExpect(answer.status()).toBe(409);
    baseExpect(await answer.json()).toEqual({ ok: false, error: "unavailable" });
  });

  async function owner(page: Page, locale: "en" | "ar" = "en"): Promise<void> {
    const name = `mod-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    await page.goto(`/${locale}/signup?name=${name}`);
    await page.waitForLoadState("networkidle");
    await page.locator("#signup-email").fill(`${name}@example.com`);
    await page.locator("form button[type=submit]").click();
    await enterDemoCode(page);
    await page.waitForURL(`**/${locale}/app/welcome`);
    await page.goto(`/${locale}/admin`);
    await page.locator("#team-code").fill(TEAM_CODE);
    await page.locator("form button[type=submit]").click();
    // The team is set up once the overview greets the owner.
    await baseExpect(page.getByRole("heading", { level: 1 })).toContainText(locale === "ar" ? "أهلاً" : "Hi");
  }

  base("the console: the badge counts open reports; hide a block with its reasons, lift it, dismiss one; the log has each", async ({ page }) => {
    await owner(page);
    const t = en.admin.reports;
    // The badge: four made-up reports, one past the team's target (set apart, and said in words).
    const badge = page.locator('[data-waiting="4"]').locator("visible=true").first();
    await baseExpect(badge).toBeVisible();
    await page.goto("/en/admin/reports");
    await baseExpect(page.getByRole("heading", { level: 1 })).toHaveText(t.title);
    await baseExpect(page.locator("[data-report]")).toHaveCount(4);
    await baseExpect(page.getByText(t.overdueBadge, { exact: true })).toHaveCount(1);
    await baseExpect(page.getByText(t.demo)).toBeVisible();
    baseExpect(await axe(page)).toEqual([]);

    // Hide the "Über mich" block on nora-keramik, with a ground and reasons.
    const nora = page.locator("[data-report]").filter({ hasText: "linkyo.app/nora-keramik" });
    await nora.getByRole("button", { name: t.decide }).click();
    const sheet = page.getByRole("dialog");
    await baseExpect(sheet.getByRole("button", { name: t.dialog.confirm })).toBeDisabled();
    await sheet.getByRole("radio", { name: new RegExp(t.decisions.hide_block) }).check();
    await sheet.getByRole("radio", { name: "Über mich" }).check();
    await sheet.getByLabel(t.dialog.reason).fill("The block names a neighbour's home address without her consent.");
    baseExpect(await axe(page)).toEqual([]);
    await sheet.getByRole("button", { name: t.dialog.confirm }).click();
    await baseExpect(page.getByText(t.toast.done, { exact: true }).first()).toBeVisible();
    await baseExpect(page.locator("[data-report]")).toHaveCount(3);

    // Decided: the outcome, the ground and the reasons; lifting needs a reason too.
    await page.getByRole("radio", { name: t.tabs.decided }).click();
    const decided = page.locator("[data-report]").filter({ hasText: "linkyo.app/nora-keramik" });
    await baseExpect(decided.getByText("Hidden: Über mich")).toBeVisible();
    await baseExpect(decided.getByText(t.grounds.illegal)).toBeVisible();
    await decided.getByRole("button", { name: t.inForce.lift }).click();
    const lift = page.getByRole("alertdialog");
    await baseExpect(lift.getByRole("button", { name: t.inForce.liftConfirm })).toBeDisabled();
    await lift.getByLabel(t.inForce.liftReason).fill("The creator removed the address and asked us to check again.");
    await lift.getByRole("button", { name: t.inForce.liftConfirm }).click();
    await baseExpect(page.getByText(t.toast.lifted, { exact: true }).first()).toBeVisible();

    // A report about a page that does not exist can only be dismissed, with reasons for the reporter.
    await page.getByRole("radio", { name: new RegExp(t.tabs.open) }).click();
    await page.locator("[data-report]").filter({ hasText: "linkyo.app/gibt-es-nicht" }).getByRole("button", { name: t.decide }).click();
    await baseExpect(page.getByRole("dialog").getByRole("radio")).toHaveCount(1);
    await page.getByRole("dialog").getByLabel(t.dialog.reasonDismiss).fill("There is no such page on Linkyo; nothing to restrict.");
    await page.getByRole("dialog").getByRole("button", { name: t.dialog.confirm }).click();
    await baseExpect(page.locator("[data-report]")).toHaveCount(2);

    await page.goto("/en/admin/activity");
    const log = page.locator("main");
    await baseExpect(log.getByText(/hid content on nora-keramik/)).toBeVisible();
    await baseExpect(log.getByText(/lifted a restriction on nora-keramik/)).toBeVisible();
    await baseExpect(log.getByText(/dismissed a report about gibt-es-nicht/)).toBeVisible();
  });

  base("the console in Arabic: the queue and its decision sheet mirror and pass axe", async ({ page }) => {
    await owner(page, "ar");
    await page.goto("/ar/admin/reports");
    await baseExpect(page.getByRole("heading", { level: 1 })).toHaveText(ar.admin.reports.title);
    await baseExpect(page.locator("html")).toHaveAttribute("dir", "rtl");
    baseExpect(await axe(page)).toEqual([]);
    await page.locator("[data-report]").first().getByRole("button", { name: ar.admin.reports.decide }).click();
    await page.getByRole("dialog").getByRole("radio").first().check();
    baseExpect(await axe(page)).toEqual([]);
  });

  base("suspending a customer asks for the reasons and the ground first", async ({ page }) => {
    await owner(page);
    await page.goto("/en/admin/customers");
    await page.locator("main a[href*='/admin/customers/cus_']").locator("visible=true").first().click();
    await page.getByRole("button", { name: en.admin.customer.actions.more }).click();
    await page.getByRole("menuitem", { name: en.admin.customer.actions.suspend }).click();
    const dialog = page.getByRole("alertdialog");
    await baseExpect(dialog.getByRole("button", { name: en.admin.customer.actions.suspend })).toBeDisabled();
    await baseExpect(dialog.getByLabel(en.admin.customer.confirm.suspendGround)).toBeVisible();
    await dialog.getByLabel(en.admin.customer.confirm.suspendReason).fill("Repeated fake ticket sales after a warning.");
    baseExpect(await axe(page)).toEqual([]);
    await dialog.getByRole("button", { name: en.admin.customer.actions.suspend }).click();
    await baseExpect(page.getByText(en.admin.customer.toast.suspended, { exact: true }).first()).toBeVisible();
  });
});

// ── Real accounts ───────────────────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

/** An access token of this account (to call the team's routes as that member). */
async function tokenOf(email: string): Promise<string> {
  const { data, error } = await service().auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(error.message);
  const client = createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const verified = await client.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
  if (verified.error || !verified.data.session) throw new Error(verified.error?.message ?? "no session");
  return verified.data.session.access_token;
}

async function creator(prefix: string): Promise<RealAccount> {
  const { username, email } = uniqueName(prefix);
  return createRealAccount({
    email,
    username,
    locale: "de",
    onboarded: true,
    page: seedPage(username, "de", { displayName: "Mona Beispiel" }, [
      { id: "shop", type: "link", title: "Mein Laden", url: "https://example.com/shop", visible: true, highlight: false },
      { id: "flagged", type: "link", title: "Gefälschte Tickets", url: "https://example.com/tickets", visible: true, highlight: false },
    ]),
  });
}

async function owner(prefix = "mod-owner"): Promise<RealAccount> {
  const { username, email } = uniqueName(prefix);
  const account = await createRealAccount({ email, username, locale: "de", onboarded: true });
  await addTeamMember(email, "owner");
  return account;
}

async function fileReport(request: APIRequestContext, page: string, reporter: string, category = "fraud"): Promise<string> {
  const answer = await request.post("/api/reports", {
    data: { page, category, explanation: "Der Link verkauft Tickets für ein Konzert, das es nicht gibt.", name: "Kai Beispiel", email: reporter, goodFaith: true, locale: "de" },
  });
  expect(answer.status()).toBe(201);
  const body = (await answer.json()) as { reference: string };
  const { data } = await service().from("reports").select("id").eq("page", page).eq("reporter_email", reporter).order("received_at", { ascending: false }).limit(1).single();
  expect(body.reference).toBe((data?.id ?? "").replaceAll("-", "").slice(0, 8).toUpperCase());
  return data?.id ?? "";
}

test.describe("notice and action with real accounts @real", () => {
  test.skip(!realEnabled, "Needs the local Supabase stack with 20261128100000_reports.sql (E2E_SUPABASE=1).");

  test("a visitor reports from the footer's link: no cookie, the report is stored, the receipt is captured; axe in de, en, ar @real", async ({ page, context, baseURL }) => {
    const mona = await creator("mod-form");
    const reporter = `${uniqueName("reporter").username}@example.com`;
    await page.goto(`/${mona.username}`);
    const report = page.locator("footer").getByRole("link", { name: de.creator.report });
    await expect(report).toHaveAttribute("href", new RegExp(`/de/melden\\?url=.*${mona.username}`));
    const foreign = foreignRequests(page, baseURL);
    // The footer links the website's origin (siteUrl); the test opens the same path on this server.
    const href = (await report.getAttribute("href")) ?? "/de/melden";
    await page.goto(href.replace(/^https?:\/\/[^/]+/, ""));
    await expect(page.getByLabel(de.report.form.page)).toHaveValue(new RegExp(mona.username));
    expect(await axe(page)).toEqual([]);
    // Sending it empty names every field and moves to the first one to correct.
    await page.getByLabel(de.report.form.page).fill("");
    await page.getByRole("button", { name: de.report.form.submit }).click();
    await expect(page.getByLabel(de.report.form.page)).toBeFocused();
    await expect(page.getByText(de.report.errors.goodFaith)).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await page.getByLabel(de.report.form.page).fill(`linkyo.app/${mona.username}`);
    await page.getByRole("radio", { name: de.report.form.categories.fraud }).check();
    await page.getByLabel(de.report.form.explanation).fill("Der Link „Gefälschte Tickets“ verkauft Karten für ein Konzert, das es nicht gibt.");
    await page.getByLabel(de.report.form.name).fill("Kai Beispiel");
    await page.getByLabel(de.report.form.email).fill(reporter);
    await page.getByRole("checkbox", { name: de.report.form.goodFaith }).check();
    await page.getByRole("button", { name: de.report.form.submit }).click();
    await expect(page.getByRole("heading", { name: de.report.done.title })).toBeFocused();
    await expect(page.getByText(`Eine Bestätigung ging an ${reporter}.`)).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await noCookies(context);
    expect(foreign).toEqual([]);
    const { data } = await service().from("reports").select("page, profile_id, category, status").eq("reporter_email", reporter).single();
    expect(data).toEqual({ page: mona.username, profile_id: mona.id, category: "fraud", status: "open" });
    await expect.poll(async () => (await readCapturedMail({ to: reporter, tag: "report-receipt" })).length).toBe(1);

    for (const locale of ["en", "ar"] as const) {
      await page.goto(`/${locale}/melden`);
      await expect(page.getByRole("button", { name: MESSAGES[locale].report.form.submit })).toBeVisible();
      // Every word is there: no message key shows in place of its text.
      expect(await page.locator("main").innerText()).not.toMatch(/\breport\.[a-z]+\./);
      expect(await axe(page)).toEqual([]);
    }
  });

  test("the team hides a block: gone from the page at once, the statement and the notice are mailed, the log has it, the badge counts @real", async ({ page, request }) => {
    const mona = await creator("mod-hide");
    const boss = await owner();
    const reporter = `${uniqueName("reporter").username}@example.com`;
    const id = await fileReport(request, mona.username, reporter);
    await page.goto(`/${mona.username}`);
    await expect(page.getByText("Gefälschte Tickets")).toBeVisible();

    await signIn(page, boss.email, "/de/admin/reports");
    await page.waitForURL("**/de/admin/reports");
    await expect(page.locator("[data-waiting]").locator("visible=true").first()).toBeVisible();
    const card = page.locator(`[data-report="${id}"]`);
    await card.getByRole("button", { name: de.admin.reports.decide }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("radio", { name: new RegExp(de.admin.reports.decisions.hide_block) }).check();
    await sheet.getByRole("radio", { name: "Gefälschte Tickets" }).check();
    await sheet.getByLabel(de.admin.reports.dialog.reason).fill("Der Link verkauft Tickets für ein Konzert, das es nicht gibt (§ 263 StGB).");
    await sheet.getByRole("button", { name: de.admin.reports.dialog.confirm }).click();
    await expect(page.getByText(de.admin.reports.toast.done, { exact: true }).first()).toBeVisible();
    await expect(card).toHaveCount(0);

    await page.goto(`/${mona.username}`);
    await expect(page.getByText("Mein Laden")).toBeVisible();
    await expect(page.getByText("Gefälschte Tickets")).toHaveCount(0);

    await expect.poll(async () => (await readCapturedMail({ to: mona.email, tag: "statement-of-reasons" })).length).toBe(1);
    const [statement] = await readCapturedMail({ to: mona.email, tag: "statement-of-reasons" });
    expect(statement?.text).toContain("„Gefälschte Tickets“");
    expect(statement?.text).toContain("§ 263 StGB");
    expect(statement?.text).not.toContain(reporter);
    await expect.poll(async () => (await readCapturedMail({ to: reporter, tag: "report-decision" })).length).toBe(1);
    const { data: logged } = await service().from("audit_log").select("action, details").eq("target_id", mona.id).order("id", { ascending: false }).limit(1).single();
    expect(logged?.action).toBe("moderation.hide");
    expect(JSON.stringify(logged?.details)).not.toContain("263");
  });

  test("taking a page offline, suspending with a reason and dismissing each write the log and mail; anon cannot read reports @real", async ({ request }) => {
    const nils = await creator("mod-offline");
    const sven = await creator("mod-suspend");
    const boss = await owner();
    const token = await tokenOf(boss.email);
    const headers = { Authorization: `Bearer ${token}` };
    const reporter = `${uniqueName("reporter").username}@example.com`;

    const offline = await fileReport(request, nils.username, reporter);
    const decided = await request.post("/api/admin/moderation", {
      headers,
      data: { decision: "unpublish", customer: nils.id, report: offline, ground: "terms", reason: "Die Seite verkauft Tickets für ein Konzert, das es nicht gibt." },
    });
    expect(decided.status()).toBe(200);
    expect((await request.get(`/${nils.username}`)).status()).toBe(404);
    // A decided report is decided once.
    expect((await request.post("/api/admin/moderation", { headers, data: { decision: "dismiss", report: offline, reason: "Nothing to restrict here." } })).status()).toBe(409);

    const suspended = await request.post(`/api/admin/customers/${sven.id}/status`, { headers, data: { next: "suspended", ground: "terms", reason: "Wiederholt gefälschte Tickets trotz Warnung." } });
    expect(suspended.status()).toBe(200);
    expect(await suspended.json()).toMatchObject({ ok: true, recorded: true, creatorMailed: true });
    expect((await request.post(`/api/admin/customers/${sven.id}/status`, { headers, data: { next: "suspended" } })).status()).toBe(400);

    const dismissed = await fileReport(request, sven.username, reporter, "other");
    expect((await request.post("/api/admin/moderation", { headers, data: { decision: "dismiss", report: dismissed, reason: "Auf der Seite ist nichts rechtswidrig." } })).status()).toBe(200);

    const actions = async (target: string) => ((await service().from("audit_log").select("action").eq("target_id", target)).data ?? []).map((row) => row.action).sort();
    expect(await actions(nils.id)).toEqual(["moderation.unpublish"]);
    expect(await actions(sven.id)).toEqual(["customer.suspend", "report.dismiss"]);
    await expect.poll(async () => (await readCapturedMail({ to: nils.email, tag: "statement-of-reasons" })).length).toBe(1);
    await expect.poll(async () => (await readCapturedMail({ to: sven.email, tag: "statement-of-reasons" })).length).toBe(1);
    await expect.poll(async () => (await readCapturedMail({ to: reporter, tag: "report-decision" })).length).toBe(2);

    // The publishable key reads no report and files none around the route's limit.
    const anon = createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false } });
    expect((await anon.from("reports").select("id")).data ?? []).toEqual([]);
    expect((await anon.rpc("submit_report", { page: nils.username, category: "other", explanation: "Around the route, straight to the database.", good_faith: true, reporter_name: "X Y", reporter_email: "x@example.com" })).error?.code).toBe("42501");
  });
});
