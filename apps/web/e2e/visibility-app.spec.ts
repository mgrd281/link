import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import ar from "../src/messages/ar.json" with { type: "json" };
import de from "../src/messages/de.json" with { type: "json" };
import en from "../src/messages/en.json" with { type: "json" };

import { enterDemoCode } from "./auth";

/**
 * WP4.5 (D-09, W-04, leftovers 1–2): Settings › Sichtbarkeit (pause, search engines, search title and
 * description with live previews), the help entries (the Settings row, the rail's "?", each screen's
 * article), no dead band at 1920 and the Arabic week names at 360. Demo build: everything lives in this
 * browser's storage. The public side of a paused page needs real accounts: the stub block at the end
 * (E2E_STUB=1, as e2e/stub-app.spec.ts).
 */

const MESSAGES = { de, en, ar } as const;
type Locale = keyof typeof MESSAGES;
const STORAGE_KEY = "linkyo.demo.v1";
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const SHOTS = process.env.WP45_SHOTS ?? "";

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

const heading = (page: Page) => page.locator("#main h1").first();

async function signedIn(page: Page, locale: Locale = "en") {
  const name = `vs-${unique()}`;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/${locale}/signup?name=${name}`);
  await page.waitForLoadState("networkidle");
  await page.locator("#signup-email").fill(`${name}@example.com`);
  await page.locator("form button[type=submit]").click();
  await enterDemoCode(page);
  await page.waitForURL(`**/${locale}/app/welcome`);
  await page.getByRole("button", { name: MESSAGES[locale].app.welcome.skip }).click();
  await page.waitForURL(`**/${locale}/app`);
  await expect(heading(page)).toBeVisible();
  return MESSAGES[locale];
}

/** A page with a photo, a bio and three links (Home is "ready" and shows the week), then a reload. */
async function seed(page: Page) {
  await page.evaluate((key) => {
    const db = JSON.parse(window.localStorage.getItem(key) ?? "{}") as { session: { accountId: string }; sites: Record<string, { page: { blocks: unknown[]; profile: Record<string, unknown> } }> };
    const site = db.sites[db.session.accountId];
    if (!site) throw new Error("no site");
    const block = (id: string, extra: Record<string, unknown>) => ({ id, visible: true, highlight: false, ...extra });
    site.page.blocks = [
      block("l-tickets", { type: "link", title: "Tickets", url: "https://example.com/tickets" }),
      block("l-merch", { type: "link", title: "Merch store", url: "https://example.com/merch" }),
      block("l-album", { type: "link", title: "New album", url: "https://example.com/album" }),
    ];
    site.page.profile.bio = "Songs and shows.";
    site.page.profile.avatar = { src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", alt: "" };
    window.localStorage.setItem(key, JSON.stringify(db));
  }, STORAGE_KEY);
  await page.reload();
  await expect(heading(page)).toBeVisible();
}

/** The page's visibility settings as the demo store saved them. */
const stored = (page: Page) =>
  page.evaluate((key) => {
    const db = JSON.parse(window.localStorage.getItem(key) ?? "{}") as { session: { accountId: string }; sites: Record<string, { page: { profile: { visibility?: Record<string, unknown> } } }> };
    return db.sites[db.session.accountId]?.page.profile.visibility ?? null;
  }, STORAGE_KEY);

async function axe(page: Page) {
  // A colour scheme just switched starts colour transitions: axe waits until they ran (LEFTOVERS 23).
  await page.evaluate(() => Promise.all(document.getAnimations().filter((animation) => animation instanceof CSSTransition).map((animation) => animation.finished.catch(() => undefined))));
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${SHOTS}/${name}-${test.info().project.name}.png` });
}

