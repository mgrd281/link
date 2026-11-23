import AxeBuilder from "@axe-core/playwright";
import type { Block, Page as BlocksPage } from "@linkyo/blocks";
import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/lib/supabase/database.types";
import { toJson } from "../src/lib/supabase/json";
import { addTeamMember, createRealAccount, expect, realEnabled, seedMedia, seedPage, service, signIn, test, uniqueName } from "./real";

/**
 * Public creator pages at `/<username>` and going live without demo mode (plan §1.8). The `@real`
 * cases need a build with Supabase settings, the local stack and the real-mode variables; the demo
 * case runs in the regular suite.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
// The local stack's publishable key (public by design) unless the run names another.
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const link =(id: string, title: string, extra: Partial<Block> = {}): Block =>
  ({ id, type: "link", title, url: `https://example.com/${id}`, visible: true, highlight: false, ...extra }) as Block;

/** A confirmed, onboarded account with this page; answers its name and id. */
async function publicAccount(prefix: string, locale: "de" | "en" | "ar", profile: Partial<BlocksPage["profile"]> = {}, blocks: Block[] = []) {
  const { username, email } = uniqueName(prefix);
  const account = await createRealAccount({ email, username, locale, onboarded: true, page: seedPage(username, locale, { displayName: "Mira Okafor", ...profile }, blocks) });
  return account;
}

