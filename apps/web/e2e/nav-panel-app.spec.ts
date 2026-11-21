import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { enterDemoCode } from "./auth";

/**
 * The two-level sidebar on wide screens (ADR 0063): the icon rail, the section panel and its fold.
 * Every panel item leads somewhere real; the fold is remembered and never shifts the layout; Design
 * tabs live in the URL without a history entry; Arabic mirrors. The last test is the phone's way
 * into Invite. Demo mode: everything lives in this browser's storage.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const STORAGE_KEY = "linkyo.demo.v1";

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

async function signedIn(page: Page, locale = "en") {
  // Short enough for an address (at most 15 characters).
  const name = `np-${unique()}`;
  await page.goto(`/${locale}/signup?name=${name}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(`linkyo.app/${name}`)).toBeVisible();
  await page.locator("#signup-email").fill(`${name}@example.com`);
  await page.locator("form button[type=submit]").click();
  await enterDemoCode(page);
  await page.waitForURL(`**/${locale}/app/welcome`);
  await page.getByRole("button", { name: locale === "ar" ? "لاحقًا" : "Skip for now" }).click();
  await page.waitForURL(`**/${locale}/app`);
  await expect(heading(page)).toBeVisible();
}

/** A 1×1 picture, so the page counts as having a photo without loading anything. */
const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

/** Writes a page with two sections, three links, a photo and a bio (Home is then "ready"), then reloads. */
async function seed(page: Page) {
  await page.evaluate(
    ([key, pixel]) => {
      const db = JSON.parse(window.localStorage.getItem(key) ?? "{}") as {
        session: { accountId: string };
        sites: Record<string, { page: { blocks: unknown[]; profile: Record<string, unknown> } }>;
      };
      const site = db.sites[db.session.accountId];
      if (!site) throw new Error("no site");
      const block = (id: string, extra: Record<string, unknown>) => ({ id, visible: true, highlight: false, ...extra });
      site.page.blocks = [
        block("h-tour", { type: "header", title: "Tour 2027" }),
        block("l-tickets", { type: "link", title: "Tickets", url: "https://example.com/tickets" }),
        block("l-merch", { type: "link", title: "Merch store", url: "https://example.com/merch" }),
        block("h-listen", { type: "header", title: "Listen" }),
        block("l-album", { type: "link", title: "New album", url: "https://example.com/album" }),
      ];
      site.page.profile.bio = "Songs and shows.";
      site.page.profile.avatar = { src: pixel, alt: "" };
      window.localStorage.setItem(key, JSON.stringify(db));
    },
    [STORAGE_KEY, PIXEL] as const,
  );
  await page.reload();
  await expect(heading(page)).toBeVisible();
}

/** The visible link to a place: the rail on wide screens, the tab bar on phones. */
const place = (page: Page, name: string) => page.getByRole("link", { name, exact: true }).locator("visible=true").first();
const back = (page: Page, to: string) => page.getByRole("link", { name: `Back: ${to}`, exact: true }).locator("visible=true").first();
const heading = (page: Page) => page.locator("#main h1").first();
const rail = (page: Page) => page.locator("[data-nav] > div").first();
const panel = (page: Page) => page.locator("#nav-panel");
const panelLinks = (page: Page) => panel(page).locator("nav a");
const toggle = (page: Page, name = "Sidebar") => page.getByRole("button", { name, exact: true });
const historyLength = (page: Page) => page.evaluate(() => window.history.length);
const focusedId = (page: Page) => page.evaluate(() => document.activeElement?.id ?? "");
const h1X = (page: Page) => heading(page).evaluate((element) => Math.round(element.getBoundingClientRect().x));

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× — ${v.nodes[0]?.target.join(" ")}`);
}

