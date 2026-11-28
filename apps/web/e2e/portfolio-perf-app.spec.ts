import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { BUDGETS, frameworkFiles, gzipSize } from "../scripts/check-route-budgets.mjs";

/**
 * Creator pages load little script and still work (E-01, Stage 4 WP4.3, ADR 0008). What a page really
 * loads, until the network rests after a scroll to its end, is counted the way
 * scripts/check-route-budgets.mjs counts the build: the scripts from our own origin without the
 * framework (Next and React), gzip at zlib's default level, at most 35 KB. On the phone and the laptop,
 * in German and Arabic. The parts that need script still work: the picture viewer opens, a row of
 * projects moves, the privacy notice answers, a video card loads its player only when pressed, a real
 * page counts one view, and no word is missing in the browser (next-intl logs MISSING_MESSAGE when a
 * route group does not pass a namespace its islands read, src/i18n/client-messages.ts).
 *
 * The pages under /u need real accounts: the Supabase stand-in and its own build (E2E_STUB=1, see
 * e2e/stub-app.spec.ts for the command).
 */

const APP = path.resolve(import.meta.dirname, "..");
const FRAMEWORK = frameworkFiles(APP);
const stubEnabled = process.env.E2E_STUB === "1";
const STUB = `http://127.0.0.1:${process.env.STUB_SUPABASE_PORT ?? "55103"}`;

const WORDS = {
  de: {
    privacy: "Datenschutz",
    allow: "Externe Inhalte erlauben",
    video: /^Video von YouTube abspielen: |^Vorschau von YouTube abspielen, /,
    noVideo: "Diese Adresse nennt kein Video von YouTube: Hier lädt kein Player.",
    on: "Weiterblättern",
    back: "Zurückblättern",
  },
  ar: {
    privacy: "الخصوصية",
    allow: "السماح بالمحتوى الخارجي",
    video: /^شغّل الفيديو من YouTube: |^تشغيل معاينة \d+ ثانية من YouTube: /,
    noVideo: "هذا العنوان لا يشير إلى فيديو على YouTube: لن يُحمَّل أي مشغّل هنا.",
    on: "تمرير للأمام",
    back: "تمرير للخلف",
  },
} as const;
type Locale = keyof typeof WORDS;

