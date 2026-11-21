import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/lib/supabase/database.types";

/**
 * Real accounts against a local Supabase stack (pnpm db:start). Runs only when the app was built
 * with Supabase settings and E2E_SUPABASE=1 is set; the regular suite covers demo mode.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=… SUPABASE_SECRET_KEY=… pnpm build
 *   E2E_SUPABASE=1 SUPABASE_SECRET_KEY=… pnpm exec playwright test e2e/supabase.spec.ts
 */

const enabled = process.env.E2E_SUPABASE === "1";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

test.skip(!enabled, "Needs the local Supabase stack (E2E_SUPABASE=1).");
test.describe.configure({ mode: "serial" });

const admin = () => createClient<Database>(URL_, process.env.SUPABASE_SECRET_KEY ?? "", { auth: { persistSession: false } });

interface MailSummary {
  ID: string;
}

/** Empties this address's inbox in Mailpit, so the next email is the one we wait for. */
async function clearMail(page: Page, to: string) {
  await page.request.delete(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
}

/** The newest email to this address in Mailpit: its 6-digit code and its one-click link. */
async function latestMail(page: Page, to: string): Promise<{ code: string; link: string } | null> {
  const search = await page.request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
  const { messages } = (await search.json()) as { messages: MailSummary[] };
  const newest = messages[0];
  if (!newest) return null;
  const detail = await page.request.get(`${MAILPIT}/api/v1/message/${newest.ID}`);
  const { HTML } = (await detail.json()) as { HTML: string };
  const code = />\s*(\d{6})\s*</.exec(HTML)?.[1] ?? "";
  const link = (/href="([^"]*token_hash=[^"]*)"/.exec(HTML)?.[1] ?? "").replaceAll("&amp;", "&");
  return code ? { code, link } : null;
}

async function mail(page: Page, to: string): Promise<{ code: string; link: string }> {
  await expect.poll(async () => (await latestMail(page, to)) !== null, { timeout: 15_000 }).toBe(true);
  return (await latestMail(page, to)) ?? { code: "", link: "" };
}

async function profileOf(email: string): Promise<{ id: string; confirmed: boolean } | null> {
  const { data } = await admin().auth.admin.listUsers({ perPage: 200 });
  const user = data.users.find((candidate) => candidate.email === email);
  return user ? { id: user.id, confirmed: Boolean(user.email_confirmed_at) } : null;
}

async function signIns(id: string) {
  const { data } = await admin().from("sign_ins").select("result, ip, device_id").eq("profile_id", id).order("at", { ascending: false });
  return data ?? [];
}

/** Signing in: the email, then (when `enter`) the code from the email. */
async function logIn(page: Page, email: string, { enter = true }: { enter?: boolean } = {}) {
  await clearMail(page, email);
  await page.goto("/de/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByRole("button", { name: "Code senden", exact: true }).click();
  if (!enter) return;
  await expect(page.getByRole("heading", { name: "Gib deinen Code ein" })).toBeVisible();
  await page.getByLabel("Anmeldecode").fill((await mail(page, email)).code);
}

const name = `real-${Date.now().toString(36)}`;
const email = `${name}@example.com`;

test("sign up with the code from the email, build the page; it is saved on the server", async ({ page }) => {
  await clearMail(page, email);
  await page.goto(`/de/signup?name=${name}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(`linkyo.app/${name} ist frei`)).toBeVisible();
  await page.locator("#signup-email").fill(email);
  await page.locator("form button[type=submit]").click();
  // No session yet: the code from the email comes first. No demo notes with real accounts.
  await expect(page.getByRole("heading", { name: "Gib deinen Code ein" })).toBeVisible();
  await expect(page.locator("[id$='-demo']")).toHaveCount(0);
  await expect(page.getByText("Es wird keine E-Mail verschickt")).toHaveCount(0);
  expect((await profileOf(email))?.confirmed).toBe(false);

  const { code } = await mail(page, email);
  await page.getByLabel("Anmeldecode").fill(code);
  await page.waitForURL("**/de/app/welcome");
  const account = await profileOf(email);
  expect(account?.confirmed).toBe(true);

  await page.getByRole("button", { name: "Später" }).click();
  await page.waitForURL("**/de/app");
  await page.goto("/de/app/settings/legal");
  await page.getByLabel("Vollständiger Name oder Firma").fill("Rea Lund");
  await page.getByRole("button", { name: "Impressum speichern" }).click();
  await expect(page.getByText("Impressum gespeichert").first()).toBeVisible();
  // Saved in the background: the server has it a moment later.
  await expect
    .poll(async () => {
      const { data } = await admin().from("sites").select("legal, onboarded").eq("profile_id", account?.id ?? "").single();
      return (data?.legal as { name?: string } | null)?.name;
    })
    .toBe("Rea Lund");
  // A reload reads it back from the server.
  await page.reload();
  await expect(page.getByLabel("Vollständiger Name oder Firma")).toHaveValue("Rea Lund");
});

test("a wrong code is logged as failed; the right one signs in and is logged with the device", async ({ page }) => {
  const account = await profileOf(email);
  await logIn(page, email, { enter: false });
  await expect(page.getByRole("heading", { name: "Gib deinen Code ein" })).toBeVisible();
  const { code } = await mail(page, email);
  await page.getByLabel("Anmeldecode").fill(code === "000000" ? "111111" : "000000");
  await expect(page.getByText("Dieser Code passt nicht")).toBeVisible();
  await page.getByLabel("Anmeldecode").fill(code);
  await page.waitForURL("**/de/app");
  const log = await signIns(account?.id ?? "");
  expect(log.slice(0, 2).map((entry) => entry.result)).toEqual(["success", "failed"]);
  expect(log[0]?.device_id).toMatch(/^dev_/);
  // The owner sees their own sign-ins.
  await page.goto("/de/app/settings/account");
  await expect(page.getByRole("heading", { name: "Letzte Anmeldungen" })).toBeVisible();
  await expect(page.getByText("Dieses Gerät").first()).toBeVisible();
});

test("the one-click link in the email signs in as well", async ({ page }) => {
  await logIn(page, email, { enter: false });
  const { link } = await mail(page, email);
  expect(link).toContain("type=email");
  await page.goto(link);
  await page.waitForURL("**/de/app");
});

test("an address without an account gets the same answer, and no email", async ({ page }) => {
  const nobody = `nobody-${name}@example.com`;
  await logIn(page, nobody, { enter: false });
  await expect(page.getByText(`Wenn es für ${nobody} ein Linkyo-Konto gibt`)).toBeVisible();
  await page.waitForTimeout(1500);
  expect(await latestMail(page, nobody)).toBeNull();
  expect(await profileOf(nobody)).toBeNull();
});

test("the username check asks the server: a taken name is refused while typing", async ({ page }) => {
  await page.goto(`/de/signup?name=${name}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Diese Adresse ist schon vergeben").first()).toBeVisible();
});

test("suspended accounts and blocked addresses cannot sign in", async ({ page }) => {
  const account = await profileOf(email);
  await admin().from("profiles").update({ status: "suspended" }).eq("id", account?.id ?? "");
  await logIn(page, email);
  await expect(page.getByText("Dieses Konto ist vorübergehend gesperrt")).toBeVisible();
  await admin().from("profiles").update({ status: "active" }).eq("id", account?.id ?? "");

  // A blocked address doesn't even get a code.
  await admin().from("blocked_ips").insert({ ip: "127.0.0.1", reason: "e2e" });
  await logIn(page, email, { enter: false });
  await expect(page.getByText("Von dieser Verbindung aus ist gerade keine Anmeldung möglich")).toBeVisible();
  await admin().from("blocked_ips").delete().eq("ip", "127.0.0.1");
});

test("deleting the account removes it from the server", async ({ page }) => {
  await logIn(page, email);
  await page.waitForURL("**/de/app");
  await page.goto("/de/app/settings/account");
  await page.getByRole("button", { name: "Konto löschen" }).first().click();
  await page.getByLabel(`Gib ${name} zur Bestätigung ein`).fill(name);
  await page.getByRole("button", { name: "Endgültig löschen" }).click();
  await expect.poll(async () => (await profileOf(email)) === null).toBe(true);
});

// ── The team console on real data ───────────────────────────────────────────────────────────
const stamp = Date.now().toString(36);
const customerName = `cust-${stamp}`;
const customerEmail = `${customerName}@example.com`;
const ownerEmail = `boss-${stamp}@example.com`;

/** A confirmed account made directly in the database (the sign-up flow is covered above). */
async function account(emailAddress: string, username: string) {
  const { data, error } = await admin().auth.admin.createUser({
    email: emailAddress,
    email_confirm: true,
    user_metadata: { username, locale: "en" },
  });
  if (error) throw error;
  return data.user.id;
}

async function logInEn(page: Page, emailAddress: string) {
  await clearMail(page, emailAddress);
  await page.goto("/en/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(emailAddress);
  await page.getByRole("button", { name: "Send code", exact: true }).click();
  await page.getByLabel("Sign-in code").fill((await mail(page, emailAddress)).code);
  await page.waitForURL(/\/en\/app/);
}

test("the console is only for team members: the database decides, no code", async ({ page }) => {
  await account(customerEmail, customerName);
  await logInEn(page, customerEmail);
  await page.goto("/en/admin");
  await expect(page.getByText("No access to the team area")).toBeVisible();
});

test("the owner finds a customer, suspends them, writes a note and blocks an address; all in the database and the log", async ({ page }) => {
  await account(ownerEmail, `boss-${stamp}`);
  await admin().rpc("make_owner", { owner_email: ownerEmail });
  await logInEn(page, ownerEmail);

  await page.goto("/en/admin/customers");
  await page.getByLabel("Search").fill(customerName);
  await page.locator("main a[href*='/admin/customers/']").locator("visible=true").first().click();
  await expect(page.getByRole("heading", { level: 1, name: customerName })).toBeVisible();
  const customerId = (await profileOf(customerEmail))?.id ?? "";

  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("menuitem", { name: "Suspend account" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Suspend account" }).click();
  await expect(page.getByText("Account suspended").first()).toBeVisible();
  await expect.poll(async () => (await admin().from("profiles").select("status").eq("id", customerId).single()).data?.status).toBe("suspended");

  await page.getByRole("radio", { name: "Notes" }).click();
  await page.getByLabel("Add a note").fill("Asked us to pause the account.");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText("Asked us to pause the account.")).toBeVisible();

  // The customer's sign-in from the first test is in the security log, with its address.
  await page.goto("/en/admin/security");
  const row = page.getByRole("row").filter({ hasText: customerName }).first();
  await expect(row).toContainText("127.0.0.1");
  await row.getByRole("button", { name: "Block 127.0.0.1" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Block", exact: true }).click();
  await expect(page.getByRole("region", { name: "Blocked addresses" }).getByText("127.0.0.1", { exact: true })).toBeVisible();
  expect((await admin().from("blocked_ips").select("ip")).data?.map((entry) => entry.ip)).toContain("127.0.0.1");
  await page.getByRole("region", { name: "Blocked addresses" }).getByRole("button", { name: "Unblock" }).click();
  await expect(page.getByRole("region", { name: "Blocked addresses" }).getByText("127.0.0.1", { exact: true })).toHaveCount(0);

  // Every action is in the database's activity log, by the owner.
  const { data: log } = await admin()
    .from("audit_log")
    .select("action, actor")
    .in("action", ["customer.suspend", "customer.note", "ip.block", "ip.unblock"])
    .order("id", { ascending: false })
    .limit(4);
  expect(log?.map((entry) => entry.action).sort()).toEqual(["customer.note", "customer.suspend", "ip.block", "ip.unblock"]);
  expect(log?.every((entry) => entry.actor === ownerEmail)).toBe(true);
  await page.goto("/en/admin/activity");
  await expect(page.getByText(/suspended/).first()).toBeVisible();
});
