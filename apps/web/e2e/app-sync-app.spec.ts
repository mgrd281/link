import { randomUUID } from "node:crypto";

import type { Block } from "@linkyo/blocks";
import type { Browser, Page, TestInfo } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import de from "../src/messages/de.json" with { type: "json" };
import type { Database } from "../src/lib/supabase/database.types";
import { createRealAccount, expect, realEnabled, seedPage, service, signIn, test, uniqueName, type RealAccount } from "./real";

/**
 * The web side of the iPhone app, against real accounts (ADR 0088): the app's session
 * handed to its web view (/api/auth/handoff), the page operations route (/api/app/page) and the save
 * guard that keeps a stale copy (another tab, the web view while the app wrote) from overwriting a
 * newer page. Needs a build with Supabase settings, the local stack and the real-mode variables.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
// The local stack's publishable key (public by design) unless the run names another.
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
/** The app's own device id, as its Keychain keeps it. */
const DEVICE = "dev_0a99c0ffee12";
const CONFLICT = de.app.sync.conflict.title;

const link = (id: string, title: string): Block => ({ id, type: "link", title, url: `https://example.com/${id}`, visible: true, highlight: false });
const BLOCKS = [link("first", "Erster Link"), link("second", "Zweiter Link"), link("third", "Dritter Link")];

/** A confirmed, onboarded account with three links. */
async function syncAccount(prefix: string): Promise<RealAccount> {
  const { username, email } = uniqueName(prefix);
  return createRealAccount({ email, username, locale: "de", onboarded: true, page: seedPage(username, "de", { displayName: "Mira Okafor" }, BLOCKS) });
}

/** The native app's own session: a magic-link token verified directly, as the app's sign-in answers it. */
async function appToken(email: string): Promise<string> {
  const { data, error } = await service().auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(error.message);
  const anon = createClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const verified = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
  if (verified.error || !verified.data.session) throw new Error(verified.error?.message ?? "no session");
  return verified.data.session.access_token;
}

async function stored(id: string): Promise<{ blocks: Block[]; updatedAt: string }> {
  const { data, error } = await service().from("sites").select("page, updated_at").eq("profile_id", id).single();
  if (error) throw new Error(error.message);
  return { blocks: (data.page as { blocks: Block[] }).blocks, updatedAt: data.updated_at };
}
const shown = async (id: string, block: string) => (await stored(id)).blocks.find((candidate) => candidate.id === block)?.visible;

/** The page editor's visibility switch of a block. */
const visibility = (page: Page, title: string) => page.getByRole("switch", { name: de.app.editor.visible.replace("{title}", title) });

/** Counts every time the conflict toast appears in this page, from its first script on. */
async function watchConflicts(page: Page) {
  await page.addInitScript((title: string) => {
    const seen = window as unknown as { conflictToasts: number };
    seen.conflictToasts = 0;
    let showing = false;
    // Only a toast (a list item): the page's own message catalogue also carries the words.
    new MutationObserver(() => {
      const now = Array.from(document.querySelectorAll("li")).some((item) => item.textContent.includes(title));
      if (now && !showing) seen.conflictToasts += 1;
      showing = now;
    }).observe(document, { subtree: true, childList: true, characterData: true });
  }, CONFLICT);
}
const conflictToasts = (page: Page) => page.evaluate(() => (window as unknown as { conflictToasts: number }).conflictToasts);

/**
 * The page as the iPhone app shows it: the native shell marks <html> and puts its object on window
 * before the first paint, and WebKit's message handler records what the page tells the app.
 */
async function asTheApp(page: Page) {
  await page.addInitScript(() => {
    const messages: unknown[] = [];
    Object.assign(window, {
      linkyoApp: { platform: "ios", version: "1.0", bridge: 1 },
      appMessages: messages,
      webkit: { messageHandlers: { linkyo: { postMessage: (message: unknown) => messages.push(message) } } },
    });
    // WebKit runs a document-start script once <html> exists; Chromium runs this one before it does.
    const mark = () => {
      const root = document.documentElement as HTMLElement | null;
      if (!root) return false;
      root.dataset.app = "ios";
      return true;
    };
    if (!mark()) {
      const watch = new MutationObserver(() => {
        if (mark()) watch.disconnect();
      });
      watch.observe(document, { childList: true });
    }
  });
}
interface AppMessage {
  type: string;
  state?: string;
  updatedAt?: string | null;
}
const appMessages = (page: Page) => page.evaluate(() => (window as unknown as { appMessages: AppMessage[] }).appMessages);
const callApp = (page: Page, method: "flush" | "reload" | "signOut") =>
  page.evaluate(async (name) => {
    const app = (window as unknown as { linkyoApp: Record<string, () => Promise<unknown>> }).linkyoApp;
    const answer = await app[name]?.();
    return answer ?? null;
  }, method);

