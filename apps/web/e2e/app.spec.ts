import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Accounts + dashboard, end to end (demo mode: everything lives in this browser's storage).
 * Runs on desktop and on a phone. Each test starts with an empty browser.
 */

const PASSWORD = "night-shift-42";
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

async function signUp(page: Page, locale = "en") {
  const name = `mila-${unique()}`;
  await page.goto(`/${locale}/signup?name=${name}`);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("#signup-username")).toHaveValue(name);
  await page.locator("#signup-email").fill(`${name}@example.com`);
  await page.locator("#signup-password").fill(PASSWORD);
  await page.locator("form button[type=submit]").click();
  await page.waitForURL(`**/${locale}/app/welcome`);
  return { name, email: `${name}@example.com` };
}

/** Sign up and skip the welcome flow (for tests about the dashboard itself). */
async function signedIn(page: Page, locale = "en") {
  const account = await signUp(page, locale);
  await page.getByRole("button", { name: locale === "ar" ? "لاحقًا" : "Skip for now" }).click();
  await page.waitForURL(`**/${locale}/app`);
  return account;
}

const addButton = (page: Page) => page.getByRole("button", { name: "Add", exact: true }).first();

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× — ${v.nodes[0]?.target.join(" ")}`);
}

test.describe("accounts", () => {
  test("the homepage claim leads to sign-up with the address filled in", async ({ page }) => {
    await page.goto("/en");
    const field = page.getByRole("textbox", { name: "Choose your page address" }).first();
    await field.fill("mila-aurel");
    await field.press("Enter");
    await page.waitForURL("**/en/signup?name=mila-aurel");
    await expect(page.locator("#signup-username")).toHaveValue("mila-aurel");
    await expect(page.getByText("linkyo.app/mila-aurel is available")).toBeVisible();
  });

  test("sign-up explains what is missing, field by field", async ({ page }) => {
    await page.goto("/en/signup");
    await page.locator("#signup-username").fill("login");
    await expect(page.getByText("This address is reserved for Linkyo.")).toBeVisible();
    await page.locator("#signup-username").fill("mila-ok");
    await page.locator("#signup-email").fill("not-an-email");
    await page.locator("#signup-password").fill("short");
    await page.locator("form button[type=submit]").click();
    await expect(page.locator("#signup-email")).toBeFocused();
    await expect(page.getByText("This email address looks incomplete")).toBeVisible();
    await expect(page.getByText("Choose a password that meets all three points.")).toBeVisible();
  });

  test("sign up → welcome → dashboard, then log out and back in", async ({ page }) => {
    const { name, email } = await signUp(page);
    // Step 1: who you are.
    await page.getByLabel("Name", { exact: true }).fill("Mila Aurel");
    await page.getByLabel("Short bio").fill("DJ and producer from Berlin.");
    await page.getByRole("button", { name: "Continue" }).click();
    // Step 2: look. The live preview follows the choice.
    await expect(page.getByRole("heading", { name: "Pick a look" })).toBeFocused();
    await page.getByText("Pulse", { exact: true }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    // Step 3: links.
    await page.getByLabel("Instagram").fill("milaaurel");
    await page.getByLabel("Important links (optional)").fill("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC https://www.youtube.com/watch?v=aqz-KE-bpKQ");
    await expect(page.getByRole("list", { name: "Recognised links" }).getByRole("listitem")).toHaveCount(2);
    await page.getByRole("button", { name: "Create my page" }).click();
    await expect(page.getByRole("heading", { name: "Your page is ready, Mila Aurel" })).toBeVisible();
    await page.getByRole("button", { name: "Go to dashboard" }).click();
    await page.waitForURL("**/en/app");
    await expect(page.getByRole("heading", { name: "Hi Mila Aurel" })).toBeVisible();
    await expect(page.getByText(`linkyo.app/${name}`).filter({ visible: true }).first()).toBeVisible();

    await page.goto("/en/app/editor");
    await expect(page.getByText("3 blocks")).toBeVisible();

    // Log out from the settings screen; the dashboard is guarded.
    await page.goto("/en/app/settings");
    await page.getByRole("button", { name: "Log out" }).last().click();
    await page.waitForURL("**/en/login?next=*");
    await page.goto("/en/app/design");
    await page.waitForURL("**/en/login?next=%2Fapp%2Fdesign");
    await page.waitForLoadState("networkidle");

    // Wrong password: one calm message, focus moves to it.
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("wrong-pass-1");
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page.getByText("Email or password doesn't match")).toBeFocused();
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    // Back where they wanted to go.
    await page.waitForURL("**/en/app/design");
    await expect(page.getByRole("heading", { name: "Design", level: 1 })).toBeVisible();
  });

  test("forgot password sets a new one (demo) and it works", async ({ page }) => {
    const { email } = await signedIn(page);
    await page.goto("/en/app/settings");
    await page.getByRole("button", { name: "Log out" }).last().click();
    await page.waitForURL("**/en/login**");
    await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await page.waitForURL("**/en/forgot");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("New password").fill("after-reset-77");
    await page.getByRole("button", { name: "Save new password" }).click();
    await expect(page.getByRole("heading", { name: "Password changed" })).toBeVisible();
    await page.getByRole("link", { name: "Go to log in" }).click();
    await page.waitForURL("**/en/login");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("after-reset-77");
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForURL("**/en/app");
  });
});

test.describe("dashboard", () => {
  test("paste a link from the Add sheet, edit it, see it live, undo a delete", async ({ page }) => {
    await signedIn(page);
    await page.goto("/en/app/editor");
    await expect(page.getByText("Your page is waiting")).toBeVisible();

    await addButton(page).click();
    const sheet = page.getByRole("dialog", { name: "Add to your page" });
    await sheet.getByLabel("Paste a link").fill("https://www.youtube.com/watch?v=aqz-KE-bpKQ");
    await expect(sheet.getByText("Video detected")).toBeVisible();
    await sheet.getByRole("button", { name: "Add", exact: true }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByText("Video added").first()).toBeVisible();

    // Create a link from scratch: errors first, then a valid one.
    await addButton(page).click();
    await page.getByRole("dialog", { name: "Add to your page" }).getByRole("button", { name: /^Link Any website/ }).click();
    const edit = page.getByRole("dialog", { name: "Add Link" });
    await edit.getByRole("button", { name: "Add to page" }).click();
    await expect(edit.getByText("2 fields need your attention.")).toBeVisible();
    await edit.getByLabel("Title", { exact: true }).fill("Booking & press");
    await edit.getByLabel("Link", { exact: true }).fill("milaaurel.com/booking");
    await edit.getByLabel("Link", { exact: true }).blur();
    await expect(edit.getByLabel("Link", { exact: true })).toHaveValue("https://milaaurel.com/booking");
    await edit.getByRole("button", { name: "Add to page" }).click();
    await expect(edit).toBeHidden();
    await expect(page.getByText("2 blocks")).toBeVisible();

    // Edit in place; the preview shows the draft while typing.
    await page.getByRole("button", { name: "Edit Booking & press (Link)" }).click();
    const editing = page.getByRole("dialog", { name: "Edit Link" });
    await editing.getByLabel("Title", { exact: true }).fill("Book me");
    await editing.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: "Edit Book me (Link)" })).toBeVisible();

    // Delete is undoable.
    await page.getByRole("button", { name: "More for Book me" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(page.getByText("“Book me” deleted").first()).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).first().click();
    await expect(page.getByRole("button", { name: "Edit Book me (Link)" })).toBeVisible();

    // Hidden blocks stay in the list, marked.
    await page.getByRole("switch", { name: "Show Book me on your page" }).click();
    await expect(page.getByText("Hidden").first()).toBeVisible();

    // Everything survives a reload (autosave).
    await expect(page.getByRole("status").filter({ hasText: "Saved" }).first()).toBeAttached();
    await page.reload();
    await expect(page.getByRole("button", { name: "Edit Book me (Link)" })).toBeVisible();
  });

  test("design changes the live page and can be undone", async ({ page }) => {
    await signedIn(page);
    await page.goto("/en/app/design");
    await page.getByText("Daylight", { exact: true }).click();
    await expect(page.getByText("Daylight applied").first()).toBeVisible();
    await page.getByText("Outline", { exact: true }).click();
    await expect(page.getByRole("radio", { name: "Outline" })).toBeChecked();
    await page.getByRole("button", { name: "Reset to template" }).click();
    await expect(page.getByRole("radio", { name: "Soft", exact: true })).toBeChecked();
  });

  test("settings: address change and legal notice persist", async ({ page }) => {
    const { name } = await signedIn(page);
    await page.goto("/en/app/settings");
    const address = page.getByLabel("Address", { exact: true });
    await address.fill(`${name}-studio`);
    await expect(page.getByText(`linkyo.app/${name}-studio is available`)).toBeVisible();
    await page.getByRole("button", { name: "Change address" }).click();
    await expect(page.getByText(`Your page is now at linkyo.app/${name}-studio`).first()).toBeVisible();
    await page.getByLabel("Full name or company").fill("Mila Aurel");
    await page.getByLabel("Address for service").fill("Musterstraße 1, 10115 Berlin");
    await page.getByRole("button", { name: "Save legal notice" }).click();
    await expect(page.getByText("Legal notice saved").first()).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Full name or company")).toHaveValue("Mila Aurel");
    await expect(page.getByText(`linkyo.app/${name}-studio`).filter({ visible: true }).first()).toBeVisible();
  });

  test("analytics reads every day by keyboard and offers a table", async ({ page }) => {
    await signedIn(page);
    await page.goto("/en/app/analytics");
    await expect(page.getByText("Sample data").first()).toBeVisible();
    const chart = page.getByRole("slider", { name: /Views per day/ });
    await chart.focus();
    await page.keyboard.press("Home");
    await expect(chart).toHaveAttribute("aria-valuenow", "1");
    await page.keyboard.press("ArrowRight");
    await expect(chart).toHaveAttribute("aria-valuenow", "2");
    await page.getByRole("radio", { name: "7 days" }).click();
    await page.getByText("Show as table").click();
    await expect(page.getByRole("region", { name: "Show as table" }).getByRole("row")).toHaveCount(8);
  });
});

test.describe("accessibility", () => {
  for (const locale of ["en", "ar"] as const) {
    for (const scheme of ["light", "dark"] as const) {
      test(`axe: dashboard screens and sheets (${locale}, ${scheme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
        await signUp(page, locale);
        expect(await axe(page)).toEqual([]);
        await page.getByRole("button", { name: locale === "ar" ? "لاحقًا" : "Skip for now" }).click();
        await page.waitForURL(`**/${locale}/app`);
        for (const path of ["", "/editor", "/design", "/analytics", "/settings", "/preview"]) {
          await page.goto(`/${locale}/app${path}`);
          await page.locator("#main, .poster-scope").first().waitFor();
          expect(await axe(page), `/${locale}/app${path}`).toEqual([]);
        }
        await page.goto(`/${locale}/app/editor`);
        await addButton(page).or(page.getByRole("button", { name: "إضافة", exact: true }).first()).first().click();
        await page.getByRole("dialog").waitFor();
        expect(await axe(page), "add sheet").toEqual([]);
        await page.getByRole("dialog").locator("ul button").nth(4).click(); // Video
        await page.getByRole("dialog").waitFor();
        expect(await axe(page), "edit sheet").toEqual([]);
      });
    }
  }
});

