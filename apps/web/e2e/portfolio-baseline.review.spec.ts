import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

/**
 * "Existing pages never change": full-page captures of the pages that existed before the Portfolio
 * work, compared byte for byte with the stored baseline (same machine, same browser, same encoder:
 * equal bytes are equal pixels; the repo has no pixel-comparison tool).
 *
 *   V8_BASELINE_DIR=<folder>                    compare with the PNGs stored there (the default mode)
 *   V8_BASELINE=write V8_BASELINE_DIR=<folder>  store new PNGs there
 *
 * Without V8_BASELINE_DIR every capture is skipped, so `pnpm review` stays what it was. On a
 * difference the new capture is written next to the stored one as `<name>.actual.png`.
 *
 * Two sets of captures (`BASELINE_SET`, the old one by default):
 *
 *   (unset) or v8  the 50 captures of the Portfolio baseline (/root/linkyo-v8-baseline): the eleven
 *                  templates it knew, de and ar, plus three /p pages, at 390 x 844 and 1440 x 900.
 *   s2             the Stage 2 baseline (/root/linkyo-s2-baseline), 78 captures: all fourteen
 *                  templates (werkbogen, tiefdruck and laufbahn included) on the music sample, de and
 *                  ar; the four portfolio templates also on the portfolio sample (`&page=portfolio`);
 *                  the same three /p pages; each at 390 x 844 (phone) and 1440 x 900 (laptop).
 *
 * Run against the demo build (no Supabase variables), by file, in the `review` project, from
 * apps/web on a port of your own (the config starts `next start` on it):
 *   unset ANTHROPIC_BASE_URL ANTHROPIC_API_KEY PW_REUSE_SERVER
 *   PORT=<port> V8_BASELINE_DIR=<copy of /root/linkyo-v8-baseline> \
 *     npx playwright test e2e/portfolio-baseline.review.spec.ts --project review
 *   PORT=<port> BASELINE_SET=s2 V8_BASELINE_DIR=<copy of /root/linkyo-s2-baseline> \
 *     npx playwright test e2e/portfolio-baseline.review.spec.ts --project review
 * Compare against a copy: a difference writes `.actual.png` files into the folder. Write a set
 * (`V8_BASELINE=write`) only into a new folder, never over a stored baseline.
 */
const DIR = process.env.V8_BASELINE_DIR ? path.resolve(process.env.V8_BASELINE_DIR) : null;
const WRITE = process.env.V8_BASELINE === "write";
const SET = process.env.BASELINE_SET === "s2" ? "s2" : "v8";

/**
 * The eleven templates of the baseline, in the order of `creator.template` in tokens.json. Templates
 * added later are not captured here (they have no baseline); a baseline template that disappears
 * from the tokens fails the run before any capture.
 */
const BASELINE_TEMPLATES = ["nocturne", "daylight", "marquee", "pulse", "atelier", "mono", "studio", "aura", "folio", "signal", "bloom"] as const;
/** The fourteen templates of the Stage 2 baseline (BASELINE_SET=s2), in token order. */
const S2_TEMPLATES = [...BASELINE_TEMPLATES, "werkbogen", "tiefdruck", "laufbahn"] as const;
/** Of those, the ones made for portfolios (`use` in tokens.json): also captured on the portfolio sample. */
const S2_PORTFOLIO_TEMPLATES = ["folio", "werkbogen", "tiefdruck", "laufbahn"] as const;
/** Three existing pages with a highlighted link, each in its own language. */
const PAGES = ["/de/p/fc-kiezkicker", "/ar/p/karim-almansour", "/de/p/messi"] as const;
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;
const LOCALES = ["de", "ar"] as const;
const SET_TEMPLATES: readonly string[] = SET === "s2" ? S2_TEMPLATES : BASELINE_TEMPLATES;
const EXPECTED_CAPTURES = SET === "s2" ? 78 : 50;

/**
 * Elements hidden behind a flat box before a capture, each with its reason (also listed in the
 * baseline's README.md). Empty: every capture was byte-equal over repeated runs and a server restart
 * without one.
 */
const MASKS: readonly { selector: string; reason: string }[] = [];

interface Capture {
  name: string;
  url: string;
  viewport: (typeof VIEWPORTS)[number];
}

