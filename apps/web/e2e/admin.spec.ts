import AxeBuilder from "@axe-core/playwright";
import { TEMPLATE_IDS } from "@linkyo/tokens/creator";
import { expect, test, type Page } from "@playwright/test";

import { enterDemoCode } from "./auth";

/**
 * The Linkyo team area (/admin), end to end. Demo mode: accounts and team data live in this
 * browser; the team code is checked by the server. Runs on desktop and on a phone.
 */

const TEAM_CODE = "linkyo-team-4827";
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

async function signUp(page: Page, locale = "en") {
  const name = `team-${unique()}`;
  await page.goto(`/${locale}/signup?name=${name}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(`linkyo.app/${name}`)).toBeVisible();
  await page.locator("#signup-email").fill(`${name}@example.com`);
  await page.locator("form button[type=submit]").click();
  await enterDemoCode(page);
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

/** "View as" sits in the account menu (A-11), on phones and laptops alike. */
async function viewAs(page: Page, role: "Viewer" | "Editor" | "Owner") {
  await page.getByRole("button", { name: /^Account/ }).locator("visible=true").first().click();
  await page.getByRole("menuitemradio", { name: role }).click();
}

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

  test("roles decide what each person can do; owners can check by viewing as another role", async ({ page }) => {
    await owner(page);
    await go(page, "Team");
    await page.getByRole("button", { name: "Add member" }).click();
    await page.getByLabel("Name", { exact: true }).fill("Sara");
    await page.getByLabel("Email", { exact: true }).fill(`sara-${unique()}@example.com`);
    await page.getByRole("dialog").getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("Sara is now on the team.", { exact: true })).toBeVisible();
    // A table from md; on a phone one row per permission with every role under it (nothing cut off).
    const matrix = page.getByRole("table", { name: "Roles & permissions" }).or(page.getByRole("list", { name: "Roles & permissions" }));
    await expect(matrix.locator("visible=true")).toHaveCount(1);

    const username = `mo-${unique()}`;
    await createPage(page, "Mo", username);
    await viewAs(page, "Editor");
    await expect(page.getByText("You're viewing the team area as Editor.")).toBeVisible();
    // Editors build pages; approval, verification and invites are for admins.
    await nav(page).getByRole("link", { name: "Creators" }).click();
    // The page just made (other pages may start with "Mo" too, like Mo Salah's concept page).
    await page.locator(`a[href$="/admin/creators/${username}"]`).click();
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
    // Filters sit behind one button, in a sheet (A-11); what is on shows as removable chips.
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    const filters = page.getByRole("dialog", { name: "Filters" });
    await filters.getByRole("button", { name: "Payment failed" }).click();
    await expect(filters.getByRole("button", { name: "Payment failed" })).toHaveAttribute("aria-pressed", "true");
    await filters.getByRole("button", { name: /^Show \d+ customers?$/ }).click();
    await expect(filters).toBeHidden();
    await expect(page.getByRole("status")).toContainText(/\d+ customers?/);
    await page.getByRole("button", { name: "Remove filter Payment failed" }).click();
    await expect(page.getByRole("group", { name: "Active filters" })).toHaveCount(0);
    await page.getByLabel("Search").fill("haddad");
    const first = page.locator("main a[href*='/admin/customers/cus_']").locator("visible=true").first();
    const name = (await first.textContent()) ?? "";
    await first.click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

    await page.getByRole("button", { name: "Change plan" }).click();
    // By hand the team gives Pro free of charge (a paid plan changes only through Stripe).
    await page.getByRole("menuitem", { name: "Give Pro (team)" }).click();
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
    // The list shows the person's name, which a new page makes from its address ("team-x1" → "Team X1").
    const row = page.locator("[data-sign-ins] > li").filter({ hasText: new RegExp(account.name.replace(/-/g, " "), "i") }).first();
    await expect(row).toContainText(/127\.0\.0\.1|::1/);
    await expect(row).toContainText("Signed in");
    const ip = (await row.locator("[data-ip]").textContent())?.trim() ?? "";
    await row.getByRole("button", { name: `Block ${ip}` }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Block", exact: true }).click();
    await page.getByRole("radio", { name: /^Blocked/ }).click();
    await expect(page.getByRole("list", { name: "Blocked addresses" }).getByText(ip, { exact: true })).toBeVisible();
    // The customer sees the same sign-in in their own settings (after skipping the welcome flow).
    await page.goto("/en/app/welcome");
    await page.getByRole("button", { name: "Skip for now" }).click();
    await page.waitForURL("**/en/app");
    await page.goto("/en/app/settings/account");
    await expect(page.getByRole("heading", { name: "Recent sign-ins" })).toBeVisible();
    await expect(page.getByText("This device").first()).toBeVisible();
  });

  test("only owners and admins export customers; editors see no customers at all", async ({ page }) => {
    await owner(page);
    await go(page, "Customers");
    await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();

    // A viewer: the list, no export.
    await viewAs(page, "Viewer");
    await expect(page.getByText("You're viewing the team area as Viewer.")).toBeVisible();
    await go(page, "Customers");
    await expect(page.getByRole("heading", { level: 1, name: "Customers" })).toBeVisible();
    await expect(page.locator("main a[href*='/admin/customers/cus_']").locator("visible=true").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Export CSV" })).toHaveCount(0);

    // An editor: no customers, no addresses, no export, on any screen.
    await viewAs(page, "Editor");
    await expect(page.getByText("You're viewing the team area as Editor.")).toBeVisible();
    // The customer list that was open turns into the notice (the menu is on every screen now, phones too).
    await expect(page.getByRole("heading", { level: 1, name: "Customers aren't visible to your role" })).toBeVisible();
    await expect(page.locator("main")).not.toContainText("@example.com");
    await nav(page).getByRole("link", { name: "Overview", exact: true }).click();
    await expect(nav(page).getByRole("link", { name: "Customers", exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: "Newest customers" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Export CSV" })).toHaveCount(0);
  });

  test("without payments the money routes send nothing to Stripe and say so", async ({ request }) => {
    for (const action of ["refund", "cancel", "resume"]) {
      const response = await request.post(`/api/admin/customers/00000000-0000-4000-8000-000000000001/billing/${action}`, { data: { invoice: "in_1" } });
      expect(response.status()).toBe(409);
      const body = (await response.json()) as { ok: boolean; error: string; message: string };
      expect(body).toMatchObject({ ok: false, error: "paymentsOff" });
      expect(body.message).toContain("nothing was sent to Stripe");
    }
  });

  test("viewers see revenue and customers but can't change anything", async ({ page }) => {
    await owner(page);
    await viewAs(page, "Viewer");
    await go(page, "Customers");
    await page.locator("main a[href*='/admin/customers/cus_']").locator("visible=true").first().click();
    await expect(page.getByRole("radio", { name: "Subscription" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Change plan" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Actions" })).toHaveCount(0);
  });
});

/**
 * The invite program in the team area (ADR 0064): verification requests and held invites under
 * Referrals, and each customer's Invites tab. Demo mode: every account lives in this browser.
 */
const DEMO_KEY = "linkyo.demo.v1";

/** Signs out from the team area's account menu. */
async function logOutOfTeam(page: Page) {
  await page.getByRole("button", { name: /^Account/ }).locator("visible=true").first().click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await page.waitForURL(/\/en\/login/);
}

/** Skips the welcome flow (if it is open), then signs out from the dashboard's settings. */
async function skipAndLogOut(page: Page) {
  if (page.url().includes("/app/welcome")) {
    await page.getByRole("button", { name: "Skip for now" }).click();
    await page.waitForURL("**/en/app");
  }
  await page.goto("/en/app/settings");
  await page.getByRole("button", { name: "Log out" }).last().click();
  await page.waitForURL("**/en/login?next=*");
}

/** Signs back in with the code the demo shows on screen. */
async function logIn(page: Page, email: string) {
  await page.goto("/en/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send code", exact: true }).click();
  await enterDemoCode(page);
  await page.waitForURL(/\/en\/app/);
}

/**
 * A creator with three counted invites, the free verification review and an open request, written
 * the way the demo store keeps them (as the Invite screen leaves them). Reload to show it.
 */
async function seedRequest(page: Page, username: string, name: string) {
  await page.evaluate(
    ([key, handle, displayName]) => {
      const db = JSON.parse(localStorage.getItem(key) ?? "{}") as {
        accounts: { id: string; email: string; username: string; createdAt: string }[];
        sites: Record<string, unknown>;
        referralCodes?: Record<string, string>;
        referrals?: unknown[];
        rewards?: Record<string, unknown>;
        verifications?: Record<string, unknown[]>;
      };
      const now = new Date().toISOString();
      const account = (user: string, shown: string) => {
        const id = crypto.randomUUID();
        db.accounts.push({ id, email: `${user}@example.com`, username: user, createdAt: now });
        db.sites[id] = {
          page: { profile: { username: user, displayName: shown, bio: "", avatar: { src: "", alt: "" }, verified: false, locale: "en" }, blocks: [] },
          theme: {},
          legal: { name: "", address: "", email: "", phone: "" },
          onboarded: true,
          updatedAt: now,
        };
        return id;
      };
      const creator = account(handle, displayName);
      const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
      const code = Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
      db.referralCodes = { ...db.referralCodes, [creator]: code };
      db.referrals = [
        ...(db.referrals ?? []),
        ...[1, 2, 3].map((n) => ({ id: crypto.randomUUID(), inviterId: creator, inviteeId: account(`${handle}-friend${n}`, `Friend ${n}`), state: "qualified", at: now })),
      ];
      db.rewards = { ...db.rewards, [creator]: { verification_review: { at: now, source: "referrals" } } };
      db.verifications = {
        ...db.verifications,
        [creator]: [{ id: crypto.randomUUID(), state: "requested", links: [`https://instagram.com/${handle}`], note: "The link is in my bio.", at: now }],
      };
      localStorage.setItem(key, JSON.stringify(db));
    },
    [DEMO_KEY, username, name] as const,
  );
}

