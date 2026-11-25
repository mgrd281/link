import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

import ar from "../src/messages/ar.json" with { type: "json" };
import de from "../src/messages/de.json" with { type: "json" };
import en from "../src/messages/en.json" with { type: "json" };

import { enterDemoCode } from "./auth";

/**
 * The team console's polish after Stage 3, measured in the demo:
 *
 * - K1: the sign-in log on laptops: no two cells overlap, chips keep a gap, and text that does not
 *   fit ends in an ellipsis, has a title and keeps its start (Latin names in Arabic rows).
 * - K2: the customers list uses the room it has: no name, e-mail or country is cut at 1440 or 1920.
 *
 * Every test sets its own window (and a touch phone where it says so), so the file runs once, on the
 * desktop project. The account is a demo sign-up with the demo team code, as in admin-phone-app.spec.ts.
 */

const TEAM_CODE = "linkyo-team-4827";
const MESSAGES = { de, en, ar };
type Locale = keyof typeof MESSAGES;
type Size = "phone" | "laptop" | "desktop";
type State = Awaited<ReturnType<BrowserContext["storageState"]>>;

const WINDOWS: Record<Size, { viewport: { width: number; height: number }; isMobile?: boolean; hasTouch?: boolean }> = {
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  laptop: { viewport: { width: 1440, height: 900 } },
  desktop: { viewport: { width: 1920, height: 1080 } },
};

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Signs up in the demo and opens the team area with the team code; the account becomes the owner. */
async function owner(browser: Browser, baseURL: string | undefined, locale: Locale): Promise<State> {
  const context = await browser.newContext({ ...(baseURL ? { baseURL } : {}), viewport: WINDOWS.laptop.viewport });
  const page = await context.newPage();
  const name = `polish-${unique()}`;
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
  const state = await context.storageState();
  await context.close();
  return state;
}

async function open(browser: Browser, baseURL: string | undefined, state: State, size: Size): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ ...(baseURL ? { baseURL } : {}), ...WINDOWS[size], deviceScaleFactor: 1, reducedMotion: "reduce", storageState: state });
  return { context, page: await context.newPage() };
}

async function settle(page: Page) {
  await expect(page.locator("main h1").first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/**
 * Runs in the page (serialised: no outside names). The sign-in log's rows: two cells whose painted
 * boxes (their text and the boxes that paint, cut by what clips them) overlap; cells side by side
 * with less than 8 px between them; text cut without an ellipsis (or by an inline box, which never
 * gets one), without a title, or Latin text cut at its start.
 */
const logProblems = (): string[] => {
  const visible = (element: Element) => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
  };
  const clips = (element: Element) => getComputedStyle(element).overflowX !== "visible";
  /** The cells of a row: the boxes that take part in its grid (inside any `display: contents`). */
  const cellsOf = (row: Element): Element[] => {
    const out: Element[] = [];
    const walk = (element: Element) => {
      for (const child of element.children) {
        const display = getComputedStyle(child).display;
        if (display === "contents") walk(child);
        else if (display !== "none" && visible(child)) out.push(child);
      }
    };
    walk(row);
    return out;
  };
  interface Box {
    left: number;
    top: number;
    right: number;
    bottom: number;
  }
  const painted = (cell: Element): Box | null => {
    let box: Box | null = null;
    const add = (rect: DOMRect, from: Node) => {
      if (rect.width <= 0 || rect.height <= 0) return;
      let { left, top, right, bottom } = rect;
      for (let element = from.parentElement; element; element = element.parentElement) {
        if (clips(element)) {
          const clip = element.getBoundingClientRect();
          left = Math.max(left, clip.left);
          right = Math.min(right, clip.right);
          top = Math.max(top, clip.top);
          bottom = Math.min(bottom, clip.bottom);
        }
        if (element === cell) break;
      }
      if (right - left <= 0.5 || bottom - top <= 0.5) return;
      box = box ? { left: Math.min(box.left, left), top: Math.min(box.top, top), right: Math.max(box.right, right), bottom: Math.max(box.bottom, bottom) } : { left, top, right, bottom };
    };
    const walker = document.createTreeWalker(cell, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let node: Node | null = walker.currentNode; node; node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (!node.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) add(rect, node);
      } else if (node instanceof Element && node !== cell && visible(node)) {
        const style = getComputedStyle(node);
        if (node.tagName.toLowerCase() === "svg" || style.backgroundColor !== "rgba(0, 0, 0, 0)" || parseFloat(style.borderTopWidth) > 0) add(node.getBoundingClientRect(), node.firstChild ?? node);
      }
    }
    return box;
  };
  const words = (element: Element) => element.textContent.trim().replace(/\s+/g, " ").slice(0, 32);
  const problems: string[] = [];
  for (const row of document.querySelectorAll("[data-sign-ins] > li")) {
    const cells = cellsOf(row).map((cell) => ({ cell, box: painted(cell) }));
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const a = cells[i]?.box;
        const b = cells[j]?.box;
        if (!a || !b) continue;
        const across = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const down = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        const first = cells[i]?.cell;
        const second = cells[j]?.cell;
        if (!first || !second) continue;
        if (across > 0.5 && down > 0.5) problems.push(`overlap: "${words(first)}" × "${words(second)}" (${across.toFixed(1)} px)`);
        else if (down > 0.5 && -across < 8) problems.push(`no gap: "${words(first)}" | "${words(second)}" (${(-across).toFixed(1)} px)`);
      }
    }
    for (const element of row.querySelectorAll("*")) {
      if (!visible(element) || !clips(element) || element.scrollWidth <= element.clientWidth) continue;
      const style = getComputedStyle(element);
      const text = words(element);
      const inlineOnly = [...element.children].every((child) => getComputedStyle(child).display === "inline");
      if (style.textOverflow !== "ellipsis" || !inlineOnly) problems.push(`cut without an ellipsis: "${text}"`);
      else if (element.closest("[title]") === null) problems.push(`cut without a title: "${text}"`);
      else if (/^[A-Za-z0-9]/.test(text) && style.direction !== "ltr") problems.push(`Latin text cut at its start: "${text}"`);
    }
  }
  return problems.slice(0, 12);
};

