import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { enterDemoCode } from "./auth";

/**
 * Accounts + dashboard, end to end (demo mode: everything lives in this browser's storage).
 * Runs on desktop and on a phone. Each test starts with an empty browser.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

async function signUp(page: Page, locale = "en") {
  const name = `mila-${unique()}`;
  await page.goto(`/${locale}/signup?name=${name}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(`linkyo.app/${name}`)).toBeVisible();
  await page.locator("#signup-email").fill(`${name}@example.com`);
  await page.locator("form button[type=submit]").click();
  await enterDemoCode(page);
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
    // The claimed address comes along as one line; only the email is asked.
    await expect(page.locator("#signup-username")).toHaveCount(0);
    await expect(page.getByText("linkyo.app/mila-aurel is available")).toBeVisible();
  });

  test("sign-up asks only for the email; the page address follows the name in the welcome flow", async ({ page }) => {
    await page.goto("/en/signup");
    // Like the sign-up pages people know: the logo, one field, one button. Language and
    // light/dark live on the homepage.
    await expect(page.locator("#signup-username")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Language" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sign up" })).toBeVisible();
    const id = unique();
    await page.locator("#signup-email").fill(`solo-${id}@example.com`);
    await page.locator("form button[type=submit]").click();
    await enterDemoCode(page);
    await page.waitForURL("**/en/app/welcome");
    await page.getByText("Music", { exact: true }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    // The address is suggested from the name as it is typed, and can be changed.
    await page.getByLabel("Your artist name").fill(`Solo ${id}`);
    await expect(page.getByLabel("Your address")).toHaveValue(`solo-${id}`);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Pick a look" })).toBeFocused();
    await page.getByRole("button", { name: "Skip for now" }).click();
    await page.waitForURL("**/en/app");
    await expect(page.getByText(`linkyo.app/solo-${id}`).filter({ visible: true }).first()).toBeVisible();
  });

  test("sign-up explains what is missing, field by field", async ({ page }) => {
    // A claimed address that cannot be used opens the address field with the reason.
    await page.goto("/en/signup?name=login");
    await expect(page.getByText("This address is reserved for Linkyo.")).toBeVisible();
    await page.locator("#signup-username").fill("mila-ok");
    await page.locator("#signup-email").fill("not-an-email");
    await page.locator("form button[type=submit]").click();
    await expect(page.locator("#signup-email")).toBeFocused();
    await expect(page.getByText("This email address looks incomplete")).toBeVisible();
    // No password anywhere: the next step is a code by email.
    await expect(page.getByLabel(/password/i)).toHaveCount(0);
  });

  test("the code step: six boxes, wrong code explained, other email, new code after a wait", async ({ page }) => {
    const name = `code-${unique()}`;
    await page.goto(`/en/signup?name=${name}`);
    await page.waitForLoadState("networkidle");
    await page.locator("#signup-email").fill(`${name}@example.com`);
    await page.locator("form button[type=submit]").click();
    await expect(page.getByRole("heading", { name: "Enter your code" })).toBeVisible();
    await expect(page.getByText(`We sent a 6\u2011digit code to ${name}@example.com.`)).toBeVisible();
    const field = page.getByLabel("Sign-in code");
    await expect(field).toBeFocused();
    expect(await axe(page)).toEqual([]);
    const shown = (await page.locator("[id$='-demo'] strong").textContent()) ?? "";
    const wrong = shown === "000000" ? "111111" : "000000";
    // Six digits submit by themselves; letters are ignored.
    await field.pressSequentially(`${wrong.slice(0, 3)}a${wrong.slice(3)}`);
    await expect(page.getByText("This code doesn't match.")).toBeVisible();
    await expect(field).toHaveValue("");
    await expect(page.getByRole("button", { name: /New code in \d+ s/ })).toBeDisabled();
    // A different email goes back to the first step, with what was typed kept.
    await page.getByRole("button", { name: "Use a different email" }).click();
    await expect(page.getByText(`linkyo.app/${name}`)).toBeVisible();
    await expect(page.locator("#signup-email")).toBeFocused();
    await page.locator("form button[type=submit]").click();
    await enterDemoCode(page);
    await page.waitForURL("**/en/app/welcome");
  });

  test("sign up → welcome → dashboard, then log out and back in", async ({ page }) => {
    const { name, email } = await signUp(page);
    // Step 1: what the page is for; it picks the template and the questions.
    await expect(page.getByRole("heading", { name: "What describes you best?" })).toBeVisible();
    await page.getByText("Music", { exact: true }).click();
    await expect(page.getByRole("radio", { name: /^Music/ })).toBeChecked();
    await page.getByRole("button", { name: "Continue" }).click();
    // Step 2: who you are, worded for the kind.
    await expect(page.getByRole("heading", { name: "Who's behind the page?" })).toBeFocused();
    await page.getByLabel("Your artist name").fill("Mila Aurel");
    await page.getByLabel("Short bio").fill("DJ and producer from Berlin.");
    await page.getByRole("button", { name: "Continue" }).click();
    // Step 3: look, pre-selected for the kind. The live preview follows the choice.
    await expect(page.getByRole("heading", { name: "Pick a look" })).toBeFocused();
    await expect(page.getByText("Picked for Music")).toBeVisible();
    await page.getByText("Pulse", { exact: true }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    // Step 4: links.
    await page.getByLabel("Instagram").fill("milaaurel");
    await page.getByLabel("Your latest song or video (optional)").fill("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC https://www.youtube.com/watch?v=aqz-KE-bpKQ");
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

    // Signing back in: the email, then the code.
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send code", exact: true }).click();
    await expect(page.getByText(`If there's a Linkyo account for ${email}`)).toBeVisible();
    await enterDemoCode(page);
    // Back where they wanted to go.
    await page.waitForURL("**/en/app/design");
    await expect(page.getByRole("heading", { name: "Design", level: 1 })).toBeVisible();
  });

  test("the links step offers to bring links over from another link page", async ({ page }) => {
    await signUp(page);
    await page.getByText("Music", { exact: true }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Your artist name").fill("Mila Aurel");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    const box = page.getByRole("region", { name: "Coming from Linktree, Beacons & co.?" });
    await expect(box).toBeVisible();
    // Only link-in-bio services are read; anything else is explained (no request leaves for it).
    await box.getByLabel("Your current link page").fill("example.com/mila");
    await box.getByRole("button", { name: "Import" }).click();
    await expect(box.getByText("Paste the address of a Linktree, Beacons")).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });

  test("a shop owner gets the shop template and is asked for address, phone and opening hours", async ({ page }) => {
    await signUp(page);
    await page.getByText("Local shop", { exact: true }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Name of your shop").fill("Café Rosa");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Picked for Local shop")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Instagram").fill("cafe.rosa");
    await page.getByLabel("Address").fill("Hauptstraße 5, Berlin");
    await page.getByLabel("Phone").fill("+49 30 123456");
    await page.getByLabel("Opening hours").fill("Mon–Fri 8am–6pm");
    await page.getByRole("button", { name: "Create my page" }).click();
    await expect(page.getByRole("heading", { name: "Your page is ready, Café Rosa" })).toBeVisible();
    await page.getByRole("button", { name: "Keep editing my page" }).click();
    await page.waitForURL("**/en/app/editor");
    await expect(page.getByText("5 blocks")).toBeVisible();
    await expect(page.getByText("Directions: Hauptstraße 5, Berlin").first()).toBeVisible();
    await expect(page.getByText("Call", { exact: true }).first()).toBeVisible();
  });

  test("old password links lead to sign-in, and an unknown email gets the same answer", async ({ page }) => {
    await page.goto("/en/forgot");
    await page.waitForURL("**/en/login");
    await page.goto("/en/reset-password");
    await page.waitForURL("**/en/login");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Email").fill("nobody-here@example.com");
    await page.getByRole("button", { name: "Send code", exact: true }).click();
    await expect(page.getByText("If there's a Linkyo account for nobody-here@example.com")).toBeVisible();
    // No account, so the demo has no code to show.
    await expect(page.locator("[id$='-demo']")).toHaveCount(0);
  });
});

