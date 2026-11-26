import { runInNewContext } from "node:vm";

import { describe, expect, it, vi } from "vitest";

import { launchQueueInitScript } from "./launch-queue-script";

/**
 * The installed app's launches into a window that is already open (focus-existing): the head script
 * runs against a stand-in window, and the launch parameters are handed to the consumer it sets, as
 * Chrome does. It loads what a shortcut or a share asks for, and nothing else.
 */
const ORIGIN = "https://linkyo.example";

function windowAt(address: string, readyState: "loading" | "interactive" | "complete" = "complete", queue = true) {
  let consumer: ((params: { targetURL?: unknown }) => void) | null = null;
  const assign = vi.fn();
  const here = new URL(address, ORIGIN);
  const window = {
    location: { href: here.href, origin: here.origin, assign },
    document: { readyState },
    ...(queue
      ? {
          launchQueue: {
            setConsumer: (fn: typeof consumer) => {
              consumer = fn;
            },
          },
        }
      : {}),
  };
  runInNewContext(launchQueueInitScript, { window, URL });
  return {
    assign,
    hasConsumer: () => consumer !== null,
    launch: (targetURL?: unknown) => {
      if (!consumer) throw new Error("no consumer set");
      consumer(targetURL === undefined ? {} : { targetURL });
    },
  };
}

describe("launches into the open app window", () => {
  it("loads a shortcut's screen and the share route in the window", () => {
    const app = windowAt("/de/app/settings");
    expect(app.hasConsumer()).toBe(true);
    app.launch(`${ORIGIN}/de/app/analytics`);
    expect(app.assign).toHaveBeenLastCalledWith("/de/app/analytics");
    app.launch(`${ORIGIN}/de/app/share?text=H%C3%B6r%20mal%20https%3A%2F%2Fopen.spotify.com%2Ftrack%2F1`);
    expect(app.assign).toHaveBeenLastCalledWith("/de/app/share?text=H%C3%B6r%20mal%20https%3A%2F%2Fopen.spotify.com%2Ftrack%2F1");
    app.launch(`${ORIGIN}/de/app?add=1`);
    expect(app.assign).toHaveBeenLastCalledWith("/de/app?add=1");
    app.launch(`${ORIGIN}/de/app#home-link`);
    expect(app.assign).toHaveBeenLastCalledWith("/de/app#home-link");
    expect(app.assign).toHaveBeenCalledTimes(4);
  });

  it("works from any page of the site the window shows, sign-in included", () => {
    const app = windowAt("/de/login?next=%2Fapp");
    app.launch(`${ORIGIN}/de/app/editor`);
    expect(app.assign).toHaveBeenCalledWith("/de/app/editor");
  });

  it("ignores another origin, an empty or broken address, and the page already shown", () => {
    const app = windowAt("/de/app/analytics");
    app.launch("https://evil.example/de/app/share?text=x");
    app.launch("http://linkyo.example/de/app/analytics");
    app.launch("");
    app.launch();
    app.launch(null);
    app.launch("not an address");
    app.launch(`${ORIGIN}/de/app/analytics`);
    expect(app.assign).not.toHaveBeenCalled();
  });

  it("only brings the window to the front for a plain start from the icon, in any language", () => {
    const app = windowAt("/de/app/editor");
    for (const locale of ["de", "en", "ar"]) app.launch(`${ORIGIN}/${locale}/app?source=app`);
    expect(app.assign).not.toHaveBeenCalled();
    // Home itself without the start mark is a screen like any other.
    app.launch(`${ORIGIN}/de/app`);
    expect(app.assign).toHaveBeenCalledWith("/de/app");
  });

  it("does not load the launch that opened this window again (its parameters arrive while the page loads)", () => {
    for (const state of ["loading", "interactive"] as const) {
      const app = windowAt("/de/app?shared=https%3A%2F%2Fopen.spotify.com%2Ftrack%2F1", state);
      app.launch(`${ORIGIN}/de/app/share?text=https%3A%2F%2Fopen.spotify.com%2Ftrack%2F1`);
      expect(app.assign).not.toHaveBeenCalled();
    }
  });

  it("does nothing in a browser without a launch queue (Safari, Firefox)", () => {
    expect(() => windowAt("/de/app", "complete", false)).not.toThrow();
    expect(windowAt("/de/app", "complete", false).hasConsumer()).toBe(false);
  });
});
