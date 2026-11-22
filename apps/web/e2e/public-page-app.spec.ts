import AxeBuilder from "@axe-core/playwright";
import type { Block, Page as BlocksPage } from "@linkyo/blocks";
import type { Page } from "@playwright/test";

import { toJson } from "../src/lib/supabase/json";
import { createRealAccount, expect, realEnabled, seedMedia, seedPage, service, signIn, test, uniqueName } from "./real";

/**
 * Public creator pages at `/<username>` and going live without demo mode (plan §1.8). The `@real`
 * cases need a build with Supabase settings, the local stack and the real-mode variables; the demo
 * case runs in the regular suite.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const link = (id: string, title: string, extra: Partial<Block> = {}): Block =>
  ({ id, type: "link", title, url: `https://example.com/${id}`, visible: true, highlight: false, ...extra }) as Block;

/** A confirmed, onboarded account with this page; answers its name and id. */
async function publicAccount(prefix: string, locale: "de" | "en" | "ar", profile: Partial<BlocksPage["profile"]> = {}, blocks: Block[] = []) {
  const { username, email } = uniqueName(prefix);
  const account = await createRealAccount({ email, username, locale, onboarded: true, page: seedPage(username, locale, { displayName: "Mira Okafor", ...profile }, blocks) });
  return account;
}

/** The address a Storage picture has inside our own image optimizer's URL. */
const optimized = (url: string) => `/_next/image?url=${encodeURIComponent(url)}`;

/** The public URL answers "not found" (local Storage says HTTP 400 with statusCode "404" in the body). */
async function storageGone(page: Page, url: string): Promise<boolean> {
  const response = await page.request.get(url);
  if (response.status() === 404) return true;
  if (response.ok()) return false;
  const body = (await response.json().catch(() => ({}))) as { statusCode?: string };
  return body.statusCode === "404";
}

