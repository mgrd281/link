#!/usr/bin/env node
/* eslint-disable no-console -- a command-line tool prints its result. */
/**
 * Takes the phone pictures of our example pages for the marketing site: the top of each page at
 * 390 × 844, saved as src/assets/marketing/examples/<slug>.jpg (640 × 1385).
 *
 * Run it against a running production build whenever the pages' look or Linkyo's own chip on them
 * changes (for instance after a new logo):
 *
 *   node scripts/capture-example-shots.mjs                      every picture that exists
 *   node scripts/capture-example-shots.mjs nordlicht-sneaker    one page (new or existing)
 *   BASE_URL=http://localhost:3100 node scripts/capture-example-shots.mjs
 *
 * A new picture also needs its line in src/features/marketing/examples.ts.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../src/assets/marketing/examples");
const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const PHONE = { width: 390, height: 844 };
const PICTURE_WIDTH = 640;

/** Each example page lives in its own language: read it from the catalog of looks. */
const looks = readFileSync(path.resolve(HERE, "../src/features/examples/looks.ts"), "utf8");
const localeOf = (slug) => new RegExp(`"?${slug}"?: \\{[^}]*?locale: "(\\w+)"`).exec(looks)?.[1];

/** "Essential only" on the privacy note, in each language (the note is not part of the picture). */
const essential = Object.fromEntries(
  ["de", "en", "ar"].map((locale) => {
    const messages = readFileSync(path.resolve(HERE, `../src/messages/${locale}.json`), "utf8");
    return [locale, /"privacyEssential": "([^"]+)"/.exec(messages)?.[1] ?? ""];
  }),
);

const asked = process.argv.slice(2);
const slugs = asked.length > 0 ? asked : readdirSync(OUT).filter((file) => file.endsWith(".jpg")).map((file) => file.replace(/\.jpg$/, ""));

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
let failed = 0;
for (const slug of slugs) {
  const locale = localeOf(slug);
  if (!locale) {
    console.error(`✖ ${slug}: not in features/examples/looks.ts`);
    failed += 1;
    continue;
  }
  const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: PICTURE_WIDTH / PHONE.width, reducedMotion: "reduce" });
  const page = await context.newPage();
  const response = await page.goto(`${BASE}/${locale}/p/${slug}`, { waitUntil: "networkidle" });
  if (!response?.ok()) {
    console.error(`✖ ${slug}: ${response?.status() ?? "no response"}`);
    failed += 1;
    await context.close();
    continue;
  }
  const note = page.getByRole("button", { name: essential[locale], exact: true });
  if ((await note.count()) > 0) await note.first().click();
  await page.evaluate(() => document.fonts.ready);
  // Let pictures finish decoding and the note leave before the picture is taken.
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, `${slug}.jpg`), type: "jpeg", quality: 84 });
  await context.close();
  console.log(`✔ ${slug} (${locale})`);
}
await browser.close();
process.exit(failed > 0 ? 1 : 0);