const slugOf = (url: string) => url.replace(/^\//, "").replaceAll("/", "-");

const CAPTURES: Capture[] = VIEWPORTS.flatMap((viewport) => [
  ...LOCALES.flatMap((locale) =>
    SET_TEMPLATES.map((template) => ({
      name: `poster-${template}-${locale}-${viewport.width}`,
      url: `/${locale}/directions/poster?chrome=0&template=${template}`,
      viewport,
    })),
  ),
  ...(SET === "s2"
    ? LOCALES.flatMap((locale) =>
        S2_PORTFOLIO_TEMPLATES.map((template) => ({
          name: `portfolio-${template}-${locale}-${viewport.width}`,
          url: `/${locale}/directions/poster?chrome=0&template=${template}&page=portfolio`,
          viewport,
        })),
      )
    : []),
  ...PAGES.map((url) => ({ name: `${slugOf(url)}-${viewport.width}`, url, viewport })),
]);

/** The templates the tokens define today (read at run time, never from memory). */
function tokenTemplates(): string[] {
  return Object.keys(creatorTemplates()).filter((key) => !key.startsWith("$"));
}

/** What a template is made for (`use` in tokens.json; link-in-bio when it says nothing). */
function templateUses(template: string): string[] {
  const entry = creatorTemplates()[template] as { $extensions?: { "app.linkyo"?: { use?: string[] } } } | undefined;
  return entry?.$extensions?.["app.linkyo"]?.use ?? ["link-in-bio"];
}

function creatorTemplates(): Record<string, unknown> {
  const file = path.resolve(import.meta.dirname, "../../../packages/tokens/tokens.json");
  const tokens = JSON.parse(readFileSync(file, "utf8")) as { creator: { template: Record<string, unknown> } };
  return tokens.creator.template;
}

test.skip(!DIR, "Set V8_BASELINE_DIR to compare with (or, with V8_BASELINE=write, to store) the Portfolio baseline.");
test.describe.configure({ mode: "parallel" });
// One fixed browser setup, whatever the `review` project says later.
test.use({
  deviceScaleFactor: 1,
  colorScheme: "light",
  locale: "de-DE",
  timezoneId: "Europe/Berlin",
  // Chromium repaints only the changed part of a tile on top of what the tile held ("partial raster"),
  // which leaves anti-aliased edges one colour step off depending on what was painted before: the
  // same page gave two or three different pictures. Painting whole tiles gives one.
  launchOptions: async ({ launchOptions }, use) => {
    await use({ ...launchOptions, args: [...(launchOptions.args ?? []), "--disable-partial-raster"] });
  },
});

/**
 * Brings the page to rest: fonts in, every lazy picture loaded and decoded (scrolled to the end and
 * back), every video paused on its first frame.
 */
async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 60)));
    const step = Math.max(200, Math.round(window.innerHeight / 2));
    // The height can grow while pictures come in, so the end is read again on every step.
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: "instant" });
      await frame();
    }
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
    await frame();
  });
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    // The part of an element a visitor can see somewhere on the page: its box, cut by every clipping
    // ancestor and by the page's width. Pictures further along a sideways rail never load and never show.
    const shows = (element: Element) => {
      const box = element.getBoundingClientRect();
      let [left, top, right, bottom] = [box.left, box.top, box.right, box.bottom];
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (style.overflowX === "visible" && style.overflowY === "visible") continue;
        const clip = parent.getBoundingClientRect();
        if (style.overflowX !== "visible") [left, right] = [Math.max(left, clip.left), Math.min(right, clip.right)];
        if (style.overflowY !== "visible") [top, bottom] = [Math.max(top, clip.top), Math.min(bottom, clip.bottom)];
      }
      left = Math.max(left, 0);
      right = Math.min(right, document.documentElement.clientWidth);
      return right > left && bottom > top;
    };
    const loaded = (image: HTMLImageElement) =>
      image.complete ? Promise.resolve() : new Promise<void>((resolve) => { image.addEventListener("load", () => resolve(), { once: true }); image.addEventListener("error", () => resolve(), { once: true }); });
    for (const image of [...document.images].filter(shows)) {
      await loaded(image);
      await image.decode().catch(() => undefined);
    }
    for (const video of document.querySelectorAll("video")) {
      video.pause();
      if (video.currentTime !== 0) {
        const seeked = new Promise<void>((resolve) => video.addEventListener("seeked", () => resolve(), { once: true }));
        video.currentTime = 0;
        await seeked;
      }
    }
    window.scrollTo({ top: 0, behavior: "instant" });
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  await page.waitForFunction(() => window.scrollY === 0);
  if (SET === "s2") await holdObservers(page);
}

