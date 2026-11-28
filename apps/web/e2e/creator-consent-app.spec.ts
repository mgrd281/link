import { randomUUID } from "node:crypto";
import path from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";

import ar from "../src/messages/ar.json" with { type: "json" };
import de from "../src/messages/de.json" with { type: "json" };

/**
 * The external-content choice on creator pages gates what a tap does (leftover 16, ADR
 * 0090-csp-and-limits). On /<locale>/p/nizar (real YouTube videos), in de and ar, on the phone and
 * the laptop:
 *
 * - before any choice, a YouTube card says where its video comes from and one tap, on a button whose
 *   name says YouTube, loads the player;
 * - after "Externe Inhalte erlauben", a tap plays;
 * - after "Nur notwendige", a tap first asks in the card ("Dieses Video kommt von YouTube. Laden?"),
 *   and only "Video laden" loads it;
 * - nothing leaves our origin before that action (the player's address is answered here, so no test
 *   reaches YouTube), and no card says "Der Player lädt hier" any more: a TikTok card is a link that
 *   says what a tap opens.
 *
 * `CONSENT_SHOTS=<dir>` also saves the card in each state.
 */

const SHOTS = process.env.CONSENT_SHOTS ?? "";
const STUB = process.env.E2E_STUB === "1";
const STUB_URL = `http://127.0.0.1:${process.env.STUB_SUPABASE_PORT ?? "55103"}`;
const MESSAGES = { de: de.creator, ar: ar.creator } as const;
type Locale = keyof typeof MESSAGES;

/** A message with its `<bdi>` tags dropped and its values filled in, as the page shows it. */
const words = (message: string, values: Record<string, string> = {}) =>
  Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), message.replace(/<\/?bdi>/g, ""));

/** Answers the player's address here, and keeps every request that left our origin. */
async function watch(page: Page, origin: string): Promise<{ players: string[]; foreign: string[] }> {
  const seen = { players: [] as string[], foreign: [] as string[] };
  await page.route("https://www.youtube-nocookie.com/**", async (route) => {
    seen.players.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>player</title>" });
  });
  page.on("request", (request) => {
    const url = request.url();
    if (/^https?:/.test(url) && new URL(url).origin !== origin && !url.startsWith("https://www.youtube-nocookie.com/")) seen.foreign.push(url);
  });
  return seen;
}

async function open(page: Page, address: string): Promise<void> {
  expect((await page.goto(address))?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The first YouTube card: its button is named after YouTube. */
function firstCard(page: Page, locale: Locale): Locator {
  const name = words(MESSAGES[locale].playVideo, { provider: "YouTube", title: "" });
  return page.getByRole("button", { name: new RegExp(`^${escape(name)}`) }).first();
}

async function shot(page: Page, locator: Locator, name: string, project: string): Promise<void> {
  if (!SHOTS) return;
  await locator.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(SHOTS, `consent-${name}-${project}.png`) });
}

const player = (page: Page) => page.locator('iframe[src^="https://www.youtube-nocookie.com/embed/"]');
const notice = (page: Page, locale: Locale) => page.getByRole("region", { name: MESSAGES[locale].privacyLabel });

for (const locale of ["de", "ar"] as const) {
  const t = MESSAGES[locale];
  const address = `/${locale}/p/nizar`;

  test.describe(address, () => {
    test("before any choice: the card names YouTube, and one tap loads the player", async ({ page, baseURL }, info) => {
      const seen = await watch(page, new URL(baseURL ?? "").origin);
      await open(page, address);
      await expect(notice(page, locale)).toBeVisible();
      const card = firstCard(page, locale);
      await card.scrollIntoViewIfNeeded();
      // Where the video comes from, before anything loads: the sentence on a large card, the corner of a small one.
      await expect(card).toContainText(new RegExp(`${escape(words(t.loadsFrom, { provider: "YouTube" }))}|${escape(words(t.fromProvider, { provider: "YouTube" }))}`));
      await expect(card.locator("bdi").filter({ hasText: "YouTube" }).first()).toBeAttached();
      await shot(page, card, `${locale}-before`, info.project.name);
      expect(seen.players).toEqual([]);
      await expect(player(page)).toHaveCount(0);
      await card.click();
      await expect(player(page)).toHaveCount(1);
      await expect.poll(() => seen.players.length).toBeGreaterThan(0);
      expect(seen.foreign).toEqual([]);
      expect(await page.content()).not.toContain(words(de.creator.noVideo, { provider: "YouTube" }));
    });

    test("after \"Nur notwendige\": a tap asks in the card, and only \"Video laden\" loads", async ({ page, baseURL }, info) => {
      const seen = await watch(page, new URL(baseURL ?? "").origin);
      await open(page, address);
      await notice(page, locale).getByRole("button", { name: t.privacyEssential }).click();
      await expect(notice(page, locale)).toBeHidden();
      const card = firstCard(page, locale);
      await card.scrollIntoViewIfNeeded();
      await card.click();
      const ask = page.locator("[data-video-ask]");
      await expect(ask).toHaveCount(1);
      await expect(ask.getByRole("group", { name: words(t.askTitle, { provider: "YouTube" }) })).toBeVisible();
      const load = ask.getByRole("button", { name: t.askLoad });
      // Focus moves to the question's answer (the button that was pressed is gone).
      await expect(load).toBeFocused();
      await shot(page, ask, `${locale}-ask`, info.project.name);
      await expect(player(page)).toHaveCount(0);
      expect(seen.players).toEqual([]);
      await load.click();
      await expect(player(page)).toHaveCount(1);
      await expect.poll(() => seen.players.length).toBeGreaterThan(0);
      expect(seen.foreign).toEqual([]);
    });

    test("after \"Externe Inhalte erlauben\": a tap plays at once", async ({ page, baseURL }) => {
      const seen = await watch(page, new URL(baseURL ?? "").origin);
      await open(page, address);
      await notice(page, locale).getByRole("button", { name: t.privacyAllow }).click();
      const card = firstCard(page, locale);
      await card.scrollIntoViewIfNeeded();
      // Allowed: the card no longer needs to say it.
      for (const said of [t.loadsFrom, t.fromProvider]) await expect(card.getByText(words(said, { provider: "YouTube" }), { exact: true })).toHaveCount(0);
      await card.click();
      await expect(page.locator("[data-video-ask]")).toHaveCount(0);
      await expect(player(page)).toHaveCount(1);
      expect(seen.foreign).toEqual([]);
    });
  });
}

