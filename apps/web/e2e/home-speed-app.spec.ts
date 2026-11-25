import { expect, test, type Page } from "@playwright/test";

/**
 * The home page loads fast on phones (WP4.3b, E-03, ADR 0008): its HTML stays under its budget
 * (scripts/check-route-budgets.mjs), its first screen's largest picture paints with the first screen,
 * and what lies further down (the playground's other panels, the looks' typefaces) comes when it
 * comes near. Nothing changes what the page shows once it has loaded.
 */

const LOCALES = ["de", "ar"] as const;

/** The typefaces of creator pages (the playground's looks and the story picture), not the website's. */
const CREATOR_FACES = /\/(anton|playfair_display|instrument_serif|bricolage_grotesque|inter|lato|space_grotesk)_/;

/** The font files the page has fetched so far. */
const fontsFetched = (page: Page) =>
  page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => /\.woff2?($|\?)/.test(name)),
  );

for (const locale of LOCALES) {
  test(`/${locale}: the page in front paints with the first screen and is its largest picture`, async ({ page }, info) => {
    await page.addInitScript(() => {
      const largest: { tag: string; slide: string }[] = [];
      Object.assign(window, { __largest: largest });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & { element?: Element | null })[]) {
          largest.push({ tag: entry.element?.tagName ?? "", slide: entry.element?.closest('[data-deck] [role="tabpanel"]')?.id.replace(/^.*-slide-/, "slide-") ?? "" });
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });
    });
    await page.goto(`/${locale}`);
    // The first page of the deck, in front when the page opens (the deck turns by itself later on).
    const front = page.locator('[data-deck] [role="tabpanel"]').first().locator("img");
    await expect(front).toHaveCount(1);
    // Server-rendered, preloaded, fetched first: the browser finds it in the HTML.
    await expect(front).toHaveAttribute("fetchpriority", "high");
    await expect(front).toHaveAttribute("loading", "eager");
    // No animation on the picture or around it starts it transparent: a picture that starts
    // transparent only counts as painted once it shows (the deck used to fade in after 320 ms).
    const fades = await front.evaluate((picture) => {
      const found: string[] = [];
      for (let node: Element | null = picture; node; node = node.parentElement) {
        // Entrances are CSS animations (the deck's own turns are transitions between its places).
        for (const animation of node.getAnimations()) {
          if (!(animation instanceof CSSAnimation)) continue;
          const frames = animation.effect instanceof KeyframeEffect ? animation.effect.getKeyframes() : [];
          if (frames.some((frame) => frame.opacity !== undefined && Number(frame.opacity) < 1)) {
            found.push(`${animation.animationName} on <${node.tagName.toLowerCase()} class="${node.getAttribute("class") ?? ""}">`);
          }
        }
      }
      return found;
    });
    expect(fades).toEqual([]);
    // On a phone (where Lighthouse measures) it is the Largest Contentful Paint.
    if (info.project.name === "mobile") {
      await expect.poll(() => page.evaluate(() => (window as unknown as { __largest: { tag: string; slide: string }[] }).__largest.at(-1))).toEqual({ tag: "IMG", slide: "slide-0" });
    }
  });
}

test("no blurred preview travels in the home page, and no picture is listed under two addresses", async ({ page, request }) => {
  const html = await (await request.get("/de")).text();
  // A bundled picture's blurred preview (its props and next/image's placeholder style).
  expect(html).not.toContain("blurDataURL");
  expect(html).not.toMatch(/data:image\/(jpeg|png|webp|avif);base64/);
  expect(html).not.toContain("data:image/svg+xml");

  await page.goto("/de");
  // One picture of each kind: the page in front, a face under the deck, a card of the strip, a phone
  // of the Portfolio band and the link preview in the sharing tile.
  const kinds = {
    deck: '[data-deck] [data-slot="front"] img',
    face: '[data-deck] [role="tab"] img',
    strip: "#templates img",
    band: "#portfolio-band img",
    share: 'img[src*="opengraph-image"]',
  };
  for (const [kind, selector] of Object.entries(kinds)) {
    const srcset = await page.locator(selector).first().getAttribute("srcset");
    expect(srcset, kind).toBeTruthy();
    const entries = (srcset ?? "").split(", ").map((entry) => entry.slice(0, entry.lastIndexOf(" ")));
    expect(entries.length, kind).toBeGreaterThan(1);
    // The optimizer never enlarges: two entries at or above a picture's own width are the very same
    // bytes. The last two differ, so only the last reaches the picture's own width.
    const [before, last] = await Promise.all(entries.slice(-2).map(async (address) => (await request.get(address, { headers: { accept: "image/webp" } })).body()));
    expect(before?.length, kind).toBeGreaterThan(0);
    expect(Buffer.compare(before ?? Buffer.alloc(0), last ?? Buffer.alloc(0)), `${kind}: the last two widths are one picture`).not.toBe(0);
  }
});

test("the playground's other panels and the looks' typefaces come when the playground comes near", async ({ page }) => {
  await page.goto("/en");
  await page.waitForLoadState("networkidle");
  const playground = page.locator("#try");
  // The first screen fetches the website's own typeface only (and no creator page's).
  expect((await fontsFetched(page)).filter((name) => CREATOR_FACES.test(name))).toEqual([]);
  // The panels out of sight hold nothing yet; the one in front is whole.
  await expect(playground.getByLabel("Your name")).toHaveCount(1);
  await expect(playground.getByRole("radio", { includeHidden: true })).toHaveCount(0);
  await expect(playground.getByRole("textbox", { name: "Paste or type a link", includeHidden: true })).toHaveCount(0);

  await playground.scrollIntoViewIfNeeded();
  // Five looks and a colour of one's own, in the looks' own typefaces; the links panel with its examples.
  await expect(playground.getByRole("radio", { includeHidden: true })).toHaveCount(5);
  await expect(playground.getByRole("textbox", { name: "Paste or type a link", includeHidden: true })).toHaveCount(1);
  await expect.poll(async () => (await fontsFetched(page)).filter((name) => CREATOR_FACES.test(name)).length, { timeout: 15_000 }).toBeGreaterThan(0);
});
