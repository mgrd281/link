import { TEMPLATE_IDS, templatesFor } from "@linkyo/tokens/creator";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { enterDemoCode } from "./auth";

/**
 * The polish pass after Stage 3 (creator dashboard): one guard per defect the scorers found, each
 * measured as geometry so it fails without its fix.
 *
 * - D1: Design never scrolls the page by itself (at 1440 and 1920).
 * - D2: on a phone the pinned preview is at most a quarter of the screen, framed by a hairline (not
 *   the black bezel), and follows the part being changed.
 * - D3: every control of Home, Seite, Arbeiten, Design and Settings is reached at 44 × 44 px on a
 *   phone (hit-tested, so a `::before` counts), and a sheet's two header buttons sit at one margin.
 * - D4: the Seite, plan and section glyphs say what they mean; the welcome kinds are one style.
 * - D5: no dead areas on laptops: one start edge, Arbeiten fills its column, Plan and Konto in columns.
 * - D6: weekday names that differ, whole words on the Add sheet's cards, toasts that cover nothing.
 *
 * Each block below is named after its defect (D1 … D6).
 *
 * Demo mode: everything lives in this browser's storage. The file name keeps it out of the mobile
 * project (see playwright.config.ts): it runs once, in the desktop project, with the viewport (and,
 * for phones, touch) each test sets for itself.
 */

const STORAGE_KEY = "linkyo.demo.v1";
let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

const heading = (page: Page) => page.locator("#main h1").first();

async function signedIn(page: Page, locale: "de" | "en" | "ar" = "en") {
  const name = `dp-${unique()}`;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/${locale}/signup?name=${name}`);
  await page.waitForLoadState("networkidle");
  await page.locator("#signup-email").fill(`${name}@example.com`);
  await page.locator("form button[type=submit]").click();
  await enterDemoCode(page);
  await page.waitForURL(`**/${locale}/app/welcome`);
  await page.getByRole("button", { name: { de: "Später", en: "Skip for now", ar: "لاحقًا" }[locale] }).click();
  await page.waitForURL(`**/${locale}/app`);
  await expect(heading(page)).toBeVisible();
}

interface Seed {
  kind?: string;
  template?: string;
  projects?: number;
  links?: number;
  ready?: boolean;
}

/** A demo page: links and projects (a cover each), and (ready) a photo and a bio. */
async function seed(page: Page, { kind, template, projects = 0, links = 3, ready = true }: Seed) {
  await page.evaluate(
    ([key, options]) => {
      const db = JSON.parse(window.localStorage.getItem(key) ?? "{}") as {
        session: { accountId: string };
        sites: Record<string, { kind?: string; theme: Record<string, unknown>; page: { blocks: unknown[]; profile: Record<string, unknown> } }>;
      };
      const site = db.sites[db.session.accountId];
      if (!site) throw new Error("no site");
      const block = (id: string, extra: Record<string, unknown>) => ({ id, visible: true, highlight: false, ...extra });
      const cover = (alt: string) => ({ src: "sample:mila-avatar", alt, tone: "dark", w: 800, h: 1000 });
      site.page.blocks = [
        ...Array.from({ length: options.links }, (_, i) => block(`l-${i}`, { type: "link", title: `Link ${i + 1}`, url: `https://example.com/${i}` })),
        ...Array.from({ length: options.projects }, (_, i) =>
          block(`p-${i}`, {
            type: "project",
            slug: `arbeit-${i + 1}`,
            title: `Arbeit ${i + 1}`,
            summary: "Ein Satz über diese Arbeit.",
            year: { from: 2020 + i },
            cover: cover(`Bild ${i + 1}`),
          }),
        ),
      ];
      if (options.ready) {
        site.page.profile.bio = "Bilder und Räume.";
        // A 1×1 picture: the page counts as having a photo without loading anything.
        site.page.profile.avatar = { src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", alt: "" };
      }
      if (options.kind) site.kind = options.kind;
      if (options.template) site.theme = { template: options.template };
      window.localStorage.setItem(key, JSON.stringify(db));
    },
    [STORAGE_KEY, { kind, template, projects, links, ready }] as const,
  );
  await page.reload();
  await expect(heading(page)).toBeVisible();
}

/** A phone, as a finger meets it: 390 × 844 with touch (so `pointer: coarse` grows the small targets). */
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } as const;

// ─── D1: Design does not move the page ─────────────────────────────────────────────────────────

