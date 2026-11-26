import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import ar from "../src/messages/ar.json" with { type: "json" };
import de from "../src/messages/de.json" with { type: "json" };
import en from "../src/messages/en.json" with { type: "json" };

import { enterDemoCode } from "./auth";

/**
 * App mode (ADR draft "app mode"): the dashboard inside Linkyo's iPhone app. The app's WKWebView is
 * stood in for by the app's user agent and a document-start script, as the app sets them: `<html
 * data-app="ios">`, `window.linkyoApp` and a `webkit.messageHandlers.linkyo` that records what the web
 * posts. On a phone (390 × 844) in German and Arabic: no web chrome, no purchase surface, no install
 * hint, no service worker, axe clean; the bridge (ready, route, navigate, back, every download and
 * share, editClosed) and nothing posted outside the app or from a frame; the editor's ?edit= link, also
 * in a browser; and from every page the app shows outside the dashboard (help, contact, the legal and
 * sign-in pages), every link a person can see, followed two levels deep, stays on those pages. Demo build.
 */

const MESSAGES = { de, en, ar } as const;
type Locale = keyof typeof MESSAGES;
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const STORAGE_KEY = "linkyo.demo.v1";

/** WKWebView's own user agent with the app's `applicationNameForUserAgent`. */
const APP_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 LinkyoApp/1.0";

/** What the app's document-start script does, plus a handler that records each message (in every frame). */
const APP_SCRIPT = `(() => {
  const mark = () => { document.documentElement.dataset.app = "ios"; };
  if (document.documentElement) mark();
  else new MutationObserver((_, observer) => { if (document.documentElement) { mark(); observer.disconnect(); } }).observe(document, { childList: true });
  window.linkyoApp = { platform: "ios", version: "1.0", bridge: 1 };
  window.__posted = [];
  window.webkit = { messageHandlers: { linkyo: { postMessage: (body) => window.__posted.push(JSON.parse(JSON.stringify(body))) } } };
})();`;

/** A page that has a handler of the same name but is not in the app (no data-app): it must get nothing. */
const HANDLER_ONLY = `(() => {
  window.__posted = [];
  window.webkit = { messageHandlers: { linkyo: { postMessage: (body) => window.__posted.push(body) } } };
})();`;

/** Chrome's install offer, as the browser fires it after load (so a browser would show Home's hint). */
const OFFER = `addEventListener("load", () => {
  const offer = new Event("beforeinstallprompt", { cancelable: true });
  offer.prompt = () => Promise.resolve();
  offer.userChoice = Promise.resolve({ outcome: "accepted" });
  dispatchEvent(offer);
});`;

interface Posted {
  type: string;
  [key: string]: unknown;
}

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;
const heading = (page: Page) => page.locator("#main h1").first();
const posted = (page: Page) => page.evaluate(() => (window as unknown as { __posted: Posted[] }).__posted);
const postedOf = async (page: Page, type: string) => (await posted(page)).filter((message) => message.type === type);
const decode = (base64: string) => Buffer.from(base64, "base64");

async function signedIn(page: Page, locale: Locale) {
  const m = MESSAGES[locale];
  const name = `app-${unique()}`;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/link-metadata**", (route) => route.fulfill({ json: {} }));
  await page.goto(`/${locale}/signup?name=${name}`);
  await page.waitForLoadState("networkidle");
  await page.locator("#signup-email").fill(`${name}@example.com`);
  await page.locator("form button[type=submit]").click();
  await enterDemoCode(page);
  await page.waitForURL(`**/${locale}/app/welcome`);
  await page.getByRole("button", { name: m.app.welcome.skip }).click();
  await page.waitForURL(`**/${locale}/app`);
  await expect(heading(page)).toBeVisible();
  return { m, name };
}

/**
 * The creator's own words that name "Pro" (a link of theirs, as a creator may have one): the "Pro" check
 * allows the word only inside these, the page's own content (`expectNoPro`).
 */
const OWN_PRO = "Pro-Tipps";

/**
 * Two links on the page (ids l-0 and l-1), so the editor and the previews have something to show. With
 * `more`: also a link whose title names "Pro" (OWN_PRO, id l-2), a live planned in three days (live-1),
 * whose reminder the page's island offers, a photo and a bio: a page Home calls ready to share, so Home
 * shows the invite row too.
 */
