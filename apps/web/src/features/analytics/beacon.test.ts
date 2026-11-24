import { readFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { beaconScript } from "./beacon-script";

// The counter is what visitors' browsers run. It is run here against a fake browser, and its text
// is held to the privacy rules, so a later change cannot quietly add a cookie, storage, a
// fingerprint or another host.

const WEB = path.resolve(import.meta.dirname, "../../..");

interface Element {
  closest: (selector: string) => Element | null;
  getAttribute: (name: string) => string | null;
}

/** An element inside a block (or not), as `closest` sees it. */
function element({ control, block }: { control: boolean; block?: string }): Element {
  const holder: Element | null = block ? { closest: () => null, getAttribute: (name) => (name === "data-block" ? block : null) } : null;
  const button: Element = { closest: (selector) => (selector === "[data-block]" ? holder : null), getAttribute: () => null };
  return { closest: (selector) => (selector.startsWith("a[href]") ? (control ? button : null) : holder), getAttribute: () => null };
}

interface Browser {
  sent: Record<string, string>[];
  fetched: number;
  fire: (type: string, event?: object) => void;
  document: { visibilityState: string; prerendering?: boolean };
}

/** Runs the script for page "mila" in a fake browser and answers what it sent. */
function run({ gpc = false, dnt = null as string | null, visibility = "visible", prerendering = false, referrer = "", search = "", beacon = true } = {}): Browser {
  const listeners = new Map<string, ((event: object) => void)[]>();
  const sent: Record<string, string>[] = [];
  const browser: Browser = {
    sent,
    fetched: 0,
    fire: (type, event = {}) => {
      for (const listener of listeners.get(type) ?? []) listener({ type, ...event });
    },
    document: { visibilityState: visibility, prerendering },
  };
  const navigator = {
    globalPrivacyControl: gpc,
    doNotTrack: dnt,
    sendBeacon: (url: string, body: string) => {
      expect(url).toBe("/api/collect");
      if (!beacon) return false;
      sent.push(JSON.parse(body) as Record<string, string>);
      return true;
    },
  };
  const document = Object.assign(browser.document, {
    referrer,
    addEventListener: (type: string, listener: (event: object) => void) => listeners.set(type, [...(listeners.get(type) ?? []), listener]),
  });
  const fetch = (url: string, init: { body: string; keepalive: boolean; credentials: string }) => {
    expect(url).toBe("/api/collect");
    expect(init.keepalive).toBe(true);
    expect(init.credentials).toBe("omit");
    browser.fetched += 1;
    sent.push(JSON.parse(init.body) as Record<string, string>);
    return Promise.resolve();
  };
  // Runs the very text the page carries, with the fakes in place of the browser's globals.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- that text is what is under test
  const page = new Function("navigator", "document", "location", "fetch", beaconScript("mila")) as (...globals: unknown[]) => void;
  page(navigator, document, { search }, fetch);
  return browser;
}

describe("the counter in the page", () => {
  it("sends one view with the referring host only", () => {
    const browser = run({ referrer: "https://l.instagram.com/some/path?u=secret" });
    expect(browser.sent).toEqual([{ t: "v", r: "l.instagram.com", p: "mila" }]);
    browser.fire("visibilitychange");
    expect(browser.sent).toHaveLength(1);
  });

  it("marks a QR code", () => {
    expect(run({ search: "?src=qr" }).sent).toEqual([{ t: "v", r: "", s: "qr", p: "mila" }]);
  });

  it("waits until a background tab or a prerendered page is really seen", () => {
    const hidden = run({ visibility: "hidden" });
    expect(hidden.sent).toEqual([]);
    hidden.document.visibilityState = "visible";
    hidden.fire("visibilitychange");
    expect(hidden.sent).toHaveLength(1);

    const prerendered = run({ prerendering: true });
    expect(prerendered.sent).toEqual([]);
    prerendered.document.prerendering = false;
    prerendered.fire("prerenderingchange");
    expect(prerendered.sent).toHaveLength(1);
  });

  it("sends nothing at all when the browser asks not to be tracked", () => {
    for (const browser of [run({ gpc: true }), run({ dnt: "1" })]) {
      browser.fire("click", { target: element({ control: true, block: "shop" }) });
      expect(browser.sent).toEqual([]);
    }
  });

  it("counts a tap on a link or button inside a block, once per double tap", () => {
    const browser = run();
    browser.fire("click", { target: element({ control: true, block: "shop" }) });
    browser.fire("click", { target: element({ control: true, block: "shop" }) });
    browser.fire("click", { target: element({ control: true, block: "tour" }) });
    browser.fire("auxclick", { target: element({ control: true, block: "press" }), button: 1 });
    browser.fire("auxclick", { target: element({ control: true, block: "press" }), button: 2 });
    expect(browser.sent.slice(1)).toEqual([
      { t: "c", b: "shop", p: "mila" },
      { t: "c", b: "tour", p: "mila" },
      { t: "c", b: "press", p: "mila" },
    ]);
  });

  it("ignores clicks on text and outside blocks", () => {
    const browser = run();
    browser.fire("click", { target: element({ control: false, block: "about" }) });
    browser.fire("click", { target: element({ control: true }) });
    browser.fire("click", { target: null });
    expect(browser.sent).toHaveLength(1);
  });

  it("falls back to a keepalive request without credentials when there is no beacon", () => {
    const browser = run({ beacon: false });
    expect(browser.fetched).toBe(1);
    expect(browser.sent).toEqual([{ t: "v", r: "", p: "mila" }]);
  });
});

describe("the counter's text", () => {
  const script = beaconScript("mila");

  it("reads and writes nothing on the device and reads no fingerprint", () => {
    for (const banned of ["cookie", "localStorage", "sessionStorage", "indexedDB", "caches", "canvas", "userAgent", "screen", "devicePixelRatio", "plugins", "hardwareConcurrency", "deviceMemory", "language", "timeZone", "getBattery", "webgl"])
      expect(script, banned).not.toContain(banned);
  });

  it("talks only to its own origin, at /api/collect", () => {
    const addresses = [...script.matchAll(/"(\/[^"]*|https?:[^"]*)"/g)].map((match) => match[1]);
    expect(new Set(addresses)).toEqual(new Set(["/api/collect"]));
    expect(script).not.toMatch(/https?:\/\//);
  });

  it("stays tiny: well under 2 KB gzip", () => {
    expect(gzipSync(script).length).toBeLessThan(1024);
  });

  it("cannot be broken out of by a page name", () => {
    expect(beaconScript("</script><script>alert(1)</script>")).not.toContain("</script>");
  });

  it("is written into creator pages only while the server switch is on", () => {
    const layout = readFileSync(path.join(WEB, "src/app/u/[username]/layout.tsx"), "utf8");
    expect(layout).toMatch(/\{found && analyticsEnabled\(\) \? <script data-beacon dangerouslySetInnerHTML=\{\{ __html: beaconScript\(found\.page\.profile\.username\) \}\} \/> : null\}/);
    expect(layout.match(/beaconScript\(/g)).toHaveLength(1);
  });
});
