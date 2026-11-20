// Walks the Linkyo user journey and screenshots every screen (see SKILL.md).
// Usage: node journey.cjs <out-dir> [mobile|desktop] [de|en|ar]   (app running on localhost:3100)
const { chromium } = require("playwright");
const OUT = process.argv[2];
const MODE = process.argv[3] || "mobile";
const LOCALE = process.argv[4] || "de";
const B = process.env.BASE_URL || "http://localhost:3100";
const RUN = Date.now().toString(36);
const L = {
  de: { music: "Musik", add: /Block hinzufügen|Hinzufügen/, edit: /bearbeiten/, dashboard: /Dashboard/ },
  en: { music: "Music", add: /^Add$/, edit: /^Edit/, dashboard: /dashboard/i },
  ar: { music: "موسيقى", add: /إضافة/, edit: /تعديل/, dashboard: /لوحة/ },
}[LOCALE];
(async () => {
  const browser = await chromium.launch();
  const opts = MODE === "mobile"
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: LOCALE }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: LOCALE };
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const shot = async (name, full = false) => { await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/${LOCALE}-${MODE}-${name}.png`, fullPage: full }); };
  const step = async (name, fn) => { try { await fn(); } catch (e) { console.log("FAIL", name, e.message.split("\n")[0]); } };
  await step("home", async () => { await page.goto(`${B}/${LOCALE}`); await page.waitForLoadState("networkidle"); await shot("01-home"); await shot("01-home-full", true); });
  await step("templates", async () => { await page.goto(`${B}/${LOCALE}/templates`); await page.waitForLoadState("networkidle"); await shot("02-templates"); });
  await step("signup", async () => {
    await page.goto(`${B}/${LOCALE}/signup?name=ux-${MODE}-${RUN}`); await page.waitForLoadState("networkidle"); await shot("03-signup");
    await page.locator("#signup-email").fill(`ux-${MODE}-${RUN}@example.com`);
    await page.locator("form button[type=submit]").click();
    // Passwordless: demo mode shows the 6-digit code on screen; enter it as from the email.
    const shown = page.locator("[id$='-demo'] strong");
    await shown.waitFor();
    await page.locator('input[autocomplete="one-time-code"]').fill(((await shown.textContent()) || "").trim());
    await page.waitForURL(/\/app\/welcome/); await page.waitForLoadState("networkidle");
  });
  await step("welcome", async () => {
    await shot("04-welcome-kind");
    await page.getByText(L.music, { exact: true }).click();
    await page.locator("footer button").last().click(); await page.waitForTimeout(500);
    await shot("05-welcome-you");
    await page.locator("#main input").first().fill("Mila Aurel");
    await page.locator("#main textarea").first().fill("DJ und Produzentin aus Berlin. Neue EP am Freitag.");
    await page.locator("footer button").last().click(); await page.waitForTimeout(500);
    await shot("06-welcome-look");
    await page.locator("footer button").last().click(); await page.waitForTimeout(500);
    await page.getByLabel("Instagram").fill("milaaurel");
    await page.locator("#main textarea").first().fill("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC https://www.youtube.com/watch?v=aqz-KE-bpKQ");
    await page.waitForTimeout(500);
    await shot("07-welcome-links");
    await page.locator("footer button").last().click(); await page.waitForTimeout(800);
    await shot("08-welcome-done");
    await page.getByRole("button", { name: L.dashboard }).click();
    await page.waitForURL(/\/app$/);
  });
  await step("app", async () => { await page.waitForLoadState("networkidle"); await shot("09-app-home"); await shot("09-app-home-full", true); });
  await step("editor", async () => { await page.goto(`${B}/${LOCALE}/app/editor`); await page.waitForLoadState("networkidle"); await shot("10-editor"); await shot("10-editor-full", true); });
  await step("add", async () => {
    const add = page.getByRole("button", { name: L.add }).first();
    await add.click(); await page.waitForTimeout(700); await shot("11-add-sheet"); await page.keyboard.press("Escape");
  });
  await step("edit", async () => {
    await page.getByRole("button", { name: L.edit }).first().click(); await page.waitForTimeout(800); await shot("12-edit-sheet"); await page.keyboard.press("Escape");
  });
  await step("design", async () => { await page.goto(`${B}/${LOCALE}/app/design`); await page.waitForLoadState("networkidle"); await shot("13-design"); await shot("13-design-full", true); });
  await step("analytics", async () => { await page.goto(`${B}/${LOCALE}/app/analytics`); await page.waitForLoadState("networkidle"); await shot("14-analytics"); await shot("14-analytics-full", true); });
  await step("settings", async () => { await page.goto(`${B}/${LOCALE}/app/settings`); await page.waitForLoadState("networkidle"); await shot("15-settings"); await shot("15-settings-full", true); });
  await step("preview", async () => { await page.goto(`${B}/${LOCALE}/app/preview`); await page.waitForLoadState("networkidle"); await shot("16-own-preview"); });
  await browser.close();
})();