async function seed(page: Page, { more = false }: { more?: boolean } = {}) {
  const accountId = await page.evaluate(
    ({ key, more, own }) => {
      const db = JSON.parse(window.localStorage.getItem(key) ?? "{}") as {
        session: { accountId: string };
        sites: Record<string, { page: { blocks: unknown[]; profile: { bio: string; avatar: { src: string; alt: string } } } }>;
      };
      const site = db.sites[db.session.accountId];
      if (!site) throw new Error("no site");
      site.page.blocks = [0, 1].map((i) => ({ id: `l-${String(i)}`, type: "link", visible: true, highlight: false, title: `Link ${String(i + 1)}`, url: `https://example.com/${String(i)}` }));
      if (more) {
        const soon = new Date(Date.now() + 3 * 86_400_000).toISOString();
        site.page.profile.bio = "Musik, Live und Tipps.";
        site.page.profile.avatar = { src: "/screenshots/de/page-phone.jpg", alt: "" };
        site.page.blocks.push(
          { id: "l-2", type: "link", visible: true, highlight: false, title: own, url: "https://example.com/tipps" },
          { id: "live-1", type: "live", visible: true, highlight: false, platform: "twitch", channel: "example", isLive: false, title: "Q&A", url: "https://www.twitch.tv/example", startsAt: soon },
        );
      }
      window.localStorage.setItem(key, JSON.stringify(db));
      return db.session.accountId;
    },
    { key: STORAGE_KEY, more, own: OWN_PRO },
  );
  await page.reload();
  await expect(heading(page)).toBeVisible();
  return accountId;
}

/**
 * A creator page's share button: in its compact bar, which slides in once the hero has scrolled away
 * (poster-bar), so the page is scrolled to its end first.
 */
async function pageShareButton(page: Page, label: string) {
  // Room below a short page (a test page has four blocks), so its hero can scroll away.
  await page.evaluate(() => {
    const room = document.createElement("div");
    room.style.height = "100vh";
    document.body.append(room);
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  const button = page.getByRole("button", { name: label, exact: true }).first();
  await expect(button).toBeVisible();
  return button;
}

/** Every closed article and disclosure (`<details>`) opened, so what a person can read is in `innerText`. */
const openDetails = (page: Page) =>
  page.evaluate(() => {
    for (const details of document.querySelectorAll("details")) details.open = true;
  });

/** The words a person can reach on the page: every `<details>` opened first. */
async function readableText(page: Page): Promise<string> {
  await openDetails(page);
  return page.locator("body").innerText();
}

/**
 * No "Pro" as a word of its own (App Store 3.1.3(f): the app names no plan to buy, unlock or wait for).
 * Allowed only inside the creator's own content (OWN_PRO), which the app shows as it is.
 */
function expectNoPro(text: string, where: string) {
  const lines = text.split("\n").filter((line) => /\bPro\b/.test(line.replaceAll(OWN_PRO, "")));
  expect(lines, `${where}: "Pro"`).toEqual([]);
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.map((v) => `${v.id} (${v.impact ?? ""}): ${String(v.nodes.length)}× — ${v.nodes[0]?.target.join(" ") ?? ""}`);
}

/** Links to a purchase or contract page anywhere in the document (hidden ones included). */
const PURCHASE_LINKS = 'a[href*="/checkout"], a[href*="/service"], a[href*="/kuendigen"], a[href*="/widerruf"], a[href*="/admin"], a[href*="/app/orders/"]';

/** What a screen in the app may never show: a price, "Pro", "Get Pro", a way to a purchase, the web's bars. */
async function expectAppScreen(page: Page, locale: Locale, where: string) {
  const m = MESSAGES[locale];
  const text = await readableText(page);
  expect(text, `${where}: a price`).not.toContain("€");
  expectNoPro(text, where);
  for (const words of [m.app.settings.plan.upgrade, m.app.ai.pro.get, m.app.settings.plan.soon]) expect(text, `${where}: "${words}"`).not.toContain(words);
  await expect(page.locator(PURCHASE_LINKS), `${where}: a purchase link`).toHaveCount(0);
  for (const chrome of ["[data-tabbar]", "[data-nav]", "[data-grouped] header[data-app-hide]"]) {
    const found = page.locator(chrome);
    if ((await found.count()) > 0) await expect(found.first(), `${where}: ${chrome}`).toBeHidden();
  }
  expect(await axe(page), where).toEqual([]);
}

/**
 * The pages the app shows outside the dashboard (plan §1.1: help, contact, the legal pages and the
 * security page help links to; the sign-in pages only for a moment, when the web view's session has
 * ended), and the dashboard itself. Inside the app's one web view a link may lead only here: the
 * router's links never ask the app's navigation policy, so a link to the website would carry the web
 * view on to the homepage and its prices.
 */
const APP_PAGES = /^\/(?:de|en|ar)\/(?:app(?:\/.*)?|hilfe|kontakt|impressum|datenschutz|sicherheit|login|signup)$/;
const PURCHASE_PATH = /^\/(?:de|en|ar)\/(?:checkout|service|kuendigen|widerruf|admin)(?:\/|$)|\/app\/orders\//;

/**
 * Every link a person can reach on the page: closed articles (`<details>`) opened first, then each link
 * that is laid out (not hidden by `data-app-hide`, or anything else) and not invisible.
 */
const reachableLinks = (page: Page) =>
  page.evaluate(() => {
    for (const details of document.querySelectorAll("details")) details.open = true;
    return [...document.querySelectorAll<HTMLAnchorElement>("a[href]")]
      .filter((link) => link.getClientRects().length > 0 && getComputedStyle(link).visibility !== "hidden")
      .map((link) => ({ href: link.href, text: link.innerText.trim().slice(0, 40), blank: link.target === "_blank" }));
  });

const isDashboard = (pathname: string) => /^\/(?:de|en|ar)\/app(?:\/|$)/.test(pathname);

/**
 * From `starts`, every link a person can reach, followed two levels deep outside the dashboard: each
 * page is read with every `<details>` open, and none may show a price; a dashboard page may also not
 * name "Pro". A link may lead only to the app's pages (APP_PAGES), never to a purchase or contract
 * page. A dashboard link is not followed (the dashboard's screens are starts of their own); a link to
 * another host or into a new window is a real navigation the app's policy sends to Safari.
 */
async function walk(page: Page, origin: string, starts: readonly string[]) {
  const problems: string[] = [];
  const seen = new Set<string>();
  let checked = 0;
  let level = [...starts];
  // Level 0: the pages the app opens; levels 1 and 2: where their links lead, and where those lead.
  for (let depth = 0; depth <= 2 && level.length > 0; depth += 1) {
    const next = new Set<string>();
    for (const address of level) {
      if (seen.has(address)) continue;
      seen.add(address);
      await page.goto(address);
      await expect(page.locator("h1").first(), address).toBeVisible();
      await page.waitForLoadState("networkidle");
      expect(await page.evaluate(() => document.documentElement.dataset.app), address).toBe("ios");
      const text = await readableText(page);
      if (text.includes("€")) problems.push(`${address}: a price`);
      if (isDashboard(new URL(address, origin).pathname)) {
        const pro = text.split("\n").filter((line) => /\bPro\b/.test(line.replaceAll(OWN_PRO, "")));
        if (pro.length > 0) problems.push(`${address}: "Pro" in ${JSON.stringify(pro)}`);
      }
      for (const link of await reachableLinks(page)) {
        const url = new URL(link.href);
        // E-mail and phone go to the system; another host is a real navigation the app's policy sends to Safari.
        if (url.protocol === "mailto:" || url.protocol === "tel:" || url.origin !== origin) continue;
        checked += 1;
        const where = `${address} → ${url.pathname}${url.search} "${link.text}"`;
        if (PURCHASE_PATH.test(url.pathname)) problems.push(`${where}: a purchase or contract page`);
        // A new window is a real navigation too: the app opens it outside its web view.
        else if (link.blank) continue;
        else if (!APP_PAGES.test(url.pathname)) problems.push(`${where}: outside the app's pages`);
        else if (!isDashboard(url.pathname)) next.add(url.pathname);
      }
    }
    level = [...next];
  }
  return { problems, seen, checked };
}

/**
 * No service worker for this origin once the page has loaded and settled, and for two seconds more: a
 * worker is registered after hydration and the load event, and the browser's job runs after that.
 */
async function expectNoWorker(page: Page) {
  await page.waitForLoadState("networkidle");
  for (let check = 0; check < 10; check += 1) {
    expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map((one) => one.scope))).toEqual([]);
    await page.waitForTimeout(200);
  }
}

