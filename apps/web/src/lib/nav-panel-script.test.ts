import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";

import { NAV_PANEL_STORAGE_KEY, navPanelInitScript } from "./nav-panel-script";

/** Runs the pre-paint script against a fake document and storage, as the browser would in <head>. */
function run(storage: { getItem: (key: string) => string | null }) {
  const dataset: Record<string, string> = {};
  const read: string[] = [];
  const localStorage = {
    getItem: (key: string) => {
      read.push(key);
      return storage.getItem(key);
    },
  };
  runInNewContext(navPanelInitScript, { document: { documentElement: { dataset } }, localStorage });
  return { dataset, read };
}

describe("nav panel pre-paint script", () => {
  it("sets data-nav-panel from the stored choice", () => {
    expect(run({ getItem: () => "folded" }).dataset).toEqual({ navPanel: "folded" });
    expect(run({ getItem: () => "open" }).dataset).toEqual({ navPanel: "open" });
  });

  it("reads the documented key", () => {
    expect(run({ getItem: () => null }).read).toEqual([NAV_PANEL_STORAGE_KEY]);
    expect(NAV_PANEL_STORAGE_KEY).toBe("linkyo.navPanel");
  });

  it("sets nothing for no choice or junk", () => {
    expect(run({ getItem: () => null }).dataset).toEqual({});
    expect(run({ getItem: () => "closed" }).dataset).toEqual({});
    expect(run({ getItem: () => "" }).dataset).toEqual({});
    expect(run({ getItem: () => "FOLDED" }).dataset).toEqual({});
  });

  it("does not throw when storage throws (private mode, blocked site data)", () => {
    const blocked = {
      getItem: (): string | null => {
        throw new Error("SecurityError");
      },
    };
    expect(() => run(blocked)).not.toThrow();
    expect(run(blocked).dataset).toEqual({});
  });

  it("does not throw when there is no storage at all", () => {
    const dataset: Record<string, string> = {};
    expect(() => {
      runInNewContext(navPanelInitScript, { document: { documentElement: { dataset } } });
    }).not.toThrow();
    expect(dataset).toEqual({});
  });
});
