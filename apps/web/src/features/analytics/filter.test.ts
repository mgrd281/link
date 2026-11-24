import { describe, expect, it } from "vitest";

import { fromOwnPage, isBot, isPrefetch, optedOut } from "./filter";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const ANDROID_CUBOT = "Mozilla/5.0 (Linux; Android 12; CUBOT X50 Build/SP1A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const INSTAGRAM_APP = `${IPHONE} Instagram 356.0.0.21.106 (iPhone15,2; iOS 18_1; de_DE; de; scale=3.00; 1179x2556; 657226584)`;
const FACEBOOK_APP = `${IPHONE} [FBAN/FBIOS;FBAV/488.0.0.51.110;FBBV/668118580;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.1;FBSS/3;FBID/phone;FBLC/de_DE;FBOP/5]`;

const headers = (entries: Record<string, string>) => new Headers(entries);

describe("the bot filter", () => {
  it("lets people's browsers through, in-app browsers included", () => {
    for (const ua of [IPHONE, CHROME, ANDROID_CUBOT, INSTAGRAM_APP, FACEBOOK_APP]) expect(isBot(ua), ua).toBe(false);
  });

  it("stops crawlers, link previews, monitors, headless browsers and scripts", () => {
    const bots = [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/600.2.5 (KHTML, like Gecko) Version/8.0.2 Safari/600.2.5 (Applebot/0.1; +http://www.apple.com/go/applebot)",
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
      "WhatsApp/2.23.20.0 A",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse",
      "Mozilla/5.0 (compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)",
      "curl/8.5.0",
      "python-requests/2.32.3",
      "node-fetch/1.0 (+https://github.com/bitinn/node-fetch)",
      "Go-http-client/2.0",
      "",
      "Mozilla/5.0",
    ];
    for (const ua of bots) expect(isBot(ua), ua).toBe(true);
    expect(isBot(null)).toBe(true);
  });
});

describe("privacy signals", () => {
  it("honour Global Privacy Control and Do Not Track", () => {
    expect(optedOut(headers({ "sec-gpc": "1" }))).toBe(true);
    expect(optedOut(headers({ dnt: "1" }))).toBe(true);
    expect(optedOut(headers({ dnt: "0" }))).toBe(false);
    expect(optedOut(headers({}))).toBe(false);
  });

  it("skip prefetches and prerenders nobody may look at", () => {
    expect(isPrefetch(headers({ "sec-purpose": "prefetch;prerender" }))).toBe(true);
    expect(isPrefetch(headers({ purpose: "prefetch" }))).toBe(true);
    expect(isPrefetch(headers({}))).toBe(false);
  });
});

describe("same origin", () => {
  const host = "linkyo.app";

  it("takes a beacon from the page's own origin", () => {
    expect(fromOwnPage(headers({ "sec-fetch-site": "same-origin", origin: "https://linkyo.app" }), host)).toBe(true);
    expect(fromOwnPage(headers({ "sec-fetch-site": "same-origin" }), host)).toBe(true);
    // A browser without fetch metadata still names the origin.
    expect(fromOwnPage(headers({ origin: "https://linkyo.app" }), host)).toBe(true);
  });

  it("refuses other sites, other origins and requests that name neither", () => {
    expect(fromOwnPage(headers({ "sec-fetch-site": "cross-site", origin: "https://evil.example" }), host)).toBe(false);
    expect(fromOwnPage(headers({ "sec-fetch-site": "same-site", origin: "https://www.linkyo.app" }), host)).toBe(false);
    expect(fromOwnPage(headers({ origin: "https://evil.example" }), host)).toBe(false);
    expect(fromOwnPage(headers({ "sec-fetch-site": "same-origin", origin: "https://evil.example" }), host)).toBe(false);
    expect(fromOwnPage(headers({}), host)).toBe(false);
  });
});
