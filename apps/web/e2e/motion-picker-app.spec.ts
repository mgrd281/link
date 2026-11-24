import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { enterDemoCode } from "./auth";

/**
 * "Moving header" in the profile: Linkyo's own clips to watch and choose, none, or an own link. A clip
 * also sets the header picture to its first frame; leaving it gives the picture back.
 * Demo mode (everything lives in this browser's storage); runs on desktop and on a phone.
 */

const STORAGE_KEY = "linkyo.demo.v1";
/** Linkyo's clips in the picker (features/creator/motion-library.ts); "None" and "Own link" come on top. */
const MOTION_CLIPS = 7;

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

async function signedIn(page: Page, locale: "en" | "ar" = "en") {
  const name = `mila-${unique()}`;
  await page.goto(`/${locale}/signup?name=${name}`);
  await page.waitForLoadState("networkidle");
  await page.locator("#signup-email").fill(`${name}@example.com`);
  await page.locator("form button[type=submit]").click();
  await enterDemoCode(page);
  await page.waitForURL(`**/${locale}/app/welcome`);
  await page.getByRole("button", { name: locale === "ar" ? "لاحقًا" : "Skip for now" }).click();
  await page.waitForURL(`**/${locale}/app`);
}

interface StoredProfile {
  locale: string;
  motion?: { src: string };
  hero?: { src: string; alt: string; w?: number; h?: number };
}

const storedProfile = (page: Page) =>
  page.evaluate<StoredProfile, string>((key) => {
    const db = JSON.parse(window.localStorage.getItem(key) ?? "{}") as {
      session: { accountId: string };
      sites: Record<string, { page: { profile: StoredProfile } }>;
    };
    const site = db.sites[db.session.accountId];
    if (!site) throw new Error("no site");
    return site.page.profile;
  }, STORAGE_KEY);

/** Settings → Profile, with "More for the header" open. */
async function openPicker(page: Page, locale: "en" | "ar" = "en") {
  const words = locale === "ar" ? { profile: "الملف الشخصي", more: "المزيد لأعلى الصفحة" } : { profile: "Profile", more: "More for the header" };
  await page.goto(`/${locale}/app/settings`);
  await page.locator("#main").getByRole("listitem").filter({ has: page.getByText(words.profile, { exact: true }) }).getByRole("button").click();
  const sheet = page.getByRole("dialog", { name: words.profile });
  const more = sheet.getByRole("button", { name: words.more });
  if ((await more.getAttribute("aria-expanded")) === "false") await more.click();
  return sheet;
}

test.describe("profile: moving header from Linkyo's clips", () => {
  test("watch a clip in its tile, choose one by keyboard, save it with its still; None takes both away", async ({ page }) => {
    await signedIn(page);
    const sheet = await openPicker(page);
    const group = sheet.getByRole("radiogroup", { name: "Moving header" });
    await expect(group).toBeVisible();
    await expect(group.getByRole("radio")).toHaveCount(MOTION_CLIPS + 2);
    await expect(group.getByRole("radio", { name: "None" })).toBeChecked();

    // Each tile says whether it is real footage or an illustration.
    await expect(group.getByRole("radio", { name: /Scanning a barcode.*Real footage/ })).toHaveCount(1);
    await expect(group.getByRole("radio", { name: /Scanning goods.*Illustration/ })).toHaveCount(1);

    // Watching plays the clip in its tile and chooses nothing.
    const watch = sheet.getByRole("button", { name: "Watch Scanning goods" });
    await watch.click();
    const playing = sheet.getByRole("button", { name: "Stop Scanning goods" });
    await expect(playing).toHaveAttribute("aria-pressed", "true");
    await expect(sheet.locator('video[src="/media/motion/ware-scannen.mp4"]')).toHaveCount(1);
    await expect(group.getByRole("radio", { name: "None" })).toBeChecked();
    await playing.click();
    await expect(sheet.locator("video")).toHaveCount(0);

    // Choosing: a tap on the tile, then the arrow keys move through the group.
    await group.getByText("Scanning goods").click();
    await expect(group.getByRole("radio", { name: /Scanning goods/ })).toBeChecked();
    await page.keyboard.press("ArrowLeft");
    await expect(group.getByRole("radio", { name: /Packing a pallet/ })).toBeChecked();
    await expect(group.getByRole("radio", { name: /Packing a pallet/ })).toBeFocused();

    const results = await new AxeBuilder({ page }).include("[role=dialog]").analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);

    const save = sheet.getByRole("button", { name: "Save profile" }).locator("visible=true").first();
    await save.click();
    await expect(sheet).toBeHidden();
    // The store is written a moment after the sheet closes.
    await expect.poll(async () => (await storedProfile(page)).motion).toEqual({ src: "sample:motion-palette-packen" });
    const saved = await storedProfile(page);
    expect(saved.hero).toMatchObject({ src: "sample:ex-motion-palette-packen", w: 1080, h: 1350 });
    expect(saved.hero?.alt).toMatch(/stretch film/);

    // Back in: the clip is chosen; None takes the clip and its still away again.
    await openPicker(page);
    await expect(sheet.getByRole("radio", { name: /Packing a pallet/ })).toBeChecked();
    await sheet.getByRole("radiogroup", { name: "Moving header" }).getByText("None").click();
    await save.click();
    await expect(sheet).toBeHidden();
    await expect.poll(async () => (await storedProfile(page)).motion).toBeUndefined();
    const cleared = await storedProfile(page);
    expect(cleared.hero).toBeUndefined();
  });

  test("Own link shows the link field, which is still checked", async ({ page }) => {
    await signedIn(page);
    const sheet = await openPicker(page);
    await expect(sheet.getByLabel("Link to the MP4 file")).toHaveCount(0);
    await sheet.getByRole("radiogroup", { name: "Moving header" }).getByText("Own link").click();
    const field = sheet.getByLabel("Link to the MP4 file");
    await field.fill("https://cdn.example.com/clip.m4v");
    await sheet.getByRole("button", { name: "Save profile" }).locator("visible=true").first().click();
    await expect(sheet.getByText("Paste a direct link to an MP4 file.")).toBeVisible();
    await field.fill("https://cdn.example.com/clip.mp4");
    await sheet.getByRole("button", { name: "Save profile" }).locator("visible=true").first().click();
    await expect(sheet).toBeHidden();
    await expect.poll(async () => (await storedProfile(page)).motion).toEqual({ src: "https://cdn.example.com/clip.mp4" });
  });

  test("in Arabic: the clips carry their Arabic names and lengths, and the sheet passes axe", async ({ page }) => {
    await signedIn(page, "ar");
    const sheet = await openPicker(page, "ar");
    const group = sheet.getByRole("radiogroup", { name: "واجهة متحركة" });
    await expect(group.getByRole("radio", { name: /مسح البضائع/ })).toHaveCount(1);
    // Three clips run 8 seconds: scanning goods, the forklift in the aisle and the pallet truck.
    await expect(group.getByText("8 ثوانٍ")).toHaveCount(3);
    await expect(sheet.getByRole("button", { name: "شاهد عمل المستودع" })).toBeVisible();
    const results = await new AxeBuilder({ page }).include("[role=dialog]").analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});
