import { expect, test, type Page } from "@playwright/test";

import { legalReady } from "../src/features/legal/company";

/**
 * Touch targets. Every control a finger can press has a hit area of at least 44 × 44 px on a
 * phone: the home page, the template gallery and a creator page (a concept page, which carries the
 * label pill, the Linkyo bar and the privacy notice). The visible control may be smaller: the hit area
 * is its own box plus an invisible extension (`::before`, 2 px on every side for a 40 px control).
 *
 * The measure is the element's box united with its `::before`/`::after` box when that is positioned
 * over it and takes pointer events. An extension only counts when it is real: the middle of each
 * extended side must hit the control or another control (a scroller that clips the extension, or
 * something laid over it, shows there). Controls a finger cannot press are skipped: the skip link
 * (visible only on focus) and the phone mock-ups on the pages (`inert`, `aria-hidden`).
 *
 * What may stay under 44 px, on purpose: a link inside a sentence (WCAG 2.5.8 exempts it; its box is the
 * words). Nothing else; the list is explicit below.
 *
 * Phone checks set a touch phone themselves and run once, on the desktop project; the laptop check
 * (the footer's legal links) uses a mouse.
 */

interface TargetRow {
  name: string;
  tag: string;
  own: { w: number; h: number };
  hit: { w: number; h: number; extended: boolean };
  reachable: boolean;
  inline: boolean;
}

/**
 * Runs in the page (serialised: no outside names). One row per live control, or per live control inside
 * `scope` (a selector) when one is given.
 */
const collectTargets = (scope?: string): TargetRow[] => {
  const SEL = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=switch], [role=checkbox], [role=radio], [role=menuitem], [role=link], [tabindex]:not([tabindex="-1"])';
  const live = (element: Element) => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    if (style.visibility === "hidden" || style.display === "none" || box.width === 0 || box.height === 0) return false;
    // Not pressable: the skip link until it is focused, anything inert or hidden from assistive technology (the phone mock-ups).
    return element.closest('[inert], [aria-hidden="true"], [hidden]') === null && !(element.tagName === "A" && element.classList.contains("sr-only"));
  };
  const hitBox = (element: Element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    let left = box.left;
    let top = box.top;
    let right = box.right;
    let bottom = box.bottom;
    for (const pseudo of ["::before", "::after"] as const) {
      const extra = getComputedStyle(element, pseudo);
      if (extra.content === "none" || extra.content === "normal" || extra.position !== "absolute" || style.position === "static" || extra.pointerEvents === "none") continue;
      const [x, y, w, h] = [extra.left, extra.top, extra.width, extra.height].map(parseFloat);
      if ([x, y, w, h].some((value) => value === undefined || Number.isNaN(value))) continue;
      const originX = box.left + parseFloat(style.borderLeftWidth);
      const originY = box.top + parseFloat(style.borderTopWidth);
      left = Math.min(left, originX + (x ?? 0));
      top = Math.min(top, originY + (y ?? 0));
      right = Math.max(right, originX + (x ?? 0) + (w ?? 0));
      bottom = Math.max(bottom, originY + (y ?? 0) + (h ?? 0));
    }
    return { left, top, right, bottom, box };
  };
  const rows: TargetRow[] = [];
  for (const element of new Set(document.querySelectorAll(SEL))) {
    if ((scope !== undefined && element.closest(scope) === null) || !live(element)) continue;
    // Bring it to the middle of the screen: the hit test below needs the control in view.
    element.scrollIntoView({ block: "center", inline: "center" });
    const { left, top, right, bottom, box } = hitBox(element);
    const extended = left < box.left - 0.5 || top < box.top - 0.5 || right > box.right + 0.5 || bottom > box.bottom + 0.5;
    let reachable = true;
    if (extended) {
      const probes: [number, number][] = [];
      if (left < box.left - 0.5) probes.push([(left + box.left) / 2, (box.top + box.bottom) / 2]);
      if (right > box.right + 0.5) probes.push([(right + box.right) / 2, (box.top + box.bottom) / 2]);
      if (top < box.top - 0.5) probes.push([(box.left + box.right) / 2, (top + box.top) / 2]);
      if (bottom > box.bottom + 0.5) probes.push([(box.left + box.right) / 2, (bottom + box.bottom) / 2]);
      reachable = probes.every(([x, y]) => {
        if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return true;
        const hit = document.elementFromPoint(x, y);
        return hit !== null && (hit === element || element.contains(hit) || hit.closest(SEL) !== null);
      });
    }
    const label = element.getAttribute("aria-label") ?? element.textContent.trim().replace(/\s+/g, " ").slice(0, 28);
    rows.push({
      name: label !== "" ? label : (element.getAttribute("placeholder") ?? element.tagName),
      tag: element.tagName.toLowerCase() + (element.getAttribute("role") ? `[${element.getAttribute("role") ?? ""}]` : ""),
      own: { w: Math.round(box.width), h: Math.round(box.height) },
      hit: { w: Math.round(right - left), h: Math.round(bottom - top), extended },
      reachable,
      inline: element.tagName === "A" && getComputedStyle(element).display === "inline" && element.closest("p, li, dd, dt") !== null,
    });
  }
  return rows;
};

