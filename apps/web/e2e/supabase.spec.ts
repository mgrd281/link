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
const PASSWORD = "night-shift-42";

test.skip(!enabled, "Needs the local Supabase stack (E2E_SUPABASE=1).");
test.describe.configure({ mode: "serial" });

const admin = () => createClient<Database>(URL_, process.env.SUPABASE_SECRET_KEY ?? "", { auth: { persistSession: false } });

interface MailSummary {
  ID: string;
}
/** The newest email to this address in Mailpit, and the link with a one-time token inside it. */
async function findLink(page: Page, to: string, type: string): Promise<string> {
  const search = await page.request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
  const { messages } = (await search.json()) as { messages: MailSummary[] };
  for (const message of messages) {
    const detail = await page.request.get(`${MAILPIT}/api/v1/message/${message.ID}`);
    const { HTML } = (await detail.json()) as { HTML: string };
    const found = /href="([^"]*type=([a-z_]+)[^"]*)"/.exec(HTML);
    if (found?.[2] === type) return (found[1] ?? "").replaceAll("&amp;", "&");
  }
  return "";
}

async function linkFromMail(page: Page, to: string, type: string): Promise<string> {
  await expect.poll(async () => (await findLink(page, to, type)) !== "", { timeout: 15_000 }).toBe(true);
  return findLink(page, to, type);
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

async function logIn(page: Page, email: string, password: string) {
  await page.goto("/de/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
}

const name = `real-${Date.now().toString(36)}`;
const email = `${name}@example.com`;

test("sign up, confirm by email, build the page; it is saved on the server", async ({ page }) => {
  await page.goto(`/de/signup?name=${name}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(`linkyo.app/${name} ist frei`)).toBeVisible();
  await page.locator("#signup-email").fill(email);
  await page.locator("#signup-password").fill(PASSWORD);
  await page.locator("form button[type=submit]").click();
  // No session yet: the address has to be confirmed first.
  await expect(page.getByRole("heading", { name: "Fast geschafft: Bestätige deine E-Mail" })).toBeVisible();
  await expect(page.getByText(email).first()).toBeVisible();
  expect((await profileOf(email))?.confirmed).toBe(false);
  // No demo notes with real accounts.
  await expect(page.getByText("Konto und Seite werden nur in diesem Browser gespeichert")).toHaveCount(0);

  // The link in the email signs in and continues with the welcome flow.
  await page.goto(await linkFromMail(page, email, "signup"));
  await page.waitForURL("**/de/app/welcome");
  const account = await profileOf(email);
  expect(account?.confirmed).toBe(true);

  await page.getByRole("button", { name: "Später" }).click();
  await page.waitForURL("**/de/app");
  await page.goto("/de/app/settings");
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

test("a wrong password is logged as failed; the right one signs in and is logged with the device", async ({ page }) => {
  const account = await profileOf(email);
  await logIn(page, email, "wrong-pass-1");
  await expect(page.getByText("E-Mail oder Passwort stimmt nicht")).toBeVisible();
  await logIn(page, email, PASSWORD);
  await page.waitForURL("**/de/app");
  const log = await signIns(account?.id ?? "");
  expect(log.slice(0, 2).map((entry) => entry.result)).toEqual(["success", "failed"]);
  expect(log[0]?.device_id).toMatch(/^dev_/);
  // The owner sees their own sign-ins.
  await page.goto("/de/app/settings");
  await expect(page.getByRole("heading", { name: "Letzte Anmeldungen" })).toBeVisible();
  await expect(page.getByText("Dieses Gerät").first()).toBeVisible();
});

test("the username check asks the server: a taken name is refused while typing", async ({ page }) => {
  await page.goto(`/de/signup?name=${name}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Diese Adresse ist schon vergeben").first()).toBeVisible();
});

test("forgot password: the link by email leads to a new password, which then works", async ({ page }) => {
  await page.goto("/de/forgot");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByRole("button", { name: "Link senden" }).click();
  await expect(page.getByRole("heading", { name: "Schau in dein Postfach" })).toBeVisible();
  await page.goto(await linkFromMail(page, email, "recovery"));
  await page.waitForURL("**/de/reset-password");
  await page.getByLabel("Neues Passwort").fill("brand-new-pass-7");
  await page.getByRole("button", { name: "Passwort speichern" }).click();
  await expect(page.getByRole("heading", { name: "Passwort geändert" })).toBeVisible();
  await page.context().clearCookies();
  await logIn(page, email, "brand-new-pass-7");
  await page.waitForURL("**/de/app");
});

test("suspended accounts and blocked addresses cannot sign in", async ({ page }) => {
  const account = await profileOf(email);
  await admin().from("profiles").update({ status: "suspended" }).eq("id", account?.id ?? "");
  await logIn(page, email, "brand-new-pass-7");
  await expect(page.getByText("Dieses Konto ist vorübergehend gesperrt")).toBeVisible();
  await admin().from("profiles").update({ status: "active" }).eq("id", account?.id ?? "");

  await admin().from("blocked_ips").insert({ ip: "127.0.0.1", reason: "e2e" });
  await logIn(page, email, "brand-new-pass-7");
  await expect(page.getByText("Von dieser Verbindung aus ist gerade keine Anmeldung möglich")).toBeVisible();
  await admin().from("blocked_ips").delete().eq("ip", "127.0.0.1");
});

test("deleting the account removes it from the server", async ({ page }) => {
  await logIn(page, email, "brand-new-pass-7");
  await page.waitForURL("**/de/app");
  await page.goto("/de/app/settings");
  await page.getByRole("button", { name: "Konto löschen" }).first().click();
  await page.getByLabel(`Gib ${name} zur Bestätigung ein`).fill(name);
  await page.getByRole("button", { name: "Endgültig löschen" }).click();
  await expect.poll(async () => (await profileOf(email)) === null).toBe(true);
});
