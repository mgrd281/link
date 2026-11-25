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
 * - K3: the block button of a sign-in row says what it does on a phone (and nothing runs under it),
 *   and opening a sheet pops no tooltip up.
 * - K4: a customer's header leaves the first screen to the content, tile labels are whole, the
 *   search placeholders fit, and every control of the team area is 44 × 44 px to a finger.
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

test.describe("K3: a phone's sign-in rows and sheets", () => {
  for (const locale of ["de", "ar"] as const) {
    test(`${locale}: the block button shows its word and is 44 × 44 px; a sheet opens without a tooltip`, async ({ browser, baseURL }, info) => {
      test.skip(info.project.name !== "desktop", "sets its own windows");
      test.setTimeout(120_000);
      const words = MESSAGES[locale].admin.security;
      const state = await owner(browser, baseURL, locale);
      const { context, page } = await open(browser, baseURL, state, "phone");
      await page.goto(`/${locale}/admin/security`);
      await settle(page);
      const block = page.locator("[data-sign-ins] > li").first().getByRole("button");
      // Its name contains the word it shows ("127.0.0.1 sperren"; WCAG 2.5.3).
      await expect(block).toHaveAccessibleName(new RegExp(words.block, "i"));
      // The word is on the screen, not only read out.
      const shown = await block.getByText(words.block, { exact: true }).boundingBox();
      expect(shown && shown.width > 8 && shown.height > 8).toBe(true);
      const box = await block.boundingBox();
      expect(box && box.width >= 44 && box.height >= 44, `block button ${String(box?.width)}×${String(box?.height)}`).toBe(true);
      // Nothing of a row runs under its block button (a warning chip took a third line instead).
      expect(await page.evaluate(logProblems)).toEqual([]);

      // A sheet opened with a finger takes focus itself: no tooltip pops up over its close button.
      await page.goto(`/${locale}/admin/customers`);
      await settle(page);
      await page.getByRole("button", { name: MESSAGES[locale].ui.filter.title, exact: true }).tap();
      const sheet = page.getByRole("dialog", { name: MESSAGES[locale].ui.filter.title });
      await expect(sheet).toBeVisible();
      // Longer than the tooltip's delay (motion.delay.tooltip, 400 ms).
      await page.waitForTimeout(800);
      await expect(page.getByRole("tooltip")).toHaveCount(0);
      await expect(sheet).toBeFocused();
      await context.close();
    });
  }

  test("a laptop opens the sheet with the mouse without a tooltip as well", async ({ browser, baseURL }, info) => {
    test.skip(info.project.name !== "desktop", "sets its own windows");
    const state = await owner(browser, baseURL, "de");
    const { context, page } = await open(browser, baseURL, state, "laptop");
    await page.goto("/de/admin/customers");
    await settle(page);
    await page.getByRole("button", { name: de.ui.filter.title, exact: true }).click();
    await expect(page.getByRole("dialog", { name: de.ui.filter.title })).toBeVisible();
    await page.waitForTimeout(800);
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await context.close();
  });
});

/**
 * Runs in the page (serialised: no outside names). The hit area of every live control inside `scope`,
 * as e2e/touch-targets.spec.ts measures it: its box united with its `::before`/`::after`, which only
 * counts where it is not clipped or covered. Disabled controls are not targets. A positioned pseudo-
 * element is placed in its containing block: the control itself when it is positioned, else its
 * nearest positioned ancestor (a link that covers its row with `after:inset-0`, as DataList's do).
 */