/** Clicks every item the panel lists for the place on screen and checks that it lands where it says. */
async function walkPanel(page: Page, expected: string[]) {
  await expect(panelLinks(page)).toHaveText(expected);
  for (let index = 0; index < expected.length; index += 1) {
    const link = panelLinks(page).nth(index);
    const href = (await link.getAttribute("href")) ?? "";
    const label = expected[index] ?? "";
    await link.click();
    if (href.includes("?tab=")) {
      const tab = href.split("?tab=")[1] ?? "";
      await expect(page).toHaveURL(new RegExp(`\\?tab=${tab}$`));
      const control = page.locator("#main").getByRole("tab", { name: label, exact: true });
      await expect(control).toHaveAttribute("aria-selected", "true");
      await expect(control).toBeFocused();
      await expect(link).toHaveAttribute("aria-current", "true");
    } else if (href.includes("#")) {
      const target = href.split("#")[1] ?? "";
      await expect.poll(() => focusedId(page), `${label} focuses #${target}`).toBe(target);
      // The address is left alone: no hash, no history entry.
      expect(new URL(page.url()).hash).toBe("");
    } else {
      await expect(page).toHaveURL(new RegExp(`${href.replaceAll("/", "\\/")}$`));
      await expect(link).toHaveAttribute("aria-current", "page");
    }
  }
}