test.describe("referrals", () => {
  test("a verification request shows under Referrals; approving it verifies the page", async ({ page }) => {
    test.setTimeout(240_000);
    const team = await owner(page);
    await logOutOfTeam(page);

    // A creator, and three friends who sign up with the creator's invite link (demo: one browser).
    const creator = await signUp(page);
    const code = await page.evaluate((key) => {
      const db = JSON.parse(localStorage.getItem(key) ?? "{}") as { session: { accountId: string }; referralCodes?: Record<string, string> };
      return db.referralCodes?.[db.session.accountId] ?? "";
    }, DEMO_KEY);
    expect(code).toMatch(/^[2-9a-hjkmnp-z]{8}$/);
    await skipAndLogOut(page);
    for (let friend = 1; friend <= 3; friend++) {
      await page.goto(`/en/i/${code}`);
      await page.waitForURL(`**/en/signup?ref=${code}`);
      await page.waitForLoadState("networkidle");
      await page.locator("#signup-email").fill(`friend${friend}-${unique()}@example.com`);
      await page.locator("form button[type=submit]").click();
      await enterDemoCode(page);
      await page.waitForURL("**/en/app/welcome");
      await skipAndLogOut(page);
    }

    // Three counted friends unlock the review: the creator asks for it on the Invite screen.
    await logIn(page, creator.email);
    await page.goto("/en/app/invite");
    await page.getByRole("button", { name: "Request review" }).locator("visible=true").first().click();
    const sheet = page.getByRole("dialog", { name: "Request verification" });
    await sheet.getByLabel("Official profile", { exact: true }).fill(`https://instagram.com/${creator.name}`);
    await sheet.getByRole("button", { name: "Send request" }).click();
    await expect(sheet).toBeHidden();
    await skipAndLogOut(page);

    // The team finds it under Referrals and approves it.
    await logIn(page, team.email);
    await page.goto("/en/admin");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Hi");
    await go(page, "Referrals");
    await expect(page.getByRole("heading", { level: 1, name: "Referrals" })).toBeVisible();
    const request = page.getByRole("article").filter({ hasText: `@${creator.name}` });
    await expect(request).toContainText("3 invites");
    await expect(request.getByRole("link", { name: `instagram.com/${creator.name}` })).toHaveAttribute("target", "_blank");
    await request.getByRole("button", { name: "Approve (blue check)" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Approve (blue check)" }).click();
    await expect(page.getByText("No open requests.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Decided in the last 30 days" })).toContainText("Approved");

    await go(page, "Activity");
    await expect(page.getByText(new RegExp(`verified ${creator.name} \\(request\\)`))).toBeVisible();

    // Three invites give the review, not Pro for life: no badge in the customers list.
    await go(page, "Customers");
    await page.getByLabel("Search").fill(creator.name);
    await expect(page.locator("main a[href*='/admin/customers/']").locator("visible=true")).toHaveCount(1);
    await expect(page.locator("main").getByText("Pro for life", { exact: true })).toHaveCount(0);

    // The creator sees the blue check on the Invite screen.
    await logOutOfTeam(page);
    await logIn(page, creator.email);
    await page.goto("/en/app/invite");
    await expect(page.getByText("Verified. The blue check is on your page.")).toBeVisible();
  });

  test("Referrals has no accessibility violations: both panes, light and dark, en and ar, and the decline dialog", async ({ page }) => {
    test.setTimeout(120_000);
    await owner(page);
    const username = `nora-${unique()}`;
    await seedRequest(page, username, "Nora Vale");
    for (const locale of ["en", "ar"] as const) {
      for (const colorScheme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme });
        await page.goto(`/${locale}/admin/referrals`);
        await expect(page.getByRole("article").filter({ hasText: `@${username}` })).toBeVisible();
        expect(await axe(page), `${locale} ${colorScheme}: requests`).toEqual([]);
        await page.getByRole("radio", { name: locale === "ar" ? /^للتحقق/ : /^To check/ }).click();
        await expect(page.getByText(locale === "ar" ? "لا شيء للتحقق منه." : "Nothing to check.")).toBeVisible();
        expect(await axe(page), `${locale} ${colorScheme}: to check`).toEqual([]);
      }
    }

    // Declining asks for a reason first (focus starts there), then lists the decision.
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/en/admin/referrals");
    await page.getByRole("article").filter({ hasText: `@${username}` }).getByRole("button", { name: "Decline …" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Decline the request?" });
    await expect(dialog.getByLabel("Reason")).toBeFocused();
    // The dialog fades in; axe measures contrast mid-fade otherwise (a flake under load, not a real issue).
    await expect
      .poll(() => dialog.evaluate((element) => element.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length))
      .toBe(0);
    expect(await axe(page), "decline dialog").toEqual([]);
    await dialog.getByLabel("Reason").selectOption("identityUnclear");
    await dialog.getByRole("button", { name: "Decline", exact: true }).click();
    await expect(page.getByText("No open requests.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Decided in the last 30 days" })).toContainText("Identity unclear");
    await go(page, "Activity");
    await expect(page.getByText(`declined ${username}'s verification`).first()).toBeVisible();
  });

  test("viewers see requests and invites but can't approve or remove anything", async ({ page }) => {
    await owner(page);
    const username = `omar-${unique()}`;
    await seedRequest(page, username, "Omar Fares");
    await page.goto("/en/admin");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Hi");
    await go(page, "Referrals");
    const request = page.getByRole("article").filter({ hasText: `@${username}` });
    await expect(request.getByRole("button", { name: "Approve (blue check)" })).toBeVisible();
    await request.getByRole("link", { name: `@${username}` }).click();
    await page.getByRole("radio", { name: "Invites" }).click();
    await expect(page.getByRole("button", { name: "Remove", exact: true })).toHaveCount(3);
    await expect(page.getByRole("button", { name: "Remove reward …" })).toHaveCount(1);

    await viewAs(page, "Viewer");
    await go(page, "Referrals");
    await expect(request.getByText("Admins and owners can verify.")).toBeVisible();
    await expect(request.getByRole("button")).toHaveCount(0);
    await request.getByRole("link", { name: `@${username}` }).click();
    await page.getByRole("radio", { name: "Invites" }).click();
    await expect(page.locator("[data-invite-state='qualified']")).toHaveCount(3);
    await expect(page.getByRole("button", { name: "Remove", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /reward/ })).toHaveCount(0);
  });
});

test.describe("team console: templates", () => {
  test("every design and every example page, each opening the real page", async ({ page }) => {
    await owner(page);
    await page.goto("/en/admin/templates");
    await expect(page.getByRole("heading", { level: 1, name: "Templates" })).toBeVisible();
    const designs = page.locator('a[href^="/directions/poster?template="]');
    await expect(designs).toHaveCount(TEMPLATE_IDS.length);
    await expect(designs.first()).toHaveAttribute("target", "_blank");
    await page.getByText(/^Examples \(/).click();
    await expect(page.locator('a[href*="/p/"]').first()).toBeVisible();
    expect(await page.locator('a[href*="/p/"]').count()).toBeGreaterThan(40);
    expect(await axe(page)).toEqual([]);
  });
});
