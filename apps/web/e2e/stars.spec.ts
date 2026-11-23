import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** Concept pages for well-known people (ADR 0020): labelled, never verified, noindex, accessible. */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const PAGES = [
  ["en", "messi"],
  ["ar", "cristiano"],
  ["ar", "mo-salah"],
  ["en", "elon-musk"],
  ["de", "jeff-bezos"],
  ["en", "donald-trump"],
  ["de", "friedrich-merz"],
  ["en", "mrbeast"],
  ["en", "taylor-swift"],
  ["ar", "alshami"],
  ["ar", "taim-hassan"],
  ["ar", "nadine-njeim"],
] as const;
const BADGE = { de: /^Konzept · /, en: /^Concept · /, ar: /^تصوّر · / };

for (const [locale, slug] of PAGES) {
  test(`concept page /${locale}/p/${slug} is labelled, unindexed and accessible`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/${locale}/p/${slug}`);
    await expect(page.getByText(BADGE[locale]).first()).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    // Every outbound link goes to a real https address, never to the example domain.
    const hrefs = await page.locator("main a[href^='http']").evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href).toMatch(/^https:\/\//);
      expect(href).not.toContain("example.com");
    }
    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });
}

test("a preview video plays 30 seconds here, then offers to keep watching on YouTube", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("linkyo.privacy.v1", "essential"));
  // Stand-in for YouTube's player: it reports "ended" the way the real one does at the preview's end.
  await page.route("https://www.youtube-nocookie.com/embed/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<script>setTimeout(() => parent.postMessage(JSON.stringify({ event: "onStateChange", info: 0 }), "*"), 300);</script>`,
    }),
  );
  await page.goto("/en/p/mrbeast");
  const play = page.getByRole("button", { name: /^Play 30 seconds of / }).first();
  await play.scrollIntoViewIfNeeded();
  await play.click();
  const frame = page.locator('iframe[src*="youtube-nocookie.com/embed/"]').first();
  await expect(frame).toHaveAttribute("src", /end=30&enablejsapi=1/);
  const keepWatching = page.getByRole("link", { name: "Keep watching on YouTube" });
  await expect(keepWatching).toBeVisible();
  await expect(keepWatching).toHaveAttribute("href", /youtube\.com\/watch\?v=[\w-]{11}&t=30s$/);
});

test("a page prepared from a person's own application letter reads as his own page, unindexed, keeps the letter's paragraphs and is accessible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/de/p/sevag-ghazarian-2131af");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  // His own page for the employer: no Linkyo label over it, no Linkyo bar under it.
  await expect(page.getByText("Vorschau für Sevag Ghazarian")).toHaveCount(0);
  await expect(page).toHaveTitle("Sevag Ghazarian · Lagerist · Staplerfahrer mit Flurförderzeugschein");
  await expect(page.getByRole("link", { name: /Sichern/ })).toHaveCount(0);
  // The name on one line, the role right under it.
  const name = page.getByRole("heading", { level: 1, name: "Sevag Ghazarian" });
  await expect(name).toBeVisible();
  const role = page.getByText("Lagerist · Staplerfahrer mit Flurförderzeugschein").first();
  const [nameBox, roleBox] = [await name.boundingBox(), await role.boundingBox()];
  expect(nameBox && roleBox && roleBox.y >= nameBox.y + nameBox.height - 1).toBe(true);
  expect(await name.evaluate((h1) => Math.round(h1.getBoundingClientRect().height / parseFloat(getComputedStyle(h1).lineHeight)))).toBe(1);
  // The motion graphic comes from our own origin (one of his four library clips, a different one on
  // every visit), its own first frame is the still, and it stays still for reduced motion.
  const clip = page.locator("video").first();
  const src = (await clip.getAttribute("src")) ?? "";
  expect(src).toMatch(/^\/media\/motion\/(palette-packen|barcode-scannen|lagerarbeit|ware-scannen)\.mp4$/);
  const key = /motion\/([a-z-]+)\.mp4/.exec(src)?.[1] ?? "";
  await expect(page.locator("[data-hero-plate] img").first()).toHaveAttribute("src", new RegExp(`ex-motion-${key}`));
  expect(await clip.evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
  // The letter keeps its paragraphs: seven of them, the signature with its line break. On phones the
  // last five wait behind "Ganzes Anschreiben lesen".
  const letter = page.getByRole("region", { name: "Anschreiben" });
  await expect(letter.getByText(/^Sehr geehrter Herr Vitt,$/)).toHaveCSS("white-space", "pre-line");
  const more = letter.getByText("Ganzes Anschreiben lesen");
  if (await more.isVisible()) await more.click();
  const paragraphs = letter.locator("p.whitespace-pre-line");
  await expect(paragraphs).toHaveCount(7);
  await expect(paragraphs.last()).toHaveText("Mit freundlichen Grüßen\nSevag Ghazarian", { useInnerText: true });
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
});

test("his page opens with the next of his clips on every refresh, each with its own still", async ({ request }) => {
  const seen: string[] = [];
  for (let visit = 0; visit < 6; visit += 1) {
    const html = await (await request.get("/de/p/sevag-ghazarian-2131af")).text();
    const key = /\/media\/motion\/([a-z-]+)\.mp4/.exec(html)?.[1] ?? "";
    expect(["palette-packen", "barcode-scannen", "lagerarbeit", "ware-scannen"]).toContain(key);
    // The still is that clip's own first frame, never another one's.
    expect(html).toContain(`ex-motion-${key}`);
    for (const other of ["palette-packen", "barcode-scannen", "lagerarbeit", "ware-scannen"].filter((name) => name !== key)) expect(html).not.toContain(`ex-motion-${other}`);
    seen.push(key);
  }
  // Rendered per visit: more than one clip over six visits (other tests may visit in between).
  expect(new Set(seen).size).toBeGreaterThan(1);
});