test.describe("dashboard", () => {
  test("a picture to post: story and feed formats in the page's look, downloadable", async ({ page }) => {
    await signedIn(page);
    await page.getByRole("button", { name: "Image for story & post" }).click();
    const sheet = page.getByRole("dialog", { name: "Your image to share" });
    const download = sheet.getByRole("button", { name: "Download" });
    await expect(download).toBeEnabled();
    const size = () => sheet.locator("canvas").evaluate((canvas: HTMLCanvasElement) => [canvas.width, canvas.height]);
    expect(await size()).toEqual([1080, 1920]);
    await sheet.getByRole("radio", { name: "Post · 4:5" }).click();
    await expect.poll(size).toEqual([1080, 1350]);
    const saved = page.waitForEvent("download");
    await download.click();
    expect((await saved).suggestedFilename()).toMatch(/^linkyo-.+-post\.png$/);
    expect(await axe(page)).toEqual([]);
  });

  test("a pasted video gets its real title from the platform, without undo noise", async ({ page }) => {
    // Our server asks the platform (stubbed here); the browser only ever talks to Linkyo.
    await page.route("**/api/link-metadata**", (route) => route.fulfill({ json: { title: "Big Buck Bunny – Short Film", author: "Blender" } }));
    await signedIn(page);
    await page.goto("/en/app/editor");
    await addButton(page).click();
    const sheet = page.getByRole("dialog", { name: "Add to your page" });
    await sheet.getByLabel("Paste a link").fill("https://www.youtube.com/watch?v=aqz-KE-bpKQ");
    await sheet.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("Big Buck Bunny – Short Film").first()).toBeVisible();
    // One undo removes the video itself (the filled-in title is not a step of its own).
    await page.keyboard.press("ControlOrMeta+z");
    await expect(page.getByText("Big Buck Bunny – Short Film")).toHaveCount(0);
  });

  test("View my page: the owner's bar steps aside while the privacy notice is open, then comes back down", async ({ page }) => {
    await page.route("**/api/link-metadata**", (route) => route.fulfill({ json: {} }));
    await signedIn(page);
    await page.goto("/en/app/editor");
    await addButton(page).click();
    const sheet = page.getByRole("dialog", { name: "Add to your page" });
    await sheet.getByLabel("Paste a link").fill("https://www.youtube.com/watch?v=aqz-KE-bpKQ");
    await sheet.getByRole("button", { name: "Add", exact: true }).click();
    await expect(sheet).toBeHidden();
    await page.goto("/en/app/preview");
    const notice = page.getByRole("region", { name: "Privacy" });
    const bar = page.getByRole("navigation", { name: "Page actions" });
    await expect(notice).toBeVisible();
    // Both reachable, neither on top of the other: the bar waits at the top.
    const [noticeBox, barBox] = [await notice.boundingBox(), await bar.boundingBox()];
    expect(noticeBox && barBox && barBox.y + barBox.height <= noticeBox.y).toBe(true);
    await notice.getByRole("button", { name: "Essential only" }).click();
    await expect(notice).toBeHidden();
    // Decided: the bar is back at the bottom.
    const after = await bar.boundingBox();
    const viewport = page.viewportSize();
    expect(after && viewport && after.y > viewport.height / 2).toBe(true);
  });

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
      await page.goto(`/${locale}/p/nizar`);
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
      // The badge is explained in the label: it shows the look after verification.
      await expect(page.getByRole("heading", { level: 1 }).getByRole("img")).toBeVisible();
      await expect(page.getByRole("complementary").first()).toContainText(locale === "de" ? "Verifizierung" : "توثيق");
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      // The claim bar slides in once the portrait has scrolled away.
      await page.mouse.wheel(0, 2000);
      await expect(page.getByRole("link", { name: cta })).toHaveAttribute("href", `/${locale}/signup?name=nizarals9&invite=nizar`);
      expect(await axe(page)).toEqual([]);
    });
  }

  test("the example page for journalists is labelled and starts sign-up with the journalist template", async ({ page }) => {
    await page.goto("/en/p/journalist");
    await expect(page.getByText("Example · Journalist", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Lea Hartmann");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    expect(await axe(page)).toEqual([]);
    await page.mouse.wheel(0, 2000);
    const cta = page.getByRole("link", { name: "Sign up for free" });
    await expect(cta).toHaveAttribute("href", "/en/signup?kind=journalist&look=journalist");
    await cta.click();
    await page.waitForURL("**/en/signup?kind=journalist&look=journalist");
    await page.waitForLoadState("networkidle");
    const name = `press-${unique()}`;
    await page.locator("#signup-email").fill(`${name}@example.com`);
    await page.locator("form button[type=submit]").click();
    await enterDemoCode(page);
    await page.waitForURL("**/en/app/welcome");
    // The kind is already chosen; the next steps ask what a journalist needs.
    await expect(page.getByRole("radio", { name: /^Journalist/ })).toBeChecked();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Your name").fill("Sam Reporter");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Picked for Journalist")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel("Email for requests")).toBeVisible();
    await expect(page.getByLabel("LinkedIn")).toBeVisible();
  });

  test("pages with players show a privacy notice in the page's own colors; the choice is kept", async ({ page }) => {
    await page.goto("/de/p/nizar");
    const notice = page.getByRole("region", { name: "Datenschutz" });
    await expect(notice).toContainText("Keine Tracking-Cookies");
    await expect(notice).toContainText("YouTube");
    expect(await axe(page)).toEqual([]);
    // The button wears the creator's accent, not Linkyo's violet.
    const allow = notice.getByRole("button", { name: "Externe Inhalte erlauben" });
    const accent = await page.locator(".poster-scope").evaluate((element) => getComputedStyle(element).getPropertyValue("--creator-accent").trim());
    const fill = await allow.evaluate((element) => getComputedStyle(element).backgroundColor);
    const probe = await page.evaluate((color) => {
      const element = document.createElement("i");
      element.style.color = color;
      document.body.append(element);
      const value = getComputedStyle(element).color;
      element.remove();
      return value;
    }, accent);
    expect(fill).toBe(probe);
    await allow.click();
    await expect(notice).toBeHidden();
    await page.reload();
    await expect(page.getByText("Keine Tracking-Cookies")).toBeHidden();
    // It can always be changed from the footer, also per category in the settings.
    await page.getByRole("button", { name: "Cookie-Einstellungen" }).click();
    const again = page.getByRole("region", { name: "Datenschutz" });
    await expect(again).toBeVisible();
    await again.getByRole("button", { name: "Einstellungen", exact: true }).click();
    const media = again.getByRole("switch", { name: "Externe Medien" });
    await expect(media).toHaveAttribute("aria-checked", "true");
    await media.click();
    expect(await axe(page)).toEqual([]);
    await again.getByRole("button", { name: "Auswahl speichern" }).click();
    await expect(again).toBeHidden();
    expect(await page.evaluate(() => window.localStorage.getItem("linkyo.privacy.v1"))).toBe("essential");
  });

  test("the Linkyo bar slides in once the hero has scrolled away, and can be closed", async ({ page }) => {
    await page.goto("/en/p/journalist");
    const cta = page.getByRole("link", { name: "Sign up for free" });
    await expect(cta).toBeHidden();
    await page.mouse.wheel(0, 900);
    await expect(cta).toBeVisible();
    await page.getByRole("button", { name: "Close bar" }).click();
    await expect(cta).toBeHidden();
    // Closed for the rest of the visit.
    await page.reload();
    await page.mouse.wheel(0, 900);
    await expect(page.getByRole("heading", { name: "Latest investigations" })).toBeVisible();
    await expect(cta).toBeHidden();
  });

  test("newsletter sign-up confirms with a double opt-in note", async ({ page }) => {
    await page.goto("/en/p/journalist");
    // The form submits through React: wait until the page is hydrated (flaky under full-suite load).
    await page.waitForLoadState("networkidle");
    const form = page.getByRole("region", { name: "Investigations newsletter, every Friday" });
    await form.getByLabel("Your email").fill("reader@example.com");
    await form.getByRole("button", { name: "Subscribe" }).click();
    await expect(form.getByRole("status")).toContainText("Almost there!");
  });

  test("the earlier long link still leads to the short one", async ({ page }) => {
    await page.goto("/de/p/nizar-m3e8dw");
    await page.waitForURL("**/de/p/nizar");
  });

  test("unknown previews and other languages are not found", async ({ page }) => {
    expect((await page.goto("/de/p/nizar-guess1"))?.status()).toBe(404);
    expect((await page.goto("/en/p/nizar"))?.status()).toBe(404);
  });
});

