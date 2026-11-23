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
  // Laufbahn: no photo of him yet, so his initials stand beside the role line, under the badge.
  await expect(page.getByText("SG", { exact: true }).locator("visible=true").first()).toBeVisible();
  const role = page.getByText("Lagerist · Staplerfahrer mit Flurförderzeugschein").first();
  const [badgeBox, roleBox] = [await badge.boundingBox(), await role.boundingBox()];
  expect(roleBox && badgeBox && roleBox.y >= badgeBox.y + badgeBox.height).toBe(true);
  // The motion graphic comes from our own origin and stays still for reduced motion.
  const clip = page.locator("video").first();
  await expect(clip).toHaveAttribute("src", "/media/motion/sevag-stapler.mp4");
  expect(await clip.evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
  // The badge covers no text of the page: no line of the hero (or anything else) runs under it.
  const covered = await page.evaluate(() => {
    const aside = document.querySelector('aside[data-theme="dark"]')?.getBoundingClientRect();
    if (!aside) return ["no badge"];
    const hits: string[] = [];
    const walker = document.createTreeWalker(document.querySelector("[lang]") ?? document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const owner = node.parentElement;
      if (!owner || owner.closest("aside") || !node.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const box of range.getClientRects()) {
        const overlaps = box.width > 0 && box.left < aside.right && box.right > aside.left && box.top < aside.bottom && box.bottom > aside.top;
        if (overlaps && getComputedStyle(owner).visibility !== "hidden") hits.push(node.textContent.trim());
      }
    }
    return hits;
  });
  expect(covered).toEqual([]);
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
