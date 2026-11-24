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

test("an account with a password (the team) signs in with it; a wrong one is refused and logged", async ({ page }) => {
  const teamEmail = `team-${Date.now()}@example.com`;
  const secret = `pw-${Date.now()}-Linkyo`;
  const { error } = await admin().auth.admin.createUser({ email: teamEmail, password: secret, email_confirm: true });
  expect(error).toBeNull();
  await page.goto("/de/login");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Mit Passwort anmelden" }).click();
  await page.locator("#login-email").fill(teamEmail);
  await page.locator("#login-password").fill("not-the-password");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page.getByText("E-Mail oder Passwort stimmt nicht.")).toBeVisible();
  await page.locator("#login-password").fill(secret);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await page.waitForURL(/\/de\/app/);
  const account = await profileOf(teamEmail);
  const log = await signIns(account?.id ?? "");
  expect(log.slice(0, 2).map((entry) => entry.result)).toEqual(["success", "failed"]);
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

test("the page address changes only after a confirm that names the old one, and the server has it", async ({ page }) => {
  const account = await profileOf(email);
  const usernameOf = async () => (await admin().from("profiles").select("username").eq("id", account?.id ?? "").single()).data?.username;
  await logIn(page, email);
  await page.waitForURL("**/de/app");
  await page.goto("/de/app/settings/address");
  const field = page.getByLabel("Adresse", { exact: true });
  // Typed as words, written as an address.
  await field.fill(`${name} Neu`);
  await expect(field).toHaveValue(`${name}-neu`);
  await page.getByRole("button", { name: "Adresse ändern" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Adresse ändern?" });
  await expect(dialog).toContainText(`linkyo.app/${name} funktioniert danach nicht mehr`);
  await dialog.getByRole("button", { name: "Adresse ändern" }).click();
  await expect(page.getByText(`Deine Seite ist jetzt unter linkyo.app/${name}-neu`).first()).toBeVisible();
  await expect.poll(usernameOf).toBe(`${name}-neu`);

  // And back, so the tests after this one find the account under its first address.
  await field.fill(name);
  await page.getByRole("button", { name: "Adresse ändern" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Adresse ändern" }).click();
  await expect.poll(usernameOf).toBe(name);
});

test("a new email asks first, then waits for the link: signing in keeps the old one until then", async ({ page }) => {
  const next = `next-${name}@example.com`;
  await clearMail(page, next);
  await logIn(page, email);
  await page.waitForURL("**/de/app");
  await page.goto("/de/app/settings/account");
  const field = page.getByLabel("E-Mail", { exact: true });
  await expect(field).toHaveValue(email);
  await field.fill(next);
  await page.getByRole("button", { name: "E-Mail ändern" }).click();
  const dialog = page.getByRole("alertdialog", { name: "E-Mail ändern?" });
  await expect(dialog).toContainText(next);
  await dialog.getByRole("button", { name: "E-Mail ändern" }).click();
  // The address sits in direction marks, so it reads correctly inside Arabic text too.
  await expect(page.getByRole("status").filter({ hasText: next })).toContainText("Bestätigung ausstehend");
  // The field shows the address that still signs in.
  await expect(field).toHaveValue(email);
  // The confirm link went to the new address (a link only, no sign-in code); the account keeps the old one.
  await expect
    .poll(async () => {
      const search = await page.request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${next}"`)}`);
      return ((await search.json()) as { messages: MailSummary[] }).messages.length;
    })
    .toBeGreaterThan(0);
  expect(await profileOf(email)).not.toBeNull();
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
/** A new page's name is a first guess from its address: "cust-…" shows as "Cust …". */
const customerShown = `Cust ${stamp.charAt(0).toUpperCase()}${stamp.slice(1)}`;
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
  await expect(page.getByRole("heading", { level: 1, name: customerShown })).toBeVisible();
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

  // The customer's sign-in from the first test is in the security log, with its address (the log is
  // the kit's DataList: one item per sign-in, cards on a phone and aligned columns from md).
  await page.goto("/en/admin/security");
  const row = page.getByRole("list", { name: "Sign-in log" }).getByRole("listitem").filter({ hasText: customerShown }).first();
  await expect(row).toContainText("127.0.0.1");
  await row.getByRole("button", { name: "Block 127.0.0.1" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Block", exact: true }).click();
  // The blocked addresses are a pane of the log (its "Blocked" filter), with their Unblock buttons.
  await page.getByRole("radio", { name: /^Blocked/ }).click();
  const blocked = page.getByRole("list", { name: "Blocked addresses" });
  await expect(blocked.getByText("127.0.0.1", { exact: true })).toBeVisible();
  expect((await admin().from("blocked_ips").select("ip")).data?.map((entry) => entry.ip)).toContain("127.0.0.1");
  await blocked.getByRole("button", { name: "Unblock" }).click();
  await expect(blocked.getByText("127.0.0.1", { exact: true })).toHaveCount(0);

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

// ── The invite program on real data (ADR 0064) ──────────────────────────────────────────────

/**
 * What the app itself sends to the database from this page: its publishable key and, once signed in,
 * the account's access token. Lets the test ask the database as that account (row-level security
 * and auth.uid() apply), exactly as the app does.
 */
function databaseCredentials(page: Page) {
  const seen = { apikey: "", token: "" };
  page.on("request", (request) => {
    if (!request.url().startsWith(`${URL_}/rest/v1/`)) return;
    const headers = request.headers();
    if (headers.apikey) seen.apikey = headers.apikey;
    const bearer = /^Bearer (ey\S+)$/.exec(headers.authorization ?? "")?.[1];
    if (bearer) seen.token = bearer;
  });
  return seen;
}

const asAccount = (seen: { apikey: string; token: string }) =>
  createClient<Database>(URL_, seen.apikey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${seen.token}` } },
  });

test("a friend who signs up through an invite link in another browser counts; the team can remove it", async ({ page, browser }) => {
  const inviterName = `inv-${stamp}`;
  const inviterEmail = `${inviterName}@example.com`;
  const friendEmail = `friend-${stamp}@example.com`;

  // The inviter signs in here (browser A): the security log has A's device.
  const inviterSeen = databaseCredentials(page);
  const inviterId = await account(inviterEmail, inviterName);
  await logInEn(page, inviterEmail);
  await expect.poll(() => inviterSeen.token).not.toBe("");
  const code = (await admin().from("profiles").select("referral_code").eq("id", inviterId).single()).data?.referral_code ?? "";
  expect(code).toMatch(/^[2-9a-hjkmnp-z]{8}$/);

  // The friend uses the link in another browser (its own device id; loopback addresses are never compared).
  const other = await browser.newContext();
  const friend = await other.newPage();
  await clearMail(friend, friendEmail);
  await friend.goto(`/en/i/${code}`);
  await friend.waitForURL(`**/en/signup?ref=${code}`);
  await friend.waitForLoadState("networkidle");
  // The inviter's page isn't set up yet, so it isn't named.
  await expect(friend.getByText("You were invited to Linkyo")).toBeVisible();
  await expect(friend.getByRole("textbox")).toHaveCount(1);
  await friend.locator("#signup-email").fill(friendEmail);
  await friend.locator("form button[type=submit]").click();
  await expect(friend.getByRole("heading", { name: "Enter your code" })).toBeVisible();
  await friend.getByLabel("Sign-in code").fill((await mail(friend, friendEmail)).code);
  await friend.waitForURL("**/en/app/welcome");
  await other.close();

  // Our server settled it right after the friend's first sign-in.
  const friendId = (await profileOf(friendEmail))?.id ?? "";
  const { data: referral } = await admin().from("referrals").select("id, inviter_id, state, reason, signals").eq("invitee_id", friendId).single();
  expect(referral).toMatchObject({ inviter_id: inviterId, state: "qualified", reason: null, signals: { sameNetwork: false, emailLink: false } });

  // The inviter sees one counted friend, without their email: in the database's answer and on the Invite screen.
  const asInviter = asAccount(inviterSeen);
  const { data: overview, error } = await asInviter.rpc("my_referrals");
  expect(error).toBeNull();
  expect(overview).toMatchObject({ code, counted: 1, invited: [{ status: "counted", deleted: false, name: null }] });
  expect(JSON.stringify(overview)).not.toContain(friendEmail);
  // Browser A is still in the welcome flow: the inviter skips it first.
  if (page.url().includes("/app/welcome")) {
    await page.getByRole("button", { name: "Skip for now" }).click();
    await page.waitForURL("**/en/app");
  }
  const invited = page.locator("#main").getByRole("region", { name: "Von dir eingeladen" });
  await page.goto("/de/app/invite");
  await expect(invited.getByRole("listitem")).toHaveCount(1);
  await expect(invited.getByText("Zählt", { exact: true })).toBeVisible();
  await expect(invited).not.toContainText(friendEmail);

  // The owner (made by the console test above) removes it as fraud in the customer's Invites tab.
  const ownerPage = await (await browser.newContext()).newPage();
  await logInEn(ownerPage, ownerEmail);
  await ownerPage.goto("/en/admin/customers");
  await ownerPage.getByLabel("Search").fill(inviterName);
  await ownerPage.locator("main a[href*='/admin/customers/']").locator("visible=true").first().click();
  await ownerPage.getByRole("radio", { name: "Invites" }).click();
  const invites = ownerPage.locator("#main").getByRole("list", { name: "Invited accounts" });
  const row = invites.getByRole("listitem").filter({ hasText: "Counts" });
  await expect(row).toHaveCount(1);
  await row.getByRole("button", { name: "Remove", exact: true }).click();
  await ownerPage.getByRole("alertdialog").getByRole("button", { name: "Remove", exact: true }).click();
  await expect(invites.getByRole("listitem").filter({ hasText: "Removed" })).toHaveCount(1);
  await ownerPage.context().close();

  // The inviter's count drops, on the screen and in the database; the activity log names the owner.
  await page.reload();
  await expect(invited.getByText("Zählt nicht", { exact: true })).toBeVisible();
  await expect(invited.getByText("Zählt", { exact: true })).toHaveCount(0);
  const { data: after } = await asInviter.rpc("my_referrals");
  expect(after).toMatchObject({ counted: 0, invited: [{ status: "notCounted" }] });
  const { data: logged } = await admin().from("audit_log").select("action, actor").eq("target_id", inviterId).eq("action", "referral.revoke");
  expect(logged).toEqual([{ action: "referral.revoke", actor: ownerEmail }]);
});

test("a sign-up someone else asked for with their invite code doesn't count when the owner of the address signs in", async ({ page }) => {
  const attackerId = await account(`att-${stamp}@example.com`, `att-${stamp}`);
  const code = (await admin().from("profiles").select("referral_code").eq("id", attackerId).single()).data?.referral_code ?? "";
  const victimEmail = `vic-${stamp}@example.com`;
  // Someone asks for a sign-up code for this address with their own invite code (the account is made unconfirmed).
  await clearMail(page, victimEmail);
  const asked = await page.request.post("/api/auth/code", { data: { email: victimEmail, locale: "en", signUp: { username: `vic-${stamp}`, ref: code } } });
  expect(await asked.json()).toEqual({ ok: true, pending: "code" });
  // That e-mail is delivered a moment after the answer. Wait until it is there: signing in below
  // empties the inbox first, and a sign-up e-mail arriving after that would be read as the sign-in
  // code (the newest e-mail is the one whose code is typed), which the second request has replaced.
  await mail(page, victimEmail);
  const victimId = (await profileOf(victimEmail))?.id ?? "";
  expect((await admin().from("referrals").select("state").eq("invitee_id", victimId).single()).data?.state).toBe("pending");

  // The owner of the address signs in from the sign-in page, without that invite link: the invite is dropped.
  await logInEn(page, victimEmail);
  await expect.poll(async () => (await admin().from("referrals").select("id").eq("invitee_id", victimId)).data?.length).toBe(0);
  const { data: attackerLog } = await admin().from("audit_log").select("action").eq("target_id", attackerId);
  expect(attackerLog ?? []).toEqual([]);
});