test.describe("in the app, on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, userAgent: APP_UA });
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "the iPhone app: phone only");
    await page.addInitScript(APP_SCRIPT);
  });

  for (const locale of ["de", "ar"] as const) {
    test(`${locale}: no web chrome, no purchase, no install hint, no worker, axe clean`, async ({ page }) => {
      test.setTimeout(240_000);
      // A browser would show Home's install hint after this offer.
      await page.addInitScript(OFFER);
      const { m } = await signedIn(page, locale);
      await seed(page);
      await expect(page.locator("[data-install-hint]")).toHaveCount(0);
      await expectNoWorker(page);

      const screens = ["/app", "/app/editor", "/app/design", "/app/analytics", "/app/settings", "/app/settings/plan", "/app/settings/account", "/app/settings/address", "/app/settings/legal", "/app/invite"];
      for (const screen of screens) {
        await page.goto(`/${locale}${screen}`);
        await expect(heading(page)).toBeVisible();
        await page.waitForLoadState("networkidle");
        await expectAppScreen(page, locale, screen);
      }

      // Settings: no "Linkyo als App"; the AGB open in Safari (they state prices), through the app.
      await page.goto(`/${locale}/app/settings`);
      await expect(heading(page)).toBeVisible();
      await expect(page.getByRole("button", { name: new RegExp(`^${m.app.install.row}`) })).toHaveCount(0);
      // Signing out is the app's own row: a web-only sign-out would land on the sign-in page, which the
      // app answers by signing the web view straight back in.
      await expect(page.getByRole("button", { name: m.app.settings.logout, exact: true })).toHaveCount(0);
      // The app owns the app's language and its appearance (it sets both natively): no "App language",
      // no "Appearance", no "in this browser". The page's language, for its visitors, stays.
      await expect(page.getByText(m.app.settings.rows.appLanguage, { exact: true })).toHaveCount(0);
      await expect(page.getByText(m.app.settings.theme, { exact: true })).toHaveCount(0);
      await expect(page.getByText(m.app.settings.footers.app)).toHaveCount(0);
      await expect(page.getByText(m.app.settings.rows.pageLanguage, { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: m.app.settings.rows.terms, exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: m.app.settings.rows.terms, exact: true }).click();
      expect(await postedOf(page, "openExternal")).toEqual([{ type: "openExternal", url: new URL(`/${locale}/agb`, page.url()).href }]);

      // Invite: the rules promise nothing about Pro (five rules, not six); of the rewards only the
      // verification; the link, its share button and the count stay.
      await page.goto(`/${locale}/app/invite`);
      await expect(page.locator("section", { has: page.locator("#invite-rules") }).locator("ol > li")).toHaveCount(5);
      await expect(page.getByText(m.app.invite.rewards.verification.title, { exact: true })).toBeVisible();
      await expect(page.getByText(m.app.invite.rewards.pro.title, { exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: m.app.invite.link.share })).toBeVisible();
      // A new account: nobody counted yet (the message's "=0" case).
      const nobody = /(?:=0|zero) \{([^}]*)\}/.exec(m.app.invite.rewards.counted)?.[1] ?? "";
      expect(nobody).not.toBe("");
      await expect(page.getByText(nobody, { exact: true })).toBeVisible();

      // Design: the live page under where the bar was sticks at the very top.
      await page.goto(`/${locale}/app/design`);
      await expect(heading(page)).toBeVisible();
      const sticky = page.locator("[data-sticky-preview]").first();
      await page.evaluate(() => window.scrollBy(0, 900));
      await expect.poll(() => sticky.evaluate((element) => Math.round(element.getBoundingClientRect().top))).toBe(0);
      expect(await sticky.evaluate((element) => getComputedStyle(element).top)).toBe("0px");

      // "View my page": no floating bar (the app has its own toolbar) and no "Made with Linkyo".
      await page.goto(`/${locale}/app/preview`);
      await expect(page.locator("[data-credit]")).toHaveCount(1);
      await expect(page.locator("[data-credit]")).toBeHidden();
      await expect(page.locator("nav[data-console=local]")).toHaveCount(1);
      await expect(page.locator("nav[data-console=local]")).toBeHidden();
      expect(await axe(page), "preview").toEqual([]);

      // Help and the legal pages the dashboard opens: without the website's header and footer.
      for (const address of ["/hilfe", "/impressum", "/datenschutz"]) {
        await page.goto(`/${locale}${address}`);
        await expect(page.locator("h1").first()).toBeVisible();
        await expect(page.locator("header[data-app-hide]").first(), address).toBeHidden();
        await expect(page.locator("footer[data-app-hide]").first(), address).toBeHidden();
        const text = await page.locator("body").innerText();
        expect(text, `${address}: a price`).not.toContain("€");
        await expect(page.locator(PURCHASE_LINKS).locator("visible=true"), address).toHaveCount(0);
        expect(await axe(page), address).toEqual([]);
      }
    });
  }

  for (const locale of ["de", "ar"] as const) {
    test(`${locale}: every link from help, contact, the legal and sign-in pages stays on the app's pages, two levels deep, with no price`, async ({ page, baseURL }) => {
      test.setTimeout(240_000);
      const origin = new URL(baseURL ?? page.url()).origin;
      const starts = ["/hilfe", "/kontakt", "/impressum", "/datenschutz", "/sicherheit", "/login", "/signup"].map((address) => `/${locale}${address}`);
      const { problems, seen, checked } = await walk(page, origin, starts);
      expect(problems).toEqual([]);
      // It looked at something: every start page, and the links between them (help → contact → Impressum …).
      expect(seen.size).toBeGreaterThanOrEqual(starts.length);
      expect(checked).toBeGreaterThan(starts.length);
    });
  }

  for (const locale of ["de", "ar"] as const) {
    test(`${locale}: every link from the dashboard's own screens and a dashboard 404 stays on the app's pages, two levels deep, with no price and no "Pro"`, async ({ page, baseURL }) => {
      test.setTimeout(420_000);
      const origin = new URL(baseURL ?? page.url()).origin;
      await signedIn(page, locale);
      // A link of the creator's own named "Pro-Tipps": the page's content may say it, the app may not.
      await seed(page, { more: true });
      // Home, Seite, Design, Arbeiten, Statistik, Einstellungen and its panes, Einladen, the AI builder,
      // "View my page", and a dashboard address that does not exist.
      const screens = ["/app", "/app/editor", "/app/design", "/app/work", "/app/analytics", "/app/settings", "/app/settings/plan", "/app/settings/account", "/app/settings/address", "/app/settings/legal", "/app/invite", "/app/build", "/app/preview", "/app/nope"];
      const starts = screens.map((screen) => `/${locale}${screen}`);
      const { problems, seen, checked } = await walk(page, origin, starts);
      expect(problems).toEqual([]);
      // Every screen, and the help and legal pages they lead to (Settings → Impressum → …).
      expect(seen.size).toBeGreaterThan(starts.length);
      expect(checked).toBeGreaterThan(starts.length);
      // The creator's own "Pro" was on the screens that show the page, and allowed there.
      await page.goto(`/${locale}/app/editor`);
      await expect(page.getByText(OWN_PRO).first()).toBeVisible();
    });
  }

  test("a dashboard 404 offers only the way back to the dashboard (no way to the website)", async ({ page }) => {
    for (const [locale, address] of [
      ["de", "/de/app/orders/x"],
      ["de", "/de/app/work-old"],
      ["ar", "/ar/app/settings/nope"],
    ] as const) {
      const response = await page.goto(address);
      expect(response?.status(), address).toBe(404);
      await expect(page.locator("h1").first()).toHaveText(MESSAGES[locale].errors.notFound.title);
      await page.waitForLoadState("networkidle");
      const visible = await reachableLinks(page);
      expect(
        visible.map((link) => new URL(link.href).pathname),
        address,
      ).toEqual([`/${locale}/app`]);
      await expect(page.getByRole("link", { name: MESSAGES[locale].errors.actions.dashboard })).toBeVisible();
      await expect(page.getByRole("link", { name: MESSAGES[locale].errors.actions.home })).toBeHidden();
      expect(await axe(page), address).toEqual([]);
    }
  });

  test("Ctrl/⌘ K opens no people search in the app (the website's search is not the app's)", async ({ page }) => {
    await page.goto("/de/hilfe");
    await expect(page.locator("h1").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    for (const keys of ["Control+k", "Meta+k"]) {
      await page.keyboard.press(keys);
      await page.waitForTimeout(800);
      await expect(page.locator("[data-people-search]").filter({ visible: true }), keys).toHaveCount(0);
    }
    expect(new URL(page.url()).pathname).toBe("/de/hilfe");
  });

  test("the bridge: ready, route follows the screens, navigate() without a reload, back()", async ({ page }) => {
    const { m } = await signedIn(page, "de");
    const accountId = await seed(page);
    await expect.poll(() => postedOf(page, "ready")).toContainEqual({ type: "ready", signedIn: true, accountId });
    await expect.poll(async () => (await postedOf(page, "route")).at(-1)).toEqual({ type: "route", path: "/de/app", title: m.app.nav.home, back: null });

    // A marker on the window survives only a move without a reload.
    await page.evaluate(() => {
      (window as unknown as { __same: boolean }).__same = true;
    });
    const navigate = (path: string) => page.evaluate((target) => (window as unknown as { linkyoApp: { navigate: (path: string) => boolean } }).linkyoApp.navigate(target), path);
    const back = () => page.evaluate(() => (window as unknown as { linkyoApp: { back: () => boolean } }).linkyoApp.back());

    expect(await back()).toBe(false);
    expect(await navigate("/de/app/settings/plan")).toBe(true);
    await page.waitForURL("**/de/app/settings/plan");
    await expect(heading(page)).toHaveText(m.app.settings.panes.plan);
    await expect.poll(async () => (await postedOf(page, "route")).at(-1)).toEqual({ type: "route", path: "/de/app/settings/plan", title: m.app.settings.panes.plan, back: "/de/app/settings" });
    // A path without its language keeps the current one.
    expect(await navigate("/app/design")).toBe(true);
    await page.waitForURL("**/de/app/design");
    await expect(heading(page)).toHaveText(m.app.nav.design);
    // Nothing but this site's paths.
    for (const refused of ["https://evil.example/de/app", "//evil.example/x", "javascript:alert(1)"]) expect(await navigate(refused), refused).toBe(false);
    expect(page.url()).toContain("/de/app/design");

    expect(await navigate("/de/app/settings/account")).toBe(true);
    await page.waitForURL("**/de/app/settings/account");
    expect(await back()).toBe(true);
    await page.waitForURL("**/de/app/settings");
    await expect(heading(page)).toHaveText(m.app.settings.title);
    expect(await page.evaluate(() => (window as unknown as { __same?: boolean }).__same)).toBe(true);
    const paths = (await postedOf(page, "route")).map((message) => message.path);
    expect(paths.slice(-4)).toEqual(["/de/app/settings/plan", "/de/app/design", "/de/app/settings/account", "/de/app/settings"]);
  });

  test("every download and share goes to the app, none to the browser", async ({ page }) => {
    const { m, name } = await signedIn(page, "de");
    await seed(page);
    let downloads = 0;
    page.on("download", () => {
      downloads += 1;
    });

    // Home's link card: share the address, the QR code (PNG, SVG, share), the story picture.
    await page.getByRole("button", { name: m.app.share.share, exact: true }).first().click();
    await expect.poll(() => postedOf(page, "share")).toEqual([{ type: "share", title: `linkyo.app/${name}`, url: expect.stringContaining(`/${name}`) as unknown as string }]);

    await page.getByRole("button", { name: m.app.share.qr }).click();
    const qr = page.getByRole("dialog", { name: m.app.share.qrTitle });
    await expect(qr).toBeVisible();
    await qr.getByRole("button", { name: m.app.share.download }).click();
    await qr.getByRole("button", { name: m.app.share.downloadSvg }).click();
    await qr.getByRole("button", { name: m.app.share.share, exact: true }).click();
    await expect.poll(async () => (await postedOf(page, "download")).length).toBe(2);
    const [png, svg] = (await postedOf(page, "download")) as unknown as { name: string; mime: string; base64: string }[];
    expect(png).toMatchObject({ name: `linkyo-${name}-qr.png`, mime: "image/png" });
    expect(decode(png?.base64 ?? "").subarray(1, 4).toString()).toBe("PNG");
    expect(svg).toMatchObject({ name: `linkyo-${name}-qr.svg`, mime: "image/svg+xml" });
    expect(decode(svg?.base64 ?? "").toString()).toMatch(/^<svg /);
    await expect.poll(async () => (await postedOf(page, "share")).length).toBe(2);
    const qrShare = (await postedOf(page, "share"))[1] as unknown as { file: { name: string; mime: string } };
    expect(qrShare).toMatchObject({ title: `linkyo.app/${name}`, file: { name: `linkyo-${name}-qr.png`, mime: "image/png" } });
    await qr.getByRole("button", { name: m.app.share.close }).first().click();
    await expect(qr).toBeHidden();

    await page.getByRole("button", { name: m.app.shareImage.open }).click();
    const story = page.getByRole("dialog", { name: m.app.shareImage.title });
    await expect(story).toBeVisible();
    await expect(story.getByRole("button", { name: m.app.shareImage.download })).toBeEnabled();
    await story.getByRole("button", { name: m.app.shareImage.download }).click();
    await story.getByRole("button", { name: m.app.shareImage.share, exact: true }).click();
    // A 1080 × 1920 picture is encoded twice (PNG, then base64): seconds on a busy machine.
    await expect.poll(async () => (await postedOf(page, "download")).length, { timeout: 20_000 }).toBe(3);
    await expect.poll(async () => (await postedOf(page, "share")).length, { timeout: 20_000 }).toBe(3);
    const storyFile = (await postedOf(page, "download"))[2] as unknown as { name: string; mime: string; base64: string };
    expect(storyFile.mime).toBe("image/png");
    expect(decode(storyFile.base64).subarray(1, 4).toString()).toBe("PNG");
    expect((await postedOf(page, "share"))[2]).toMatchObject({ file: { name: storyFile.name, mime: "image/png" } });

    // Stats: the CSV.
    await page.goto("/de/app/analytics");
    await expect(heading(page)).toBeVisible();
    await page.getByRole("button", { name: m.app.analytics.csv }).click();
    await expect.poll(async () => (await postedOf(page, "download")).length).toBe(1);
    const csv = (await postedOf(page, "download"))[0] as unknown as { name: string; mime: string; base64: string };
    expect(csv.name).toMatch(/^linkyo-beispieldaten-.+\.csv$/);
    expect(csv.mime).toContain("text/csv");
    expect(decode(csv.base64).toString("utf8")).toContain(m.app.analytics.views);

    // Settings: the data export.
    await page.goto("/de/app/settings");
    await expect(heading(page)).toBeVisible();
    await page.getByRole("button", { name: m.app.settings.export }).click();
    await expect.poll(async () => (await postedOf(page, "download")).length).toBe(1);
    const exported = (await postedOf(page, "download"))[0] as unknown as { name: string; mime: string; base64: string };
    expect(exported).toMatchObject({ name: `linkyo-${name}-export.json`, mime: "application/json" });
    expect(decode(exported.base64).toString("utf8")).toContain("Link 2");

    // Invite: the invite link with its words.
    await page.goto("/de/app/invite");
    await expect(heading(page)).toBeVisible();
    await page.getByRole("button", { name: m.app.invite.link.share }).click();
    await expect.poll(() => postedOf(page, "share")).toEqual([{ type: "share", title: "Linkyo", text: m.app.invite.link.shareText, url: expect.stringContaining("/i/") as unknown as string }]);

    // Taps play the app's haptic, and no file ever went to the browser's downloads.
    expect((await postedOf(page, "haptic")).length).toBeGreaterThan(0);
    expect(downloads).toBe(0);
  });

  test("nothing is posted from a frame", async ({ page }) => {
    await signedIn(page, "de");
    await page.evaluate(() => {
      const frame = document.createElement("iframe");
      frame.src = "/de/app/settings";
      frame.title = "frame";
      frame.style.width = "390px";
      frame.style.height = "600px";
      document.body.append(frame);
    });
    const frame = page.frameLocator("iframe[title=frame]");
    await expect(frame.locator("#main h1").first()).toBeVisible();
    await page.waitForTimeout(500);
    const inFrame = await page.frames()[1]?.evaluate(() => {
      const own = window as unknown as { __posted: unknown[]; linkyoApp: { navigate?: unknown } };
      return { app: document.documentElement.dataset.app, island: typeof own.linkyoApp.navigate, posted: own.__posted };
    });
    // The frame is a page of the app too (the app's script runs there, and the dashboard's island with
    // it), but only the main frame speaks: the frame posted nothing, the main frame did.
    expect(inFrame).toEqual({ app: "ios", island: "function", posted: [] });
    expect((await postedOf(page, "route")).length).toBeGreaterThan(0);
  });

  test("?edit= opens a block's sheet from another screen; closing it posts editClosed", async ({ page }) => {
    const { m } = await signedIn(page, "de");
    await seed(page);
    const navigate = (path: string) => page.evaluate((target) => (window as unknown as { linkyoApp: { navigate: (path: string) => boolean } }).linkyoApp.navigate(target), path);
    const sheet = page.getByRole("dialog", { name: m.app.edit.editTitle.replace("{type}", m.dashboard.types.link) });

    // From Home: the shell closes every sheet when the screen changes, and this one still opens.
    expect(await navigate("/de/app/editor?edit=l-0")).toBe(true);
    await expect(sheet).toBeVisible();
    await expect(sheet.locator("input[value='https://example.com/0']")).toHaveCount(1);
    expect(new URL(page.url()).search).toBe("");
    await sheet.getByRole("button", { name: m.app.edit.cancel }).locator("visible=true").first().click();
    await expect(sheet).toBeHidden();
    await expect.poll(() => postedOf(page, "editClosed")).toEqual([{ type: "editClosed", id: "l-0" }]);

    // On the editor already: the same link opens the other block; saving closes it.
    expect(await navigate("/de/app/editor?edit=l-1")).toBe(true);
    await expect(sheet).toBeVisible();
    await expect(sheet.locator("input[value='https://example.com/1']")).toHaveCount(1);
    await sheet.getByRole("button", { name: m.app.edit.save }).locator("visible=true").first().click();
    await expect(sheet).toBeHidden();
    await expect.poll(() => postedOf(page, "editClosed")).toEqual([
      { type: "editClosed", id: "l-0" },
      { type: "editClosed", id: "l-1" },
    ]);
    // A sheet opened from the list is not the link's: closing it posts nothing.
    await page.getByRole("button", { name: /Link 1/ }).first().click();
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: m.app.edit.cancel }).locator("visible=true").first().click();
    await expect(sheet).toBeHidden();
    expect(await postedOf(page, "editClosed")).toHaveLength(2);

    // A block the page does not have (deleted on another device): no sheet, and at once `missing`, so
    // the app can return to its list instead of waiting for a sheet that never opens.
    expect(await navigate("/de/app/editor?edit=gone-1")).toBe(true);
    await expect.poll(async () => (await postedOf(page, "editClosed")).at(-1)).toEqual({ type: "editClosed", id: "gone-1", missing: true });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(new URL(page.url()).search).toBe("");
    // From another screen too.
    expect(await navigate("/de/app/settings")).toBe(true);
    await page.waitForURL("**/de/app/settings");
    expect(await navigate("/de/app/editor?edit=gone-2")).toBe(true);
    await expect.poll(async () => (await postedOf(page, "editClosed")).at(-1)).toEqual({ type: "editClosed", id: "gone-2", missing: true });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await postedOf(page, "editClosed")).toHaveLength(4);
  });

  test("the page's own share and reminder in 'View my page' go to the app, with the page's public address", async ({ page }) => {
    const { m, name } = await signedIn(page, "de");
    await seed(page, { more: true });
    let downloads = 0;
    page.on("download", () => {
      downloads += 1;
    });
    // The address the dashboard shares for this page (Home's link card): the public one.
    await page.getByRole("button", { name: m.app.share.share, exact: true }).first().click();
    await expect.poll(async () => (await postedOf(page, "share")).length).toBe(1);
    const publicUrl = ((await postedOf(page, "share"))[0] as unknown as { url: string }).url;
    expect(publicUrl).toMatch(new RegExp(`/${name}$`));

    // A shorter window, so the page scrolls far enough for its compact bar with the share button. (A new
    // document: what the app's handler recorded starts again.)
    await page.setViewportSize({ width: 390, height: 640 });
    await page.goto("/de/app/preview");
    await expect(page.locator("[data-credit]")).toHaveCount(1);
    await page.waitForLoadState("networkidle");
    // The page's share button: the public address, never the dashboard's /app/preview.
    await (await pageShareButton(page, m.creator.share)).click();
    await expect.poll(async () => (await postedOf(page, "share")).length).toBe(1);
    expect((await postedOf(page, "share"))[0]).toEqual({ type: "share", title: expect.any(String) as unknown as string, url: publicUrl });

    // The planned live's reminder: the calendar file goes to the app.
    await page.locator("#live-1").getByRole("button", { name: m.creator.remindAbout.replace("{title}", "Q&A") }).click();
    await expect.poll(async () => (await postedOf(page, "download")).length).toBe(1);
    const ics = (await postedOf(page, "download"))[0] as unknown as { name: string; mime: string; base64: string };
    expect(ics).toMatchObject({ name: "live.ics", mime: "text/calendar" });
    const calendar = decode(ics.base64).toString("utf8");
    expect(calendar).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(calendar).toContain("UID:live-1-");
    expect(calendar).toContain("URL:https://www.twitch.tv/example");
    expect(downloads).toBe(0);
  });

  test("a theme stored in the web view never overrides the device's appearance (the app sets it)", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript(() => {
      window.localStorage.setItem("ly-theme", "light");
    });
    await page.goto("/de/hilfe");
    await expect(page.locator("h1").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.dataset.theme ?? null)).toBeNull();
    expect(await page.evaluate(() => window.localStorage.getItem("ly-theme"))).toBe("light");
  });
});

