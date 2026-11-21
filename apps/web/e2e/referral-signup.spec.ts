import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { enterDemoCode } from "./auth";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * Invite links (ADR 0064), demo mode: `/i/<code>` hands the code to the sign-up in the address and
 * stores nothing; the sign-up names the inviter in one line (not a field) and the new account counts.
 * Demo invites work within one browser: sign out, open the link, make a second account.
 */

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

interface DemoDb {
  session: { accountId: string } | null;
  referralCodes?: Record<string, string>;
  referrals?: { inviterId: string; inviteeId: string | null; state: string; reason?: string }[];
  sites: Record<string, { page: { profile: { displayName: string } } }>;
}
const demoDb = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("linkyo.demo.v1") ?? "{}") as DemoDb);

/** Signs up with this email on the sign-up page that is open, entering the on-screen code. */
async function signUpHere(page: Page, email: string) {
  await page.locator("#signup-email").fill(email);
  await page.locator("form button[type=submit]").click();
  await enterDemoCode(page);
  await page.waitForURL("**/en/app/welcome");
}

/** Skips the welcome flow and signs out from Settings. */
async function skipAndLogOut(page: Page) {
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.waitForURL("**/en/app");
  await page.goto("/en/app/settings");
  await page.getByRole("button", { name: "Log out" }).last().click();
  await page.waitForURL("**/en/login?next=*");
}

/** Account A signs up and out; answers A's id and invite code. */
async function inviter(page: Page, email: string) {
  await page.goto("/en/signup");
  await page.waitForLoadState("networkidle");
  await signUpHere(page, email);
  const db = await demoDb(page);
  const id = db.session?.accountId ?? "";
  await skipAndLogOut(page);
  return { id, code: db.referralCodes?.[id] ?? "" };
}

test("an invite link leads to the sign-up with its code, and sets no cookie", async ({ request }) => {
  const valid = await request.get("/en/i/abcdefgh", { maxRedirects: 0 });
  expect(valid.status()).toBe(307);
  expect(valid.headers().location).toBe("/en/signup?ref=abcdefgh");
  expect(valid.headers()["set-cookie"]).toBeUndefined();

  const capitals = await request.get("/en/i/ABCDEFGH", { maxRedirects: 0 });
  expect(capitals.headers().location).toBe("/en/signup?ref=abcdefgh");

  // A code that can't be one: just the sign-up.
  const short = await request.get("/en/i/short", { maxRedirects: 0 });
  expect(short.status()).toBe(307);
  expect(short.headers().location).toBe("/en/signup");
  expect(short.headers()["set-cookie"]).toBeUndefined();

  // Without a language the visitor's own is added first, again without a cookie.
  const bare = await request.get("/i/abcdefgh", { maxRedirects: 0, headers: { "Accept-Language": "ar" } });
  expect(bare.status()).toBe(307);
  expect(new URL(bare.headers().location ?? "", "http://x").pathname).toBe("/ar/i/abcdefgh");
  expect(bare.headers()["set-cookie"]).toBeUndefined();
});

test("a code nobody has shows nothing: the sign-up keeps its one field", async ({ page }) => {
  await page.goto("/en/signup?ref=abcdefgh");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("You were invited to Linkyo")).toHaveCount(0);
  await expect(page.getByText(/^Invited by /)).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveCount(1);
});

test("a friend who signs up through the link is counted for the inviter", async ({ page }) => {
  const id = unique();
  const a = await inviter(page, `ana-${id}@example.com`);
  expect(a.code).toMatch(/^[2-9a-hjkmnp-z]{8}$/);

  await page.goto(`/en/i/${a.code}`);
  await page.waitForURL(`**/en/signup?ref=${a.code}`);
  await page.waitForLoadState("networkidle");
  // A skipped the welcome flow, so their page counts as set up: its name is shown, never the email.
  const name = (await demoDb(page)).sites[a.id]?.page.profile.displayName ?? "";
  expect(name).not.toBe("");
  const line = page.getByText(`Invited by ${name}`);
  await expect(line).toBeVisible();
  await expect(page.getByText(`${name} will see your page name in their invite list, never your email.`)).toBeVisible();
  // A line, not a field.
  await expect(page.getByRole("textbox")).toHaveCount(1);

  await signUpHere(page, `ben-${id}@example.com`);
  const db = await demoDb(page);
  const b = db.session?.accountId;
  expect(db.referrals).toEqual([expect.objectContaining({ inviterId: a.id, inviteeId: b, state: "qualified" })]);
});