test.describe("Settings › Visibility (D-09)", () => {
  test("pausing, search engines, the texts and their previews, saved as part of the page", async ({ page }) => {
    const m = await signedIn(page);
    const v = m.app.visibility;
    await page.goto("/en/app/settings");
    const row = page.locator("#main").getByRole("link", { name: new RegExp(`^${m.app.settings.rows.visibility}`) });
    await expect(row).toBeVisible();
    await row.click();
    await page.waitForURL("**/en/app/settings/visibility");
    await expect(heading(page)).toHaveText(v.title);

    // Defaults: on, shown to search engines, nothing stored.
    const pause = page.getByRole("switch", { name: v.pause });
    const search = page.getByRole("switch", { name: v.search });
    await expect(pause).not.toBeChecked();
    await expect(search).toBeChecked();
    expect(await stored(page)).toBeNull();

    // The previews show today's defaults: the name and the bio.
    const titlePreview = page.locator("[data-preview-title]");
    // The demo names a new page after its address ("vs-…" becomes "Vs …").
    await expect(titlePreview).toHaveText(/^Vs /);

    // Title and description: the previews follow every key; the page is changed once the field is left.
    const title = page.getByRole("textbox", { name: v.titleLabel });
    await title.fill("Mila Berg – Songs, shows and tickets from Cologne and everywhere else");
    // At most 60 characters.
    await expect(title).toHaveValue("Mila Berg – Songs, shows and tickets from Cologne and everyw");
    await expect(titlePreview).toHaveText("Mila Berg – Songs, shows and tickets from Cologne and everyw");
    const description = page.getByRole("textbox", { name: v.descriptionLabel });
    await description.fill("Concert dates, new songs and the merch store.");
    await expect(page.locator("[data-preview-description]")).toHaveText("Concert dates, new songs and the merch store.");
    await description.blur();
    await expect.poll(() => stored(page)).toEqual({ title: "Mila Berg – Songs, shows and tickets from Cologne and everyw", description: "Concert dates, new songs and the merch store." });

    // Search engines off, then the pause: each saved, the note read out, the Settings row says so.
    await search.click();
    await expect(search).not.toBeChecked();
    await expect(page.getByText(v.previewSearchOff)).toBeVisible();
    await pause.click();
    await expect(pause).toBeChecked();
    await expect(page.getByRole("status").filter({ hasText: v.pausedNote })).toBeVisible();
    await expect.poll(() => stored(page)).toMatchObject({ paused: true, search: false });
    expect(await axe(page)).toEqual([]);

    // Undo takes the pause back (one step), redo brings it again.
    await page.locator("body").click({ position: { x: 1, y: 1 } });
    await page.keyboard.press("ControlOrMeta+z");
    await expect(pause).not.toBeChecked();
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(pause).toBeChecked();

    await page.reload();
    await expect(heading(page)).toHaveText(v.title);
    await expect(page.getByRole("switch", { name: v.pause })).toBeChecked();
    await expect(page.getByRole("textbox", { name: v.titleLabel })).toHaveValue("Mila Berg – Songs, shows and tickets from Cologne and everyw");

    await page.goto("/en/app/settings");
    await expect(page.locator("#main").getByRole("link", { name: new RegExp(`^${m.app.settings.rows.visibility}.*${v.state.paused}`) })).toBeVisible();

    // The owner still sees the page in "View my page", with the note that visitors do not.
    await page.goto("/en/app/preview");
    await expect(page.locator("[data-paused-note]")).toContainText(v.ownPagePaused);
    await expect(page.locator("[data-paused-note]").getByRole("link", { name: v.title })).toHaveAttribute("href", "/en/app/settings/visibility");

    // Unpaused and back to the defaults: nothing is stored any more.
    await page.goto("/en/app/settings/visibility");
    await page.getByRole("switch", { name: v.pause }).click();
    await page.getByRole("switch", { name: v.search }).click();
    await page.getByRole("textbox", { name: v.titleLabel }).fill("");
    await page.getByRole("textbox", { name: v.descriptionLabel }).fill("");
    await page.getByRole("textbox", { name: v.descriptionLabel }).blur();
    await expect.poll(() => stored(page)).toBeNull();
    await page.goto("/en/app/preview");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("[data-paused-note]")).toHaveCount(0);
  });

  for (const locale of ["de", "ar"] as const) {
    test(`${locale}: the pane in its language, mirrored in Arabic, axe light and dark`, async ({ page }) => {
      const m = await signedIn(page, locale);
      await seed(page);
      await page.goto(`/${locale}/app/settings/visibility`);
      await expect(heading(page)).toHaveText(m.app.visibility.title);
      await page.getByRole("textbox", { name: m.app.visibility.titleLabel }).fill(locale === "ar" ? "ميلا بيرغ – أغانٍ وحفلات" : "Mila Berg – Songs und Konzerte");
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      for (const scheme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
        expect(await axe(page), `${locale} ${scheme}`).toEqual([]);
      }
      await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
      await shot(page, `visibility-${locale}`);
    });
  }
});