/**
 * A slow network back: the next page save reaches the database at once, but its answer is held for
 * `ms`. `sent` counts the saves held (one at most).
 */
async function holdNextSave(page: Page, ms: number) {
  const held = { sent: 0 };
  await page.route(
    (url) => url.pathname.endsWith("/rest/v1/sites"),
    async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.continue();
        return;
      }
      held.sent += 1;
      const response = await route.fetch();
      await new Promise((resolve) => setTimeout(resolve, ms));
      // The page may be gone by now (closed): nobody is left to read the answer.
      await route.fulfill({ response }).catch(() => undefined);
    },
    { times: 1 },
  );
  return held;
}

/**
 * A slow network on the way there: the next page save waits `ms` before it leaves the browser, so it
 * is still on its way meanwhile. `sent` counts the saves held (one at most).
 */
async function delayNextSave(page: Page, ms: number) {
  const held = { sent: 0 };
  await page.route(
    (url) => url.pathname.endsWith("/rest/v1/sites"),
    async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.continue();
        return;
      }
      held.sent += 1;
      await new Promise((resolve) => setTimeout(resolve, ms));
      await route.continue().catch(() => undefined);
    },
    { times: 1 },
  );
  return held;
}

/** The tab is hidden (a tab switch, another app on a phone) or shown again; the page keeps running. */
const setHidden = (page: Page, hidden: boolean) =>
  page.evaluate((value) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (value ? "hidden" : "visible") });
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
  }, hidden);

/** A second browser for the same account, with this project's screen. */
async function secondBrowser(browser: Browser, info: TestInfo, baseURL: string | undefined) {
  const { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor } = info.project.use;
  const context = await browser.newContext({
    reducedMotion: "reduce",
    ...(baseURL ? { baseURL } : {}),
    ...(viewport ? { viewport } : {}),
    ...(userAgent ? { userAgent } : {}),
    ...(isMobile ? { isMobile } : {}),
    ...(hasTouch ? { hasTouch } : {}),
    ...(deviceScaleFactor ? { deviceScaleFactor } : {}),
  });
  return { context, page: await context.newPage() };
}

