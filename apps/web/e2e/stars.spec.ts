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

test("a page prepared from a person's own application letter is labelled, unindexed, keeps the letter's paragraphs and is accessible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/de/p/sevag-ghazarian-2131af");
  const badge = page.getByText("Vorschau für Sevag Ghazarian").first();
  await expect(badge).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByRole("heading", { level: 1, name: "Sevag Ghazarian" })).toBeVisible();
  // No photo of him yet: his initials stand in, and the role line sits clear of the preview's badge.
  await expect(page.getByText("SG", { exact: true }).locator("visible=true").first()).toBeVisible();
  const role = page.getByText("Lagerist · Staplerfahrer mit Flurförderzeugschein").first();
  const [badgeBox, roleBox] = [await badge.boundingBox(), await role.boundingBox()];
  expect(roleBox && badgeBox && roleBox.y >= badgeBox.y + badgeBox.height).toBe(true);
  // The motion graphic comes from our own origin and stays still for reduced motion.
  const clip = page.locator("video").first();
  await expect(clip).toHaveAttribute("src", "/media/motion/sevag-stapler.mp4");
  expect(await clip.evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
  // The letter keeps its paragraphs.
  const letter = page.getByText(/^Sehr geehrter Herr Vitt,/);
  await expect(letter).toHaveCSS("white-space", "pre-line");
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
});
