import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { enterDemoCode } from "./auth";

/**
 * The Invite screen (`/app/invite`, ADR 0064), demo mode, on desktop and on a phone. Demo invites
 * work within one browser, exactly as the screen's demo note says: sign out, open your link, make a
 * second account. Text queries are scoped to #main (the section panel repeats the group titles).
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const STORAGE_KEY = "linkyo.demo.v1";

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× — ${v.nodes[0]?.target.join(" ")}`);
}

const SKIP = { en: "Skip for now", ar: "لاحقًا" } as const;

/** Signs up with this email on the sign-up page (with `ref` when it came through an invite link) and skips the welcome flow. */
async function signUpHere(page: Page, email: string, locale: "en" | "ar" = "en") {
  await page.waitForLoadState("networkidle");
  await page.locator("#signup-email").fill(email);
  await page.locator("form button[type=submit]").click();
  await enterDemoCode(page);
  await page.waitForURL(`**/${locale}/app/welcome`);
  await page.getByRole("button", { name: SKIP[locale] }).click();
  await page.waitForURL(`**/${locale}/app`);
}

async function signedIn(page: Page, email: string, locale: "en" | "ar" = "en") {
  await page.goto(`/${locale}/signup`);
  await signUpHere(page, email, locale);
}

async function logOut(page: Page) {
  await page.goto("/en/app/settings");
  await page.getByRole("button", { name: "Log out" }).last().click();
  await page.waitForURL("**/en/login?next=*");
}

async function logIn(page: Page, email: string) {
  await page.goto("/en/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send code", exact: true }).click();
  await enterDemoCode(page);
  await page.waitForURL("**/en/app");
}

const main = (page: Page) => page.locator("#main");
const card = (page: Page) => main(page).locator('section[aria-labelledby="invite-link"]');
const rewards = (page: Page) => main(page).getByRole("region", { name: "Rewards" });
const people = (page: Page) => main(page).getByRole("region", { name: "People you invited" });
const verificationRow = (page: Page) => rewards(page).getByRole("listitem").filter({ hasText: "Free verification review" });
const proRow = (page: Page) => rewards(page).getByRole("listitem").filter({ hasText: "Pro for life" });

/** Opens the Invite screen and reads the code off the card's address. */
async function inviteCode(page: Page): Promise<string> {
  await page.goto("/en/app/invite");
  const code = card(page).locator('p[dir="ltr"] > span').last();
  await expect(code).toHaveText(/^[2-9a-hjkmnp-z]{8}$/);
  return (await code.textContent()) ?? "";
}

/** Someone opens the invite link in this browser, signs up, skips the welcome flow and signs out. */
async function friendJoins(page: Page, code: string, email: string) {
  await page.goto(`/en/i/${code}`);
  await page.waitForURL(`**/en/signup?ref=${code}`);
  await signUpHere(page, email);
  await logOut(page);
}

/** A creator with this many friends who joined through their link, signed in again on the Invite screen. */
async function inviterWith(page: Page, friends: number) {
  const id = unique();
  const email = `ana-${id}@example.com`;
  await signedIn(page, email);
  const code = await inviteCode(page);
  await logOut(page);
  for (let index = 0; index < friends; index += 1) await friendJoins(page, code, `friend${index}-${id}@example.com`);
  await logIn(page, email);
  await page.goto("/en/app/invite");
  return { email, code };
}

