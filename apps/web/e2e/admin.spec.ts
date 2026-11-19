import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * The Linkyo team area (/admin), end to end. Demo mode: accounts and team data live in this
 * browser; the team code is checked by the server. Runs on desktop and on a phone.
 */

const PASSWORD = "night-shift-42";
const TEAM_CODE = "linkyo-team-4827";
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

async function signUp(page: Page, locale = "en") {
  const name = `team-${unique()}`;
  await page.goto(`/${locale}/signup?name=${name}`);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("#signup-username")).toHaveValue(name);
  await page.locator("#signup-email").fill(`${name}@example.com`);
  await page.locator("#signup-password").fill(PASSWORD);
  await page.locator("form button[type=submit]").click();
  await page.waitForURL(`**/${locale}/app/welcome`);
  return { name, email: `${name}@example.com` };
}

/** Signs up and opens the team area with the team code: the account becomes the owner. */
async function owner(page: Page, locale = "en") {
  const account = await signUp(page, locale);
  await page.goto(`/${locale}/admin`);
  await page.locator("#team-code").fill(TEAM_CODE);
  await page.locator("form button[type=submit]").click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(locale === "ar" ? "أهلاً" : "Hi");
  return account;
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× — ${v.nodes[0]?.target.join(" ")}`);
}

/** The bottom tab bar on phones, the sidebar on wide screens: both are labelled "Team area". */
const nav = (page: Page) => page.getByRole("navigation", { name: "Team area" }).locator("visible=true");

/** Opens a section from the navigation; on phones the less used ones sit under "More". */
async function go(page: Page, name: string) {
  const link = nav(page).getByRole("link", { name, exact: true });
  if (await link.count()) {
    await link.first().click();
    return;
  }
  await nav(page).getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { name }).click();
}

async function createPage(page: Page, name: string, username: string, email?: string) {
  await nav(page).getByRole("link", { name: "Creators" }).click();
  await page.getByRole("button", { name: "New page" }).first().click();
  await page.locator("#new-name").fill(name);
  await page.locator("#new-username").fill(username);
  if (email) await page.locator("#new-email").fill(email);
  await page.getByRole("button", { name: "Create & edit" }).click();
  await page.waitForURL(`**/admin/creators/${username}`);
}

test.describe("team area", () => {
  test("is only for signed-in team members, opened with the team code", async ({ page, request }) => {
    await page.goto("/en/admin");
    await page.waitForURL(/\/en\/login\?next=%2Fadmin/);

    await signUp(page);
    await page.goto("/en/admin");
    await page.locator("#team-code").fill("guess");
    await page.locator("form button[type=submit]").click();
    await expect(page.getByText("That code isn't right.")).toBeVisible();
    await expect(page.locator("#team-code")).toBeFocused();

    // The server never lists prepared pages without the team token.
    expect((await request.get("/api/admin/prepared")).status()).toBe(401);
    expect((await request.post("/api/admin/verify", { data: { code: "guess" } })).status()).toBe(403);

    await page.locator("#team-code").fill(TEAM_CODE);
    await page.locator("form button[type=submit]").click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Hi");
    await expect(page.getByText("set up the team area")).toBeVisible();
  });

  test("an account that is not on the team is told who to ask", async ({ page }) => {
    await owner(page);
    await page.getByRole("button", { name: /^Account/ }).locator("visible=true").first().click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await page.waitForURL(/\/en\/login/);
    await signUp(page);
    await page.goto("/en/admin");
    await expect(page.getByRole("heading", { name: "No access to the team area" })).toBeVisible();
  });

  test("prepare a page: build it, verify, invite, approve, download for publishing", async ({ page }) => {
    await owner(page);
    const username = `lina-${unique()}`;
    await createPage(page, "Lina Beats", username, "Lina@Example.com");

    // The same editor creators use: add a link, it shows up on the page.
    await expect(page.getByRole("heading", { name: "Page", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Add your first link" }).click();
    const sheet = page.getByRole("dialog", { name: "Add to your page" });
    await sheet.getByLabel("Paste a link").fill("https://www.youtube.com/watch?v=aqz-KE-bpKQ");
    await sheet.getByRole("button", { name: "Add", exact: true }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByText("1 block")).toBeVisible();

    await page.getByRole("radio", { name: "Invite & approval" }).click();
    await expect(page.getByText("lina@example.com")).toBeVisible();
    await page.getByLabel("Verified (blue check)").click();
    await page.locator("#invite-email").fill("lina.management@example.com");
    await page.getByRole("button", { name: "Invite", exact: true }).click();
    await expect(page.getByText("lina.management@example.com")).toBeVisible();

    const download = page.getByRole("button", { name: "Download file" });
    await expect(download).toBeDisabled();
    await page.getByRole("radio", { name: "Ready" }).click();
    const [file] = await Promise.all([page.waitForEvent("download"), download.click()]);
    expect(file.suggestedFilename()).toBe(`linkyo-${username}.json`);
    const text = await (await file.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks).toString("utf8"));
    const published = JSON.parse(text) as { username: string; verified: boolean; pages: Record<string, { profile: { verified: boolean }; blocks: unknown[] }>; invite: { emailSha256: string[] } };
    expect(published.username).toBe(username);
    expect(published.verified).toBe(true);
    expect(published.pages.en?.profile.verified).toBe(true);
    expect(published.pages.en?.blocks).toHaveLength(1);
    // Emails leave the team area only as SHA-256.
    expect(published.invite.emailSha256).toHaveLength(2);
    expect(text).not.toContain("example.com");

    await go(page, "Activity");
    for (const line of ["created the page", "verified", "added an invite", "approved", "downloaded"]) {
      await expect(page.getByText(line).first()).toBeVisible();
    }
  });

  test("roles decide what each person can do; owners can check by viewing as another role", async ({ page, isMobile }) => {
    await owner(page);
    await go(page, "Team");
    await page.getByRole("button", { name: "Add member" }).click();
    await page.getByLabel("Name", { exact: true }).fill("Sara");
    await page.getByLabel("Email", { exact: true }).fill(`sara-${unique()}@example.com`);
    await page.getByRole("dialog").getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("Sara is now on the team.", { exact: true })).toBeVisible();
    await expect(page.getByRole("table", { name: "Roles & permissions" })).toBeVisible();

    const username = `mo-${unique()}`;
    await createPage(page, "Mo", username);
    if (isMobile) await nav(page).getByRole("link", { name: "Overview" }).click();
    await page.getByLabel("View as").locator("visible=true").selectOption("editor");
    await expect(page.getByText("You're viewing the team area as Editor.")).toBeVisible();
    // Editors build pages; approval, verification and invites are for admins.
    await nav(page).getByRole("link", { name: "Creators" }).click();
    await page.getByRole("link", { name: /^Mo/ }).click();
    await page.getByRole("radio", { name: "Invite & approval" }).click();
    await expect(page.getByText("Admins and owners can approve and publish.")).toBeVisible();
    await expect(page.getByLabel("Verified (blue check)")).toBeDisabled();
  });

  test("a page that is already live can be edited as a draft", async ({ page }) => {
    await owner(page);
    await nav(page).getByRole("link", { name: "Creators" }).click();
    await page.getByRole("link", { name: /Nizar/ }).click();
    await expect(page.getByText("Published: the creator can take it over with their email.")).toBeVisible();
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("radio", { name: "Page" })).toBeVisible();
    await expect(page.getByText("Live version exists")).toBeVisible();
    await page.getByRole("radio", { name: "Invite & approval" }).click();
    await expect(page.getByText("1 invite already published stays valid.")).toBeVisible();
  });

  test("has no accessibility violations", async ({ page }) => {
    await owner(page);
    expect(await axe(page)).toEqual([]);
    const username = `axe-${unique()}`;
    await createPage(page, "Axe Test", username, "axe@example.com");
    expect(await axe(page)).toEqual([]);
    await page.getByRole("radio", { name: "Invite & approval" }).click();
    expect(await axe(page)).toEqual([]);
    for (const path of [
      "/en/admin/creators",
      "/en/admin/team",
      "/en/admin/activity",
      "/ar/admin/team",
      "/en/admin/customers",
      "/en/admin/subscriptions",
      "/en/admin/security",
      "/en/admin/analytics",
      "/ar/admin/customers",
      "/ar/admin/security",
    ]) {
      await page.goto(path);
      await page.locator("main h1").first().waitFor();
      expect(await axe(page), path).toEqual([]);
    }
  });

});

test.describe("customer console", () => {
  test("find a customer, change the plan, suspend, add a note; every action is in the activity log", async ({ page }) => {
    await owner(page);
    await go(page, "Customers");
    await expect(page.getByRole("heading", { level: 1, name: "Customers" })).toBeVisible();
    await page.getByLabel("Status").selectOption("past_due");
    await expect(page.getByRole("status")).toContainText(/\d+ customers?/);
    await page.getByLabel("Status").selectOption("all");
    await page.getByLabel("Search").fill("haddad");
    const first = page.locator("main a[href*='/admin/customers/cus_']").locator("visible=true").first();
    const name = (await first.locator("span.truncate").first().textContent()) ?? "";
    await first.click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

    await page.getByRole("button", { name: "Change plan" }).click();
    await page.getByRole("menuitem", { name: /^Pro/ }).click();
    await expect(page.getByText("Plan changed to Pro").first()).toBeVisible();
    await page.getByRole("button", { name: "Actions" }).click();
    await page.getByRole("menuitem", { name: "Suspend account" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Suspend account" }).click();
    await expect(page.getByText("Suspended", { exact: true }).first()).toBeVisible();

    await page.getByRole("radio", { name: "Notes" }).click();
    await page.getByLabel("Add a note").fill("Called about the custom domain.");
    await page.getByRole("button", { name: "Save note" }).click();
    await expect(page.getByText("Called about the custom domain.")).toBeVisible();
    await expect(page.getByText(/changed the plan/)).toBeVisible();

    await go(page, "Activity");
    await page.getByRole("radio", { name: "Customers" }).click();
    await expect(page.getByText(/suspended/).first()).toBeVisible();
  });

  test("security shows this browser's sign-in with IP and device, and an address can be blocked", async ({ page }) => {
    const account = await owner(page);
    await go(page, "Security");
    await expect(page.getByRole("heading", { level: 1, name: "Security" })).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: account.name }).first();
    await expect(row).toContainText(/127\.0\.0\.1|::1/);
    await expect(row).toContainText("Signed in");
    const ip = (await row.locator("td span.font-mono").first().textContent())?.trim() ?? "";
    await row.getByRole("button", { name: `Block ${ip}` }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Block", exact: true }).click();
    await expect(page.getByRole("region", { name: "Blocked addresses" }).getByText(ip, { exact: true })).toBeVisible();
    // The customer sees the same sign-in in their own settings (after skipping the welcome flow).
    await page.goto("/en/app/welcome");
    await page.getByRole("button", { name: "Skip for now" }).click();
    await page.waitForURL("**/en/app");
    await page.goto("/en/app/settings");
    await expect(page.getByRole("heading", { name: "Recent sign-ins" })).toBeVisible();
    await expect(page.getByText("This device").first()).toBeVisible();
  });

  test("viewers see revenue and customers but can't change anything", async ({ page }) => {
    await owner(page);
    await page.getByLabel("View as").locator("visible=true").selectOption("viewer");
    await go(page, "Customers");
    await page.locator("main a[href*='/admin/customers/cus_']").locator("visible=true").first().click();
    await expect(page.getByRole("radio", { name: "Subscription" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Change plan" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Actions" })).toHaveCount(0);
  });
});