test.describe("public creator page @real", () => {
  test.skip(!realEnabled, "Needs the local Supabase stack (E2E_SUPABASE=1).");

  test("serves the page in its language without hidden, scheduled or newsletter blocks @real", async ({ page }) => {
    for (const locale of ["de", "ar"] as const) {
      const later = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
      const { username } = await publicAccount(`pub-${locale}`, locale, {}, [
        link("b-visible", "Visible link text"),
        link("b-hidden", "Hidden link text", { visible: false }),
        link("b-later", "Scheduled link text", { schedule: { from: later } }),
        { id: "b-news", type: "newsletter", title: "Newsletter signup text", visible: true, highlight: false },
      ]);
      const response = await page.goto(`/${username}`);
      expect(response?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      await expect(page.getByText("Visible link text")).toBeVisible();
      // The HTML and the React payload inside it: nothing a visitor may not see is sent at all.
      const html = (await response?.text()) ?? "";
      expect(html).toContain("Visible link text");
      for (const hidden of ["Hidden link text", "Scheduled link text", "Newsletter signup text", "example.com/b-hidden", "example.com/b-later"]) {
        expect(html, hidden).not.toContain(hidden);
      }
      expect(page.url()).toMatch(new RegExp(`/${username}$`));
    }
  });

  test("sets no cookie and loads nothing from another origin @real", async ({ page, context, baseURL }) => {
    const { id, username } = await publicAccount("pub-privacy", "de");
    const { url } = await seedMedia(id);
    const { error } = await service()
      .from("sites")
      .update({ page: toJson(seedPage(username, "de", { displayName: "Mira Okafor", avatar: { src: url, alt: "Mira" } }, [link("l1", "One link")])) })
      .eq("profile_id", id);
    expect(error).toBeNull();
    const origins = new Set<string>();
    const cookieHeaders: string[] = [];
    page.on("request", (request) => {
      if (/^https?:/.test(request.url())) origins.add(new URL(request.url()).origin);
    });
    page.on("response", async (response) => {
      const header = (await response.allHeaders())["set-cookie"];
      if (header) cookieHeaders.push(`${response.url()}: ${header}`);
    });
    await page.goto(`/${username}`);
    await page.waitForLoadState("networkidle");
    // The portrait (wide screens also draw it blurred behind the column, hidden on phones).
    await expect(page.locator(`img[src*="${encodeURIComponent(url)}"]`).locator("visible=true").first()).toBeVisible();
    expect([...origins]).toEqual([new URL(baseURL ?? "").origin]);
    expect(cookieHeaders).toEqual([]);
    expect(await context.cookies()).toEqual([]);
  });

  test("unknown names are a 404 in the page's frame, product routes still work @real", async ({ page }) => {
    const unknown = uniqueName("nobody").username;
    const response = await page.goto(`/${unknown}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Diese Seite gibt es nicht" })).toBeVisible();
    // A product route is never taken for a name: it gets its language (the browser's) as before.
    const templates = await page.goto("/templates");
    expect(templates?.status()).toBe(200);
    expect(page.url()).toMatch(/\/(de|en|ar)\/templates$/);
  });

  test("has a link preview image and its canonical address on linkyo.app @real", async ({ page }) => {
    const { username } = await publicAccount("pub-og", "en", { tagline: "Producer · Lagos" });
    await page.goto(`/${username}`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://linkyo.app/${username}`);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", new RegExp(`/u/${username}/opengraph-image`));
    const image = await page.request.get(`/u/${username}/opengraph-image`);
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toBe("image/png");
  });

  test("marks AI-written blocks and AI-written profile texts @real", async ({ page }) => {
    const withBlock = await publicAccount("pub-ai", "en", {}, [link("ai-1", "Written by the AI", { origin: "ai" }), link("me-1", "Written by me")]);
    await page.goto(`/${withBlock.username}`);
    await expect(page.locator('meta[name="ai-generated"]')).toHaveAttribute("content", "partial");
    await expect(page.locator('[data-ai-generated="true"]').filter({ hasText: "Written by the AI" })).toHaveCount(1);
    await expect(page.locator('[data-ai-generated="true"]').filter({ hasText: "Written by me" })).toHaveCount(0);

    const bioOnly = await publicAccount("pub-aibio", "en", { bio: "A bio the AI wrote.", aiFields: ["bio"] }, [link("me-2", "Mine")]);
    await page.goto(`/${bioOnly.username}`);
    await expect(page.locator('meta[name="ai-generated"]')).toHaveAttribute("content", "partial");
    await expect(page.locator('p[data-ai-generated="true"]', { hasText: "A bio the AI wrote." })).toHaveCount(1);
    await expect(page.locator('h1[data-ai-generated="true"]')).toHaveCount(0);

    const human = await publicAccount("pub-human", "en", {}, [link("me-3", "Mine")]);
    await page.goto(`/${human.username}`);
    await expect(page.locator('meta[name="ai-generated"]')).toHaveCount(0);
  });

  test("a photo uploaded in the editor goes to Storage and reaches the page through our optimizer @real", async ({ page }) => {
    const { id, email, username } = await publicAccount("pub-photo", "en");
    await signIn(page, email, "/en/app/editor");
    await page.waitForURL("**/en/app/editor");
    await page.getByRole("button", { name: "Edit profile" }).first().click();
    const sheet = page.getByRole("dialog", { name: "Profile" });
    const chooser = page.waitForEvent("filechooser");
    await sheet.getByRole("button", { name: "Upload Profile photo" }).click();
    await (await chooser).setFiles("src/assets/samples/mila-avatar.jpg");
    await expect(sheet.getByRole("button", { name: "Replace Profile photo" })).toBeVisible({ timeout: 15_000 });
    await sheet.getByRole("button", { name: "Save profile" }).locator("visible=true").first().click();
    const stored = new RegExp(`/storage/v1/object/public/media/${id}/\\d{4}/[0-9a-f-]{36}\\.jpg$`);
    let src = "";
    await expect
      .poll(async () => {
        const { data } = await service().from("sites").select("page").eq("profile_id", id).single();
        src = (data?.page as { profile?: { avatar?: { src?: string } } } | null)?.profile?.avatar?.src ?? "";
        return src;
      }, { timeout: 20_000 })
      .toMatch(stored);
    await page.goto(`/${username}`);
    const picture = page.locator(`img[src*="${encodeURIComponent(src)}"]`).locator("visible=true").first();
    await expect(picture).toBeVisible();
    expect(await picture.getAttribute("src")).toContain(optimized(src));
  });

  test("real-mode Analytics shows the empty state and Add offers no newsletter @real", async ({ page }) => {
    const { email } = await publicAccount("pub-honest", "en");
    await signIn(page, email, "/en/app/analytics");
    await page.waitForURL("**/en/app/analytics");
    await expect(page.getByRole("heading", { name: "Stats are coming soon" })).toBeVisible();
    await expect(page.getByText("Sample data")).toHaveCount(0);
    await page.goto("/en/app/editor");
    await page.getByRole("button", { name: "Add", exact: true }).first().click();
    const sheet = page.getByRole("dialog", { name: "Add to your page" });
    await expect(sheet.getByRole("button", { name: /Link/ }).first()).toBeVisible();
    await expect(sheet.getByRole("button", { name: /Newsletter/ })).toHaveCount(0);
  });

  test("real-mode Home shows no sample numbers @real", async ({ page }) => {
    // Home's "This week" switches to statsSource() with WP4 (home-screen.tsx belongs to WP4).
    test.fixme(true, "Enable once WP4's home-screen.tsx uses statsSource().");
    const { email } = await publicAccount("pub-home", "en");
    await signIn(page, email, "/en/app");
    await page.waitForURL("**/en/app");
    await expect(page.getByText("Sample data")).toHaveCount(0);
  });

  test("the demo team code does not open the team area with real accounts @real", async ({ page }) => {
    const response = await page.request.post("/api/admin/verify", { data: { code: "linkyo-team-4827" } });
    expect(response.status()).toBe(403);
  });

  test("deleting the account removes its pictures from Storage @real", async ({ page }) => {
    const { id, email, username } = await publicAccount("pub-delete", "en");
    const { url } = await seedMedia(id);
    expect((await page.request.get(url)).status()).toBe(200);
    await signIn(page, email, "/en/app/settings/account");
    await page.waitForURL("**/en/app/settings/account");
    await page.getByRole("button", { name: "Delete account" }).click();
    const confirm = page.getByRole("alertdialog", { name: "Delete your account?" });
    await confirm.getByLabel(`Type ${username} to confirm`).fill(username);
    await confirm.getByRole("button", { name: "Delete for good" }).click();
    await expect.poll(async () => (await service().from("profiles").select("id").eq("id", id)).data?.length ?? -1, { timeout: 15_000 }).toBe(0);
    await expect.poll(() => storageGone(page, url), { timeout: 15_000 }).toBe(true);
  });

  test("the storage purge route drains its queue and is hidden without its secret @real", async ({ page }) => {
    const { id } = await publicAccount("pub-purge", "en");
    const order = crypto.randomUUID();
    const { path } = await seedMedia(id, { bucket: "briefing", folder: order });
    const { error } = await service().from("storage_purge").insert({ bucket: "briefing", prefix: `${id}/${order}/` });
    expect(error).toBeNull();
    expect((await page.request.post("/api/maintenance/storage-purge")).status()).toBe(404);
    expect((await page.request.post("/api/maintenance/storage-purge", { headers: { Authorization: "Bearer wrong" } })).status()).toBe(404);
    const drained = await page.request.post("/api/maintenance/storage-purge", { headers: { Authorization: `Bearer ${process.env.MAINTENANCE_SECRET ?? ""}` } });
    expect(drained.status()).toBe(200);
    expect(((await drained.json()) as { removed: number }).removed).toBeGreaterThanOrEqual(1);
    const { data } = await service().storage.from("briefing").list(`${id}/${order}`);
    expect((data ?? []).map((entry) => entry.name)).not.toContain(path.split("/").at(-1));
    const left = await service().from("storage_purge").select("id").eq("prefix", `${id}/${order}/`);
    expect(left.data).toEqual([]);
  });

  test("the real homepage promises no analytics, and a creator page has no axe violations @real", async ({ page }) => {
    await page.goto("/de");
    const description = await page.locator('meta[name="description"]').getAttribute("content");
    expect(description).toBeTruthy();
    expect(description).not.toMatch(/analytics/i);
    const { username } = await publicAccount("pub-axe", "ar", { tagline: "مدرّبة لياقة · دبي", bio: "تمارين قصيرة كل صباح." }, [link("a1", "احجز جلسة"), link("a2", "قناتي")]);
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await page.goto(`/${username}`);
      await page.waitForLoadState("load");
      const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× — ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    }
  });
});

test.describe("public creator page in a demo build", () => {
  test.skip(realEnabled, "Demo build only (no Supabase settings).");

  test("/u/<name> answers 404 and /<name> behaves as before", async ({ page }) => {
    const internal = await page.goto("/u/mila");
    expect(internal?.status()).toBe(404);
    const bare = await page.goto("/mila");
    // As before: next-intl adds the language, and an unknown first segment is the 404 page.
    expect(bare?.status()).toBe(404);
    expect(page.url()).toMatch(/\/de\/mila$/);
  });
});
