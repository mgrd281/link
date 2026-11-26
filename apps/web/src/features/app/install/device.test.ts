import { describe, expect, it } from "vitest";

import { installVariant, isChromium, isIos, isMacSafari, type DeviceFacts } from "./device";

/** The install sheet shows only the way that works on the device (device.ts). */
const UA = {
  chromeWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
  edgeMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0",
  chromeAndroid: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36",
  iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  iphoneChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/142.0.0.0 Mobile/15E148 Safari/604.1",
  ipadSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
  macSafari18: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
  macSafari16: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15",
  firefoxMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:140.0) Gecko/20100101 Firefox/140.0",
  firefoxWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0",
  samsungAndroid: "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36",
  operaWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 OPR/126.0.0.0",
  edgeIphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/142.0.0.0 Mobile/15E148 Safari/605.1.15",
} as const;

const facts = (userAgent: string, rest: Partial<DeviceFacts> = {}): DeviceFacts => ({
  standalone: false,
  installed: false,
  canPrompt: false,
  declined: false,
  userAgent,
  maxTouchPoints: 0,
  ...rest,
});

describe("the way to install on this device", () => {
  it("is the browser's own dialog wherever it offers one (Chrome, Edge, Android)", () => {
    for (const ua of [UA.chromeWindows, UA.edgeMac, UA.chromeAndroid]) expect(installVariant(facts(ua, { canPrompt: true }))).toBe("prompt");
    expect(installVariant(facts(UA.chromeAndroid, { declined: true }))).toBe("later");
  });

  it("is Share › Add to Home Screen on iPhone and iPad, in any browser there", () => {
    expect(installVariant(facts(UA.iphoneSafari, { maxTouchPoints: 5 }))).toBe("ios");
    expect(installVariant(facts(UA.iphoneChrome, { maxTouchPoints: 5 }))).toBe("ios");
    // iPadOS's Safari calls itself a Mac; its touch screen gives it away.
    expect(isIos(UA.ipadSafari, 5)).toBe(true);
    expect(installVariant(facts(UA.ipadSafari, { maxTouchPoints: 5 }))).toBe("ios");
  });

  it("is File › Add to Dock in Safari 17 or newer on a Mac, and nothing in older Safari or Firefox", () => {
    expect(isMacSafari(UA.macSafari18, 0)).toBe(true);
    expect(isMacSafari(UA.edgeMac, 0)).toBe(false);
    expect(installVariant(facts(UA.macSafari18))).toBe("macSafari");
    expect(installVariant(facts(UA.macSafari16))).toBe("other");
    expect(installVariant(facts(UA.firefoxMac))).toBe("other");
    expect(installVariant(facts(UA.firefoxWindows))).toBe("other");
  });

  it("points Chrome, Edge, Samsung Internet and Opera without an offer to the app's icon or the browser's menu", () => {
    // No offer: already installed (Chrome never offers it then), a private window, or the offer is still to come.
    for (const ua of [UA.chromeWindows, UA.edgeMac, UA.chromeAndroid, UA.samsungAndroid, UA.operaWindows]) {
      expect(isChromium(ua), ua).toBe(true);
      expect(installVariant(facts(ua)), ua).toBe("chromium");
    }
    // iPhone browsers are WebKit: their way is the share sheet, whatever they are called.
    expect(installVariant(facts(UA.iphoneChrome, { maxTouchPoints: 5 }))).toBe("ios");
    expect(installVariant(facts(UA.edgeIphone, { maxTouchPoints: 5 }))).toBe("ios");
    for (const ua of [UA.macSafari18, UA.firefoxMac, UA.iphoneSafari]) expect(isChromium(ua), ua).toBe(false);
  });

  it("says installed inside the app, whatever the device", () => {
    expect(installVariant(facts(UA.iphoneSafari, { standalone: true, maxTouchPoints: 5 }))).toBe("installed");
    expect(installVariant(facts(UA.chromeWindows, { standalone: true, canPrompt: true }))).toBe("installed");
    expect(installVariant(facts(UA.chromeWindows, { installed: true }))).toBe("installed");
  });
});
