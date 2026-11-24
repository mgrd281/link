#!/usr/bin/env node
/* eslint-disable no-console -- a command-line tool prints its result. */
/**
 * Takes the phone pictures of pages for the marketing site, 390 px wide (saved 640 px wide).
 *   - Example pages, each in its own language, the top screen (390 × 844):
 *     src/assets/marketing/examples/<slug>.jpg
 *   - Concept pages of well-known people, in German, English and Arabic, as a tall picture of up to
 *     two and a half screens (the hero scrolls through it):
 *     src/assets/marketing/concepts/<slug>.<locale>.jpg
 *
 * Run it against a running production build whenever the pages' look or Linkyo's own chip on them
 * changes (for instance after a new logo):
 *
 *   node scripts/capture-example-shots.mjs                      every picture that exists
 *   node scripts/capture-example-shots.mjs lumen-atelier        one example page (new or existing)
 *   node scripts/capture-example-shots.mjs concept:taylor-swift one concept page, three languages
 *   node scripts/capture-example-shots.mjs laptop:ronja-feldkamp the first screen of a laptop (1440 × 810)
 *   node scripts/capture-example-shots.mjs project:ronja-feldkamp/hafenlicht a project page on a phone
 *   BASE_URL=http://localhost:3100 node scripts/capture-example-shots.mjs
 *
 * Laptop and project pictures belong to the Portfolio page and go to
 * src/features/marketing/portfolio/shots/ (<slug>.laptop.jpg, <slug>.<project>.jpg).
 *
 * A new picture also needs its line in src/features/marketing/examples.ts (or, for the Portfolio
 * page's pictures, in src/features/marketing/portfolio/shots.ts).
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../src/assets/marketing/examples");
const OUT_CONCEPTS = path.resolve(HERE, "../src/assets/marketing/concepts");
const OUT_PORTFOLIO = path.resolve(HERE, "../src/features/marketing/portfolio/shots");
const LOCALES = ["de", "en", "ar"];
const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const PHONE = { width: 390, height: 844 };
/** A laptop's first screen at 16:9 (the site's video ratio), saved at its own size. */
const LAPTOP = { width: 1440, height: 810 };
const PICTURE_WIDTH = 640;
/** Tall pictures stop after this many screens, so every page scrolls at a calm speed. */
const TALL_SCREENS = 2.5;

/** Each example page lives in its own language: read it from the catalog of looks. */
const looks = readFileSync(path.resolve(HERE, "../src/features/examples/looks.ts"), "utf8");
const localeOf = (slug) => new RegExp(`"?${slug}"?: \\{[^}]*?locale: "(\\w+)"`).exec(looks)?.[1];

/** "Essential only" on the privacy note, in each language (the note is not part of the picture). */
const essential = Object.fromEntries(
  LOCALES.map((locale) => {
    const messages = readFileSync(path.resolve(HERE, `../src/messages/${locale}.json`), "utf8");
    return [locale, /"privacyEssential": "([^"]+)"/.exec(messages)?.[1] ?? ""];
  }),
);

/**
 * What to take: [locale, slug, file, tall, viewport, path]. Examples in their own language, concepts
 * in all three; laptop and project pictures of examples in the example's language.
 */
const jobs = [];
const example = (slug) => jobs.push([localeOf(slug), slug, path.join(OUT, `${slug}.jpg`), false, PHONE, slug]);
const concept = (slug) => LOCALES.forEach((locale) => jobs.push([locale, slug, path.join(OUT_CONCEPTS, `${slug}.${locale}.jpg`), true, PHONE, slug]));
const laptop = (slug) => jobs.push([localeOf(slug), slug, path.join(OUT_PORTFOLIO, `${slug}.laptop.jpg`), false, LAPTOP, slug]);
const project = (address) => {
  const [slug, work] = address.split("/");
  jobs.push([localeOf(slug), slug, path.join(OUT_PORTFOLIO, `${slug}.${work}.jpg`), false, PHONE, `${slug}/${work}`]);
};
const asked = process.argv.slice(2);
if (asked.length > 0) {
  for (const name of asked) {
    if (name.startsWith("concept:")) concept(name.slice("concept:".length));
    else if (name.startsWith("laptop:")) laptop(name.slice("laptop:".length));
    else if (name.startsWith("project:")) project(name.slice("project:".length));
    else example(name);
  }
} else {
  readdirSync(OUT).filter((file) => file.endsWith(".jpg")).forEach((file) => example(file.replace(/\.jpg$/, "")));
  new Set(readdirSync(OUT_CONCEPTS).filter((file) => file.endsWith(".jpg")).map((file) => file.split(".")[0])).forEach(concept);
  for (const file of readdirSync(OUT_PORTFOLIO).filter((name) => name.endsWith(".jpg"))) {
    const [slug, what] = file.replace(/\.jpg$/, "").split(".");
    if (what === "laptop") laptop(slug);
    else project(`${slug}/${what}`);
  }
}

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
let failed = 0;
for (const [locale, slug, file, tall, viewport, address] of jobs) {
  if (!locale) {
    console.error(`✖ ${slug}: not in features/examples/looks.ts`);
    failed += 1;
    continue;
  }
  // Phone pictures are saved 640 px wide; a laptop's at its own size.
  const scale = viewport === PHONE ? PICTURE_WIDTH / PHONE.width : 1;
  const context = await browser.newContext({ viewport, deviceScaleFactor: scale, reducedMotion: "reduce" });
  const page = await context.newPage();
  const response = await page.goto(`${BASE}/${locale}/p/${address}`, { waitUntil: "networkidle" });
  if (!response?.ok()) {
    console.error(`✖ ${slug} (${locale}): ${response?.status() ?? "no response"}`);
    failed += 1;
    await context.close();
    continue;
  }
  const note = page.getByRole("button", { name: essential[locale], exact: true });
  if ((await note.count()) > 0) {
    await note.first().click();
    // The pointer leaves the spot: whatever lies under the closed note must not be pictured hovered.
    await page.mouse.move(0, 0);
  }
  await page.evaluate(() => document.fonts.ready);
  let height = viewport.height;
  if (tall) {
    // The picture ends where the page's own content ends (before the footer), or after
    // TALL_SCREENS screens. Walk down the page once so pictures below the first screen load.
    const content = await page.evaluate(() => {
      const footer = document.querySelector("footer");
      return Math.round(footer ? footer.getBoundingClientRect().top + window.scrollY : document.documentElement.scrollHeight);
    });
    height = Math.max(PHONE.height, Math.min(content, Math.round(PHONE.height * TALL_SCREENS)));
    for (let top = 0; top < height; top += PHONE.height / 2) {
      await page.evaluate((y) => window.scrollTo(0, y), top);
      await page.waitForTimeout(200);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForLoadState("networkidle");
  }
  // Let pictures finish decoding and the note leave before the picture is taken.
  await page.waitForTimeout(600);
  await page.screenshot({ path: file, type: "jpeg", quality: tall ? 80 : 84, fullPage: tall, clip: { x: 0, y: 0, width: viewport.width, height } });
  await context.close();
  console.log(`✔ ${address} (${locale}${viewport === LAPTOP ? ", laptop" : ""})`);
}
await browser.close();
process.exit(failed > 0 ? 1 : 0);
