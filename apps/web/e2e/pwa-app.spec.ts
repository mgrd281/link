import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { tokens } from "@linkyo/tokens";
import { chromium, expect, test, type Page } from "@playwright/test";

import { decodePng } from "../src/features/pwa/png";

import { enterDemoCode } from "./auth";
import { LOCALES } from "./routes";

/**
 * Linkyo as an installed app (ADR draft "installable app"): a manifest per language that Chrome finds
 * installable, a service worker that controls the dashboard only and shows the offline page in the
 * dashboard's language, sharing into the Add sheet (also through sign-in), the install sheet's
 * variant per device, Home's hint shown once, and the dashboard's ground at the first paint.
 * Demo mode (the account lives in this browser's storage); desktop and phone.
 */

type Locale = (typeof LOCALES)[number];
const SKIP: Record<Locale, string> = { de: "Später", en: "Skip for now", ar: "لاحقًا" };
const SPOTIFY = "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC";

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

async function signedIn(page: Page, locale: Locale = "de") {
  const name = `pwa-${unique()}`;
  await page.goto(`/${locale}/signup?name=${name}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(`linkyo.app/${name}`)).toBeVisible();
  await page.locator("#signup-email").fill(`${name}@example.com`);
  await page.locator("form button[type=submit]").click();
  await enterDemoCode(page);
  await page.waitForURL(`**/${locale}/app/welcome`);
  await page.getByRole("button", { name: SKIP[locale] }).click();
  await page.waitForURL(`**/${locale}/app`);
  return { name, email: `${name}@example.com` };
}

/** "rgb(r, g, b)" of a token's #RRGGBB, as getComputedStyle writes it. */
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)).join(", ")})`;

/** Chrome's install offer, as the browser fires it after load (Playwright's incognito contexts never get a real one). */
const OFFER = `addEventListener("load", () => {
  const offer = new Event("beforeinstallprompt", { cancelable: true });
  offer.prompt = () => { window.__prompted = (window.__prompted ?? 0) + 1; return Promise.resolve(); };
  offer.userChoice = Promise.resolve({ outcome: "accepted" });
  dispatchEvent(offer);
});`;

const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
};

async function openInstallSheet(page: Page, locale: Locale = "de") {
  await page.goto(`/${locale}/app/settings`);
  const row = { de: "Linkyo als App", en: "Linkyo as an app", ar: "Linkyo كتطبيق" }[locale];
  await page.getByRole("button", { name: new RegExp(`^${row}`) }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  return sheet;
}

test.describe("manifest and head", () => {
  test("each language links its own manifest; the old shared one is gone; the home-screen tags are there", async ({ page, request }) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}/login`);
      await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", `/${locale}/manifest.webmanifest`);
      const response = await request.get(`/${locale}/manifest.webmanifest`);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("application/manifest+json");
      const manifest = (await response.json()) as { id: string; lang: string; dir: string; start_url: string; display: string };
      expect(manifest).toMatchObject({ id: "/app", lang: locale, dir: locale === "ar" ? "rtl" : "ltr", start_url: `/${locale}/app?source=app`, display: "standalone" });
      for (const [name, content] of [
        ["mobile-web-app-capable", "yes"],
        ["apple-mobile-web-app-capable", "yes"],
        ["apple-mobile-web-app-title", "Linkyo"],
        ["apple-mobile-web-app-status-bar-style", "default"],
      ] as const) {
        await expect(page.locator(`meta[name="${name}"]`)).toHaveAttribute("content", content);
      }
      await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /\/apple-icon\.png/);
    }
    expect((await request.get("/manifest.webmanifest")).status()).toBe(404);
  });

});

test.describe("first paint", () => {
  // The server's HTML alone, no script run yet: what the screen shows before the dashboard starts.
  test.use({ javaScriptEnabled: false, colorScheme: "light" });

  test("a start from the icon paints the dashboard's grey ground first: the manifest's background colour, no white flash", async ({ page, request }) => {
    const manifest = (await (await request.get("/de/manifest.webmanifest")).json()) as { background_color: string; theme_color: string };
    expect(manifest.background_color).toBe(tokens.semantic.canvasMuted.console.light);
    await page.goto("/de/app?source=app");
    await expect(page.locator('meta[name="theme-color"][media="(prefers-color-scheme: light)"]')).toHaveAttribute("content", manifest.theme_color);
    // Measured on the picture: the colour most of the screen shows is the manifest's background colour.
    const shot = decodePng(await page.screenshot());
    const counts = new Map<string, number>();
    for (let at = 0; at < shot.pixels.length; at += shot.channels) {
      const colour = `rgb(${String(shot.pixels[at])}, ${String(shot.pixels[at + 1])}, ${String(shot.pixels[at + 2])})`;
      counts.set(colour, (counts.get(colour) ?? 0) + 1);
    }
    const [mostCommon, count = 0] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    expect(mostCommon).toBe(rgb(manifest.background_color));
    // The white surfaces of the frame (the bars, the cards' places) are a small part of it.
    expect(count / (shot.width * shot.height)).toBeGreaterThan(0.4);
    expect((counts.get("rgb(255, 255, 255)") ?? 0) / count).toBeLessThan(0.5);
  });
});

test("Chrome finds the app installable on /de/app, /en/app and /ar/app, with a manifest free of errors", async ({ baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one browser profile is enough");
  // Installing needs a normal profile: Chrome reports every incognito page (Playwright's default) as not installable.
  const profile = mkdtempSync(path.join(tmpdir(), "linkyo-pwa-"));
  const context = await chromium.launchPersistentContext(profile, {
    ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}),
    baseURL: baseURL ?? "",
    viewport: { width: 1440, height: 900 },
  });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await signedIn(page, "de");
    const cdp = await context.newCDPSession(page);
    for (const locale of LOCALES) {
      await page.goto(`/${locale}/app`);
      await expect(page.locator("#main h1").first()).toBeVisible();
      await expect.poll(async () => (await cdp.send("Page.getInstallabilityErrors")).installabilityErrors).toEqual([]);
      const manifest = await cdp.send("Page.getAppManifest");
      expect(manifest.url).toBe(`${baseURL ?? ""}/${locale}/manifest.webmanifest`);
      expect(manifest.errors).toEqual([]);
    }
  } finally {
    await context.close();
    rmSync(profile, { recursive: true, force: true });
  }
});

test.describe("service worker", () => {
  test("the website, sign-in, the team area and creator pages register none", async ({ page }) => {
    for (const address of ["/de", "/de/login", "/de/admin", "/de/p/ronja-feldkamp", "/u/mila"]) {
      await page.goto(address);
      await page.waitForLoadState("load");
      expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), address).toBe(0);
    }
  });

  test("it controls the dashboard and nothing else, caches nothing, and answers offline with the offline page in the dashboard's language", async ({ page, context, baseURL }) => {
    const origin = new URL(baseURL ?? "http://localhost:3100").origin;
    const { name } = await signedIn(page, "de");
    // Registered after load, for this language's dashboard only.
    await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map((one) => [one.scope, one.active?.state ?? null]))).toEqual([[`${origin}/de/app`, "activated"]]);
    // A dashboard page that is loaded is controlled by it.
    await page.goto("/de/app");
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null)).toBe(`${origin}/de/app/sw.js`);
    expect(await page.evaluate(() => caches.keys())).toEqual([]);

    // After the dashboard: creator pages (the demo user's address, an example) and the website are not.
    for (const address of [`/u/${name}`, "/de/p/ronja-feldkamp", "/de", "/de/login"]) {
      await page.goto(address);
      expect(await page.evaluate(() => navigator.serviceWorker.controller), address).toBeNull();
    }

    // Offline, each language's dashboard shows its own offline page (the worker of that language).
    const offline: Record<Locale, { title: string; retry: string }> = {
      de: { title: "Keine Verbindung", retry: "Erneut versuchen" },
      en: { title: "You're offline", retry: "Try again" },
      ar: { title: "لا يوجد اتصال", retry: "إعادة المحاولة" },
    };
    for (const locale of LOCALES) {
      await page.goto(`/${locale}/app`);
      await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).filter((one) => one.active).length)).toBeGreaterThanOrEqual(1);
      await expect.poll(() => page.evaluate((scope) => navigator.serviceWorker.getRegistration(scope).then((one) => one?.active?.state ?? null), `/${locale}/app`)).toBe("activated");
      await context.setOffline(true);
      await page.goto(`/${locale}/app/settings`);
      await expect(page.getByRole("heading", { level: 1, name: offline[locale].title })).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      const retry = page.getByRole("button", { name: offline[locale].retry });
      await expect(retry).toBeVisible();
      // Still offline, "try again" loads the address again and lands on the offline page again.
      await retry.click();
      await expect(page.getByRole("heading", { level: 1, name: offline[locale].title })).toBeVisible();
      expect(await page.evaluate(() => caches.keys())).toEqual([]);
      await context.setOffline(false);
      // Online again: the page reloads by itself (or on "try again") and the dashboard is back.
      await retry.click({ timeout: 2_000 }).catch(() => undefined);
      await expect(page).toHaveURL(new RegExp(`/${locale}/app/settings$`));
      await expect(page.locator("#main h1").first()).toBeVisible();
    }
    expect((await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map((one) => new URL(one.scope).pathname))).sort()).toEqual(["/ar/app", "/de/app", "/en/app"]);
  });
});

test.describe("share into Linkyo", () => {
  test.beforeEach(async ({ page }) => {
    // No platform is asked for a title in tests.
    await page.route("**/api/link-metadata**", (route) => route.fulfill({ json: {} }));
  });

  test("a shared link opens the Add sheet holding it; nothing usable opens it empty with a note; the shortcut opens it empty", async ({ page }) => {
    await signedIn(page, "de");
    await page.goto(`/de/app/share?title=&text=${encodeURIComponent(`Hör mal ${SPOTIFY}`)}&url=`);
    // Home, and the address no longer asks for the sheet (a reload does not open it again).
    await page.waitForURL((url) => url.pathname === "/de/app" && url.search === "");
    const sheet = page.getByRole("dialog", { name: "Zu deiner Seite hinzufügen" });
    await expect(sheet).toBeVisible();
    const field = sheet.getByLabel("Link einfügen");
    await expect(field).toHaveValue(SPOTIFY);
    await expect(sheet.getByText("Musik erkannt")).toBeVisible();
    // The same flow as pasting it: Add puts it on the page.
    await sheet.getByRole("button", { name: "Hinzufügen", exact: true }).click();
    await expect(sheet).toBeHidden();
    await expect
      .poll(() =>
        page.evaluate((link) => {
          const db = JSON.parse(window.localStorage.getItem("linkyo.demo.v1") ?? "{}") as { session?: { accountId: string }; sites?: Record<string, { page: { blocks: unknown[] } }> };
          const blocks = db.sites?.[db.session?.accountId ?? ""]?.page.blocks ?? [];
          return blocks.some((block) => JSON.stringify(block).includes(link));
        }, SPOTIFY),
      )
      .toBe(true);

    await page.goto(`/de/app/share?text=${encodeURIComponent("Nur ein Gedanke, kein Link")}`);
    await expect(sheet).toBeVisible();
    await expect(field).toHaveValue("");
    await expect(sheet.getByText("Im Geteilten war kein Link. Füg ihn hier ein.")).toBeVisible();

    await page.goto("/de/app?add=1");
    await expect(sheet).toBeVisible();
    await expect(field).toHaveValue("");
    await expect(sheet.getByText("Im Geteilten war kein Link.")).toHaveCount(0);
  });

  test("signed out, a share goes through sign-in and comes back to the Add sheet holding the link", async ({ page }) => {
    const { email } = await signedIn(page, "de");
    await page.goto("/de/app/settings");
    await page.getByRole("button", { name: "Abmelden" }).click();
    await page.waitForURL("**/de/login**");

    await page.goto(`/de/app/share?text=${encodeURIComponent(`Hör mal ${SPOTIFY}`)}`);
    await page.waitForURL("**/de/login?next=**");
    expect(new URL(page.url()).searchParams.get("next")).toBe(`/app?shared=${encodeURIComponent(SPOTIFY)}`);
    await page.locator("#login-email").fill(email);
    await page.locator("form button[type=submit]").click();
    await enterDemoCode(page);
    await page.waitForURL((url) => url.pathname === "/de/app" && url.search === "");
    const sheet = page.getByRole("dialog", { name: "Zu deiner Seite hinzufügen" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByLabel("Link einfügen")).toHaveValue(SPOTIFY);
  });
});

test.describe("install sheet: Chrome and Edge on a computer, Android", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(OFFER);
  });

  test("one Installieren button opens the browser's own dialog; then Linkyo is installed", async ({ page }) => {
    await signedIn(page, "de");
    const sheet = await openInstallSheet(page);
    await expect(sheet.locator("[data-install-variant]")).toHaveAttribute("data-install-variant", "prompt");
    await expect(sheet.getByRole("button", { name: "Installieren" })).toHaveCount(1);
    await sheet.getByRole("button", { name: "Installieren" }).click();
    expect(await page.evaluate(() => (window as unknown as { __prompted?: number }).__prompted)).toBe(1);
    await expect(sheet.getByRole("heading", { name: "Linkyo ist installiert" })).toBeVisible();
    await expect(sheet.locator("[data-install-variant]")).toHaveAttribute("data-install-variant", "installed");
    // No promise beyond what the app does.
    await expect(sheet).not.toContainText(/Benachrichtigung|App Store/);
  });

  test("Home's hint shows once, and only where the browser offers to install", async ({ page }) => {
    await signedIn(page, "de");
    const hint = page.locator("[data-install-hint]");
    await expect(hint).toBeVisible();
    await expect(hint.getByRole("heading", { name: "Linkyo als App" })).toBeVisible();
    expect(await page.evaluate(() => window.localStorage.getItem("linkyo.installHint"))).toBe("shown");
    // The next Home has the offer again, but the hint has been shown.
    await page.reload();
    await page.waitForFunction(() => Boolean((window as unknown as { __linkyoInstallPrompt?: unknown }).__linkyoInstallPrompt));
    await expect(page.locator("#main h1").first()).toBeVisible();
    await expect(hint).toHaveCount(0);
  });

  test("the hint's button opens the browser's dialog; its X takes it away", async ({ page, context }) => {
    await signedIn(page, "en");
    const hint = page.locator("[data-install-hint]");
    await hint.getByRole("button", { name: "Install" }).click();
    expect(await page.evaluate(() => (window as unknown as { __prompted?: number }).__prompted)).toBe(1);
    // Installed: no hint any more.
    await expect(hint).toHaveCount(0);

    // Another browser (its own storage): the X hides the hint at once.
    const other = await context.browser()?.newContext({ baseURL: new URL(page.url()).origin });
    if (!other) throw new Error("no browser");
    const second = await other.newPage();
    await second.addInitScript(OFFER);
    await signedIn(second, "ar");
    const secondHint = second.locator("[data-install-hint]");
    await expect(secondHint.getByRole("heading", { name: "Linkyo كتطبيق" })).toBeVisible();
    await secondHint.getByRole("button", { name: "إخفاء هذا التلميح" }).click();
    await expect(secondHint).toHaveCount(0);
    await other.close();
  });
});

test.describe("install sheet: iPhone and iPad", () => {
  test.use({ userAgent: UA.iphone, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("three steps with the share glyph, and no hint on Home", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "the device is emulated here; one run is enough");
    await signedIn(page, "de");
    await expect(page.locator("#main h1").first()).toBeVisible();
    await expect(page.locator("[data-install-hint]")).toHaveCount(0);
    const sheet = await openInstallSheet(page);
    await expect(sheet.locator("[data-install-variant]")).toHaveAttribute("data-install-variant", "ios");
    const steps = sheet.getByRole("listitem");
    await expect(steps).toHaveText([/Tippe auf „Teilen“/, /„Zum Home-Bildschirm“/, /„Hinzufügen“/]);
    await expect(steps.first().locator("svg")).toHaveCount(1);
    await expect(sheet.getByRole("button", { name: "Installieren" })).toHaveCount(0);
  });

  test("inside the installed app it says so", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "the device is emulated here; one run is enough");
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "standalone", { get: () => true }));
    await signedIn(page, "de");
    await page.goto("/de/app/settings");
    await expect(page.getByRole("button", { name: /^Linkyo als App/ })).toContainText("Installiert");
    const sheet = await openInstallSheet(page);
    await expect(sheet.getByRole("heading", { name: "Linkyo ist installiert" })).toBeVisible();
  });
});

test.describe("install sheet: Safari on a Mac, and Chrome's own window", () => {
  test("Safari on a Mac: File › Add to Dock", async ({ browser, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "a laptop browser");
    const context = await browser.newContext({ baseURL: baseURL ?? "", userAgent: UA.macSafari, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await signedIn(page, "de");
    const sheet = await openInstallSheet(page);
    await expect(sheet.locator("[data-install-variant]")).toHaveAttribute("data-install-variant", "macSafari");
    await expect(sheet.getByRole("listitem")).toHaveCount(1);
    await expect(sheet.getByRole("listitem")).toContainText("Wähle in der Menüleiste „Ablage“ › „Zum Dock hinzufügen“.");
    await context.close();
  });

  test("opened from the icon (display mode standalone): installed", async ({ page }) => {
    // Chrome's DevTools protocol cannot emulate display-mode: the media query answers as in an app window.
    await page.addInitScript(() => {
      const real = window.matchMedia.bind(window);
      window.matchMedia = (query: string) => (/display-mode:\s*standalone/.test(query) ? real("(min-width: 0px)") : real(query));
    });
    await page.addInitScript(OFFER);
    await signedIn(page, "de");
    await expect(page.locator("#main h1").first()).toBeVisible();
    await expect(page.locator("[data-install-hint]")).toHaveCount(0);
    const sheet = await openInstallSheet(page);
    await expect(sheet.locator("[data-install-variant]")).toHaveAttribute("data-install-variant", "installed");
  });
});

test("the install sheet is axe-clean in de, en and ar, light and dark", async ({ page }) => {
  await page.addInitScript(OFFER);
  await signedIn(page, "de");
  for (const locale of LOCALES) {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      const sheet = await openInstallSheet(page, locale);
      await expect(sheet.locator("[data-install-variant]")).toHaveAttribute("data-install-variant", "prompt");
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      const summary = results.violations.map((v) => `${v.id} (${String(v.impact)}): ${String(v.nodes.length)}× — ${v.nodes[0]?.target.join(" ") ?? ""}`);
      expect(summary, `${locale} ${scheme}`).toEqual([]);
    }
  }
});
