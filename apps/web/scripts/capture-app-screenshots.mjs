#!/usr/bin/env node
/**
 * The pictures of the installed app's manifest (`features/pwa/manifest.ts`, `MANIFEST_SCREENSHOTS`),
 * which Chrome's richer install dialog shows: the dashboard and a creator page, on a phone (390 × 844
 * at twice the pixels, "narrow") and on a laptop (1440 × 900, "wide"). Always the fictional sample
 * creator (Mila Aurel), never a real person's page:
 *
 * - the dashboard: a demo account signed up in a fresh browser, with the sample page imported through
 *   Settings › Seite importieren (the same file an export writes), then Home;
 * - the creator page: the Poster prototype with the sample (`/de/directions/poster?chrome=0`).
 *
 * JPEG at quality 80, each under 300 KB (`src/features/pwa/manifest.test.ts` checks the sizes). Run it
 * against a running production build of the demo (no Supabase variables), then look at each picture:
 *
 *   BASE_URL=http://localhost:3208 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/capture-app-screenshots.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium, expect } from "@playwright/test";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const OUT = path.join(WEB, "public/screenshots");
const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const QUALITY = 80;
const SHOTS = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  laptop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};

/** The sample page as an import file (the German sample, in the Poster direction's sections). */
function sampleFile() {
  const code = `
    import { createTranslator } from "next-intl";
    import messages from "./src/messages/de.json" with { type: "json" };
    import { samplePage } from "./src/features/directions/shared/sample.ts";
    import { posterSamplePage } from "./src/features/directions/poster/sample.ts";
    const t = createTranslator({ locale: "de", messages, namespace: "sampleContent" });
    const translate = (key) => t(key);
    const page = posterSamplePage(samplePage("de", translate), translate);
    process.stdout.write(JSON.stringify({ page, theme: { template: "nocturne" } }));
  `;
  return execFileSync("npx", ["tsx", "--eval", code], { cwd: WEB, encoding: "utf8" });
}

const scratch = mkdtempSync(path.join(tmpdir(), "linkyo-shots-"));
const importFile = path.join(scratch, "mila-aurel.json");
writeFileSync(importFile, sampleFile());
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});

/** A demo account with the sample page, signed in in this context. */
async function sampleAccount(page) {
  const name = "mila-aurel";
  await page.goto(`${BASE}/de/signup?name=${name}`, { waitUntil: "networkidle" });
  await page.locator("#signup-email").fill(`${name}-${Date.now().toString(36)}@example.com`);
  await page.locator("form button[type=submit]").click();
  const code = (await page.locator("[id$='-demo'] strong").textContent({ timeout: 30_000 })) ?? "";
  await page.locator('input[autocomplete="one-time-code"]').fill(code.trim());
  await page.waitForURL("**/de/app/welcome");
  await page.getByRole("button", { name: "Später" }).click();
  await page.waitForURL("**/de/app");
  await page.goto(`${BASE}/de/app/settings`, { waitUntil: "networkidle" });
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Seite importieren" }).click();
  await (await chooser).setFiles(importFile);
  await page.getByRole("button", { name: "Seite ersetzen" }).click();
  await expect(page.getByText("Seite importiert", { exact: true })).toBeVisible();
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
  const target = path.join(OUT, file);
  await page.screenshot({ path: target, type: "jpeg", quality: QUALITY, animations: "disabled", caret: "hide" });
  console.warn(`✔ ${path.relative(process.cwd(), target)} (${String(Math.round(statSync(target).size / 1000))} KB)`);
}

for (const [device, options] of Object.entries(SHOTS)) {
  const context = await browser.newContext({ ...options, locale: "de-DE", reducedMotion: "reduce", colorScheme: "light" });
  const page = await context.newPage();
  await sampleAccount(page);
  // A fresh load of Home: the import's toast is gone, the page is at rest.
  await page.goto(`${BASE}/de/app`, { waitUntil: "networkidle" });
  await expect(page.locator("#main h1").first()).toBeVisible();
  await capture(page, `dashboard-${device}.jpg`);
  await page.goto(`${BASE}/de/directions/poster?chrome=0`, { waitUntil: "networkidle" });
  // The privacy note is not part of the picture: "Nur notwendige" (essential only).
  const essential = page.getByRole("button", { name: "Nur notwendige" });
  if (await essential.isVisible().catch(() => false)) await essential.click();
  await capture(page, `page-${device}.jpg`);
  await context.close();
}

await browser.close();
rmSync(scratch, { recursive: true, force: true });