test.describe("in a browser", () => {
  test("the chrome stays and nothing is posted, even to a handler of the same name", async ({ page, isMobile }) => {
    await page.addInitScript(HANDLER_ONLY);
    const { m } = await signedIn(page, "de");
    await seed(page);
    await expect(page.locator(isMobile ? "[data-tabbar]" : "[data-nav]")).toBeVisible();
    if (isMobile) await expect(page.locator("[data-grouped] header[data-app-hide]")).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { linkyoApp?: unknown }).linkyoApp)).toBeUndefined();

    // The plan still says Pro comes with the launch; the AGB are a link; the export is a real download.
    await page.goto("/de/app/settings/plan");
    await expect(page.getByText(m.app.settings.plan.soon)).toBeVisible();
    await page.goto("/de/app/settings");
    await expect(page.getByRole("button", { name: m.app.settings.logout, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: m.app.settings.rows.terms, exact: true })).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: m.app.settings.export }).click();
    expect((await download).suggestedFilename()).toMatch(/^linkyo-app-.+-export\.json$/);
    expect(await page.evaluate(() => (window as unknown as { __posted: unknown[] }).__posted)).toEqual([]);
  });

  test("a stored theme still applies, and 'View my page' shares the page's public address", async ({ page }) => {
    // A browser's own share sheet, recorded (desktop Chromium has none).
    await page.addInitScript(() => {
      const own = window as unknown as { __shared: unknown[] };
      own.__shared = [];
      Object.defineProperty(Navigator.prototype, "share", {
        configurable: true,
        value: (data: unknown) => {
          own.__shared.push(JSON.parse(JSON.stringify(data)));
          return Promise.resolve();
        },
      });
    });
    const { m, name } = await signedIn(page, "de");
    await seed(page, { more: true });
    const shared = () => page.evaluate(() => (window as unknown as { __shared: { url: string; title: string }[] }).__shared);
    await page.getByRole("button", { name: m.app.share.share, exact: true }).first().click();
    await expect.poll(async () => (await shared()).length).toBe(1);
    const publicUrl = (await shared())[0]?.url ?? "";
    expect(publicUrl).toMatch(new RegExp(`/${name}$`));

    // A phone-sized window, so the page scrolls far enough for its compact bar with the share button.
    await page.setViewportSize({ width: 390, height: 640 });
    await page.goto("/de/app/preview");
    await expect(page.locator("[data-credit]")).toHaveCount(1);
    await page.waitForLoadState("networkidle");
    await (await pageShareButton(page, m.creator.share)).click();
    // A new document: what the stand-in recorded starts again.
    await expect.poll(async () => (await shared()).length).toBe(1);
    expect((await shared())[0]?.url).toBe(publicUrl);
    // The reminder is still the browser's download.
    const download = page.waitForEvent("download");
    await page.locator("#live-1").getByRole("button", { name: m.creator.remindAbout.replace("{title}", "Q&A") }).click();
    expect((await download).suggestedFilename()).toBe("live.ics");

    // Settings keeps the app language, the appearance and its footer; a stored theme applies.
    await page.goto("/de/app/settings");
    await expect(heading(page)).toBeVisible();
    await expect(page.getByText(m.app.settings.rows.appLanguage, { exact: true })).toBeVisible();
    await expect(page.getByText(m.app.settings.footers.app)).toBeVisible();
    await page.evaluate(() => {
      window.localStorage.setItem("ly-theme", "dark");
    });
    await page.goto("/de/hilfe");
    expect(await page.evaluate(() => document.documentElement.dataset.theme ?? null)).toBe("dark");
  });

  test("?edit=<id> opens that block's sheet once; an unknown id opens nothing", async ({ page }) => {
    const { m } = await signedIn(page, "en");
    await seed(page);
    const sheet = page.getByRole("dialog", { name: m.app.edit.editTitle.replace("{type}", m.dashboard.types.link) });
    await page.goto("/en/app/editor?edit=l-1");
    await expect(sheet).toBeVisible();
    await expect(sheet.locator("input[value='https://example.com/1']")).toHaveCount(1);
    // The address loses the request, so a reload does not open it again.
    await expect.poll(() => new URL(page.url()).search).toBe("");
    await page.reload();
    await expect(heading(page)).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.goto("/en/app/editor?edit=nope&tab=x");
    await expect(heading(page)).toBeVisible();
    await expect.poll(() => new URL(page.url()).search).toBe("?tab=x");
    await page.waitForTimeout(500);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
