import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

import AxeBuilder from "@axe-core/playwright";
import type { Block } from "@linkyo/blocks";
import type { Page, Request as PlaywrightRequest } from "@playwright/test";

import { createRealAccount, expect, realEnabled, seedPage, service, signIn, test, uniqueName } from "./real";

/**
 * Cookie-free analytics (Stage 3 WP3.1, ADR 0081) on real accounts: a
 * creator page counts its views and the taps on its blocks through a same-origin beacon, without a
 * cookie, storage or a fingerprint, and the owner reads the numbers on Stats. Runs with the local
 * stack (E2E_SUPABASE=1) and the full migration set. The server switch is on in tests
 * (playwright.config.ts); a second run with LINKYO_ANALYTICS=off checks that nothing ships and
 * nothing is stored while it is off:
 *
 *   LINKYO_ANALYTICS=off … npx playwright test e2e/analytics-real.spec.ts --grep @real --project desktop
 */

const ON = (process.env.LINKYO_ANALYTICS ?? "on") === "on";
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const link = (id: string, title: string): Block => ({ id, type: "link", title, url: `https://example.com/${id}`, visible: true, highlight: false });

/**
 * A confirmed, onboarded account whose page is ready to share (three links, a photo and a bio, so Home
 * shows the week).
 */
async function creator(prefix: string, locale: "de" | "en" | "ar" = "en") {
  const { username, email } = uniqueName(prefix);
  const page = seedPage(username, locale, { displayName: "Ana Lindqvist", bio: "Ceramics and tableware, made by hand.", avatar: { src: "sample:mila-avatar", alt: "" } }, [
    link("shop", "Visit the shop"),
    link("tour", "Tour dates"),
    link("press", "Press kit"),
  ]);
  return createRealAccount({ email, username, locale, onboarded: true, page, theme: { template: "nocturne" } });
}

interface Row {
  dimension: string;
  key: string;
  views: number;
  visitors: number;
  clicks: number;
}

/** What the database holds for a page (service client: checks only). */
async function rows(profileId: string): Promise<Row[]> {
  const { data, error } = await service().from("page_stats").select("dimension, key, views, visitors, clicks").eq("profile_id", profileId);
  if (error) throw new Error(error.message);
  return data;
}

const pageRow = async (profileId: string) => (await rows(profileId)).find((row) => row.dimension === "page");

/** Waits for the page's next beacon of this kind ("v" view, "c" tap). */
const beacon = (page: Page, kind: "v" | "c") =>
  page.waitForRequest((request) => request.method() === "POST" && new URL(request.url()).pathname === "/api/collect" && (request.postData() ?? "").includes(`"t":"${kind}"`));

/** Links to example.com stay on this machine. */
async function keepLinksLocal(page: Page) {
  await page.context().route("https://example.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Elsewhere</title>" }));
}