test.describe("Invite screen", () => {
  test("a friend who signs up with your link counts once the code is entered", async ({ page }) => {
    test.setTimeout(120_000);
    await inviterWith(page, 1);
    // The friend skipped the welcome flow, so their page has a name: it is listed by it, never by an email.
    await expect(people(page).getByRole("listitem")).toHaveCount(1);
    await expect(people(page).getByText("Counts", { exact: true })).toBeVisible();
    await expect(people(page)).not.toContainText("@example.com");
    await expect(rewards(page).getByText("1 friend counted", { exact: true })).toBeVisible();
    await expect(verificationRow(page)).toContainText("2 more friends");
    await expect(verificationRow(page).getByRole("progressbar")).toHaveAttribute("aria-valuetext", "1 of 3");
    await expect(proRow(page)).toContainText("9 more friends");
    // Nothing to request yet: the one primary is sharing.
    await expect(main(page).getByRole("button", { name: "Request review" })).toHaveCount(0);
    await expect(main(page).getByRole("button", { name: "Share invite link" })).toBeVisible();
  });

  test("three counted friends unlock the review", async ({ page }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await inviterWith(page, 3);
    await expect(rewards(page).getByText("3 friends counted", { exact: true })).toBeVisible();
    await expect(people(page).getByText("Counts", { exact: true })).toHaveCount(3);
    await expect(verificationRow(page)).toContainText("Unlocked. Ask for your review.");
    await expect(proRow(page)).toContainText("7 more friends");

    await main(page).getByRole("button", { name: "Request review" }).click();
    const sheet = page.getByRole("dialog", { name: "Request verification" });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText("in the bio of at least one official profile");
    expect(await axe(page), "verification sheet").toEqual([]);

    // Nothing entered: the field says what it needs.
    await sheet.getByRole("button", { name: "Send request" }).click();
    await expect(sheet.getByText("Enter links that start with https://.")).toBeVisible();

    await sheet.getByLabel("Official profile", { exact: true }).fill("https://instagram.com/mila");
    await sheet.getByRole("button", { name: "Send request" }).click();
    await expect(page.getByText("Request sent. You'll see the result on this screen.", { exact: true })).toBeVisible();
    await expect(sheet).toBeHidden();
    await expect(verificationRow(page)).toContainText("Requested on");
    // The button that opened the sheet is gone: focus is on the row it belonged to.
    await expect(page.locator("#invite-verification-title")).toBeFocused();
    await expect(main(page).getByRole("button", { name: "Request review" })).toHaveCount(0);

    await page.reload();
    await expect(verificationRow(page)).toContainText("Requested on");
    await expect(main(page).getByRole("button", { name: "Request review" })).toHaveCount(0);
  });

  test("a self-invite doesn't count", async ({ page }) => {
    test.setTimeout(120_000);
    const id = unique();
    const email = `self-${id}@example.com`;
    await signedIn(page, email);
    const code = await inviteCode(page);
    await logOut(page);
    // The same mailbox with a +tag.
    await friendJoins(page, code, `self-${id}+1@example.com`);
    await logIn(page, email);
    await page.goto("/en/app/invite");
    await expect(people(page).getByRole("listitem")).toHaveCount(1);
    await expect(people(page).getByText("Doesn't count", { exact: true })).toBeVisible();
    await expect(rewards(page).getByText("No friends counted yet", { exact: true })).toBeVisible();
  });

  test("Arabic mirrors", async ({ page }) => {
    await signedIn(page, `ar-${unique()}@example.com`, "ar");
    // One friend who counted and later deleted their account (they still count), written straight into the demo storage.
    await page.evaluate((key) => {
      const db = JSON.parse(localStorage.getItem(key) ?? "{}") as { session: { accountId: string }; referrals?: unknown[] };
      db.referrals = [{ id: "r-1", inviterId: db.session.accountId, inviteeId: null, state: "qualified", at: new Date().toISOString() }];
      localStorage.setItem(key, JSON.stringify(db));
    }, STORAGE_KEY);
    await page.goto("/ar/app/invite");
    const address = card(page).locator('p[dir="ltr"]');
    await expect(address).toHaveAttribute("dir", "ltr");
    await expect(address.locator("span").last()).toHaveText(/^[2-9a-hjkmnp-z]{8}$/);
    await expect(main(page).getByText("حساب محذوف", { exact: true })).toBeVisible();

    // The bar fills from the inline start, which is the right in Arabic.
    const bar = main(page).getByRole("progressbar").first();
    await expect(bar).toHaveAttribute("aria-valuenow", "1");
    const [track, fill] = await bar.evaluate((element) => {
      const box = (node: Element) => {
        const rect = node.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width };
      };
      return [box(element), box(element.firstElementChild ?? element)];
    });
    expect(Math.abs(fill.right - track.right)).toBeLessThanOrEqual(1);
    expect(fill.width).toBeGreaterThan(0);
    expect(fill.left).toBeGreaterThan(track.left);
    expect(await axe(page)).toEqual([]);
  });

  test("empty state is honest", async ({ page }) => {
    await signedIn(page, `fresh-${unique()}@example.com`);
    await page.goto("/en/app/invite");
    await expect(people(page).getByRole("listitem")).toHaveCount(1);
    await expect(people(page)).toContainText("No one yet. Share your link: people show up here as soon as they sign up.");
    await expect(rewards(page).getByText("No friends counted yet", { exact: true })).toBeVisible();
    // No sample people, no badge, no progress that isn't there.
    await expect(people(page).locator("bdi")).toHaveCount(0);
    await expect(main(page).getByText("Counts", { exact: true })).toHaveCount(0);
    for (const bar of await main(page).getByRole("progressbar").all()) await expect(bar).toHaveAttribute("aria-valuenow", "0");
    await expect(verificationRow(page)).toContainText("3 more friends");
    await expect(proRow(page)).toContainText("10 more friends");
  });
});
