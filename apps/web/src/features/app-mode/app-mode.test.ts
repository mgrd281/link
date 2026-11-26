import { afterEach, describe, expect, it, vi } from "vitest";

import { appPlatform, inAppMode, linkyoApp, type AppWindow } from "./app-mode";

/** A page whose <html> carries `data-app` (or not), as the app's document-start script leaves it. */
function page(app?: string) {
  const dataset: Record<string, string> = app === undefined ? {} : { app };
  vi.stubGlobal("document", { documentElement: { dataset } });
  const win = {} as AppWindow;
  vi.stubGlobal("window", win);
  return win;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the app-mode signal", () => {
  it("is off on the server (no document)", () => {
    expect(appPlatform()).toBeNull();
    expect(inAppMode()).toBe(false);
  });

  it("is off in a browser: no data-app on <html>", () => {
    page();
    expect(appPlatform()).toBeNull();
    expect(inAppMode()).toBe(false);
  });

  it("names the platform the app set before the first paint", () => {
    page("ios");
    expect(appPlatform()).toBe("ios");
    expect(inAppMode()).toBe(true);
  });

  it("knows only the platforms that exist: an unknown or empty value is a browser", () => {
    for (const value of ["", "android", "IOS", "true"]) {
      page(value);
      expect(inAppMode(), value).toBe(false);
    }
  });
});

describe("window.linkyoApp", () => {
  it("keeps the object the app made, with everything on it", () => {
    const win = page("ios");
    const flush = () => Promise.resolve({ updatedAt: "x" });
    win.linkyoApp = { platform: "ios", version: "1.0", bridge: 1, flush };
    const app = linkyoApp();
    expect(app).toBe(win.linkyoApp);
    expect(app).toMatchObject({ platform: "ios", version: "1.0", bridge: 1, flush });
  });

  it("is made when the app's script has not made it, and then stays the same object", () => {
    const win = page("ios");
    const app = linkyoApp();
    expect(win.linkyoApp).toBe(app);
    expect(linkyoApp()).toBe(app);
  });
});