/** An access token for API calls as this account (a magic-link token verified directly). */
async function tokenFor(email: string): Promise<string> {
  const { data, error } = await service().auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(error.message);
  const anon = createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const verified = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
  if (verified.error || !verified.data.session) throw new Error(verified.error?.message ?? "no session");
  return verified.data.session.access_token;
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

// ─── Project pages at /<username>/<slug> (plan §1.5) ──────────────────────────────────────────

/** A project with more to read than its card (a story part), so it has a page of its own. */
const project = (id: string, slug: string, title: string, extra: Record<string, unknown> = {}): Block =>
  ({ id, type: "project", slug, title, summary: `${title}: one sentence.`, story: { problem: `Why ${title} was needed.` }, visible: true, highlight: false, ...extra });

/** The HTML of an address and its React Server Components payload (what a client navigation fetches). */
async function served(page: Page, path: string): Promise<{ status: number; html: string; rsc: string }> {
  const response = await page.request.get(path, { maxRedirects: 0 });
  const rsc = await page.request.get(path, { maxRedirects: 0, headers: { RSC: "1" } });
  return { status: response.status(), html: await response.text(), rsc: await rsc.text() };
}

test.describe("project pages @real", () => {
  test.skip(!realEnabled, "Needs the local Supabase stack (E2E_SUPABASE=1).");

  test("/<username>/<slug> renders in the page's language with no cookie and nothing from another origin @real", async ({ page, context, baseURL }) => {
    const { username } = await publicAccount("prj-ar", "ar", { displayName: "نايا الدباس" }, [project("p1", "masar", "تطبيق Masar للتوصيل", { year: { from: 2024, to: 2025 } })]);
    const origins = new Set<string>();
    const cookieHeaders: string[] = [];
    page.on("request", (request) => {
      if (/^https?:/.test(request.url())) origins.add(new URL(request.url()).origin);
    });
    page.on("response", async (response) => {
      const header = (await response.allHeaders())["set-cookie"];
      if (header) cookieHeaders.push(`${response.url()}: ${header}`);
    });
    // The portfolio's card leads to the project's own address.
    expect((await page.goto(`/${username}`))?.status()).toBe(200);
    await expect(page.locator(`a[href="/${username}/masar"]`).first()).toBeAttached();
    const response = await page.goto(`/${username}/masar`);
    expect(response?.status()).toBe(200);
    await page.waitForLoadState("networkidle");
    expect(page.url()).toMatch(new RegExp(`/${username}/masar$`));
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("h1")).toHaveText("تطبيق Masar للتوصيل");
    await expect(page).toHaveTitle("تطبيق Masar للتوصيل · نايا الدباس");
    // The way back leads to the card on the page.
    await expect(page.locator("[data-project-bar] a").first()).toHaveAttribute("href", `/${username}#masar`);
    expect([...origins]).toEqual([new URL(baseURL ?? "").origin]);
    expect(cookieHeaders).toEqual([]);
    expect(await context.cookies()).toEqual([]);
    // Capital letters lead to the lowercase address.
    const upper = await page.request.get(`/${username.toUpperCase()}/Masar`, { maxRedirects: 0 });
    expect(upper.status()).toBe(308);
    expect(upper.headers().location).toMatch(new RegExp(`/${username}/masar$`));
  });

  test("hidden and scheduled-out projects answer 404 and are absent from the portfolio's HTML and RSC payload @real", async ({ page }) => {
    const later = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const { username } = await publicAccount("prj-hidden", "de", {}, [
      project("p1", "sichtbar", "Sichtbares Projekt"),
      project("p2", "versteckt", "Verstecktes Projekt", { visible: false }),
      project("p3", "spaeter", "Spaeteres Projekt", { schedule: { from: later } }),
    ]);
    const portfolio = await served(page, `/${username}`);
    expect(portfolio.status).toBe(200);
    expect(portfolio.html).toContain("Sichtbares Projekt");
    for (const hidden of ["Verstecktes Projekt", "Spaeteres Projekt", "versteckt", "spaeter"]) {
      expect(portfolio.html, hidden).not.toContain(hidden);
      expect(portfolio.rsc, hidden).not.toContain(hidden);
    }
    for (const slug of ["versteckt", "spaeter", "gibt-es-nicht"]) {
      const response = await page.goto(`/${username}/${slug}`);
      expect(response?.status(), slug).toBe(404);
      // The way back to the page.
      await expect(page.locator("[data-project-back]")).toHaveAttribute("href", `/${username}`);
    }
  });

  test("an earlier address answers 307 to exactly /<username>/<slug>; a slug stored twice serves the first project @real", async ({ page }) => {
    const { username } = await publicAccount("prj-moved", "en", {}, [
      project("p1", "tidewatch", "Tidewatch", { was: ["tide-old", "tide-older"] }),
      project("p2", "tidewatch", "Second with the same address"),
    ]);
    for (const old of ["tide-old", "tide-older"]) {
      const moved = await page.request.get(`/${username}/${old}`, { maxRedirects: 0 });
      expect(moved.status(), old).toBe(307);
      // Exactly the public address, never /u/…. (Next.js repeats the header on the first, uncached
      // answer; every copy is the same address, which browsers accept.)
      const locations = moved.headersArray().filter((header) => header.name.toLowerCase() === "location");
      expect(locations.length, old).toBeGreaterThan(0);
      for (const header of locations) expect(header.value, old).toBe(`/${username}/tidewatch`);
    }
    await page.goto(`/${username}/tide-old`);
    expect(page.url()).toMatch(new RegExp(`/${username}/tidewatch$`));
    await page.goto(`/${username}/tidewatch`);
    await expect(page.locator("h1")).toHaveText("Tidewatch");
  });

  test("a confidential client's name never reaches a visitor @real", async ({ page }) => {
    const name = "Hafenbetrieb Nordwerft";
    // As the editor saves it: "Confidential" switched on clears the name, so the database has none.
    const saved = await publicAccount("prj-conf", "de", {}, [project("p1", "leitsystem", "Leitsystem", { confidential: true })]);
    const { data: answer } = await service().rpc("public_page", { handle: saved.username });
    expect(JSON.stringify(answer)).toContain("Leitsystem");
    expect(JSON.stringify(answer)).not.toContain('"client"');
    const shown = await served(page, `/${saved.username}/leitsystem`);
    expect(shown.status).toBe(200);
    expect(shown.html).toContain("Vertraulich");
    // A row written by hand with both fails closed: the block does not parse, so it is not shown at all,
    // not on its own page, the portfolio, the JSON-LD in either, or the link preview.
    const forged = await publicAccount("prj-forged", "de", {}, [project("p1", "werft", "Werft", { confidential: true, client: name }), project("p2", "offen", "Offen")]);
    for (const path of [`/${forged.username}`, `/${forged.username}/werft`, `/${forged.username}/offen`]) {
      const { html, rsc } = await served(page, path);
      expect(html, path).not.toContain(name);
      expect(rsc, path).not.toContain(name);
    }
    expect((await page.request.get(`/${forged.username}/werft`)).status()).toBe(404);
    expect((await page.request.get(`/u/${forged.username}/werft/opengraph-image`)).status()).toBe(404);
    // The project page's structured data never names a client, confidential or not.
    const open = await publicAccount("prj-client", "de", {}, [project("p1", "kunde", "Kunde", { client: name })]);
    const { html } = await served(page, `/${open.username}/kunde`);
    const ld = /<script type="application\/ld\+json">([^<]*)<\/script>/.exec(html)?.[1] ?? "";
    expect(ld).toContain("CreativeWork");
    expect(ld).not.toContain(name);
  });

  test("has its canonical address on the creator domain and a link preview image @real", async ({ page }) => {
    const { username } = await publicAccount("prj-og", "en", {}, [project("p1", "harbour-light", "Harbour light", { results: [{ value: "9 → 3", label: "weeks to wait" }] })]);
    await page.goto(`/${username}/harbour-light`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://linkyo.app/${username}/harbour-light`);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "article");
    const og = await page.locator('meta[property="og:image"]').first().getAttribute("content");
    expect(og).toMatch(new RegExp(`/u/${username}/harbour-light/opengraph-image`));
    const image = await page.request.get(new URL(og ?? "").pathname);
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toBe("image/png");
    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });

  test("suspending or deleting an account drops its project pages and their previews at once @real", async ({ page }) => {
    const owner = await publicAccount("prj-gone", "de", {}, [project("p1", "werkhalle", "Werkhalle", { was: ["halle-alt"] })]);
    const team = uniqueName("prj-team");
    await createRealAccount({ ...team, locale: "de", onboarded: true });
    await addTeamMember(team.email, "admin");
    const teamToken = await tokenFor(team.email);
    const status = async (path: string) => (await page.request.get(path, { maxRedirects: 0 })).status();
    const visit = async (name: string) => ({
      page: await status(`/${name}/werkhalle`),
      preview: await status(`/u/${name}/werkhalle/opengraph-image`),
      earlier: await status(`/${name}/halle-alt`),
    });
    const shown = { page: 200, preview: 200, earlier: 307 };
    const gone = { page: 404, preview: 404, earlier: 404 };
    // Visited twice: the second answers come from the cache.
    await visit(owner.username);
    expect(await visit(owner.username)).toEqual(shown);
    const setStatus = (next: string) => page.request.post(`/api/admin/customers/${owner.id}/status`, { headers: { Authorization: `Bearer ${teamToken}` }, data: { next } });
    expect((await setStatus("suspended")).status()).toBe(200);
    expect(await visit(owner.username)).toEqual(gone);
    expect((await setStatus("active")).status()).toBe(200);
    expect(await visit(owner.username)).toEqual(shown);
    // The owner deletes the account: gone on the very next visit, too.
    const deleted = await page.request.post("/api/account/delete", { headers: { Authorization: `Bearer ${await tokenFor(owner.email)}` } });
    expect(deleted.status()).toBe(200);
    expect(await visit(owner.username)).toEqual(gone);

    // The control: the same deletion behind the app's back (no route that drops the cached copies)
    // leaves the old project page and its preview up. That is what the routes above prevent.
    const other = await publicAccount("prj-stale", "de", {}, [project("p1", "werkhalle", "Werkhalle", { was: ["halle-alt"] })]);
    expect(await visit(other.username)).toEqual(shown);
    expect((await service().auth.admin.deleteUser(other.id)).error).toBeNull();
    expect(await visit(other.username)).toEqual(shown);
  });
});

test.describe("public creator page in a demo build", () => {
  test.skip(realEnabled, "Demo build only (no Supabase settings).");

  test("/<name>/<project> is not a creator address without real accounts", async ({ page }) => {
    expect((await page.goto("/u/mila/hafenlicht"))?.status()).toBe(404);
    const bare = await page.goto("/mila/hafenlicht");
    expect(bare?.status()).toBe(404);
    expect(page.url()).toMatch(/\/(de|en|ar)\/mila\/hafenlicht$/);
  });

  test("/u/<name> answers 404 and /<name> behaves as before", async ({ page }) => {
    const internal = await page.goto("/u/mila");
    expect(internal?.status()).toBe(404);
    const bare = await page.goto("/mila");
    // As before: next-intl adds the language (the browser's), and an unknown first segment is the 404 page.
    expect(bare?.status()).toBe(404);
    expect(page.url()).toMatch(/\/(de|en|ar)\/mila$/);
  });
});