test.use({ timezoneId: "Europe/Berlin" });

test("live now and the next live: hero pill, visitor's time, calendar reminder", async ({ page }) => {
  await page.goto("/de/p/nizar");
  await expect(page.getByRole("link", { name: "Live auf TikTok" })).toHaveAttribute("href", "https://www.tiktok.com/@nizarals9/live");
  const tonight = page.locator("#live-youtube");
  await expect(tonight).toContainText(/(Heute|Morgen)\s*21:00/);
  const download = page.waitForEvent("download");
  await tonight.getByRole("button", { name: "Erinnern" }).click();
  expect((await download).suggestedFilename()).toBe("live.ics");
});

test.describe("prepared pages for creators", () => {
  test("the invited email signs up into a ready page", async ({ page }) => {
    await page.goto("/de/signup?name=nizarals9&invite=nizar");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Deine Seite ist fertig" })).toBeVisible();
    // The invite reserves the address: it shows as a line, without "Change".
    await expect(page.getByText("linkyo.app/nizarals9 ist für dich reserviert")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ändern" })).toHaveCount(0);
    await page.locator("#signup-email").fill("nezaralsweid4@gmail.com");
    await page.locator("form button[type=submit]").click();
    await enterDemoCode(page);
    // No welcome steps: straight to Home, with the page already there.
    await page.waitForURL("**/de/app");
    await expect(page.getByRole("heading", { name: "Willkommen, Nizar Alkrizma! Deine Seite ist fertig." })).toBeVisible();
    await expect(page.getByText("linkyo.app/nizarals9").filter({ visible: true }).first()).toBeVisible();
    await page.goto("/de/app/editor");
    await expect(page.getByRole("button", { name: /^Wyli Karizma bearbeiten/ })).toBeVisible();
    // The preview's example states are not part of the real page.
    await page.goto("/de/app/preview");
    await expect(page.getByText("Jetzt live")).toHaveCount(0);
  });

  test("an invite link with another email, or the reserved address, is explained", async ({ page }) => {
    await page.goto("/de/signup?name=nizarals9&invite=nizar");
    await page.waitForLoadState("networkidle");
    await page.locator("#signup-email").fill("someone.else@example.com");
    await page.locator("form button[type=submit]").click();
    await expect(page.getByText("Diese Seite wurde für eine andere E-Mail vorbereitet.")).toBeVisible();
    await page.goto("/de/signup?name=nizarals9");
    await page.waitForLoadState("networkidle");
    await page.locator("#signup-email").fill("someone.else@example.com");
    await page.locator("form button[type=submit]").click();
    await expect(page.getByText("Diese Adresse ist für einen Creator reserviert.")).toBeVisible();
  });
});
