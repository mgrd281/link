#!/usr/bin/env node
/**
 * The installed app's icons (the web app manifest, `features/pwa/manifest.ts`), drawn from the logo
 * Linkyo already has. Nothing is drawn by hand: every picture is one of the brand files that
 * `packages/tokens/brand/logo.mjs` generates from the symbol's geometry, rendered by Chromium.
 *
 *   public/icons/icon-192.png, icon-512.png   purpose "any": the symbol as it is (public/favicon.svg),
 *                                             the teal tile with its rounded corners on a clear ground,
 *                                             for windows, docks and task bars.
 *   public/icons/maskable-512.png             purpose "maskable": the iOS app icon (brand/svg/app-icon-light.svg),
 *                                             teal to the edges with the y at 56 % of the height, so the
 *                                             y stays inside the 80 % safe circle whatever shape the
 *                                             system cuts (Android's circles and squircles).
 *   public/icons/monochrome-512.png           purpose "monochrome": the y alone on a clear ground, in the
 *                                             same place as on the maskable icon (the system keeps only the
 *                                             shape and paints it in its own colour). From brand/svg/app-icon-tinted.svg
 *                                             (white y on black): its brightness becomes the alpha.
 *
 * Run it when the symbol changes (after `pnpm --filter @linkyo/tokens brand`), then look at each picture:
 *
 *   PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/generate-app-icons.mjs
 *
 * `src/features/pwa/icons.test.ts` checks the sizes and measures the maskable safe zone.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(HERE, "../public");
const BRAND = path.resolve(HERE, "../../../packages/tokens/brand/svg");

const read = (file) => readFileSync(file, "utf8");

/** What to draw: the source SVG, the size and whether its brightness becomes the alpha (monochrome). */
const ICONS = [
  { out: "icons/icon-192.png", svg: read(path.join(PUBLIC, "favicon.svg")), size: 192 },
  { out: "icons/icon-512.png", svg: read(path.join(PUBLIC, "favicon.svg")), size: 512 },
  { out: "icons/maskable-512.png", svg: read(path.join(BRAND, "app-icon-light.svg")), size: 512 },
  { out: "icons/monochrome-512.png", svg: read(path.join(BRAND, "app-icon-tinted.svg")), size: 512, alphaFromBrightness: true },
];

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
const page = await browser.newPage({ deviceScaleFactor: 1 });
await page.setContent("<!doctype html><html><body></body></html>");

for (const icon of ICONS) {
  const dataUrl = await page.evaluate(async ({ svg, size, alphaFromBrightness }) => {
    const image = new Image();
    image.src = `data:image/svg+xml;base64,${btoa(svg)}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no 2d context");
    context.drawImage(image, 0, 0, size, size);
    if (alphaFromBrightness) {
      // White y on black: the brightness is how much of a pixel belongs to the y.
      const pixels = context.getImageData(0, 0, size, size);
      const { data } = pixels;
      for (let at = 0; at < data.length; at += 4) {
        const alpha = Math.round(0.2126 * data[at] + 0.7152 * data[at + 1] + 0.0722 * data[at + 2]);
        data[at] = 255;
        data[at + 1] = 255;
        data[at + 2] = 255;
        data[at + 3] = alpha;
      }
      context.putImageData(pixels, 0, 0);
    }
    return canvas.toDataURL("image/png");
  }, icon);
  const target = path.join(PUBLIC, icon.out);
  writeFileSync(target, Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"));
  console.warn(`✔ ${path.relative(process.cwd(), target)} (${String(icon.size)} × ${String(icon.size)})`);
}

await browser.close();