test.describe("cookie-free analytics @real", () => {
  test.skip(!realEnabled, "Needs the local Supabase stack (E2E_SUPABASE=1).");

  test("two visits and one tap are counted, and Stats shows them with its range and CSV @real", async ({ page, baseURL }) => {
    test.skip(!ON, "the switch is off in this run");
    test.setTimeout(120_000);
    await keepLinksLocal(page);
    const { id, email, username } = await creator("stats-flow");

    const first = beacon(page, "v");
    await page.goto(`/${username}`);
    const view = await first;
    // Same origin, nothing but the page's name, the kind and the referring host.
    expect(new URL(view.url()).origin).toBe(new URL(baseURL ?? "").origin);
    expect(Object.keys(JSON.parse(view.postData() ?? "{}") as object).sort()).toEqual(["p", "r", "t"]);

    const second = beacon(page, "v");
    await page.reload();
    await second;
    const tap = beacon(page, "c");
    await page.getByRole("link", { name: /Visit the shop/ }).first().click();
    expect(JSON.parse((await tap).postData() ?? "{}")).toEqual({ p: username, t: "c", b: "shop" });

    await expect.poll(async () => pageRow(id), { timeout: 15_000 }).toMatchObject({ views: 2, visitors: 1, clicks: 1 });
    expect((await rows(id)).filter((row) => row.dimension === "block")).toEqual([{ dimension: "block", key: "shop", views: 0, visitors: 0, clicks: 1 }]);

    // The owner reads them.
    await signIn(page, email, "/en/app/analytics");
    await page.waitForURL("**/en/app/analytics");
    const tile = (label: string) => page.locator("main dl > div").filter({ has: page.getByText(label, { exact: true }) }).locator("dd").first();
    await expect(tile("Views")).toHaveText("2");
    await expect(tile("Visitors")).toHaveText("1");
    await expect(tile("Clicks")).toHaveText("1");
    await expect(page.getByText("Sample data")).toHaveCount(0);
    await expect(page.getByText("Tapped most: \u2068Visit the shop\u2069")).toBeVisible();
    await expect(page.getByRole("region", { name: "Top links" }).getByText("Visit the shop")).toBeVisible();

    // The range: the last 7 days hold the same visits; the table has a row per day.
    await page.getByRole("radio", { name: "7 days" }).click();
    await expect(tile("Views")).toHaveText("2");
    await page.getByRole("button", { name: "Show as table" }).click();
    const table = page.getByRole("region", { name: "Numbers per day" });
    await expect(table.getByRole("row")).toHaveCount(8);

    // The CSV holds exactly the days on screen; days before counting began are empty, not 0.
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download CSV" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^linkyo-stats-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv$/);
    const csv = (await readFile(await file.path(), "utf8")).replace(/^\uFEFF/, "").split("\n");
    expect(csv[0]).toBe('"Date","Views","Visitors","Clicks"');
    expect(csv).toHaveLength(8);
    expect(csv.at(-1)).toMatch(/^"\d{4}-\d{2}-\d{2}","2","1","1"$/);
    expect(csv[1]).toMatch(/^"\d{4}-\d{2}-\d{2}","","",""$/);

    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    }

    // Home's week and the editor's count chip read the same numbers.
    await page.goto("/en/app");
    const week = page.getByRole("region", { name: "Last 7 days" });
    await expect(week.locator("dl")).toBeVisible();
    await expect(week.getByText("Sample data")).toHaveCount(0);
    await page.goto("/en/app/editor");
    await page.getByRole("button", { name: "Edit Visit the shop (Link)" }).click();
    await expect(page.getByRole("dialog").locator("[data-block-taps]")).toHaveText(/^1 click (in the last 30 days|since .+)$/);
  });

  test("a creator page sets no cookie and keeps nothing on the device; the beacon stays on its own origin @real", async ({ page, context, baseURL }) => {
    test.skip(!ON, "the switch is off in this run");
    await keepLinksLocal(page);
    const { username } = await creator("stats-privacy", "de");
    const origins = new Set<string>();
    const beacons: PlaywrightRequest[] = [];
    page.on("request", (request) => {
      if (/^https?:/.test(request.url())) origins.add(new URL(request.url()).origin);
      if (new URL(request.url()).pathname === "/api/collect") beacons.push(request);
    });
    const counted = beacon(page, "v");
    await page.goto(`/${username}`);
    await counted;
    await page.waitForLoadState("networkidle");
    expect([...origins]).toEqual([new URL(baseURL ?? "").origin]);
    expect(beacons.length).toBe(1);
    expect(await beacons[0]?.allHeaders()).not.toHaveProperty("cookie");
    expect(await context.cookies()).toEqual([]);
    const kept = await page.evaluate(async () => ({ local: localStorage.length, session: sessionStorage.length, databases: (await indexedDB.databases()).length }));
    expect(kept).toEqual({ local: 0, session: 0, databases: 0 });
  });

  test("visitors who ask not to be tracked, bots and prefetches are not counted @real", async ({ page, baseURL }) => {
    test.skip(!ON, "the switch is off in this run");
    const { id, username } = await creator("stats-optout");
    // Global Privacy Control in the browser: the island sends nothing at all.
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "globalPrivacyControl", { get: () => true }));
    const sent: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/collect") sent.push(request.url());
    });
    await page.goto(`/${username}`);
    await page.waitForLoadState("networkidle");
    expect(sent).toEqual([]);

    // The server's own checks, request by request; the last one is a plain visit and counts.
    const origin = new URL(baseURL ?? "").origin;
    const browser = await page.evaluate(() => navigator.userAgent);
    const post = (headers: Record<string, string>) =>
      page.request.post("/api/collect", {
        headers: { "content-type": "text/plain;charset=UTF-8", "sec-fetch-site": "same-origin", origin, "user-agent": browser, ...headers },
        data: JSON.stringify({ p: username, t: "v", r: "" }),
      });
    for (const headers of [
      { "sec-gpc": "1" },
      { dnt: "1" },
      { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
      { "user-agent": "curl/8.5.0" },
      { "sec-purpose": "prefetch;prerender" },
      { "sec-fetch-site": "cross-site", origin: "https://elsewhere.example" },
    ]) {
      const response = await post(headers);
      expect(response.status(), JSON.stringify(headers)).toBe(204);
    }
    expect(await rows(id)).toEqual([]);
    expect((await post({})).status()).toBe(204);
    await expect.poll(async () => (await pageRow(id))?.views, { timeout: 10_000 }).toBe(1);
  });

  test("the counting island adds at most 2 KB (gzip) to a creator page, and no script file @real", async ({ page }) => {
    test.skip(!ON, "the switch is off in this run");
    const { username } = await creator("stats-size");
    const scripts: Buffer[] = [];
    page.on("response", async (response) => {
      if (response.request().resourceType() === "script") scripts.push(await response.body().catch(() => Buffer.alloc(0)));
    });
    const counted = beacon(page, "v");
    await page.goto(`/${username}`);
    await counted;
    await page.waitForLoadState("networkidle");
    // The counter is the page's own inline script; no bundle carries it.
    expect(scripts.filter((body) => body.includes("/api/collect"))).toHaveLength(0);
    const island = await page.locator("script[data-beacon]").textContent();
    expect(island).toContain("/api/collect");
    const gzip = gzipSync(island ?? "").length;
    test.info().annotations.push({ type: "island-gzip-bytes", description: String(gzip) });
    expect(gzip).toBeLessThanOrEqual(2048);
  });

  test("with the switch off a creator page ships no counting code and /api/collect stores nothing @real", async ({ page }) => {
    test.skip(ON, "run with LINKYO_ANALYTICS=off");
    const { id, email, username } = await creator("stats-off");
    const scripts: Buffer[] = [];
    const sent: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/collect") sent.push(request.url());
    });
    page.on("response", async (response) => {
      if (response.request().resourceType() === "script") scripts.push(await response.body().catch(() => Buffer.alloc(0)));
    });
    const response = await page.goto(`/${username}`);
    await page.waitForLoadState("networkidle");
    expect(sent).toEqual([]);
    expect(scripts.length).toBeGreaterThan(0);
    expect(scripts.filter((body) => body.includes("/api/collect"))).toHaveLength(0);
    expect((await response?.text()) ?? "").not.toContain("/api/collect");
    await expect(page.locator("script[data-beacon]")).toHaveCount(0);

    const answer = await page.evaluate(async (name) => (await fetch("/api/collect", { method: "POST", body: JSON.stringify({ p: name, t: "v", r: "" }) })).status, username);
    expect(answer).toBe(204);
    expect(await rows(id)).toEqual([]);

    // The owner keeps today's honest state.
    await signIn(page, email, "/en/app/analytics");
    await page.waitForURL("**/en/app/analytics");
    await expect(page.getByRole("heading", { name: "Stats are coming soon" })).toBeVisible();
    await expect(page.getByText("Sample data")).toHaveCount(0);
  });
});