test.describe("D1: Design keeps the page where it is", () => {
  for (const [width, height] of [
    [1440, 900],
    [1920, 1080],
  ] as const) {
    test(`at ${String(width)} the page is still at the top a second after Design opens, and after each filter`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await signedIn(page);
      // The last look is chosen: its card sits in the grid's last row, below the window.
      await seed(page, { template: "laufbahn" });
      // Smooth scrolling is what people get: the old picker moved the page with it.
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.goto("/en/app/design");
      await expect(heading(page)).toHaveText("Design");
      const cards = page.locator("#main fieldset label:has(input[name=poster-template])");
      await expect(cards).toHaveCount(TEMPLATE_IDS.length);
      const chosen = cards.filter({ has: page.locator("input:checked") });
      await expect(chosen).toHaveCount(1);
      await page.waitForTimeout(1000);
      const scrolled = await page.evaluate(() => window.scrollY);
      // The chosen look lies below the window (its place in the page, not where the window now is):
      // that is what made the old picker scroll.
      expect(((await chosen.boundingBox())?.y ?? 0) + scrolled, "the chosen look is below the window").toBeGreaterThan(height);
      expect(scrolled, "the page scrolled by itself").toBe(0);
      // A smooth scroll that starts late (a busy page) is caught too.
      await page.waitForTimeout(1500);
      expect(await page.evaluate(() => window.scrollY), "the page scrolled by itself, late").toBe(0);
      // The title, the filter and the first row are where they were.
      await expect(heading(page)).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole("radio", { name: "All", exact: true })).toBeInViewport({ ratio: 1 });
      // The filter does not move the page either.
      await page.getByRole("radio", { name: "Portfolio", exact: true }).click();
      await expect(cards).toHaveCount(templatesFor("portfolio").length);
      await page.waitForTimeout(600);
      expect(await page.evaluate(() => window.scrollY), "the filter scrolled the page").toBe(0);
      await page.getByRole("radio", { name: "All", exact: true }).click();
      await expect(cards).toHaveCount(TEMPLATE_IDS.length);
      await page.waitForTimeout(600);
      expect(await page.evaluate(() => window.scrollY), "the filter scrolled the page back").toBe(0);
    });
  }
});

// ─── D2: the pinned preview on a phone ─────────────────────────────────────────────────────────

/** The mean brightness (0 black … 1 white) of the outermost pixel ring of an element, corners left out. */
async function ringBrightness(page: Page, target: Locator): Promise<number> {
  const picture = (await target.screenshot()).toString("base64");
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("no canvas");
    context.drawImage(image, 0, 0);
    const { width, height } = canvas;
    const margin = Math.round(Math.min(width, height) * 0.2);
    const at = (x: number, y: number) => {
      const [r = 0, g = 0, b = 0] = context.getImageData(x, y, 1, 1).data;
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    };
    const samples: number[] = [];
    for (let x = margin; x < width - margin; x += 2) samples.push(at(x, 0), at(x, height - 1));
    for (let y = margin; y < height - margin; y += 2) samples.push(at(0, y), at(width - 1, y));
    return samples.reduce((sum, value) => sum + value, 0) / samples.length;
  }, picture);
}

test.describe("D2: the pinned preview on a phone", () => {
  test.use(PHONE);

  test("a quarter of the screen at most, a hairline frame instead of the black bezel, and it follows Buttons and Font", async ({ page }) => {
    await signedIn(page);
    await seed(page, { kind: "music", template: "nocturne", links: 3 });
    await page.goto("/en/app/design");
    const wrap = page.locator("[data-sticky-preview]");
    await expect(wrap).toBeVisible();
    const frame = wrap.locator("> div").first();
    const outer = await wrap.boundingBox();
    const box = await frame.boundingBox();
    if (!outer || !box) throw new Error("no preview");
    // At most a quarter of the 844 px screen, the page's own room included.
    expect.soft(box.height, "the frame").toBeLessThanOrEqual(PHONE.viewport.height * 0.25);
    expect.soft(outer.height, "the pinned band").toBeLessThanOrEqual(PHONE.viewport.height * 0.25);
    // A hairline frame, not the 8 px black bezel: nothing between the edge and the page, a light edge.
    const look = await frame.evaluate((element) => {
      const style = getComputedStyle(element);
      return { border: Number.parseFloat(style.borderTopWidth), padding: Number.parseFloat(style.paddingTop) };
    });
    expect.soft(look.border, "border width").toBeLessThanOrEqual(2);
    expect.soft(look.padding, "padding (the bezel)").toBe(0);
    expect.soft(await ringBrightness(page, frame), "the frame is not the darkest large area of a light screen").toBeGreaterThan(0.55);

    // The preview shows the part being changed: Buttons brings the first button into view, Font the page head.
    const scroller = wrap.getByRole("region");
    const shows = (id: string) =>
      scroller.evaluate((area, block) => {
        const part = area.querySelector(`[data-block-ids~="${block}"]`);
        if (!part) return "not on the page";
        const a = part.getBoundingClientRect();
        const b = area.getBoundingClientRect();
        return a.top >= b.top - 1 && a.bottom <= b.bottom + 1 ? "in view" : `out of view (${String(Math.round(a.top - b.top))} to ${String(Math.round(a.bottom - b.top))} of ${String(Math.round(b.height))})`;
      }, id);
    expect(await shows("l-0"), "the first button starts out of view").not.toBe("in view");
    await page.locator('[data-tab="buttons"]').click();
    await expect.poll(() => shows("l-0")).toBe("in view");
    await page.locator('[data-tab="fonts"]').click();
    await expect.poll(() => scroller.evaluate((area) => area.scrollTop)).toBe(0);
  });
});

