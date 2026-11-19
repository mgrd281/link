/**
 * Renders the iOS app icons (1024 × 1024 PNG, no alpha channel: the App Store rejects transparency)
 * from brand/svg/app-icon-*.svg. Needs Playwright's Chromium and Python Pillow, so it is a separate
 * step: run it after `pnpm --filter @linkyo/tokens brand` when the symbol changes.
 *
 * Run: node packages/tokens/brand/render-icons.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(import.meta.url)("playwright");
const OUT = path.resolve(HERE, "../../../apps/ios/Linkyo/Resources/Assets.xcassets/AppIcon.appiconset");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
for (const [name, file] of [["Light", "app-icon-light.svg"], ["Dark", "app-icon-dark.svg"], ["Tinted", "app-icon-tinted.svg"]]) {
  const svg = readFileSync(path.join(HERE, "svg", file), "utf8").replace("<svg ", '<svg width="1024" height="1024" ');
  await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  const target = path.join(OUT, `AppIcon-${name}.png`);
  await page.screenshot({ path: target, clip: { x: 0, y: 0, width: 1024, height: 1024 } });
  execFileSync("python3", ["-I", "-c", "import sys; from PIL import Image; Image.open(sys.argv[1]).convert('RGB').save(sys.argv[1])", target]);
  console.warn(`✔ ${path.relative(process.cwd(), target)}`);
}
await browser.close();
