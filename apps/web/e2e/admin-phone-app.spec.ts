import { mkdirSync } from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

import ar from "../src/messages/ar.json" with { type: "json" };
import de from "../src/messages/de.json" with { type: "json" };

import { enterDemoCode } from "./auth";

/**
 * The team console on a phone (Stage 3, WP3.4: A-11, A-12, A-17, A-19, A-20, A-23, S-05), in the demo:
 * readable card rows instead of clipped tables, filters in a sheet, the first row high on the screen,
 * the registry's icons, trends on the KPI tiles, Arabic mirrored with Latin names isolated. Runs on
 * the phone project (and the laptop checks on desktop). `ADMIN_PHONE_SHOTS=<dir>` also saves the
 * review pictures (phone 390 × 844 and laptop 1440 × 900, 1×, de and ar).
 */

const TEAM_CODE = "linkyo-team-4827";
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const SHOTS = process.env.ADMIN_PHONE_SHOTS ?? "";
const PHONE = { width: 390, height: 844 };

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Signs up and opens the team area with the team code: the account becomes the owner. */
async function owner(page: Page, locale: "de" | "en" | "ar" = "de") {
  const name = `team-${unique()}`;
  await page.goto(`/${locale}/signup?name=${name}`);
  await page.waitForLoadState("networkidle");
  await page.locator("#signup-email").fill(`${name}@example.com`);
  await page.locator("form button[type=submit]").click();
  await enterDemoCode(page);
  await page.waitForURL(`**/${locale}/app/welcome`);
  await page.goto(`/${locale}/admin`);
  await page.locator("#team-code").fill(TEAM_CODE);
  await page.locator("form button[type=submit]").click();
  await expect(page.locator("main [data-kpis]")).toBeVisible();
  return name;
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× — ${v.nodes[0]?.target.join(" ")}`);
}

/** Nothing reaches past the screen's edges: no sideways scrolling of the page, no box cut off at the side. */
async function overflow(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const out: string[] = [];
    if (document.documentElement.scrollWidth > width + 1) out.push(`page scrolls sideways: ${String(document.documentElement.scrollWidth)} > ${String(width)}`);
    for (const element of document.querySelectorAll("main *")) {
      // Inside a box that scrolls sideways on purpose (a segmented strip, a chart's table), a far edge is fine.
      let scroller: Element | null = element.parentElement;
      let inside = false;
      while (scroller && scroller !== document.body) {
        const style = getComputedStyle(scroller);
        if (style.overflowX === "auto" || style.overflowX === "scroll" || style.overflowX === "hidden" || style.overflowX === "clip") {
          inside = true;
          break;
        }
        scroller = scroller.parentElement;
      }
      if (inside) continue;
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (box.right > width + 1 || box.left < -1) out.push(`${element.tagName.toLowerCase()}.${(element.getAttribute("class") ?? "").slice(0, 60)}: ${String(Math.round(box.left))}–${String(Math.round(box.right))}`);
    }
    return out.slice(0, 5);
  });
}

test.describe("team console on a phone", () => {
  test.beforeEach(async ({ page, isMobile }) => {
    if (isMobile) await page.setViewportSize(PHONE);
  });

  test("customers: the search stays on top, filters sit in a sheet, the first card is high on the screen", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone layout");
    await owner(page);
    await page.goto("/de/admin/customers");
    // The first row of the list (an account made on this device comes first, then the sample customers).
    const first = page.getByRole("list", { name: de.admin.customers.title }).locator("> li").first();
    await expect(first).toBeVisible();
    const top = await first.evaluate((element) => element.getBoundingClientRect().top);
    expect(top).toBeLessThan(400);
    // No native select on the screen; the filters open in a sheet with chips.
    await expect(page.locator("main select")).toHaveCount(0);
    await page.getByRole("button", { name: de.ui.filter.title, exact: true }).click();
    const sheet = page.getByRole("dialog", { name: de.ui.filter.title });
    await sheet.getByRole("button", { name: "Pro", exact: true }).click();
    await sheet.getByRole("button", { name: /Kunden zeigen$/ }).click();
    await expect(page.getByRole("group", { name: de.ui.filter.activeList })).toContainText("Pro");
    // The search band stays flush under the header while the list scrolls.
    await page.mouse.wheel(0, 1200);
    await expect.poll(() => page.locator("[data-customer-search]").evaluate((element) => Math.round(element.getBoundingClientRect().top))).toBe(64);
    expect(await overflow(page)).toEqual([]);
  });

  test("no clipped columns: sign-ins, subscriptions, roles (de shows „Lesen“), the customer's sign-in log", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone layout");
    await owner(page);
    for (const route of ["/de/admin/security", "/de/admin/subscriptions", "/de/admin/team", "/de/admin/analytics", "/de/admin", "/ar/admin/security", "/ar/admin/team"]) {
      await page.goto(route);
      await expect(page.locator("main h1")).toBeVisible();
      expect(await overflow(page), route).toEqual([]);
    }
    await page.goto("/de/admin/team");
    // "Lesen" (the viewer role) is on screen beside the others, not cut off at the side.
    const viewer = page.locator("[data-permissions-list]").getByText(de.admin.roles.viewer.name, { exact: true }).first();
    await viewer.scrollIntoViewIfNeeded();
    await expect(viewer).toBeInViewport({ ratio: 1 });
    await page.goto("/de/admin/customers");
    await page.locator("main a[href*='/admin/customers/cus_']").first().click();
    await page.getByRole("radio", { name: de.admin.customer.tabs.security }).click();
    await expect(page.locator("main [data-ip]").first()).toBeVisible();
    expect(await overflow(page), "customer sign-ins").toEqual([]);
  });

  test("security fits in about three screens: 25 sign-ins per page, the blocked addresses as a pane", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone layout");
    await owner(page);
    await page.goto("/de/admin/security");
    await expect(page.locator("[data-sign-ins] > li")).toHaveCount(25);
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(height).toBeLessThanOrEqual(2500);
    await page.getByRole("radio", { name: new RegExp(`^${de.admin.security.filters.blocked}`) }).click();
    await expect(page.getByRole("button", { name: de.admin.security.block, exact: true })).toBeVisible();
  });

  test("the editor's header: the tabs have a row of their own and cover nothing", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone layout");
    await owner(page);
    const username = `hdr-${unique()}`;
    await page.goto("/de/admin/creators");
    await page.getByRole("button", { name: de.admin.creators.new }).first().click();
    await page.locator("#new-name").fill("Kopfzeile Test");
    await page.locator("#new-username").fill(username);
    await page.getByRole("button", { name: de.admin.creators.create.submit }).click();
    await page.waitForURL(`**/admin/creators/${username}`);
    const status = await page.locator("[data-editor-status]").boundingBox();
    const tabs = await page.getByRole("radiogroup", { name: de.admin.creator.tabsLabel }).boundingBox();
    if (!status || !tabs) throw new Error("no header");
    // The tabs start below the status line: nothing overlaps.
    expect(tabs.y).toBeGreaterThanOrEqual(status.y + status.height - 1);
    expect(await overflow(page)).toEqual([]);
  });
});

test.describe("team console: icons, trends, Arabic", () => {
  test("navigation glyphs: Contact, UsersRound, SquareUser, Gift; the chosen tab is strong and semibold", async ({ page, isMobile }) => {
    await owner(page, "en");
    const glyph = (name: string) =>
      page.getByRole("navigation", { name: "Team area" }).locator("visible=true").getByRole("link", { name, exact: true }).first().locator("svg").getAttribute("class");
    if (isMobile) {
      expect(await glyph("Customers")).toContain("lucide-contact");
      expect(await glyph("Creators")).toContain("lucide-square-user");
      await page.getByRole("navigation", { name: "Team area" }).locator("visible=true").getByRole("button", { name: "More" }).click();
      expect(await page.getByRole("menuitem", { name: "Team" }).locator("svg").getAttribute("class")).toContain("lucide-users-round");
      expect(await page.getByRole("menuitem", { name: "Referrals" }).locator("svg").getAttribute("class")).toContain("lucide-gift");
      await page.keyboard.press("Escape");
    } else {
      expect(await glyph("Customers")).toContain("lucide-contact");
      expect(await glyph("Team")).toContain("lucide-users-round");
      expect(await glyph("Creators")).toContain("lucide-square-user");
      expect(await glyph("Referrals")).toContain("lucide-gift");
    }
    // S-05: the current tab is marked by a strong stroke and a semibold label, never colour alone.
    const current = page.getByRole("navigation", { name: "Team area" }).locator("visible=true").locator("[aria-current=page]").first();
    await expect(current).toHaveCSS("font-weight", "600");
    expect(Number(await current.locator("svg").getAttribute("stroke-width"))).toBeGreaterThan(2);
    // "View as" is in the account menu, not on top of the overview.
    await expect(page.locator("main select")).toHaveCount(0);
    await page.getByRole("button", { name: /^Account/ }).locator("visible=true").first().click();
    await expect(page.getByRole("menuitemradio", { name: "Viewer" })).toBeVisible();
  });

  test("KPI deltas carry an arrow and words, never colour alone", async ({ page }) => {
    await owner(page, "en");
    const chips = page.locator("main [data-kpis] [data-tone]");
    expect(await chips.count()).toBeGreaterThanOrEqual(6);
    for (const chip of await chips.all()) {
      await expect(chip.locator("svg")).toHaveCount(1);
      await expect(chip.locator(".sr-only")).toHaveText(/^(Up|Down|Unchanged): $/);
      await expect(chip.locator("bdi")).toHaveText(/\S/);
    }
    // Revenue this month is a tile of its own; in the demo it is Pro invoices only (no page service without payments).
    await expect(page.locator("[data-revenue-orders=off]")).toBeVisible();
  });

  test("Arabic: the greeting isolates the name, the layout is mirrored", async ({ page }) => {
    await owner(page, "ar");
    const heading = await page.locator("main h1").textContent();
    expect(heading).toMatch(/⁨[^⁩]+⁩/);
    expect(await page.evaluate(() => document.documentElement.dir)).toBe("rtl");
    await page.goto("/ar/admin/customers");
    await expect(page.locator("main a[href*='/admin/customers/cus_']").first()).toBeVisible();
    // The demo note's Latin words sit in <bdi>.
    await expect(page.locator("main bdi", { hasText: "example.com" })).toBeVisible();
    // An e-mail address truncates by itself, left to right, so the ellipsis falls at its end.
    const email = page.locator("main li span[dir='ltr']", { hasText: "@" }).first();
    await expect(email).toHaveCSS("direction", "ltr");
    await expect(email).toHaveCSS("text-overflow", "ellipsis");
    // The sign-in log's pager reads "1–25 من …": the range is isolated left to right, so its first
    // figure stands on the left of the dash, not "25–1".
    await page.goto("/ar/admin/security");
    // A Latin city on a sign-in row truncates by itself too (its start stays).
    const city = page.locator("main [data-sign-ins] bdi[data-city]").first();
    if ((await city.count()) > 0) {
      await expect(city).toHaveCSS("direction", "ltr");
      await expect(city).toHaveCSS("text-overflow", "ellipsis");
    }
    const range = page.locator("main nav bdi[dir='ltr']").first();
    await expect(range).toHaveText(/^1–\d+$/);
    const [one, dash] = await range.evaluate((element) => {
      const text = element.firstChild;
      const box = (start: number) => {
        const r = document.createRange();
        r.setStart(text as Node, start);
        r.setEnd(text as Node, start + 1);
        return r.getBoundingClientRect().left;
      };
      return [box(0), box(1)];
    });
    expect(one).toBeLessThan(dash);
  });
});

/** The console's routes for axe: 15 screens and states. */
async function routes(page: Page, locale: "en" | "ar"): Promise<string[]> {
  await page.goto(`/${locale}/admin/customers`);
  const customer = await page.locator("main a[href*='/admin/customers/cus_']").first().getAttribute("href");
  await page.goto(`/${locale}/admin/creators`);
  const published = await page.locator("main a[href*='/admin/creators/']").first().getAttribute("href");
  const strip = (href: string | null) => (href ?? "").replace(/^\/(en|ar|de)/, "");
  return [
    "/admin",
    "/admin/customers",
    "/admin/customers?status=past_due",
    strip(customer),
    "/admin/subscriptions",
    "/admin/subscriptions?status=trialing",
    "/admin/security",
    "/admin/security?filter=blocked",
    "/admin/analytics",
    "/admin/creators",
    strip(published),
    "/admin/templates",
    "/admin/referrals",
    "/admin/team",
    "/admin/activity",
  ].map((route) => `/${locale}${route}`);
}

for (const locale of ["en", "ar"] as const) {
  test(`axe: 15 team console screens, ${locale}`, async ({ page, isMobile }) => {
    test.skip(!isMobile, "the phone project (A-11); desktop axe runs in admin.spec.ts");
    test.setTimeout(240_000);
    await page.setViewportSize(PHONE);
    await owner(page, locale);
    const list = await routes(page, locale);
    expect(new Set(list).size).toBe(15);
    for (const route of list) {
      await page.goto(route);
      await expect(page.locator("main h1").first()).toBeVisible();
      // Fonts and the first frame settle before contrast is measured.
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      expect(await axe(page), route).toEqual([]);
    }
  });
}

/** Review pictures: overview, customers and security on a phone (de, ar), and the overview on a laptop. */
test.describe("team console: screenshots", () => {
  test.skip(!SHOTS, "ADMIN_PHONE_SHOTS=<dir> saves the review pictures.");

  async function shoot(browser: Browser, baseURL: string | undefined, locale: "de" | "ar", size: "phone" | "laptop", routes: [string, string][]) {
    const viewport = size === "phone" ? PHONE : { width: 1440, height: 900 };
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, ...(size === "phone" ? { isMobile: true, hasTouch: true } : {}), ...(baseURL ? { baseURL } : {}) });
    const page = await context.newPage();
    await owner(page, locale);
    mkdirSync(SHOTS, { recursive: true });
    for (const [name, route] of routes) {
      await page.goto(`/${locale}${route}`);
      await expect(page.locator("main h1").first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      await page.screenshot({ path: path.join(SHOTS, `${name}-${locale}-${size}.png`), fullPage: true });
      await page.screenshot({ path: path.join(SHOTS, `${name}-${locale}-${size}-first-screen.png`) });
    }
    await context.close();
  }

  test("phone de/ar and laptop", async ({ browser, baseURL }, info) => {
    test.skip(info.project.name !== "desktop", "One run makes every size.");
    test.setTimeout(300_000);
    for (const locale of ["de", "ar"] as const) {
      await shoot(browser, baseURL, locale, "phone", [
        ["overview", "/admin"],
        ["customers", "/admin/customers"],
        ["security", "/admin/security"],
        ["team", "/admin/team"],
      ]);
      await shoot(browser, baseURL, locale, "laptop", [
        ["overview", "/admin"],
        ["customers", "/admin/customers"],
      ]);
    }
    // ar.json is read so a missing Arabic key fails here too.
    expect(ar.admin.overview.kpi.revenue.length).toBeGreaterThan(0);
  });
});