// ─── D3: targets and symmetry on phones ────────────────────────────────────────────────────────

interface Target {
  tag: string;
  name: string;
  drawn: [number, number];
  /** What a finger reaches: the run of points around the centre that land on the element (its `::before` counts). */
  hit: [number, number];
}

/**
 * Every control in `scope` (the page, or a sheet) with its drawn size and its hit area. The hit area is
 * measured the way a finger meets it: `elementFromPoint` along the centre lines, so a `::before` that
 * grows a small control counts, and a neighbour that takes the area over does not.
 */
function probeTargets(scopeSelector: string): Target[] {
  const scope = document.querySelector(scopeSelector);
  if (!scope) throw new Error(`no ${scopeSelector}`);
  const interactive =
    "a[href], button, summary, select, textarea, input:not([type=hidden]), [role=button], [role=tab], [role=switch], [role=radio], [role=checkbox], [role=menuitem], [role=link], label:has(input), [tabindex]:not([tabindex='-1'])";
  const reach = 40;
  const found: Target[] = [];
  const hits = (element: Element, x: number, y: number) => {
    const hit = document.elementFromPoint(x, y);
    return !!hit && (hit === element || element.contains(hit) || (element.tagName === "LABEL" && hit.closest("label") === element));
  };
  const run = (element: Element, cx: number, cy: number, horizontal: boolean, limit: number): number => {
    const at = (d: number) => (horizontal ? hits(element, cx + d, cy) : hits(element, cx, cy + d));
    if (!at(0)) return 0;
    let low = 0;
    let high = 0;
    while (low > -limit && at(low - 1)) low--;
    while (high < limit && at(high + 1)) high++;
    return high - low + 1;
  };
  for (const element of scope.querySelectorAll(interactive)) {
    // The preview is a picture of the page, and a sr-only skip link is not a target.
    if (element.closest("[inert], [aria-hidden=true], [data-sticky-preview], [data-preview-aside]")) continue;
    if (element.matches(":disabled, [aria-disabled=true]")) continue;
    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none" || style.pointerEvents === "none") continue;
    if (element.getBoundingClientRect().width <= 2 || element.getBoundingClientRect().height <= 2) continue;
    // A radio, a checkbox or a colour input inside a label: the label is the target.
    if (element.tagName === "INPUT" && element.closest("label") && !element.matches("[type=text],[type=email],[type=url],[type=tel],[type=search],[type=password],[type=number]")) continue;
    element.scrollIntoView({ block: "center", inline: "nearest" });
    const box = element.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    if (cy < 0 || cy > innerHeight || cx < 0 || cx > innerWidth) continue;
    found.push({
      tag: element.tagName.toLowerCase() + (element.getAttribute("role") ? `[${element.getAttribute("role") ?? ""}]` : ""),
      name: (element.getAttribute("aria-label") ?? element.textContent).replace(/\s+/g, " ").trim().slice(0, 40),
      drawn: [Math.round(box.width), Math.round(box.height)],
      hit: [run(element, cx, cy, true, Math.ceil(box.width / 2 + reach)), run(element, cx, cy, false, Math.ceil(box.height / 2 + reach))],
    });
  }
  return found;
}

/** The few controls that are allowed to stay under 44 px, and why. Nothing else is. */
const SMALL_ALLOWED: { name: RegExp; why: string }[] = [];

