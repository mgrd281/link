import { describe, expect, it, vi } from "vitest";

import { startDashboardWorker, UPDATE_EVERY, type RegisterEnv } from "./register";

/**
 * How the dashboard registers its worker and keeps it current, against a stand-in browser: after
 * the page's load, for this language's dashboard alone, never from the HTTP cache, and with an update
 * check when a window comes back to the front (at most hourly), so a deploy reaches windows that stay
 * open for days.
 */
function browser({ readyState = "complete", register = "ok" }: { readyState?: DocumentReadyState; register?: "ok" | "refused" | "none" } = {}) {
  let clock = 1_000_000;
  const update = vi.fn(() => Promise.resolve());
  const registerSpy = vi.fn(() => (register === "refused" ? Promise.reject(new Error("SecurityError")) : Promise.resolve({ update })));
  const listeners = new Map<string, () => void>();
  const target = {
    addEventListener: (type: string, listener: () => void) => listeners.set(type, listener),
    removeEventListener: (type: string, listener: () => void) => {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
  };
  const document = { ...target, readyState, visibilityState: "visible" as DocumentVisibilityState };
  const env: RegisterEnv = {
    serviceWorker: register === "none" ? undefined : { register: registerSpy },
    window: target,
    document,
    now: () => clock,
  };
  return {
    env,
    update,
    registerSpy,
    listeners,
    document,
    advance: (ms: number) => {
      clock += ms;
    },
    fire: (type: string) => listeners.get(type)?.(),
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("registering the dashboard's worker", () => {
  it("waits for the page's load, then registers this language's worker for its dashboard, never from the HTTP cache", async () => {
    const b = browser({ readyState: "interactive" });
    startDashboardWorker("ar", b.env);
    expect(b.registerSpy).not.toHaveBeenCalled();
    b.fire("load");
    await settle();
    expect(b.registerSpy).toHaveBeenCalledExactlyOnceWith("/ar/app/sw.js", { scope: "/ar/app", updateViaCache: "none" });
  });

  it("registers at once on a page that has already loaded", () => {
    const b = browser();
    startDashboardWorker("de", b.env);
    expect(b.registerSpy).toHaveBeenCalledExactlyOnceWith("/de/app/sw.js", { scope: "/de/app", updateViaCache: "none" });
  });

  it("asks for a new worker when the window comes back to the front, at most once an hour", async () => {
    const b = browser();
    startDashboardWorker("de", b.env);
    await settle();
    b.advance(UPDATE_EVERY - 1);
    b.fire("visibilitychange");
    expect(b.update).not.toHaveBeenCalled();
    b.advance(1);
    b.document.visibilityState = "hidden";
    b.fire("visibilitychange");
    expect(b.update).not.toHaveBeenCalled();
    b.document.visibilityState = "visible";
    b.fire("visibilitychange");
    expect(b.update).toHaveBeenCalledTimes(1);
    b.fire("visibilitychange");
    expect(b.update).toHaveBeenCalledTimes(1);
    b.advance(UPDATE_EVERY);
    b.fire("visibilitychange");
    expect(b.update).toHaveBeenCalledTimes(2);
  });

  it("leaves before the page has loaded without registering, and stops listening", () => {
    const b = browser({ readyState: "loading" });
    const stop = startDashboardWorker("de", b.env);
    stop();
    expect(b.listeners.size).toBe(0);
    expect(b.registerSpy).not.toHaveBeenCalled();
  });

  it("works the same without a worker: a browser without one, or one that refuses it", async () => {
    const none = browser({ register: "none" });
    expect(() => startDashboardWorker("de", none.env)()).not.toThrow();
    expect(none.listeners.size).toBe(0);
    const refused = browser({ register: "refused" });
    startDashboardWorker("de", refused.env);
    await settle();
    refused.advance(UPDATE_EVERY);
    refused.fire("visibilitychange");
    expect(refused.update).not.toHaveBeenCalled();
  });
});
