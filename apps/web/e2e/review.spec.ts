import { mkdirSync } from "node:fs";
import path from "node:path";

import { test, type Page } from "@playwright/test";

import { DIRECTIONS } from "./routes";

/**
 * Design review captures (master prompt §11): 375 / 768 / 1440, light + dark, de + ar.
 * Run with `pnpm --filter @linkyo/web review` — writes JPEGs to docs/reviews/phase-0.
 */
const OUT = path.resolve(import.meta.dirname, "../../../docs/reviews/phase-0");
const WIDTHS = [375, 768, 1440] as const;

test.skip(!process.env.REVIEW, "Set REVIEW=1 to capture review screenshots.");
test.describe.configure({ mode: "parallel" });

/** Scroll through the page so lazy images load, then wait for every image to finish decoding. */
async function loadLazyImages(page: Page) {
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight / 2);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 50)));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle");
  // Images hidden inside horizontal scrollers never start loading: give each pending image at most 2 s.
  await page.evaluate(() =>
    Promise.all(
      [...document.images]
        .filter((image) => !image.complete)
        .map((image) => Promise.race([image.decode().catch(() => undefined), new Promise((resolve) => setTimeout(resolve, 2000))])),
    ),
  );
}

async function capture(page: Page, url: string, file: string, width: number, scheme: "light" | "dark", full: boolean) {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  if (full) await loadLazyImages(page);
  mkdirSync(path.dirname(path.join(OUT, file)), { recursive: true });
  await page.screenshot({ path: path.join(OUT, file), fullPage: full, type: "jpeg", quality: 78 });
}

for (const direction of DIRECTIONS) {
  for (const locale of ["de", "ar"] as const) {
    for (const width of WIDTHS) {
      test(`creator ${direction} ${locale} ${width}`, async ({ page }) => {
        if (direction === "poster") {
          // Every template on phones; the two neutral templates also on tablet and desktop.
          const templates = width === 375 ? (["nocturne", "daylight", "marquee", "pulse", "atelier"] as const) : (["nocturne", "daylight"] as const);
          for (const template of templates) {
            await capture(page, `/${locale}/directions/poster?chrome=0&template=${template}`, `creator/poster-${template}-${locale}-${width}.jpg`, width, "light", true);
          }
          return;
        }
        await capture(page, `/${locale}/directions/${direction}?chrome=0`, `creator/${direction}-${locale}-${width}.jpg`, width, "light", true);
      });
      test(`dashboard ${direction} ${locale} ${width}`, async ({ page }) => {
        for (const scheme of ["light", "dark"] as const) {
          await capture(page, `/${locale}/directions/${direction}/dashboard?chrome=0`, `dashboard/${direction}-${locale}-${width}-${scheme}.jpg`, width, scheme, false);
        }
      });
    }
  }
  if (direction !== "poster") test(`creator ${direction} other preset`, async ({ page }) => {
    const preset = direction === "stage" ? "gold" : direction === "gallery" ? "forest" : "ocean";
    await capture(page, `/de/directions/${direction}?chrome=0&preset=${preset}`, `creator/${direction}-de-375-${preset}.jpg`, 375, "light", true);
  });
}

for (const locale of ["de", "ar"] as const) {
  for (const scheme of ["light", "dark"] as const) {
    test(`design system ${locale} ${scheme}`, async ({ page }) => {
      await capture(page, `/${locale}/design`, `design/design-${locale}-1440-${scheme}.jpg`, 1440, scheme, false);
      await capture(page, `/${locale}/design#creator`, `design/creator-themes-${locale}-1440-${scheme}.jpg`, 1440, scheme, false);
      await capture(page, `/${locale}/design`, `design/design-${locale}-375-${scheme}.jpg`, 375, scheme, false);
    });
  }
  test(`directions overview ${locale}`, async ({ page }) => {
    await capture(page, `/${locale}/directions`, `overview-${locale}-1440.jpg`, 1440, "light", true);
    await capture(page, `/${locale}/directions`, `overview-${locale}-375.jpg`, 375, "light", false);
  });
}