test.describe("help in the dashboard (W-04)", () => {
  test("the Settings row opens the help page in the same tab", async ({ page }) => {
    const m = await signedIn(page, "de");
    await page.goto("/de/app/settings");
    const row = page.locator("#main").getByRole("link", { name: new RegExp(`^${m.app.settings.rows.help}`) });
    await expect(row).toHaveAttribute("href", "/de/hilfe");
    await expect(row).not.toHaveAttribute("target", /.+/);
    await row.click();
    await page.waitForURL("**/de/hilfe");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("the rail's ? opens the screen's own article, or the help page", async ({ page, isMobile }) => {
    test.skip(isMobile, "the rail is on laptops");
    const m = await signedIn(page, "de");
    const rail = page.locator("[data-nav]").getByRole("link", { name: m.app.settings.rows.help, exact: true });
    for (const [screen, target] of [
      ["/de/app/analytics", "/de/hilfe#statistik"],
      ["/de/app/settings/address", "/de/hilfe#seitenadresse"],
      ["/de/app/settings/legal", "/de/hilfe#impressum"],
      ["/de/app/settings/account", "/de/hilfe#konto-loeschen"],
      ["/de/app", "/de/hilfe#teilen"],
      ["/de/app/settings", "/de/hilfe"],
    ] as const) {
      await page.goto(screen);
      await expect(heading(page)).toBeVisible();
      await expect(rail, screen).toHaveAttribute("href", target);
    }
    await page.goto("/de/app/analytics");
    await rail.click();
    await page.waitForURL("**/de/hilfe#statistik");
  });

  test("each screen with an article links to it: Stats, Page address, Legal notice, Account, Home's link card", async ({ page }) => {
    await signedIn(page, "en");
    await seed(page);
    for (const [screen, slug] of [
      ["/en/app/analytics", "statistik"],
      ["/en/app/settings/address", "seitenadresse"],
      ["/en/app/settings/legal", "impressum"],
      ["/en/app/settings/account", "konto-loeschen"],
      ["/en/app", "teilen"],
    ] as const) {
      await page.goto(screen);
      await expect(heading(page)).toBeVisible();
      const link = page.locator(`#main a[href="/en/hilfe#${slug}"]`).first();
      await expect(link, screen).toBeVisible();
      // Its name says it is help, and contains what it shows (WCAG 2.5.3).
      const name = await link.evaluate((element) => element.textContent);
      expect(name, screen).toContain(en.app.settings.helpLinks[slug]);
    }
    await page.goto("/en/app/settings/address");
    await page.locator('#main a[href="/en/hilfe#seitenadresse"]').click();
    await page.waitForURL("**/en/hilfe#seitenadresse");
  });
});

test.describe("laptops and small phones (leftovers 1 and 2)", () => {
  test("at 1920 no screen leaves a dead band: Stats, Invite, Settings and its form panes", async ({ page, isMobile }) => {
    test.skip(isMobile, "a 1920 px window");
    await page.setViewportSize({ width: 1920, height: 1080 });
    await signedIn(page, "de");
    await seed(page);
    for (const screen of ["/de/app/analytics", "/de/app/invite", "/de/app/settings", "/de/app/settings/address", "/de/app/settings/legal", "/de/app/settings/visibility"]) {
      await page.goto(screen);
      await expect(heading(page)).toBeVisible();
      await page.waitForLoadState("networkidle");
      // The room the screen has: from the panel's edge to the live preview (or the window's end).
      const free = await page.evaluate(() => {
        const column = document.querySelector("#main [data-screen-column]")?.getBoundingClientRect();
        const preview = document.querySelector("aside")?.getBoundingClientRect();
        const end = preview && preview.width > 0 ? preview.left : document.documentElement.clientWidth;
        // The widest thing in the column: its groups stand in two columns where there is the room.
        const items = [...document.querySelectorAll("#main [data-screen-column] > *")].map((item) => item.getBoundingClientRect().right);
        return column ? { column: Math.round(end - column.right), content: Math.round(end - Math.max(...items)) } : null;
      });
      expect(free, screen).not.toBeNull();
      // The column reaches the end of its room, but for the gutter (32 px) and the preview's own space.
      expect(free?.column, `${screen}: free beside the column`).toBeLessThanOrEqual(120);
      expect(free?.content, `${screen}: free beside the content`).toBeLessThanOrEqual(120);
    }
  });

  test("ar at 360: each short day name fits under its bar on Home", async ({ page, isMobile }) => {
    test.skip(!isMobile, "a phone");
    await page.setViewportSize({ width: 360, height: 780 });
    await signedIn(page, "ar");
    await seed(page);
    // The week's bars: the chart's own list (the lists beside it are the top links and sources).
    const days = page.locator("#stats-title").locator("xpath=ancestor::section[1]").locator("figure ol > li > span:last-child");
    await expect(days).toHaveCount(7);
    const fits = await days.evaluateAll((labels) => labels.map((label) => ({ text: label.textContent, wide: label.scrollWidth, room: label.parentElement?.clientWidth ?? 0 })));
    for (const day of fits) expect(day.wide, day.text).toBeLessThanOrEqual(day.room);
    expect(fits.map((day) => day.text)).not.toContain("الخميس");
  });
});

// ---------------------------------------------------------------------------------------------
// The public side, with real accounts (the stand-in for Supabase): the offline page and noindex.

const stubEnabled = process.env.E2E_STUB === "1";
const STUB = `http://127.0.0.1:${process.env.STUB_SUPABASE_PORT ?? "55103"}`;
const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const tokenFor = (id: string) => `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: id, role: "authenticated", exp: 4_070_908_800 })}.stub`;

async function stubSeed(data: Record<string, unknown>) {
  const response = await fetch(`${STUB}/__stub/seed`, { method: "POST", body: JSON.stringify(data) });
  if (!response.ok) throw new Error(`stub seed failed: ${String(response.status)}`);
}

/** An active, onboarded account whose page has two links and a project, with the given visibility. */
async function stubPage(id: string, username: string, locale: Locale, visibility?: Record<string, unknown>) {
  const block = (extra: Record<string, unknown>) => ({ visible: true, highlight: false, ...extra });
  await stubSeed({
    users: { [id]: { id, email: `${username}@example.com` } },
    profiles: { [id]: { id, username, locale, status: "active", created_at: "2026-11-01T00:00:00Z" } },
    sites: {
      [id]: {
        profile_id: id,
        kind: null,
        onboarded: true,
        prepared: null,
        page: {
          profile: { username, displayName: "Mila Berg", bio: "Songs and shows.", tagline: "Singer", avatar: { src: "none:", alt: "" }, verified: false, locale, ...(visibility ? { visibility } : {}) },
          blocks: [
            block({ id: "l1", type: "link", title: "Tickets", url: "https://example.com/tickets" }),
            block({ id: "p1", type: "project", slug: "harbour", title: "Harbour", summary: "A record." }),
          ],
        },
        theme: { template: "nocturne" },
        legal: { name: "", address: "", email: "", phone: "" },
        updated_at: "2026-11-20T10:00:00Z",
      },
    },
  });
}

const robots = (page: Page) => page.locator('meta[name="robots"]').getAttribute("content");

test.describe("a paused page, seen by visitors (stub)", () => {
  test.skip(!stubEnabled, "Needs the stub build and the Supabase stand-in (E2E_STUB=1).");

  for (const locale of ["de", "ar"] as const) {
    test(`${locale}: the calm offline page with noindex, no block and no counter; unpaused it is back`, async ({ page, context }) => {
      const id = randomUUID();
      const username = `pz-${randomUUID().replaceAll("-", "").slice(0, 8)}`;
      await stubPage(id, username, locale, { paused: true });
      const counted: string[] = [];
      page.on("request", (request) => {
        if (request.url().includes("/api/collect")) counted.push(request.url());
      });
      const response = await page.goto(`/${username}`);
      expect(response?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mila Berg");
      await expect(page.getByText(MESSAGES[locale].app.visibility.offline.title)).toBeVisible();
      await expect(page.getByText("Tickets")).toHaveCount(0);
      await expect(page.getByText("Singer")).toHaveCount(0);
      expect(await robots(page)).toBe("noindex, nofollow");
      await page.waitForLoadState("networkidle");
      expect(counted).toEqual([]);
      expect(await context.cookies()).toEqual([]);
      // Its project page is offline too.
      expect((await page.goto(`/${username}/harbour`))?.status()).toBe(404);
      await page.goto(`/${username}`);
      expect(await axe(page)).toEqual([]);
      await shot(page, `paused-public-${locale}`);

      // Unpaused, with a search title and description: the page is back after revalidation.
      await stubPage(id, username, locale, { title: "Mila Berg – Live", description: "Tickets and new songs." });
      const dropped = await page.request.post("/api/account/revalidate", { headers: { Authorization: `Bearer ${tokenFor(id)}` }, data: {} });
      expect(dropped.status()).toBe(200);
      await page.goto(`/${username}`);
      await expect(page.getByText("Tickets").first()).toBeVisible();
      expect(await robots(page)).toBe("index, follow");
      await expect(page).toHaveTitle("Mila Berg – Live");
      expect(await page.locator('meta[name="description"]').getAttribute("content")).toBe("Tickets and new songs.");
      expect(await page.locator('meta[property="og:title"]').getAttribute("content")).toBe("Mila Berg – Live");
      await page.waitForLoadState("networkidle");
      expect(counted.length).toBeGreaterThan(0);
    });
  }

  test("search engines off: noindex, nofollow on a page that is otherwise the same", async ({ page }) => {
    const id = randomUUID();
    const username = `nx-${randomUUID().replaceAll("-", "").slice(0, 8)}`;
    await stubPage(id, username, "en", { search: false });
    await page.goto(`/${username}`);
    await expect(page.getByText("Tickets").first()).toBeVisible();
    expect(await robots(page)).toBe("noindex, nofollow");
  });

  test("the link card carries the search title and description, and stays small", async ({ page, request }) => {
    const id = randomUUID();
    const username = `og-${randomUUID().replaceAll("-", "").slice(0, 8)}`;
    // The card's address as the page names it (og:image), on this server.
    const cardUrl = async () => {
      await page.goto(`/${username}`);
      const content = (await page.locator('meta[property="og:image"]').getAttribute("content")) ?? "";
      const url = new URL(content);
      return `${url.pathname}${url.search}`;
    };
    await stubPage(id, username, "de");
    const first = await request.get(await cardUrl());
    expect(first.status()).toBe(200);
    const plain = await first.body();
    await stubPage(id, username, "de", { title: "Mila Berg – Live", description: "Tickets und neue Songs." });
    expect((await request.post("/api/account/revalidate", { headers: { Authorization: `Bearer ${tokenFor(id)}` }, data: {} })).status()).toBe(200);
    const own = await request.get(await cardUrl());
    expect(own.status()).toBe(200);
    expect(own.headers()["content-type"]).toContain("image/jpeg");
    const card = await own.body();
    expect(card.length).toBeLessThan(300_000);
    // The same page and address with its own texts draws another card.
    expect(Buffer.compare(card, plain)).not.toBe(0);
  });
});