test.describe("private previews", () => {
  for (const [locale, label, cta] of [
    ["de", "Vorschau für Nizar", "Sichern"],
    ["ar", "معاينة لـ نزار", "احجزها"],
  ] as const) {
    test(`are labelled, not indexed and lead to sign-up (${locale})`, async ({ page }) => {
      await page.goto(`/${locale}/p/nizar-m3e8dw`);
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
      // The badge is explained in the label: it shows the look after verification.
      await expect(page.getByRole("heading", { level: 1 }).getByRole("img")).toBeVisible();
      await expect(page.getByRole("complementary").first()).toContainText(locale === "de" ? "Verifizierung" : "توثيق");
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      // The claim bar slides in once the portrait has scrolled away.
      await page.mouse.wheel(0, 2000);
      await expect(page.getByRole("link", { name: cta })).toHaveAttribute("href", `/${locale}/signup?name=nizarals9`);
      expect(await axe(page)).toEqual([]);
    });
  }

  test("unknown previews and other languages are not found", async ({ page }) => {
    expect((await page.goto("/de/p/nizar-guess1"))?.status()).toBe(404);
    expect((await page.goto("/en/p/nizar-m3e8dw"))?.status()).toBe(404);
  });
});

test.use({ timezoneId: "Europe/Berlin" });

test("live now and the next live: hero pill, visitor's time, calendar reminder", async ({ page }) => {
  await page.goto("/de/p/nizar-m3e8dw");
  await expect(page.getByRole("link", { name: "Live auf TikTok" })).toHaveAttribute("href", "https://www.tiktok.com/@nizarals9/live");
  const tonight = page.locator("#live-youtube");
  await expect(tonight).toContainText(/(Heute|Morgen)\s*21:00/);
  const download = page.waitForEvent("download");
  await tonight.getByRole("button", { name: "Erinnern" }).click();
  expect((await download).suggestedFilename()).toBe("live.ics");
});