test("a TikTok card is a link that says what a tap opens, never \"Der Player lädt hier\"", async ({ page, baseURL }) => {
  const seen = await watch(page, new URL(baseURL ?? "").origin);
  await open(page, "/de/p/lou-ferreira");
  const card = page.getByRole("link", { name: words(de.creator.openTitle, { title: "Get Ready With Me: Gala-Look in 10 Minuten" }) });
  await card.scrollIntoViewIfNeeded();
  // An example's address is no TikTok address: the card says it opens the link, not TikTok.
  await expect(card).toContainText(de.creator.opensLink);
  await expect(card).toHaveAttribute("target", "_blank");
  expect(await page.content()).not.toContain("Der Player lädt hier");
  expect(seen.foreign).toEqual([]);
});

test.describe("a real page under /u (stub)", () => {
  test.skip(!STUB, "Needs the stub build and the Supabase stand-in (E2E_STUB=1).");

  test("a TikTok video opens TikTok; a YouTube address without a video says no player loads", async ({ page, baseURL }) => {
    const id = randomUUID();
    const username = `cn-${randomUUID().replaceAll("-", "").slice(0, 8)}`;
    const poster = { src: "none:", alt: "" };
    const block = (extra: Record<string, unknown>) => ({ visible: true, highlight: false, poster, ...extra });
    const site = {
      profile: { username, displayName: "Mira Feld", bio: "", avatar: { src: "none:", alt: "" }, verified: false, locale: "de" },
      blocks: [
        block({ id: "t1", type: "video", title: "Tanz am Hafen", provider: "tiktok", url: "https://www.tiktok.com/@mirafeld/video/7300000000000000000" }),
        block({ id: "y1", type: "video", title: "Kanal", provider: "youtube", url: "https://www.youtube.com/@mirafeld" }),
      ],
    };
    const seeded = await fetch(`${STUB_URL}/__stub/seed`, {
      method: "POST",
      body: JSON.stringify({
        users: { [id]: { id, email: `${username}@example.com` } },
        profiles: { [id]: { id, username, locale: "de", status: "active", created_at: "2026-11-01T00:00:00Z" } },
        sites: { [id]: { profile_id: id, kind: null, onboarded: true, prepared: null, page: site, theme: { template: "nocturne" }, legal: { name: "", address: "", email: "", phone: "" }, updated_at: "2026-11-20T10:00:00Z" } },
      }),
    });
    expect(seeded.ok).toBe(true);
    const seen = await watch(page, new URL(baseURL ?? "").origin);
    await open(page, `/${username}`);
    const tiktok = page.getByRole("link", { name: words(de.creator.watchOn, { title: "Tanz am Hafen", provider: "TikTok" }) });
    await expect(tiktok).toContainText(words(de.creator.opensOn, { provider: "TikTok" }));
    await expect(tiktok).toHaveAttribute("href", "https://www.tiktok.com/@mirafeld/video/7300000000000000000");
    const channel = page.getByRole("button", { name: words(de.creator.playVideo, { provider: "YouTube", title: "Kanal" }) });
    await channel.click();
    await expect(page.getByRole("status").filter({ hasText: words(de.creator.noVideo, { provider: "YouTube" }) })).toBeVisible();
    await expect(player(page)).toHaveCount(0);
    expect(seen.players).toEqual([]);
    expect(seen.foreign).toEqual([]);
  });
});