const smallTargets = (scope: string): string[] => {
  const SEL = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=switch], [role=checkbox], [role=radio], [role=menuitem], [role=link], [tabindex]:not([tabindex="-1"])';
  const live = (element: Element) => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    if (style.visibility === "hidden" || style.display === "none" || box.width === 0 || box.height === 0) return false;
    if (element.matches(":disabled, [aria-disabled=true]")) return false;
    return element.closest('[inert], [aria-hidden="true"], [hidden]') === null;
  };
  const containingBlock = (element: Element): Element => {
    let block: Element | null = element;
    while (block && block !== document.documentElement && getComputedStyle(block).position === "static") block = block.parentElement;
    return block ?? document.documentElement;
  };
  const out: string[] = [];
  for (const element of new Set(document.querySelectorAll(SEL))) {
    if (element.closest(scope) === null || !live(element)) continue;
    element.scrollIntoView({ block: "center", inline: "center" });
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    let { left, top, right, bottom } = box;
    for (const pseudo of ["::before", "::after"] as const) {
      const extra = getComputedStyle(element, pseudo);
      if (extra.content === "none" || extra.content === "normal" || extra.position !== "absolute" || extra.pointerEvents === "none") continue;
      const [x, y, w, h] = [extra.left, extra.top, extra.width, extra.height].map(parseFloat);
      if (x === undefined || y === undefined || w === undefined || h === undefined || [x, y, w, h].some(Number.isNaN)) continue;
      const block = containingBlock(element);
      const frame = block.getBoundingClientRect();
      const blockStyle = getComputedStyle(block);
      const originX = frame.left + parseFloat(blockStyle.borderLeftWidth);
      const originY = frame.top + parseFloat(blockStyle.borderTopWidth);
      left = Math.min(left, originX + x);
      top = Math.min(top, originY + y);
      right = Math.max(right, originX + x + w);
      bottom = Math.max(bottom, originY + y + h);
    }
    // An extension counts on each side only where a finger reaches it: the middle of the extended side
    // must hit the control or another control. Where it is clipped or covered (a raised slot of the
    // row), that side of the hit area is the control's own edge.
    const reaches = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return true;
      const hit = document.elementFromPoint(x, y);
      return hit !== null && (hit === element || element.contains(hit) || hit.closest(SEL) !== null);
    };
    const middleX = (box.left + box.right) / 2;
    const middleY = (box.top + box.bottom) / 2;
    if (left < box.left - 0.5 && !reaches((left + box.left) / 2, middleY)) left = box.left;
    if (right > box.right + 0.5 && !reaches((right + box.right) / 2, middleY)) right = box.right;
    if (top < box.top - 0.5 && !reaches(middleX, (top + box.top) / 2)) top = box.top;
    if (bottom > box.bottom + 0.5 && !reaches(middleX, (bottom + box.bottom) / 2)) bottom = box.bottom;
    // A link inside a sentence may stay its words (WCAG 2.5.8).
    const inline = element.tagName === "A" && style.display === "inline" && element.closest("p, li, dd, dt") !== null;
    const name = (element.getAttribute("aria-label") ?? element.textContent).trim().replace(/\s+/g, " ").slice(0, 28) || (element.getAttribute("placeholder") ?? element.tagName);
    const tag = element.tagName.toLowerCase() + (element.getAttribute("role") ? `[${element.getAttribute("role") ?? ""}]` : "");
    if (!inline && (right - left < 44 || bottom - top < 44)) out.push(`${tag} "${name}": ${String(Math.round(right - left))}×${String(Math.round(bottom - top))} to a finger`);
  }
  return out;
};

/** Runs in the page. KPI tile labels that are cut (on one line or after their second). */
const cutTileLabels = (): string[] =>
  [...document.querySelectorAll("main [data-kpis] dt")].filter((label) => label.scrollWidth > label.clientWidth || label.scrollHeight > label.clientHeight + 1).map((label) => label.textContent.trim());

/** Runs in the page. The search field's placeholder, measured in the field's own font, against its room. */
const placeholderFits = (): { text: string; width: number; room: number } | null => {
  const input = document.querySelector<HTMLInputElement>("main input[type=search]");
  if (!input) return null;
  const style = getComputedStyle(input);
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return null;
  context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const text = input.placeholder;
  return { text, width: Math.ceil(context.measureText(text).width), room: Math.floor(input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)) };
};