/**
 * Stage 2 set only (the v8 set is captured exactly as it was written). Laufbahn's app bar is shown and
 * hidden by an IntersectionObserver (BarReveal), and Chromium's full-page capture itself makes that
 * observer fire: at rest at the top the bar is away, yet after a full-page screenshot it was there in
 * one of two captures, so the set was not repeatable. `observerHold` (an init script) wraps every
 * observer the page makes; once the page is at rest at the top, their callbacks are held, so the
 * capture shows the page as a visitor sees it there.
 */
async function holdObservers(page: Page) {
  await page.evaluate(async () => {
    // Observers are notified in the order they were made: when a new one has had its first callback,
    // the page's own have had theirs for this scroll position.
    await new Promise<void>((resolve) => {
      const probe = new IntersectionObserver(() => {
        probe.disconnect();
        resolve();
      });
      probe.observe(document.body);
    });
    (window as unknown as { linkyoHoldObservers: boolean }).linkyoHoldObservers = true;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

/** Runs in the page before its own scripts: IntersectionObserver callbacks stop once `linkyoHoldObservers` is set. */
function observerHold() {
  const Native = window.IntersectionObserver;
  window.IntersectionObserver = class extends Native {
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      super((entries, observer) => {
        if (!(window as unknown as { linkyoHoldObservers?: boolean }).linkyoHoldObservers) callback(entries, observer);
      }, options);
    }
  };
}

const shoot = (page: Page) =>
  page.screenshot({
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    scale: "css",
    type: "png",
    mask: MASKS.map(({ selector }) => page.locator(selector)),
  });

/** A capture counts once two in a row are the same picture: the page has come to rest. */
async function stableShot(page: Page): Promise<Buffer> {
  let before = await shoot(page);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const after = await shoot(page);
    if (after.equals(before)) return after;
    before = after;
  }
  throw new Error("The page never came to rest: six captures in a row all differ.");
}

test("the baseline's templates are still in the tokens", () => {
  const today = tokenTemplates();
  for (const template of SET_TEMPLATES) expect(today, `template "${template}" is in tokens.json`).toContain(template);
  if (SET === "s2") {
    // A Stage 2 baseline is only written from a tree whose templates are exactly these fourteen.
    if (WRITE) expect(today).toEqual([...S2_TEMPLATES]);
    for (const template of S2_PORTFOLIO_TEMPLATES) expect(templateUses(template), `"${template}" is made for portfolios`).toContain("portfolio");
  } else if (WRITE) {
    // A baseline is only written from a tree whose templates are exactly these eleven (plus the two the Portfolio work adds).
    expect(today.filter((id) => id !== "werkbogen" && id !== "tiefdruck")).toEqual([...BASELINE_TEMPLATES]);
  }
  expect(CAPTURES).toHaveLength(EXPECTED_CAPTURES);
  expect(new Set(CAPTURES.map((capture) => capture.name)).size).toBe(EXPECTED_CAPTURES);
});

for (const capture of CAPTURES) {
  test(capture.name, async ({ page }) => {
    test.setTimeout(180_000);
    const dir = DIR ?? "";
    const stored = path.join(dir, `${capture.name}.png`);
    const actual = path.join(dir, `${capture.name}.actual.png`);

    await page.setViewportSize(capture.viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    // A visitor who answered the privacy notice with "necessary only" on an earlier visit (nothing
    // external loads). Unanswered, the notice is a sheet fixed to the bottom of the first screen, and
    // in a full-page capture it covers the name, the bio and the social icons of every page with a
    // player: the part of the hero this baseline is there to watch. The notice has its own test (app.spec.ts).
    await page.addInitScript(() => window.localStorage.setItem("linkyo.privacy.v1", "essential"));
    if (SET === "s2") await page.addInitScript(observerHold);
    const response = await page.goto(capture.url, { waitUntil: "load" });
    expect(response?.status(), capture.url).toBe(200);
    await settle(page);
    const shot = await stableShot(page);

    if (WRITE) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(stored, shot);
      rmSync(actual, { force: true });
      return;
    }
    const where = SET === "s2" ? "from the integrated Stage 2 tree" : "at the tag v8-baseline";
    expect(existsSync(stored), `the baseline has ${capture.name}.png (write it ${where} with V8_BASELINE=write)`).toBe(true);
    const same = readFileSync(stored).equals(shot);
    if (same) rmSync(actual, { force: true });
    else writeFileSync(actual, shot);
    expect(same, `${capture.name} differs from the baseline: compare ${stored} with ${actual}`).toBe(true);
  });
}
