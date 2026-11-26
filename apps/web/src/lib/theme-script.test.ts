import { afterEach, describe, expect, it, vi } from "vitest";

import { THEME_STORAGE_KEY, themeInitScript } from "./theme-script";

/** Runs the script as the page's head does, on a stand-in document; answers the theme it set. */
function run({ app, stored }: { app?: string; stored: string | null }): string | undefined {
  const dataset: Record<string, string> = app === undefined ? {} : { app };
  vi.stubGlobal("document", { documentElement: { dataset } });
  vi.stubGlobal("localStorage", { getItem: (key: string) => (key === THEME_STORAGE_KEY ? stored : null) });
  // The inline script exactly as the page runs it.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- the script is a string by design (it runs before any bundle)
  const script = new Function(themeInitScript) as () => void;
  script();
  return dataset.theme;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the theme script before the first paint", () => {
  it("applies a stored light or dark choice in a browser", () => {
    expect(run({ stored: "dark" })).toBe("dark");
    expect(run({ stored: "light" })).toBe("light");
    expect(run({ stored: null })).toBeUndefined();
    expect(run({ stored: "blue" })).toBeUndefined();
  });

  it("leaves the appearance to the device inside the iPhone app, whatever is stored (the app sets it)", () => {
    expect(run({ app: "ios", stored: "dark" })).toBeUndefined();
    expect(run({ app: "ios", stored: "light" })).toBeUndefined();
  });

  it("treats a platform the code does not know as a browser, as the rest of app mode does", () => {
    expect(run({ app: "android", stored: "dark" })).toBe("dark");
  });
});
