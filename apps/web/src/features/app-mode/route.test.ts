import { describe, expect, it } from "vitest";

import { navigationTarget, routeParts } from "./route";

const ORIGIN = "https://linkyo.app";

describe("the route message's name and back", () => {
  it("names the tabs, which lead back nowhere", () => {
    expect(routeParts("/app", "home")).toEqual({ title: "nav.home", back: null });
    expect(routeParts("/app/editor", "home")).toEqual({ title: "nav.page", back: null });
    expect(routeParts("/app/work", "home")).toEqual({ title: "nav.work", back: null });
    expect(routeParts("/app/design", "home")).toEqual({ title: "nav.design", back: null });
    expect(routeParts("/app/analytics", "home")).toEqual({ title: "nav.analytics", back: null });
  });

  it("leads Settings back to the tab it was opened from, and its panes and Invite back to Settings", () => {
    expect(routeParts("/app/settings", "analytics")).toEqual({ title: "nav.settings", back: "/app/analytics" });
    expect(routeParts("/app/settings/", "page")).toEqual({ title: "nav.settings", back: "/app/editor" });
    expect(routeParts("/app/settings/plan", "home")).toEqual({ title: "settings.panes.plan", back: "/app/settings" });
    expect(routeParts("/app/settings/account", "home")).toEqual({ title: "settings.panes.account", back: "/app/settings" });
    expect(routeParts("/app/invite", "home")).toEqual({ title: "invite.title", back: "/app/settings" });
  });

  it("names no screen outside the dashboard's table: the app names those itself", () => {
    for (const path of ["/app/preview", "/app/welcome", "/app/build", "/app/orders/o1", "/app/proposals/p1", "/hilfe"]) {
      expect(routeParts(path, "home"), path).toEqual({ title: null, back: null });
    }
  });
});

describe("navigate(path)", () => {
  it("splits a path with its language into the language and the rest", () => {
    expect(navigationTarget("/de/app/editor?edit=b1", ORIGIN)).toEqual({ locale: "de", href: "/app/editor?edit=b1" });
    expect(navigationTarget("/ar/app/settings/plan", ORIGIN)).toEqual({ locale: "ar", href: "/app/settings/plan" });
    expect(navigationTarget("/en/app", ORIGIN)).toEqual({ locale: "en", href: "/app" });
    expect(navigationTarget("/de/app/analytics#week", ORIGIN)).toEqual({ locale: "de", href: "/app/analytics#week" });
  });

  it("refuses every page outside the dashboard: the app loads those itself, so its navigation policy sees them", () => {
    // pushState never asks WKNavigationDelegate: a page reached this way would pass the app's policy by.
    for (const path of ["/de", "/", "/en/hilfe#statistik", "/de/checkout/pro", "/checkout/pro", "/de/service", "/de/kuendigen", "/de/datenschutz", "/de/admin", "/de/application", "/de/app/../checkout/pro", "/de/app/%2e%2e/checkout/pro"]) {
      expect(navigationTarget(path, ORIGIN), path).toBeNull();
    }
  });

  it("keeps the current language for a path without one", () => {
    expect(navigationTarget("/app/design?tab=fonts", ORIGIN)).toEqual({ locale: null, href: "/app/design?tab=fonts" });
  });

  it("refuses anything that is not a path of this site", () => {
    const refused: unknown[] = [
      "https://evil.example/de/app",
      "//evil.example/de/app",
      "/\\evil.example",
      "javascript:alert(1)",
      "app/design",
      "",
      `/${"a".repeat(2048)}`,
      null,
      42,
      { pathname: "/de/app" },
    ];
    for (const path of refused) expect(navigationTarget(path, ORIGIN), String(path)).toBeNull();
  });
});