const gzipOfFile = new Map<string, number>();
/** The gzip size of one of the build's chunks, read from `.next` (as the budget script reads it). */
function chunkGzip(pathname: string): number {
  let size = gzipOfFile.get(pathname);
  if (size === undefined) {
    size = gzipSize(readFileSync(path.join(APP, ".next", pathname.replace(/^\/_next\//, ""))));
    gzipOfFile.set(pathname, size);
  }
  return size;
}

/** From here on: the scripts the page loads from our origin, and the words the browser could not find. */
function watch(page: Page, origin: string) {
  const scripts = new Set<string>();
  const missing: string[] = [];
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === origin && response.request().resourceType() === "script" && url.pathname.startsWith("/_next/static/")) scripts.add(url.pathname);
  });
  page.on("console", (message) => {
    if (message.text().includes("MISSING_MESSAGE")) missing.push(message.text());
  });
  return {
    missing,
    /** The page's own code so far: its scripts without the framework's, gzip. */
    pageCode: () => [...scripts].filter((file) => !FRAMEWORK.has(file)).reduce((sum, file) => sum + chunkGzip(file), 0),
  };
}

/** Opens a page, scrolls to its end (so anything that loads on the way loads) and waits until the network rests. */
async function visit(page: Page, address: string): Promise<void> {
  const response = await page.goto(address);
  expect(response?.status(), address).toBe(200);
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle");
}

/** The page's language and direction, and its code within the budget. */
async function lean(page: Page, address: string, locale: Locale, watched: ReturnType<typeof watch>): Promise<void> {
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
  const code = watched.pageCode();
  expect(code, `${address}: ${String(code)} bytes of page code (gzip)`).toBeLessThanOrEqual(BUDGETS.creatorPageCode);
  expect(code, `${address}: some page code loads`).toBeGreaterThan(0);
}

/** A YouTube player is never really fetched here: the embed's address answers with an empty page. */
async function fakePlayers(page: Page): Promise<string[]> {
  const asked: string[] = [];
  await page.route("https://www.youtube-nocookie.com/**", async (route) => {
    asked.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>player</title>" });
  });
  return asked;
}

/**
 * The privacy notice is there before a choice; a video card loads its player only when pressed (a real
 * YouTube address gets the embed; an example's address, which names no real video, says that no player
 * loads); "allow" is kept.
 */
async function playerAndNotice(page: Page, locale: Locale, asked: string[], { embed }: { embed: boolean }): Promise<void> {
  const words = WORDS[locale];
  const notice = page.getByRole("region", { name: words.privacy });
  await expect(notice).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  expect(asked).toEqual([]);
  const card = page.getByRole("button", { name: words.video }).first();
  await card.scrollIntoViewIfNeeded();
  await card.click();
  if (embed) {
    await expect(page.locator('iframe[src^="https://www.youtube-nocookie.com/embed/"]')).toHaveCount(1);
    await expect.poll(() => asked.length).toBeGreaterThan(0);
  } else {
    await expect(page.getByRole("status").filter({ hasText: words.noVideo })).toBeVisible();
    await expect(page.locator("iframe")).toHaveCount(0);
    expect(asked).toEqual([]);
  }
  await notice.getByRole("button", { name: words.allow }).click();
  await expect(notice).toBeHidden();
  expect(await page.evaluate(() => window.localStorage.getItem("linkyo.privacy.v1"))).toBe("media");
}

/** The viewer opens on a press on the third picture and closes with Escape, focus back on the picture. */
async function viewerOpens(page: Page, touch: boolean): Promise<void> {
  await expect(page.locator("[data-viewer-ready]")).toHaveCount(1);
  const link = page.locator("[data-project-page] a[data-viewer]").nth(2);
  await expect(link).toHaveAttribute("data-viewer", "3");
  await link.scrollIntoViewIfNeeded();
  if (touch) await link.tap();
  else await link.click();
  const viewer = page.locator("dialog[data-picture-viewer]");
  await expect(viewer).toHaveAttribute("open", "");
  await expect(viewer.locator("[data-viewer-counter]")).toHaveText(/^3 \/ \d+$/);
  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();
  await expect(link).toBeFocused();
}

/** A row of projects moves: one press on "on" pages it (laptop), or a phone scrolls it sideways. */
async function railMoves(page: Page, locale: Locale, touch: boolean): Promise<void> {
  const group = page.locator("[data-rail-group]").first();
  await group.scrollIntoViewIfNeeded();
  const rail = group.locator("[data-rail-track]");
  const at = (track: Locator) => track.evaluate((element) => Math.round(Math.abs(element.scrollLeft)));
  expect(await at(rail)).toBe(0);
  if (touch) {
    // Phones swipe: the buttons are for a mouse and stay hidden; the row scrolls on its own.
    await expect(group.getByRole("button", { name: WORDS[locale].on })).toBeHidden();
    expect(await rail.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    return;
  }
  const on = group.getByRole("button", { name: WORDS[locale].on });
  await expect(group.getByRole("button", { name: WORDS[locale].back })).toHaveAttribute("aria-disabled", "true");
  await on.click();
  await expect.poll(() => at(rail)).toBeGreaterThan(0);
  expect(await rail.evaluate((element) => Math.sign(element.scrollLeft))).toBe(locale === "ar" ? -1 : 1);
}

test.describe("example creator pages under /p", () => {
  for (const { address, locale } of [
    { address: "/de/p/ronja-feldkamp", locale: "de" },
    { address: "/de/p/ronja-feldkamp/hafenlicht", locale: "de" },
    { address: "/ar/p/elena-novak", locale: "ar" },
    { address: "/ar/p/elena-novak/accountant-to-analyst", locale: "ar" },
  ] as const) {
    test(`${address} loads at most 35 KB of page code and misses no word`, async ({ page, baseURL }, testInfo) => {
      const watched = watch(page, new URL(baseURL ?? "").origin);
      await visit(page, address);
      await lean(page, address, locale, watched);
      if (address.endsWith("/hafenlicht")) await viewerOpens(page, testInfo.project.name === "mobile");
      expect(watched.missing).toEqual([]);
    });
  }

  for (const { address, locale } of [
    { address: "/de/p/lena-vogt", locale: "de" },
    { address: "/ar/p/adam-nour", locale: "ar" },
  ] as const) {
    test(`${address}: the notice answers and the video card loads its player only when pressed, within budget`, async ({ page, baseURL }) => {
      const asked = await fakePlayers(page);
      const watched = watch(page, new URL(baseURL ?? "").origin);
      await visit(page, address);
      await lean(page, address, locale, watched);
      await playerAndNotice(page, locale, asked, { embed: false });
      expect(watched.missing).toEqual([]);
    });
  }
});

test.describe("a real creator page under /u (stub)", () => {
  test.skip(!stubEnabled, "Needs the stub build and the Supabase stand-in (E2E_STUB=1).");

  /** A page with a video, a row of four projects and a project with pictures, made in the stand-in. */
  async function seed(locale: Locale): Promise<string> {
    const id = randomUUID();
    const username = `perf-${randomUUID().replaceAll("-", "").slice(0, 8)}`;
    const sample = (n: number) => `sample:ex-pf-ronja-${String(n).padStart(2, "0")}`;
    const project = (n: number) => ({
      id: `p${String(n)}`,
      type: "project",
      slug: `studie-${String(n)}`,
      title: `Studie ${String(n)}`,
      summary: "Eine Serie am Hafen.",
      visible: true,
      highlight: false,
      cover: { src: sample(n), alt: `Studie ${String(n)}` },
      pictures: [1, 2, 3, 4].map((k) => ({ image: { src: sample(n + k), alt: `Bild ${String(k)}` } })),
    });
    const page = {
      profile: { username, displayName: "Mira Feld", bio: "Fotografin am Hafen.", avatar: { src: sample(1), alt: "" }, verified: false, locale },
      blocks: [
        { id: "v1", type: "video", title: "Hafen bei Nacht", provider: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", poster: { src: sample(9), alt: "" }, visible: true, highlight: false },
        ...[1, 2, 3, 4].map(project),
      ],
    };
    const response = await fetch(`${STUB}/__stub/seed`, {
      method: "POST",
      body: JSON.stringify({
        users: { [id]: { id, email: `${username}@example.com` } },
        profiles: { [id]: { id, username, locale, status: "active", created_at: "2026-11-01T00:00:00Z" } },
        sites: {
          [id]: {
            profile_id: id,
            kind: null,
            onboarded: true,
            prepared: null,
            page,
            theme: { template: "tiefdruck", projects: "rail" },
            legal: { name: "", address: "", email: "", phone: "" },
            updated_at: "2026-11-20T10:00:00Z",
          },
        },
      }),
    });
    expect(response.ok).toBe(true);
    return username;
  }

  for (const locale of ["de", "ar"] as const) {
    test(`${locale}: within budget, one view counted, the row moves, the notice and the video card answer`, async ({ page, baseURL }, testInfo) => {
      const username = await seed(locale);
      const views: string[] = [];
      page.on("request", (request) => {
        if (request.method() === "POST" && new URL(request.url()).pathname === "/api/collect" && request.postData()?.includes('"t":"v"')) views.push(request.url());
      });
      const asked = await fakePlayers(page);
      const watched = watch(page, new URL(baseURL ?? "").origin);
      await visit(page, `/${username}`);
      await lean(page, `/${username}`, locale, watched);
      // The counter fires once for the view (the scroll to the end and back counts nothing more).
      await expect.poll(() => views.length).toBe(1);
      await railMoves(page, locale, testInfo.project.name === "mobile");
      await playerAndNotice(page, locale, asked, { embed: true });
      expect(views).toHaveLength(1);
      expect(watched.missing).toEqual([]);
    });

    test(`${locale}: a project page within budget, and its viewer opens`, async ({ page, baseURL }, testInfo) => {
      const username = await seed(locale);
      const watched = watch(page, new URL(baseURL ?? "").origin);
      await visit(page, `/${username}/studie-1`);
      await lean(page, `/${username}/studie-1`, locale, watched);
      await viewerOpens(page, testInfo.project.name === "mobile");
      expect(watched.missing).toEqual([]);
    });
  }
});