test.describe("the section panel", () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, "the rail and the panel are for wide screens; phones keep the tab bar");
  });

  test("every panel item leads somewhere real", async ({ page }) => {
    await signedIn(page);
    // A fresh page is being built: the next step, then the link.
    await expect(page.locator("#nav-panel-title")).toHaveText("Home");
    await walkPanel(page, ["Next step", "Your link"]);
    // Ready (three links, a photo, a bio): the link, what is still open, the week.
    await seed(page);
    await walkPanel(page, ["Your link", "Still to do", "Last 7 days"]);

    await place(page, "Page").click();
    await expect(heading(page)).toHaveText("Page");
    // The page's outline: one row per section, nested under Content.
    await walkPanel(page, ["Profile", "Content", "Tour 2027", "Listen"]);

    await place(page, "Design").click();
    await expect(heading(page)).toHaveText("Design");
    await walkPanel(page, ["Template", "Color", "Font", "Buttons"]);

    await place(page, "Stats").click();
    await expect(heading(page)).toHaveText("Stats");
    await walkPanel(page, ["Views per day", "Top links", "Sources", "Countries", "Devices"]);

    await place(page, "Invite").click();
    await expect(heading(page)).toHaveText("Invite friends");
    await walkPanel(page, ["Your invite link", "Rewards", "People you invited", "How it works"]);

    await place(page, "Settings").click();
    await expect(heading(page)).toHaveText("Settings");
    await walkPanel(page, ["Account", "Page address", "Legal notice"]);
    // On a pane, the rail's Settings says "you are under here", the pane's item says "here".
    await expect(place(page, "Settings")).toHaveAttribute("aria-current", "true");
  });

  test("folding is remembered and never shifts the layout", async ({ page }) => {
    await signedIn(page);
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
    expect(await h1X(page)).toBe(288);
    // No width animation: the panel shows and hides at once.
    expect(await panel(page).evaluate((element) => getComputedStyle(element).transitionProperty)).not.toMatch(/width|all/);

    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
    await expect(panel(page)).toBeHidden();
    expect(await h1X(page)).toBe(104);

    // Before any script of the app runs, the frame is already folded: the splash from the server HTML.
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const splashPanel = document.querySelector("[data-splash-panel]");
        const title = document.querySelector("[data-splash-title]");
        (window as unknown as { beforeMount: unknown }).beforeMount = {
          attribute: document.documentElement.dataset.navPanel,
          panelDisplay: splashPanel ? getComputedStyle(splashPanel).display : "missing",
          titleX: title ? Math.round(title.getBoundingClientRect().x) : -1,
        };
      });
    });
    await page.reload();
    await expect(heading(page)).toBeVisible();
    const beforeMount = await page.evaluate(() => (window as unknown as { beforeMount: unknown }).beforeMount);
    expect(beforeMount).toEqual({ attribute: "folded", panelDisplay: "none", titleX: 104 });
    expect(await h1X(page), "the same start edge after the shell mounts").toBe(104);
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");

    await toggle(page).click();
    await expect(panel(page)).toBeVisible();
    expect(await h1X(page)).toBe(288);
  });

  test("storage that throws: the panel is open and the toggle still folds", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await signedIn(page);
    await page.addInitScript(() => {
      // The demo account still loads (the store reads its own key first); only the panel's key throws.
      const descriptors = Object.getOwnPropertyDescriptors(Storage.prototype);
      const get = descriptors.getItem.value as (this: Storage, key: string) => string | null;
      const set = descriptors.setItem.value as (this: Storage, key: string, value: string) => void;
      Storage.prototype.getItem = function (this: Storage, key: string) {
        if (key === "linkyo.navPanel") throw new DOMException("blocked", "SecurityError");
        return get.call(this, key);
      };
      Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
        if (key === "linkyo.navPanel") throw new DOMException("blocked", "SecurityError");
        set.call(this, key, value);
      };
    });
    await page.reload();
    await expect(heading(page)).toBeVisible();
    await expect(panel(page)).toBeVisible();
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
    await toggle(page).click();
    await expect(panel(page)).toBeHidden();
    expect(await h1X(page)).toBe(104);
    expect(errors).toEqual([]);
  });

  test("Design tabs live in the URL, without a history entry", async ({ page }) => {
    await signedIn(page);
    await place(page, "Design").click();
    await expect(heading(page)).toHaveText("Design");
    const length = await historyLength(page);
    const font = panelLinks(page).filter({ hasText: "Font" });
    await font.click();
    await expect(page).toHaveURL(/\/en\/app\/design\?tab=fonts$/);
    const fontTab = page.locator("#main").getByRole("tab", { name: "Font", exact: true });
    await expect(fontTab).toHaveAttribute("aria-selected", "true");
    await expect(fontTab).toBeFocused();
    await expect(font).toHaveAttribute("aria-current", "true");
    expect(await historyLength(page)).toBe(length);

    await page.reload();
    await expect(page.locator("#main").getByRole("tab", { name: "Font", exact: true })).toHaveAttribute("aria-selected", "true");

    await page.locator("#main").getByRole("tab", { name: "Buttons", exact: true }).click();
    await expect(page).toHaveURL(/\?tab=buttons$/);
    await expect(panelLinks(page).filter({ hasText: "Buttons" })).toHaveAttribute("aria-current", "true");
    expect(await historyLength(page)).toBe(length);
  });

  test("a panel move between panes keeps focus and does not slide", async ({ page }) => {
    await signedIn(page);
    await place(page, "Settings").click();
    await panelLinks(page).filter({ hasText: "Account" }).click();
    await expect(heading(page)).toHaveText("Account");
    const address = panelLinks(page).filter({ hasText: "Page address" });
    await address.click();
    await page.waitForURL(/\/en\/app\/settings\/address$/);
    await expect(heading(page)).toHaveText("Page address");
    await expect(address).toBeFocused();
    await expect(page.locator('[class*="animate-page-in"]')).toHaveCount(0);
    // A content row still pushes the pane, as before.
    await back(page, "Settings").click();
    await page.locator("#main").getByRole("link", { name: /^Account/ }).click();
    await expect(page.locator('[class*="animate-page-in"]')).toHaveCount(1);
  });

  test("Arabic mirrors the frame: rail at the right edge, toggle flipped, tooltips to the left", async ({ page }) => {
    await signedIn(page, "ar");
    const box = await rail(page).boundingBox();
    // The page's right edge, inside the scrollbar gutter. (With `scrollbar-gutter: stable` Chromium
    // reports documentElement.clientWidth as the whole window, gutter included; the root box is exact.)
    const edge = await page.evaluate(() => Math.round(document.documentElement.getBoundingClientRect().right));
    expect(Math.round((box?.x ?? 0) + (box?.width ?? 0))).toBe(edge);
    const flip = await toggle(page, "الشريط الجانبي")
      .locator("svg")
      .evaluate((svg) => `${getComputedStyle(svg).transform} ${getComputedStyle(svg).scale}`);
    expect(flip).toContain("-1");

    const home = place(page, "الرئيسية");
    await home.focus();
    const tip = page.getByRole("tooltip");
    await expect(tip).toHaveText("الرئيسية");
    const tipBox = await page.locator("[data-radix-popper-content-wrapper]").first().boundingBox();
    const homeBox = await home.boundingBox();
    // On the left of the icon (towards the content), never over it.
    expect((tipBox?.x ?? 0) + (tipBox?.width ?? 0)).toBeLessThanOrEqual(homeBox?.x ?? 0);
    expect(tipBox?.x ?? 0).toBeLessThan(box?.x ?? 0);
  });

  test("a rail tooltip says what the panel title says", async ({ page }) => {
    await signedIn(page);
    const stats = place(page, "Stats");
    await stats.focus();
    await expect(page.getByRole("tooltip")).toHaveText("Stats");
    await stats.click();
    await expect(heading(page)).toHaveText("Stats");
    await expect(page.locator("#nav-panel-title")).toHaveText("Stats");
  });

  test("folded, the save status moves to the rail: one visible status", async ({ page }) => {
    await signedIn(page);
    await page.goto("/en/app/settings/legal");
    await page.getByLabel("Full name or company").fill("Mila Aurel");
    await place(page, "Home").click();
    await expect(heading(page)).toBeVisible();
    const unsaved = page.getByRole("link", { name: "Legal notice not saved" }).locator("visible=true");
    await expect(unsaved).toHaveCount(1);
    await expect(panel(page).getByRole("link", { name: "Legal notice not saved" })).toBeVisible();
    await toggle(page).click();
    await expect(unsaved).toHaveCount(1);
    await expect(rail(page).getByRole("link", { name: "Legal notice not saved" })).toBeVisible();
  });

  test("Invite is a place in the rail", async ({ page }) => {
    await signedIn(page);
    await place(page, "Invite").click();
    await page.waitForURL(/\/en\/app\/invite$/);
    await expect(place(page, "Invite")).toHaveAttribute("aria-current", "page");
    await expect(page.locator("#nav-panel-title")).toHaveText("Invite");
    // Wide screens reach it from the rail: no back link in the toolbar.
    await expect(page.getByRole("link", { name: "Back: Settings" }).locator("visible=true")).toHaveCount(0);
  });

  for (const locale of ["en", "ar"] as const) {
    test(`axe: open and folded, light and dark (${locale})`, async ({ page }) => {
      await signedIn(page, locale);
      const name = locale === "ar" ? "الشريط الجانبي" : "Sidebar";
      for (const scheme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
        expect(await axe(page), `${scheme}, open`).toEqual([]);
        await toggle(page, name).click();
        await expect(panel(page)).toBeHidden();
        expect(await axe(page), `${scheme}, folded`).toEqual([]);
        await toggle(page, name).click();
        await expect(panel(page)).toBeVisible();
      }
    });
  }
});

test("phones reach Invite from Settings, and back says Settings", async ({ page, isMobile }) => {
  test.skip(!isMobile, "on wide screens the rail is the way in (tested above)");
  await signedIn(page);
  await page.getByRole("link", { name: /^Settings and account/ }).click();
  await page.waitForURL(/\/en\/app\/settings$/);
  await page.locator("#main").getByRole("link", { name: "Invite friends" }).click();
  await page.waitForURL(/\/en\/app\/invite$/);
  await expect(heading(page)).toHaveText("Invite friends");
  await expect(back(page, "Settings")).toBeVisible();
  // The tab it was opened from stays marked under the pushed screen.
  await expect(page.locator("[data-tabbar] a[data-origin]")).toHaveCount(1);
});