test.describe("K1: the sign-in log on laptops", () => {
  for (const locale of ["de", "ar"] as const) {
    test(`${locale}: cells never overlap, chips keep a gap, cut text ends in an ellipsis with a title (1440 and 1920)`, async ({ browser, baseURL }, info) => {
      test.skip(info.project.name !== "desktop", "sets its own windows");
      test.setTimeout(120_000);
      const state = await owner(browser, baseURL, locale);
      for (const size of ["laptop", "desktop"] as const) {
        const { context, page } = await open(browser, baseURL, state, size);
        await page.goto(`/${locale}/admin/security`);
        await settle(page);
        await expect(page.locator("[data-sign-ins] > li")).toHaveCount(25);
        expect(await page.evaluate(logProblems), `${locale} ${size}`).toEqual([]);
        await context.close();
      }
    });
  }
});

/** Runs in the page. Names, e-mail addresses and countries of the customers list that are cut. */
const cutCustomerCells = (country: string): string[] => {
  const list = document.querySelector("main ul[aria-label] > li dl")?.closest("ul");
  if (!list) return ["no list"];
  const header = list.parentElement?.querySelector(":scope > [aria-hidden]");
  const column = [...(header?.children ?? [])].findIndex((element) => element.textContent.trim() === country);
  if (column < 1) return ["no country column"];
  const cut = (element: Element | null | undefined) => element !== null && element !== undefined && (element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight + 1);
  const out: string[] = [];
  for (const row of list.querySelectorAll(":scope > li")) {
    const name = row.querySelector("a")?.closest(".truncate");
    const email = row.querySelector("span[dir=ltr]");
    const place = row.querySelectorAll("dl > div > dd")[column - 1];
    for (const [what, element] of [["name", name], ["e-mail", email], ["country", place]] as const) {
      if (cut(element)) out.push(`${what}: ${element?.textContent.trim() ?? ""}`);
    }
  }
  return out;
};

test.describe("K2: the customers list on laptops", () => {
  for (const locale of ["de", "en", "ar"] as const) {
    test(`${locale}: no name, e-mail or country is cut at 1440 and 1920, and 1920 gives the list more room`, async ({ browser, baseURL }, info) => {
      test.skip(info.project.name !== "desktop", "sets its own windows");
      test.setTimeout(120_000);
      const state = await owner(browser, baseURL, locale);
      const widths: number[] = [];
      for (const size of ["laptop", "desktop"] as const) {
        const { context, page } = await open(browser, baseURL, state, size);
        await page.goto(`/${locale}/admin/customers`);
        await settle(page);
        const list = page.getByRole("list", { name: MESSAGES[locale].admin.customers.title });
        await expect(list.locator("> li")).toHaveCount(25);
        expect(await page.evaluate(cutCustomerCells, MESSAGES[locale].admin.customers.columns.country), `${locale} ${size}`).toEqual([]);
        widths.push((await list.boundingBox())?.width ?? 0);
        await context.close();
      }
      // The column grows at 1920: the list is not held at the laptop's width with 300 px left on each side.
      expect(widths[1] ?? 0).toBeGreaterThan((widths[0] ?? 0) + 300);
    });
  }
});