test.describe("K4: the team console on a phone", () => {
  for (const locale of ["de", "ar"] as const) {
    test(`${locale}: a customer's content starts high, tile labels are whole, the search hints fit`, async ({ browser, baseURL }, info) => {
      test.skip(info.project.name !== "desktop", "sets its own windows");
      test.setTimeout(150_000);
      const state = await owner(browser, baseURL, locale);
      const { context, page } = await open(browser, baseURL, state, "phone");
      // The customers' search hint fits its field on a 390 px phone, and on a 360 px one.
      for (const width of [390, 360]) {
        await page.setViewportSize({ width, height: 844 });
        await page.goto(`/${locale}/admin/customers`);
        await settle(page);
        const hint = await page.evaluate(placeholderFits);
        expect(hint && hint.text.length > 0 && hint.width <= hint.room, `${String(width)}: "${hint?.text ?? ""}" ${String(hint?.width)} px in ${String(hint?.room)} px`).toBe(true);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      // A customer: the way back, the name, the addresses, the plan and the two actions take less than
      // the first 360 px; the first card starts below them (it was at 443 px of 844) and the tabs are in view.
      await page.goto(`/${locale}/admin/customers`);
      await settle(page);
      await page.locator("main a[href*='/admin/customers/cus_']").first().click();
      await settle(page);
      const card = page.locator("main section").first();
      await expect(card).toBeVisible();
      const top = await card.evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
      expect(top, "first card").toBeLessThanOrEqual(360);
      // Compact, not crowded: the way back, the name, the addresses, the chips and the buttons never overlap.
      const crowded = await page.evaluate(() => {
        const parts = [...document.querySelectorAll("main header :is(a, h1, span[dir=ltr], [data-customer-chips], button)")].map((element) => ({ name: (element.textContent || element.tagName).trim().slice(0, 24), box: element.getBoundingClientRect() }));
        const out: string[] = [];
        for (const [i, a] of parts.entries()) {
          for (const b of parts.slice(i + 1)) {
            const across = Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left);
            const down = Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top);
            if (across > 0.5 && down > 0.5) out.push(`${a.name} × ${b.name}`);
          }
        }
        return out;
      });
      expect(crowded).toEqual([]);
      await expect(page.getByRole("radiogroup", { name: MESSAGES[locale].admin.customer.tabs.label })).toBeInViewport({ ratio: 1 });
      // Tile labels wrap to a second line instead of being cut ("Zahlung fehlgeschl…").
      for (const route of ["/admin", "/admin/subscriptions", "/admin/analytics", "/admin/security"]) {
        await page.goto(`/${locale}${route}`);
        await settle(page);
        await expect(page.locator("main [data-kpis] dt").first()).toBeVisible();
        expect(await page.evaluate(cutTileLabels), route).toEqual([]);
      }
      await context.close();
    });

    test(`${locale}: every control of the team area is 44 × 44 px to a finger`, async ({ browser, baseURL }, info) => {
      test.skip(info.project.name !== "desktop", "sets its own windows");
      test.setTimeout(240_000);
      const state = await owner(browser, baseURL, locale);
      const { context, page } = await open(browser, baseURL, state, "phone");
      await page.goto(`/${locale}/admin/customers`);
      await settle(page);
      const customer = (await page.locator("main a[href*='/admin/customers/cus_']").first().getAttribute("href"))?.replace(/^\/(de|en|ar)/, "") ?? "";
      const routes = ["/admin", "/admin/customers", customer, "/admin/subscriptions", "/admin/security", "/admin/analytics", "/admin/creators", "/admin/templates", "/admin/referrals", "/admin/team", "/admin/activity"];
      const small: string[] = [];
      for (const route of routes) {
        await page.goto(`/${locale}${route}`);
        await settle(page);
        for (const line of await page.evaluate(smallTargets, "main")) small.push(`${route}: ${line}`);
      }
      expect(small).toEqual([]);
      await context.close();
    });
  }
});