const describeRow = (row: TargetRow) => `${row.tag} "${row.name}": box ${String(row.own.w)}×${String(row.own.h)}, hit area ${String(row.hit.w)}×${String(row.hit.h)}`;

async function targets(page: Page, scope?: string): Promise<TargetRow[]> {
  return page.evaluate(collectTargets, scope);
}

/**
 * A creator page's controls: those in the page with the page at its top (the label pill, the cards, the
 * privacy notice; Linkyo's bar is inert there), then Linkyo's bar and the privacy notice with the page
 * scrolled past the hero, where the bar is shown. Two passes, because the page's compact top bar comes in
 * as it scrolls away and covers the pill's buttons (which is right: a visitor at that scroll position
 * cannot press them either).
 */
async function creatorPageTargets(page: Page): Promise<TargetRow[]> {
  await page.goto("/de/p/messi");
  await page.evaluate(() => document.fonts.ready);
  // The privacy notice is there from the start; Linkyo's bar slides in once the hero has gone by.
  await expect(page.getByRole("button", { name: "Externe Inhalte erlauben" })).toBeVisible();
  const top = await targets(page);
  await page.evaluate(() => window.scrollTo(0, 1500));
  await expect(page.locator("[data-theme='dark'][data-shown]")).toHaveCount(1);
  const scrolled = await targets(page, "[data-theme='dark'][data-shown], [data-privacy-notice]");
  return [...top, ...scrolled];
}

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  const PAGES = [
    { name: "the home page", path: "/de" },
    { name: "the template gallery", path: "/de/templates" },
    { name: "a creator page", path: "/de/p/messi" },
  ] as const;

  for (const entry of PAGES) {
    test(`${entry.name} (${entry.path}): every control has a hit area of 44 × 44 px`, async ({ page }) => {
      test.setTimeout(90_000);
      // Pages animate their content in and count figures up; measure them as they rest.
      await page.emulateMedia({ reducedMotion: "reduce" });
      let rows: TargetRow[];
      if (entry.path.startsWith("/de/p/")) {
        rows = await creatorPageTargets(page);
      } else {
        await page.goto(entry.path);
        await page.evaluate(() => document.fonts.ready);
        rows = await targets(page);
      }
      expect(rows.length, "the page has controls to measure").toBeGreaterThan(5);
      const small = rows.filter((row) => (row.hit.w < 44 || row.hit.h < 44) && !row.inline);
      expect(small.map(describeRow), "controls with a hit area under 44 × 44 px").toEqual([]);
      const clipped = rows.filter((row) => row.hit.extended && !row.reachable);
      expect(clipped.map(describeRow), "controls whose invisible extension is clipped or covered").toEqual([]);
    });
  }

  test("the creator page's own controls are among them: the label pill's buttons and Linkyo's bar", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const names = (await creatorPageTargets(page)).map((row) => row.name);
    for (const name of ["Sprache wählen", "Mehr zur Vorschau", "Kostenlos registrieren", "Leiste schließen", "Nur notwendige", "Einstellungen"]) {
      expect(names, `${name} was measured`).toContain(name);
    }
  });
});

test.describe("on a laptop", () => {
  test.skip(!legalReady, "the footer names the legal pages without links until the company data is in");
  test.use({ viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false });

  test("the footer's legal links are at least 32 px tall (24 px is the least WCAG 2.5.8 allows)", async ({ page }) => {
    await page.goto("/de");
    const footer = page.getByRole("contentinfo");
    for (const name of ["Impressum", "Datenschutz", "AGB"]) {
      const box = await footer.getByRole("link", { name, exact: true }).boundingBox();
      expect(box, name).not.toBeNull();
      expect(box?.height ?? 0, name).toBeGreaterThanOrEqual(32);
    }
  });
});