test("an inviter whose page isn't set up yet is not named", async ({ page }) => {
  const id = unique();
  await page.goto("/en/signup");
  await page.waitForLoadState("networkidle");
  await signUpHere(page, `new-${id}@example.com`);
  const db = await demoDb(page);
  const code = db.referralCodes?.[db.session?.accountId ?? ""] ?? "";
  // Signed out from the welcome flow (no page yet): the link still invites, without a name.
  await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem("linkyo.demo.v1") ?? "{}") as { session: unknown };
    stored.session = null;
    localStorage.setItem("linkyo.demo.v1", JSON.stringify(stored));
  });
  await page.goto(`/en/i/${code}`);
  await page.waitForURL(`**/en/signup?ref=${code}`);
  await expect(page.getByText("You were invited to Linkyo")).toBeVisible();
  await expect(page.getByText("The person who invited you will see your page name, never your email.")).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(1);
});

for (const [locale, name, line] of [
  ["en", "Lina Beats", "Invited by Lina Beats"],
  ["ar", "لينا بيتس", "دعاك لينا بيتس"],
] as const) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`the invited line reads well and passes axe (${locale}, ${colorScheme})`, async ({ browser }) => {
      const context = await browser.newContext({ colorScheme });
      // An inviter whose page is set up, in this browser's demo storage.
      await context.addInitScript(
        ([value]) => localStorage.setItem("linkyo.demo.v1", value ?? ""),
        [
          JSON.stringify({
            version: 1,
            accounts: [{ id: "acc-1", email: "lina@example.com", username: "lina-beats", createdAt: "2026-11-01T00:00:00.000Z" }],
            sites: {
              "acc-1": {
                page: { profile: { username: "lina-beats", displayName: name, bio: "", avatar: { src: "", alt: "" }, verified: false, locale }, blocks: [] },
                theme: {},
                legal: { name: "", address: "", email: "", phone: "" },
                onboarded: true,
                updatedAt: "2026-11-01T00:00:00.000Z",
              },
            },
            session: null,
            referralCodes: { "acc-1": "k7m2q9xz" },
          }),
        ],
      );
      const page = await context.newPage();
      await page.goto(`/${locale}/i/k7m2q9xz`);
      await page.waitForURL(`**/${locale}/signup?ref=k7m2q9xz`);
      await page.waitForLoadState("networkidle");
      // The name keeps its own direction inside the sentence.
      await expect(page.getByText(line)).toBeVisible();
      await expect(page.locator("form bdi").first()).toHaveText(name);
      await expect(page.getByRole("textbox")).toHaveCount(1);
      const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes[0]?.target.join(" ") ?? ""}`)).toEqual([]);
      await context.close();
    });
  }
}

test("signing up through your own link with a +alias doesn't count", async ({ page }) => {
  const id = unique();
  const a = await inviter(page, `self-${id}@example.com`);
  await page.goto(`/en/i/${a.code}`);
  await page.waitForURL(`**/en/signup?ref=${a.code}`);
  await expect(page.getByText(/^Invited by /)).toBeVisible();
  await signUpHere(page, `self-${id}+1@example.com`);
  const db = await demoDb(page);
  expect(db.referrals).toEqual([expect.objectContaining({ inviterId: a.id, inviteeId: db.session?.accountId, state: "rejected", reason: "self" })]);
});