async function expectBigTargets(page: Page, label: string, scope = "body") {
  const small = (await page.evaluate(probeTargets, scope)).filter((target) => (target.hit[0] < 44 || target.hit[1] < 44) && !SMALL_ALLOWED.some((entry) => entry.name.test(target.name)));
  // Soft: one run lists the small controls of every screen, not only of the first one.
  expect.soft(
    small.map((target) => `${target.tag} "${target.name}" is drawn ${target.drawn.join("×")} and reached at ${target.hit.join("×")}`),
    `${label}: controls under 44 × 44 px`,
  ).toEqual([]);
}

test.describe("D3: targets and symmetry on phones", () => {
  test.use(PHONE);

  test("Home, Seite, Arbeiten, Design and Settings: every control is reached at 44 × 44 px", async ({ page }) => {
    await signedIn(page);
    // A page that is not ready yet (Home's next step with its finished steps behind a button) and projects (Arbeiten).
    await seed(page, { kind: "designer", template: "werkbogen", projects: 3 });
    await expectBigTargets(page, "Home, building");
    for (const [label, path] of [
      ["Seite", "/en/app/editor"],
      ["Arbeiten", "/en/app/work"],
      ["Settings", "/en/app/settings"],
    ] as const) {
      await page.goto(path);
      await expect(heading(page)).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expectBigTargets(page, label);
    }
    // Design, with a change made, so Undo is on and offered too, in the screen and in the toast it brings.
    await page.goto("/en/app/design");
    await expect(heading(page)).toBeVisible();
    await page.locator("#main fieldset label:has(input[name=poster-template])").nth(1).click();
    await expect(page.getByRole("button", { name: "Undo" }).first()).toBeEnabled();
    const toasts = page.locator("[role=region][aria-label$='(F8)']");
    await expect(toasts.locator("li[data-state=open]")).toHaveCount(1);
    // The toast's own Undo and close, while it shows; then the screen without it (a toast covers what is under it).
    await expectBigTargets(page, "the toast of a change", "[role=region][aria-label$='(F8)']");
    await toasts.getByRole("button", { name: "Close" }).click();
    await expect(toasts.locator("li")).toHaveCount(0);
    await expectBigTargets(page, "Design");
    // Home when the page is ready: the link card, the week, the invite.
    await page.goto("/en/app");
    await seed(page, { kind: "music", template: "nocturne", links: 4 });
    await expectBigTargets(page, "Home, ready");
  });

  for (const locale of ["en", "ar"] as const) {
    test(`a sheet's header: Cancel and Save sit at the same margin from their edges (${locale})`, async ({ page }) => {
      await signedIn(page, locale);
      await seed(page, { kind: "designer", template: "werkbogen", projects: 2 });
      await page.goto(`/${locale}/app/work`);
      await page.locator("#main ul[aria-label] > li button[aria-label]").first().click();
      const sheet = page.getByRole("dialog");
      await expect(sheet).toBeVisible();
      await expect.poll(() => sheet.evaluate((element) => element.getAnimations().filter((a) => a.playState === "running").length)).toBe(0);
      const margins = await sheet.evaluate((element) => {
        const buttons = [...element.querySelectorAll("header button")].filter((button) => button.getBoundingClientRect().width > 0);
        const edge = (button: Element, filled: boolean) => {
          const range = document.createRange();
          range.selectNodeContents(button);
          // What shows: a filled button's own edge, a quiet button's word.
          const shown = filled ? button.getBoundingClientRect() : range.getBoundingClientRect();
          return { start: shown.left, end: innerWidth - shown.right };
        };
        const quiet = buttons.find((button) => getComputedStyle(button).backgroundColor === "rgba(0, 0, 0, 0)");
        const filled = buttons.find((button) => getComputedStyle(button).backgroundColor !== "rgba(0, 0, 0, 0)");
        if (!quiet || !filled) throw new Error("the sheet's header has no Cancel and Save");
        const a = edge(quiet, false);
        const b = edge(filled, true);
        const rtl = getComputedStyle(element).direction === "rtl";
        // Cancel is on the start side, Save on the end side: in Arabic the other way round on the screen.
        return { cancel: rtl ? a.end : a.start, save: rtl ? b.start : b.end };
      });
      expect(Math.abs(margins.cancel - margins.save), `Cancel ${String(margins.cancel)} px, Save ${String(margins.save)} px`).toBeLessThanOrEqual(1);
    });
  }
});