test.describe("the iPhone app's web side @real", () => {
  test.skip(!realEnabled, "Needs the local Supabase stack (E2E_SUPABASE=1).");
  test.use({ reducedMotion: "reduce" });

  test("hand-off: the app's Bearer token opens /de/app signed in in a fresh browser, logged under the app's device id @real", async ({ page, browser, baseURL }, info) => {
    const account = await syncAccount("sync-handoff");
    const token = await appToken(account.email);
    const bearer = { authorization: `Bearer ${token}` };
    expect((await page.request.post("/api/auth/handoff", { data: { deviceId: DEVICE } })).status()).toBe(401);
    expect((await page.request.post("/api/auth/handoff", { headers: bearer, data: { deviceId: "dev_email_link" } })).status()).toBe(422);
    const response = await page.request.post("/api/auth/handoff", { headers: bearer, data: { deviceId: DEVICE } });
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toBe("no-store");
    const { url } = (await response.json()) as { url: string };
    expect(url).toMatch(/^\/api\/auth\/confirm\?/);

    // The web view: a browser that has never seen this account.
    const web = await secondBrowser(browser, info, baseURL);
    await web.page.goto(url);
    await web.page.waitForURL("**/de/app");
    await expect(web.page.locator("main")).toBeVisible();
    expect(web.page.url()).toMatch(/\/de\/app$/);
    expect((await web.context.cookies()).some((cookie) => cookie.name.includes("-auth-token"))).toBe(true);
    // A browser is not the app: nothing of the bridge is installed.
    expect(await web.page.evaluate(() => "linkyoApp" in window)).toBe(false);
    // The security log names the app's device, so "Sign out device" ends both of its sessions.
    const { data: rows } = await service().from("sign_ins").select("device_id, result, session_id").eq("profile_id", account.id).order("at", { ascending: false }).limit(1);
    expect(rows?.[0]).toMatchObject({ device_id: DEVICE, result: "success" });
    expect(rows?.[0]?.session_id).toBeTruthy();
    // The link works once.
    const again = await secondBrowser(browser, info, baseURL);
    await again.page.goto(url);
    await again.page.waitForURL("**/de/login?link=expired");
    await Promise.all([web.context.close(), again.context.close()]);
  });

  test("hand-off: a suspended account gets no link, and no session from a link it already has @real", async ({ page }) => {
    const account = await syncAccount("sync-suspended");
    const token = await appToken(account.email);
    // A link made while the account was still active (an e-mailed one, or a hand-off link not yet opened).
    const { data: link } = await service().auth.admin.generateLink({ type: "magiclink", email: account.email });
    const { error } = await service().from("profiles").update({ status: "suspended" }).eq("id", account.id);
    expect(error).toBeNull();
    const response = await page.request.post("/api/auth/handoff", { headers: { authorization: `Bearer ${token}` }, data: { deviceId: DEVICE } });
    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({ ok: false, error: "suspended" });

    // The confirm route refuses it as the code and password sign-ins do, with their words.
    await page.goto(`/api/auth/confirm?${new URLSearchParams({ token_hash: link.properties?.hashed_token ?? "", type: "magiclink", next: "/de/app", device: DEVICE }).toString()}`);
    await page.waitForURL("**/de/login?link=suspended");
    await expect(page.getByText(de.auth.errors.suspended, { exact: true })).toBeVisible();
    expect((await page.context().cookies()).some((cookie) => cookie.name.includes("-auth-token"))).toBe(false);
    const { data: rows } = await service().from("sign_ins").select("device_id, result").eq("profile_id", account.id).order("at", { ascending: false }).limit(1);
    expect(rows?.[0]).toMatchObject({ device_id: DEVICE, result: "failed" });
    await page.goto("/de/app");
    await page.waitForURL("**/de/login**");
  });

  test("operations: add, move and remove change the public page at once, and a stale version is refused @real", async ({ page }) => {
    const account = await syncAccount("sync-ops");
    // A visitor first: the public page is now cached.
    const before = await page.goto(`/${account.username}`);
    expect(before?.status()).toBe(200);
    await expect(page.getByText("Erster Link")).toBeVisible();

    const token = await appToken(account.email);
    const { updatedAt: base } = await stored(account.id);
    const response = await page.request.post("/api/app/page", {
      headers: { authorization: `Bearer ${token}` },
      data: { baseUpdatedAt: base, ops: [{ op: "add", url: "https://example.org/app-sync?utm_source=app" }, { op: "move", id: "third", to: 0 }, { op: "remove", id: "first" }] },
    });
    expect(response.status()).toBe(200);
    const answer = (await response.json()) as { ok: boolean; updatedAt: string; changed: string[]; added: string[] };
    const now = await stored(account.id);
    expect(answer).toMatchObject({ ok: true, updatedAt: now.updatedAt });
    expect(answer.changed).toEqual([answer.added[0], "third", "first"]);
    expect(now.blocks.map((block) => block.id)).toEqual(["third", answer.added[0], "second"]);
    expect(now.blocks[1]).toMatchObject({ type: "card", url: "https://example.org/app-sync" });

    // The visitor's next look shows the change (the route dropped the cached page).
    const after = await page.goto(`/${account.username}`);
    const html = (await after?.text()) ?? "";
    expect(html).toContain("https://example.org/app-sync");
    expect(html).not.toContain("Erster Link");
    expect(html.indexOf("Dritter Link")).toBeGreaterThan(-1);
    expect(html.indexOf("Dritter Link")).toBeLessThan(html.indexOf("Zweiter Link"));

    // The version the app saw is gone now: nothing is written, the current one is answered.
    const stale = await page.request.post("/api/app/page", { headers: { authorization: `Bearer ${token}` }, data: { baseUpdatedAt: base, ops: [{ op: "remove", id: "second" }] } });
    expect(stale.status()).toBe(409);
    expect(await stale.json()).toEqual({ ok: false, error: "conflict", updatedAt: now.updatedAt });
    expect((await stored(account.id)).blocks).toHaveLength(3);
  });

  test("bridge: in the app, flush() answers the saved version, the route writes on it, reload() shows it without a toast, signOut() ends the session @real", async ({ page }) => {
    const account = await syncAccount("sync-bridge");
    await asTheApp(page);
    await watchConflicts(page);
    await signIn(page, account.email, "/de/app/editor");
    await expect(visibility(page, "Erster Link")).toBeChecked();
    // The order the app relies on (ADR 0087 decision 4): nothing before ready, then the screen, then the
    // save state. Before, route and saveState reached the app ahead of ready on every cold load.
    await expect.poll(async () => (await appMessages(page)).slice(0, 3).map((message) => message.type)).toEqual(["ready", "route", "saveState"]);
    const opening = await appMessages(page);
    expect(opening[0]).toEqual({ type: "ready", bridge: 1, signedIn: true, accountId: account.id });
    expect(opening[1]).toEqual({ type: "route", path: "/de/app/editor", title: de.app.nav.page, back: null });
    expect(opening[2]).toEqual({ type: "saveState", state: "saved", updatedAt: (await stored(account.id)).updatedAt });

    // A change the editor has not even handed to the store yet: flush() saves it and answers the new version.
    await visibility(page, "Erster Link").click();
    const flushed = (await callApp(page, "flush")) as { updatedAt: string };
    const afterFlush = await stored(account.id);
    expect(flushed.updatedAt).toBe(afterFlush.updatedAt);
    expect(afterFlush.blocks[0]?.visible).toBe(false);

    // The native write builds on that version, then the web view reads the page again.
    const token = await appToken(account.email);
    const native = await page.request.post("/api/app/page", { headers: { authorization: `Bearer ${token}` }, data: { baseUpdatedAt: flushed.updatedAt, ops: [{ op: "remove", id: "third" }] } });
    expect(native.status()).toBe(200);
    await callApp(page, "reload");
    await expect(visibility(page, "Dritter Link")).toHaveCount(0);
    await expect(visibility(page, "Erster Link")).not.toBeChecked();
    // The next change in the web view saves over the native write: no conflict, no toast.
    await visibility(page, "Zweiter Link").click();
    await expect.poll(() => shown(account.id, "second"), { timeout: 15_000 }).toBe(false);
    expect((await stored(account.id)).blocks.map((block) => block.id)).toEqual(["first", "second"]);
    expect(await conflictToasts(page)).toBe(0);

    const states = (await appMessages(page)).filter((message) => message.type === "saveState");
    expect(states.map((message) => message.state)).toContain("saving");
    expect(states.at(-1)).toEqual({ type: "saveState", state: "saved", updatedAt: (await stored(account.id)).updatedAt });
    expect(states.some((message) => message.state === "conflict")).toBe(false);

    // Signing out ends the web view's session and tells the app (signedOut); the interface half then says
    // the web view has no session any more (ready, then the screen, ADR 0087), as whenever the session changes.
    const seen = (await appMessages(page)).length;
    await callApp(page, "signOut");
    await expect
      .poll(async () => (await appMessages(page)).slice(seen))
      .toEqual([
        { type: "signedOut" },
        { type: "ready", bridge: 1, signedIn: false, accountId: null },
        { type: "route", path: "/de/app/editor", title: de.app.nav.page, back: null },
      ]);
    await page.goto("/de/app");
    await page.waitForURL("**/de/login**");
  });

  test("bridge: a refused call reaches the app as the bare reason: flush() offline rejects with saveFailed @real", async ({ page }) => {
    // WebKit hands the app the rejection's string form (userInfo[WKJavaScriptExceptionMessage]). Before,
    // it was "Error: saveFailed", which a native switch on ADR 0088's reasons never matched.
    const account = await syncAccount("sync-reason");
    await asTheApp(page);
    await signIn(page, account.email, "/de/app/editor");
    await expect(visibility(page, "Erster Link")).toBeChecked();
    await expect.poll(async () => (await appMessages(page)).map((message) => message.type)).toContain("saveState");
    await page.route(
      (url) => url.pathname.endsWith("/rest/v1/sites"),
      (route) => route.abort("internetdisconnected"),
    );
    await visibility(page, "Erster Link").click();
    const refused = await page.evaluate(async () => {
      const app = (window as unknown as { linkyoApp: { flush: () => Promise<unknown> } }).linkyoApp;
      try {
        await app.flush();
        return null;
      } catch (error) {
        return { asString: String(error), message: error instanceof Error ? error.message : null };
      }
    });
    expect(refused).toEqual({ asString: "saveFailed", message: "saveFailed" });
  });

  test("guard: of two tabs, the stale one's save is refused; it shows the toast and the newest page, the other's change stays @real", async ({ page, browser, baseURL }, info) => {
    const account = await syncAccount("sync-tabs");
    const tabB = await secondBrowser(browser, info, baseURL);
    await signIn(page, account.email, "/de/app/editor");
    await signIn(tabB.page, account.email, "/de/app/editor");
    await expect(visibility(page, "Erster Link")).toBeChecked();
    await expect(visibility(tabB.page, "Erster Link")).toBeChecked();

    // Tab A hides the first link, and it is saved.
    await visibility(page, "Erster Link").click();
    await expect.poll(() => shown(account.id, "first"), { timeout: 15_000 }).toBe(false);

    // Tab B still has the version before: it hides the second link.
    await visibility(tabB.page, "Zweiter Link").click();
    await expect(tabB.page.getByText(CONFLICT, { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(tabB.page.getByText(de.app.sync.conflict.body, { exact: true })).toBeVisible();
    // B now shows the newest page: A's change, not its own.
    await expect(visibility(tabB.page, "Erster Link")).not.toBeChecked();
    await expect(visibility(tabB.page, "Zweiter Link")).toBeChecked();
    // The server kept A's change and never took B's.
    expect(await shown(account.id, "first")).toBe(false);
    expect(await shown(account.id, "second")).toBe(true);
    // B's next change builds on the newest version; A's change is still there.
    await visibility(tabB.page, "Dritter Link").click();
    await expect.poll(() => shown(account.id, "third"), { timeout: 15_000 }).toBe(false);
    expect(await shown(account.id, "first")).toBe(false);
    await tabB.context.close();
  });

  test("guard: the stale tab is hidden while its save is on its way: the other tab's change stays, and it shows the toast and the newest page when it is back @real", async ({ page, browser, baseURL }, info) => {
    // A hidden tab keeps running, so it waits for that save and sends the rest with the exact guard
    // (ADR 0088). Before, it sent `updated_at >= base` at once, which overwrote tab A's newer page.
    const account = await syncAccount("sync-hidden");
    const tabB = await secondBrowser(browser, info, baseURL);
    await watchConflicts(page);
    await watchConflicts(tabB.page);
    await signIn(page, account.email, "/de/app/editor");
    await signIn(tabB.page, account.email, "/de/app/editor");
    await expect(visibility(page, "Erster Link")).toBeChecked();
    await expect(visibility(tabB.page, "Erster Link")).toBeChecked();

    // Tab A hides the first link, and it is saved.
    await visibility(page, "Erster Link").click();
    await expect.poll(() => shown(account.id, "first"), { timeout: 15_000 }).toBe(false);

    // Tab B still has the version before. Its save waits 1 s on the way there; meanwhile another
    // change, and B is hidden while that save is on its way.
    const held = await delayNextSave(tabB.page, 1_000);
    await visibility(tabB.page, "Zweiter Link").click();
    await expect.poll(() => held.sent).toBe(1);
    await visibility(tabB.page, "Dritter Link").click();
    await setHidden(tabB.page, true);
    // B's save is refused (the row is A's version), B reads the newest page and counts the conflict.
    await expect.poll(() => conflictToasts(tabB.page), { timeout: 15_000 }).toBe(1);
    await tabB.page.waitForTimeout(1_000);
    // A's change stays; nothing of B's stale page reached the database.
    expect((await stored(account.id)).blocks.map((block) => block.visible)).toEqual([false, true, true]);

    // B is back: the newest page, with the toast.
    await setHidden(tabB.page, false);
    await expect(visibility(tabB.page, "Erster Link")).not.toBeChecked();
    await expect(visibility(tabB.page, "Zweiter Link")).toBeChecked();
    await expect(visibility(tabB.page, "Dritter Link")).toBeChecked();
    await expect(tabB.page.getByText(CONFLICT, { exact: true })).toBeVisible();
    expect(await conflictToasts(page)).toBe(0);
    expect((await stored(account.id)).blocks.map((block) => block.visible)).toEqual([false, true, true]);
    await tabB.context.close();
  });

  test("guard: after the app changed the page through the route, the open tab's next save is refused the same way @real", async ({ page }) => {
    const account = await syncAccount("sync-native");
    await signIn(page, account.email, "/de/app/editor");
    await expect(visibility(page, "Zweiter Link")).toBeChecked();
    const token = await appToken(account.email);
    const { updatedAt } = await stored(account.id);
    const native = await page.request.post("/api/app/page", { headers: { authorization: `Bearer ${token}` }, data: { baseUpdatedAt: updatedAt, ops: [{ op: "remove", id: "second" }] } });
    expect(native.status()).toBe(200);

    await visibility(page, "Erster Link").click();
    await expect(page.getByText(CONFLICT, { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(visibility(page, "Zweiter Link")).toHaveCount(0);
    await expect(visibility(page, "Erster Link")).toBeChecked();
    const now = await stored(account.id);
    expect(now.blocks.map((block) => [block.id, block.visible])).toEqual([
      ["first", true],
      ["third", true],
    ]);
  });

  test("guard: normal editing in one tab (rapid changes, a reload, the team's badge meanwhile) never shows the toast @real", async ({ page }) => {
    const account = await syncAccount("sync-normal");
    await watchConflicts(page);
    await signIn(page, account.email, "/de/app/editor");
    await expect(visibility(page, "Erster Link")).toBeChecked();
    // Rapid changes on a slow network: the first save's answer takes 3 s, the next changes are made while it is on its way.
    const held = await holdNextSave(page, 3_000);
    await visibility(page, "Erster Link").click();
    await expect.poll(() => held.sent).toBe(1);
    await expect.poll(() => shown(account.id, "first")).toBe(false);
    await visibility(page, "Zweiter Link").click();
    await visibility(page, "Dritter Link").click();
    await visibility(page, "Erster Link").click();
    await expect
      .poll(async () => (await stored(account.id)).blocks.map((block) => block.visible), { timeout: 15_000 })
      .toEqual([true, false, false]);
    await page.reload();
    await expect(visibility(page, "Zweiter Link")).not.toBeChecked();
    // The team gives the page its badge meanwhile (a new version, the same content): not a conflict.
    await service().from("profiles").update({ verified: true }).eq("id", account.id);
    await service().from("sites").update({ onboarded: true }).eq("profile_id", account.id);
    await visibility(page, "Zweiter Link").click();
    await expect.poll(() => shown(account.id, "second"), { timeout: 15_000 }).toBe(true);
    await visibility(page, "Dritter Link").click();
    await expect.poll(() => shown(account.id, "third"), { timeout: 15_000 }).toBe(true);
    expect(await conflictToasts(page)).toBe(0);
    await expect(page.getByText(CONFLICT, { exact: true })).toHaveCount(0);
    const { blocks } = await stored(account.id);
    expect(blocks.map((block) => block.visible)).toEqual([true, true, true]);
  });

  test("guard: a tab closed while its save is on its way keeps the change made meanwhile @real", async ({ page }) => {
    const account = await syncAccount("sync-close");
    await signIn(page, account.email, "/de/app/editor");
    await expect(visibility(page, "Erster Link")).toBeChecked();
    // The first change's save reaches the database; its answer is still on its way back.
    const held = await holdNextSave(page, 4_000);
    await visibility(page, "Erster Link").click();
    await expect.poll(() => held.sent).toBe(1);
    await expect.poll(() => shown(account.id, "first")).toBe(false);
    // The next change, then the tab is closed: only the keepalive save is left to carry it.
    await visibility(page, "Zweiter Link").click();
    await expect(visibility(page, "Zweiter Link")).not.toBeChecked();
    await page.close({ runBeforeUnload: true });
    await expect.poll(() => shown(account.id, "second"), { timeout: 10_000 }).toBe(false);
    const { blocks } = await stored(account.id);
    expect(blocks.map((block) => block.visible)).toEqual([false, false, true]);
  });

  test("guard: a save lands but its answer is lost, three more attempts fail offline, then the network is back: every change is stored, no toast @real", async ({ page }) => {
    // The store tries again 2, 5, 15 and 30 s after failures in a row; the last wait is part of this test.
    test.setTimeout(120_000);
    const account = await syncAccount("sync-offline");
    await watchConflicts(page);
    await signIn(page, account.email, "/de/app/editor");
    await expect(visibility(page, "Erster Link")).toBeChecked();
    const net = { offline: false, landed: 0, failed: 0 };
    await page.route(
      (url) => url.pathname.endsWith("/rest/v1/sites"),
      async (route) => {
        if (net.offline) {
          // Offline: nothing leaves the device (no fetch), every request fails.
          if (route.request().method() === "PATCH") net.failed += 1;
          await route.abort("internetdisconnected");
          return;
        }
        if (route.request().method() !== "PATCH" || net.landed > 0) {
          await route.continue();
          return;
        }
        // The first save reaches the database; the connection drops before its answer comes back.
        net.landed += 1;
        await route.fetch();
        net.offline = true;
        await route.abort("connectionreset");
      },
    );
    await visibility(page, "Erster Link").click();
    await expect.poll(() => shown(account.id, "first")).toBe(false);
    // Three more changes while offline, each one a save attempt that fails.
    await visibility(page, "Zweiter Link").click();
    await expect.poll(() => net.failed).toBeGreaterThanOrEqual(1);
    await visibility(page, "Dritter Link").click();
    await expect.poll(() => net.failed).toBeGreaterThanOrEqual(2);
    await visibility(page, "Dritter Link").click();
    await expect.poll(() => net.failed).toBeGreaterThanOrEqual(3);
    expect((await stored(account.id)).blocks.map((block) => block.visible)).toEqual([false, true, true]);
    // Back online: the store's next try (no further change) stores everything over its own landed save.
    net.offline = false;
    await expect.poll(async () => (await stored(account.id)).blocks.map((block) => block.visible), { timeout: 45_000 }).toEqual([false, false, true]);
    await expect(visibility(page, "Erster Link")).not.toBeChecked();
    await expect(visibility(page, "Zweiter Link")).not.toBeChecked();
    await expect(visibility(page, "Dritter Link")).toBeChecked();
    expect(await conflictToasts(page)).toBe(0);
    await expect(page.getByText(CONFLICT, { exact: true })).toHaveCount(0);
  });

  test("guard: every save reaches the database but its answer is lost on the way back: every change is stored, no toast @real", async ({ page }) => {
    const account = await syncAccount("sync-lossy");
    await watchConflicts(page);
    await signIn(page, account.email, "/de/app/editor");
    await expect(visibility(page, "Erster Link")).toBeChecked();
    const lost = { patches: 0 };
    await page.route(
      (url) => url.pathname.endsWith("/rest/v1/sites"),
      async (route) => {
        if (route.request().method() !== "PATCH") {
          await route.continue();
          return;
        }
        // The write reaches the database (or its guard turns it down); the answer never comes back.
        lost.patches += 1;
        await route.fetch();
        await route.abort("connectionreset");
      },
    );
    const expected = [true, true, true];
    for (const [index, title] of ["Erster Link", "Zweiter Link", "Dritter Link", "Erster Link", "Zweiter Link"].entries()) {
      await visibility(page, title).click();
      const block = ["Erster Link", "Zweiter Link", "Dritter Link"].indexOf(title);
      expected[block] = !expected[block];
      // A change every 650 ms: each save goes out while the earlier ones' answers are lost.
      if (index < 4) await page.waitForTimeout(650);
    }
    await expect.poll(async () => (await stored(account.id)).blocks.map((block) => block.visible), { timeout: 20_000 }).toEqual(expected);
    expect(lost.patches).toBeGreaterThanOrEqual(5);
    expect(await conflictToasts(page)).toBe(0);
    await expect(page.getByText(CONFLICT, { exact: true })).toHaveCount(0);
  });

  test("guard: a save lands but its answer is lost and reads fail; a change, the page is hidden, then the phone ends it with no other event: the change is kept @real", async ({ page }) => {
    // iOS ends a suspended app's web view without a pagehide: the hidden tab's keepalive is the last
    // write it makes. Before, it carried the exact guard against the version before the landed save,
    // so it was refused and the change was lost with the page.
    test.setTimeout(90_000);
    const account = await syncAccount("sync-hiddenkill");
    await signIn(page, account.email, "/de/app/editor");
    await expect(visibility(page, "Erster Link")).toBeChecked();
    const net = { lose: true, readsFail: false, patches: [] as string[] };
    await page.route(
      (url) => url.pathname.endsWith("/rest/v1/sites"),
      async (route) => {
        if (route.request().method() !== "PATCH") {
          if (net.readsFail) await route.abort("connectionreset");
          else await route.continue().catch(() => undefined);
          return;
        }
        net.patches.push(new URL(route.request().url()).searchParams.get("updated_at")?.split(".")[0] ?? "none");
        if (net.lose) {
          // The first save reaches the database; its answer is lost, and reads fail from now on.
          net.lose = false;
          await route.fetch();
          net.readsFail = true;
          await route.abort("connectionreset");
          return;
        }
        await route.continue().catch(() => undefined);
      },
    );
    await visibility(page, "Erster Link").click();
    await expect.poll(() => shown(account.id, "first")).toBe(false);
    await expect.poll(() => net.readsFail).toBe(true);
    // Its read-back fails meanwhile.
    await page.waitForTimeout(1_000);
    await visibility(page, "Zweiter Link").click();
    await expect(visibility(page, "Zweiter Link")).not.toBeChecked();
    const beforeHiding = net.patches.length;
    await setHidden(page, true);
    await page.waitForTimeout(4_000);
    // The phone ends the page: no more code of it runs.
    const cdp = await page.context().newCDPSession(page);
    const ended = page.waitForEvent("crash");
    void cdp.send("Page.crash").catch(() => undefined);
    await ended;
    await expect.poll(async () => (await stored(account.id)).blocks.map((block) => block.visible), { timeout: 10_000 }).toEqual([false, false, true]);
    // The hidden tab's keepalive is the first write after hiding (the editor may save the same page again after it).
    expect(net.patches[beforeHiding]).toBe("gte");
  });

  test("guard: a save lands but its answer is lost and reads fail; a change, hidden, then the phone ends the page 1 s later: the change is kept @real", async ({ page }) => {
    // Expected: the read-back of the lost answer fails at once (one attempt, no retries), so the hidden
    // tab's keepalive goes right away, with the loose guard, and the change is in the row. Before, the
    // client's retries (1, 2, 4 s) held it until the 3 s wait was over: a page ended earlier lost it.
    test.setTimeout(90_000);
    const account = await syncAccount("sync-hiddenkill1");
    await signIn(page, account.email, "/de/app/editor");
    await expect(visibility(page, "Erster Link")).toBeChecked();
    const net = { lose: true, readsFail: false, patches: [] as { guard: string; at: number }[] };
    await page.route(
      (url) => url.pathname.endsWith("/rest/v1/sites"),
      async (route) => {
        if (route.request().method() !== "PATCH") {
          if (net.readsFail) await route.abort("connectionreset");
          else await route.continue().catch(() => undefined);
          return;
        }
        net.patches.push({ guard: new URL(route.request().url()).searchParams.get("updated_at")?.split(".")[0] ?? "none", at: Date.now() });
        if (net.lose) {
          net.lose = false;
          await route.fetch();
          net.readsFail = true;
          await route.abort("connectionreset");
          return;
        }
        await route.continue().catch(() => undefined);
      },
    );
    await visibility(page, "Erster Link").click();
    await expect.poll(() => shown(account.id, "first")).toBe(false);
    await expect.poll(() => net.readsFail).toBe(true);
    await page.waitForTimeout(1_000);
    await visibility(page, "Zweiter Link").click();
    await expect(visibility(page, "Zweiter Link")).not.toBeChecked();
    const hiddenAt = Date.now();
    await setHidden(page, true);
    await page.waitForTimeout(1_000);
    const cdp = await page.context().newCDPSession(page);
    const ended = page.waitForEvent("crash");
    void cdp.send("Page.crash").catch(() => undefined);
    await ended;
    await expect.poll(async () => (await stored(account.id)).blocks.map((block) => block.visible), { timeout: 10_000 }).toEqual([false, false, true]);
    // The hidden tab's keepalive is the first write after hiding (the editor may save the same page again after it).
    const keepalive = net.patches.find((patch) => patch.at >= hiddenAt);
    expect(keepalive?.guard).toBe("gte");
    expect((keepalive?.at ?? Infinity) - hiddenAt).toBeLessThan(1_000);
  });

  test("sign-out: A signs out while its saves fail, B signs in with a password in the same tab, B's app writes, B closes the tab: the app's write stays @real", async ({ page }) => {
    // Expected: A's save state (a change waiting, its lost write) ends with A's session. Before, it
    // carried over to B: B's tab closed with B's own unchanged page and `updated_at >= base`, which
    // overwrote the write B's app had made since B's page loaded.
    test.setTimeout(120_000);
    const a = await syncAccount("sync-switch-a");
    const b = await syncAccount("sync-switch-b");
    const password = `Pw-${randomUUID()}`;
    const { error } = await service().auth.admin.updateUserById(b.id, { password });
    expect(error).toBeNull();
    await signIn(page, a.email, "/de/app/settings");
    const language = page.getByLabel(de.app.settings.rows.pageLanguage);
    await expect(language).toHaveValue("de");
    await page.evaluate(() => {
      (window as unknown as { sameDocument: boolean }).sameDocument = true;
    });
    const net = { lose: true, failAll: false };
    await page.route(
      (url) => url.pathname.endsWith("/rest/v1/sites"),
      async (route) => {
        if (route.request().method() !== "PATCH") {
          if (net.failAll) await route.abort("connectionreset");
          else await route.continue().catch(() => undefined);
          return;
        }
        if (net.lose) {
          // A's save reaches the database; its answer is lost, and every read and write fails from now on.
          net.lose = false;
          await route.fetch();
          net.failAll = true;
          await route.abort("connectionreset");
          return;
        }
        if (net.failAll) await route.abort("connectionreset");
        else await route.continue().catch(() => undefined);
      },
    );
    await language.selectOption("en");
    await expect.poll(() => net.failAll).toBe(true);
    await page.waitForTimeout(1_200);
    const logout = page.getByRole("button", { name: de.app.settings.logout, exact: true });
    await logout.scrollIntoViewIfNeeded();
    await logout.click();
    await page.waitForURL("**/de/login**", { timeout: 30_000 });
    // The network is back; A's retry timer (5 s after its last failure) would have fired meanwhile.
    net.failAll = false;
    await page.waitForTimeout(8_000);
    await page.getByRole("button", { name: de.auth.login.withPassword }).click();
    await page.locator("#login-email").fill(b.email);
    await page.locator("#login-password").fill(password);
    await page.getByRole("button", { name: de.auth.login.passwordSubmit, exact: true }).click();
    await page.waitForURL((url) => url.pathname.startsWith("/de/app"), { timeout: 30_000 });
    await expect(page.locator("#main h1").first()).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { sameDocument?: boolean }).sameDocument), "B signed in in another document: this run proves nothing").toBe(true);
    await page.waitForTimeout(1_000);
    // B's iPhone app hides a block through the route.
    const token = await appToken(b.email);
    const native = await page.request.post("/api/app/page", { headers: { authorization: `Bearer ${token}` }, data: { baseUpdatedAt: (await stored(b.id)).updatedAt, ops: [{ op: "show", id: "second", visible: false }] } });
    expect(native.status()).toBe(200);
    await page.waitForTimeout(1_000);
    // B changed nothing here and closes the tab.
    await page.close({ runBeforeUnload: true });
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    expect((await stored(b.id)).blocks.map((block) => block.visible)).toEqual([true, false, true]);
  });

  test("sign-out: Abmelden in Settings right after a change keeps the change @real", async ({ page }) => {
    const account = await syncAccount("sync-logout");
    await signIn(page, account.email, "/de/app/settings");
    const language = page.getByLabel(de.app.settings.rows.pageLanguage);
    const logout = page.getByRole("button", { name: de.app.settings.logout, exact: true });
    await logout.scrollIntoViewIfNeeded();
    await expect(language).toHaveValue("de");
    // Inside the editor's autosave delay (400 ms): the change has not reached the store yet.
    const started = Date.now();
    await language.selectOption("en");
    await logout.dispatchEvent("click");
    expect(Date.now() - started, "the click came after the autosave delay: this run proves nothing").toBeLessThan(400);
    await page.waitForURL("**/de/login**");
    await expect.poll(async () => {
      const { data } = await service().from("sites").select("page").eq("profile_id", account.id).single();
      return (data?.page as { profile: { locale: string } } | undefined)?.profile.locale;
    }).toBe("en");
  });
});
