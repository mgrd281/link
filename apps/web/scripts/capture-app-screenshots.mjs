#!/usr/bin/env node
/**
 * The pictures of the installed app's manifest (`features/pwa/manifest.ts`, `MANIFEST_SCREENSHOTS`),
 * which Chrome's richer install dialog shows: the dashboard and a creator page, on a phone (390 × 844
 * at twice the pixels, "narrow") and on a laptop (1440 × 900, "wide"), once per language into
 * `public/screenshots/<locale>/` (the dashboard's words and the sample page in that language, Arabic
 * mirrored). Always the fictional sample creator (Mila Aurel; in Arabic Nour Haddad), never a real
 * person's page:
 *
 * - the dashboard: a demo account named after the language's sample creator, signed up in a fresh
 *   browser, with the language's sample page imported through Settings › import (the same file an
 *   export writes), then Home;
 * - the creator page: the Poster prototype with the sample (`/<locale>/directions/poster?chrome=0`),
 *   with the privacy choice "essential only" already made, so the notice is not in the picture.
 *
 * JPEG at quality 80, each under 300 KB (`src/features/pwa/manifest.test.ts` checks the sizes). Run it
 * against a running production build of the demo (no Supabase variables), then look at each picture:
 *
 *   BASE_URL=http://localhost:3208 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/capture-app-screenshots.mjs [de en ar]
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium, expect } from "@playwright/test";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const OUT = path.join(WEB, "public/screenshots");
const LOCALES = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ["de", "en", "ar"];
/** The words the script clicks, from the language's messages. */
const words = (locale) => {
  const messages = JSON.parse(readFileSync(path.join(WEB, `src/messages/${locale}.json`), "utf8"));
  const { skip } = messages.app.welcome;
  const { import: importPage, importConfirm, imported } = messages.app.settings;
  return { skip, importPage, importConfirm, imported };
};
const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const QUALITY = 80;
const SHOTS = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  laptop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};

/** The language's sample page as an import file (in the Poster direction's sections). */
function sampleFile(locale) {
  const code = `
    import { readFileSync } from "node:fs";
    import { createTranslator } from "next-intl";
    import { samplePage } from "./src/features/directions/shared/sample.ts";
    import { posterSamplePage } from "./src/features/directions/poster/sample.ts";
    const messages = JSON.parse(readFileSync("./src/messages/${locale}.json", "utf8"));
    const t = createTranslator({ locale: "${locale}", messages, namespace: "sampleContent" });
    const translate = (key) => t(key);
    const page = posterSamplePage(samplePage("${locale}", translate), translate);
    process.stdout.write(JSON.stringify({ page, theme: { template: "nocturne" } }));
  `;
  return execFileSync("npx", ["tsx", "--eval", code], { cwd: WEB, encoding: "utf8" });
}

const scratch = mkdtempSync(path.join(tmpdir(), "linkyo-shots-"));

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});

/** A demo account with the language's sample page, signed in in this context. */
async function sampleAccount(page, locale) {
  // The address matches the sample: Mila Aurel in German and English, Nour Haddad in Arabic.
  const name = locale === "ar" ? "nour-haddad" : "mila-aurel";
  const say = words(locale);
  const importFile = path.join(scratch, `mila-aurel-${locale}.json`);
  writeFileSync(importFile, sampleFile(locale));
  await page.goto(`${BASE}/${locale}/signup?name=${name}`, { waitUntil: "networkidle" });
  await page.locator("#signup-email").fill(`${name}-${Date.now().toString(36)}@example.com`);
  await page.locator("form button[type=submit]").click();
  const code = (await page.locator("[id$='-demo'] strong").textContent({ timeout: 30_000 })) ?? "";
  await page.locator('input[autocomplete="one-time-code"]').fill(code.trim());
  await page.waitForURL(`**/${locale}/app/welcome`);
  await page.getByRole("button", { name: say.skip }).click();
  await page.waitForURL(`**/${locale}/app`);
  await page.goto(`${BASE}/${locale}/app/settings`, { waitUntil: "networkidle" });
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: say.importPage }).click();
  await (await chooser).setFiles(importFile);
  await page.getByRole("button", { name: say.importConfirm }).click();
  await expect(page.getByText(say.imported, { exact: true })).toBeVisible();
}

async function capture(page, file) {
  await page.evaluate(() => document.fonts.ready);
  // Every picture loaded (lazy ones too), and the page back at its top.
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle");
  // Every picture on screen has arrived (a first request to the image optimizer can take a moment).
  await page.waitForFunction(
    () =>
      [...document.images]
        .filter((image) => {
          const box = image.getBoundingClientRect();
          return box.width > 0 && box.bottom > 0 && box.top < window.innerHeight;
        })
        .every((image) => image.complete && image.naturalWidth > 0),
    undefined,
    { timeout: 30_000 },
  );
  const target = path.join(OUT, file);
  mkdirSync(path.dirname(target), { recursive: true });
  await page.screenshot({ path: target, type: "jpeg", quality: QUALITY, animations: "disabled", caret: "hide" });
  console.warn(`✔ ${path.relative(process.cwd(), target)} (${String(Math.round(statSync(target).size / 1000))} KB)`);
}

for (const locale of LOCALES) {
  for (const [device, options] of Object.entries(SHOTS)) {
    const context = await browser.newContext({ ...options, locale: { de: "de-DE", en: "en-GB", ar: "ar" }[locale], reducedMotion: "reduce", colorScheme: "light" });
    // The creator page's privacy choice, made before it loads: "essential only" (features/directions/shared/privacy.tsx).
    await context.addInitScript(() => window.localStorage.setItem("linkyo.privacy.v1", "essential"));
    const page = await context.newPage();
    await sampleAccount(page, locale);
    // A fresh load of Home: the import's toast is gone, the page is at rest.
    await page.goto(`${BASE}/${locale}/app`, { waitUntil: "networkidle" });
    await expect(page.locator("#main h1").first()).toBeVisible();
    await capture(page, `${locale}/dashboard-${device}.jpg`);
    await page.goto(`${BASE}/${locale}/directions/poster?chrome=0`, { waitUntil: "networkidle" });
    await expect(page.locator("[data-privacy-notice]")).toHaveCount(0);
    await capture(page, `${locale}/page-${device}.jpg`);
    await context.close();
  }
}

await browser.close();
rmSync(scratch, { recursive: true, force: true });
