import { readFileSync } from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";

import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import de from "@/messages/de.json";

import { offlinePage, type OfflineKey } from "./offline-page";
import { serviceWorkerSource } from "./service-worker";

/**
 * The dashboard's service worker, run as the browser runs it: its script in a context of its own with
 * a stand-in for the worker's global scope. It answers page loads of the dashboard from the network
 * and with the offline page when the network fails; it leaves every other request and every address
 * outside the dashboard alone; it takes over at once; and it never touches Cache Storage.
 */
const ORIGIN = "https://linkyo.example";
const FAVICON = readFileSync(path.resolve(import.meta.dirname, "../../../public/favicon.svg"), "utf8");
const t = createTranslator({ locale: "de", messages: de, namespace: "pwa.offline" }) as unknown as (key: OfflineKey) => string;
const OFFLINE = offlinePage("de", t, FAVICON);

type Listener = (event: Record<string, unknown>) => void;

interface WorkerOptions {
  network?: "online" | "offline";
  preload?: Response | null;
}

function worker({ network = "online", preload = null }: WorkerOptions = {}) {
  const listeners = new Map<string, Listener>();
  const cacheUse = vi.fn();
  const fetchSpy = vi.fn((request: { url: string }) =>
    network === "online" ? Promise.resolve(new Response(`page ${request.url}`, { status: 200 })) : Promise.reject(new TypeError("Failed to fetch")),
  );
  const scope = {
    location: new URL(`${ORIGIN}/de/app/sw.js`),
    registration: { scope: `${ORIGIN}/de/app`, navigationPreload: { enable: vi.fn(() => Promise.resolve()) } },
    clients: { claim: vi.fn(() => Promise.resolve()) },
    skipWaiting: vi.fn(() => Promise.resolve()),
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
  };
  // Any use of Cache Storage is recorded (none is expected).
  const caches = new Proxy({}, { get: (_target, name) => (cacheUse(name), () => Promise.resolve(undefined)) });
  runInNewContext(serviceWorkerSource({ version: "test-build", scope: "/de/app", offlineHtml: OFFLINE }), {
    self: scope,
    fetch: fetchSpy,
    caches,
    Response,
    URL,
    console,
  });

  /** Dispatches a fetch event; resolves with the answer, or null when the worker left it alone. */
  async function request(url: string, mode = "navigate", method = "GET"): Promise<Response | null> {
    const answered: { response?: Promise<Response> } = {};
    listeners.get("fetch")?.({
      request: { url: `${ORIGIN}${url}`, mode, method },
      preloadResponse: Promise.resolve(preload ?? undefined),
      respondWith: (response: Promise<Response>) => {
        answered.response = response;
      },
    });
    return answered.response ? await answered.response : null;
  }
  return { listeners, scope, fetchSpy, cacheUse, request };
}

describe("the dashboard's service worker", () => {
  it("takes over at once and asks for page loads to start without waiting for it", async () => {
    const { listeners, scope } = worker();
    const waits: Promise<unknown>[] = [];
    const routes = vi.fn(() => Promise.resolve());
    listeners.get("install")?.({ waitUntil: (promise: Promise<unknown>) => waits.push(promise), addRoutes: routes });
    listeners.get("activate")?.({ waitUntil: (promise: Promise<unknown>) => waits.push(promise) });
    await Promise.all(waits);
    expect(scope.skipWaiting).toHaveBeenCalled();
    expect(scope.clients.claim).toHaveBeenCalled();
    expect(scope.registration.navigationPreload.enable).toHaveBeenCalled();
    // Everything that is not a page load goes straight to the network (Chrome's static routing).
    expect(routes).toHaveBeenCalledWith([{ condition: { or: [{ requestMode: "cors" }, { requestMode: "no-cors" }, { requestMode: "same-origin" }] }, source: "network" }]);
  });

  it("installs where static routing is missing or refuses the route", async () => {
    const { listeners, scope } = worker();
    const waits: Promise<unknown>[] = [];
    listeners.get("install")?.({ waitUntil: (promise: Promise<unknown>) => waits.push(promise) });
    listeners.get("install")?.({ waitUntil: (promise: Promise<unknown>) => waits.push(promise), addRoutes: () => Promise.reject(new TypeError("unknown condition")) });
    await expect(Promise.all(waits)).resolves.toBeDefined();
    expect(scope.skipWaiting).toHaveBeenCalledTimes(2);
  });

  it("loads dashboard pages from the network", async () => {
    const { request, fetchSpy } = worker();
    for (const url of ["/de/app", "/de/app?source=app", "/de/app/editor", "/de/app/settings/plan"]) {
      const answer = await request(url);
      expect(await answer?.text()).toBe(`page ${ORIGIN}${url}`);
    }
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it("uses the preloaded page when the browser started it already", async () => {
    const { request, fetchSpy } = worker({ preload: new Response("preloaded") });
    expect(await (await request("/de/app"))?.text()).toBe("preloaded");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("answers a dashboard page load with the German offline page when the network fails", async () => {
    const { request } = worker({ network: "offline" });
    const answer = await request("/de/app/editor");
    expect(answer?.status).toBe(200);
    expect(answer?.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(answer?.headers.get("X-Linkyo-Offline")).toBe("test-build");
    const html = (await answer?.text()) ?? "";
    expect(html).toBe(OFFLINE);
    expect(html).toContain('<html lang="de" dir="ltr">');
    expect(html).toContain(`<h1>${t("title")}</h1>`);
    expect(html).toContain(`>${t("retry")}</button>`);
  });

  it("leaves everything else alone: other requests, other methods, and every address outside the dashboard", async () => {
    const { request, fetchSpy } = worker({ network: "offline" });
    // API calls, scripts, pictures and form posts of the dashboard.
    expect(await request("/api/link-metadata?url=x", "cors")).toBeNull();
    expect(await request("/_next/static/chunks/app.js", "no-cors")).toBeNull();
    expect(await request("/de/app", "navigate", "POST")).toBeNull();
    // Creator pages, the website, sign-in, the team area, other languages, and a look-alike prefix.
    for (const url of ["/u/mila", "/mila", "/de/p/ronja-feldkamp", "/de", "/de/login", "/de/admin", "/en/app", "/de/apple", "/de/app-sw.js"]) {
      expect(await request(url), url).toBeNull();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("never touches Cache Storage", async () => {
    const { listeners, request, cacheUse } = worker({ network: "offline" });
    const waits: Promise<unknown>[] = [];
    listeners.get("install")?.({ waitUntil: (promise: Promise<unknown>) => waits.push(promise) });
    listeners.get("activate")?.({ waitUntil: (promise: Promise<unknown>) => waits.push(promise) });
    await Promise.all(waits);
    await request("/de/app");
    await request("/api/collect", "cors");
    expect(cacheUse).not.toHaveBeenCalled();
    expect(serviceWorkerSource({ version: "v", scope: "/de/app", offlineHtml: "" })).not.toMatch(/\bcaches\b|indexedDB|localStorage/);
  });

  it("carries the build's version, so every build installs a new worker", () => {
    const one = serviceWorkerSource({ version: "2026-11-26T01:00:00.000Z", scope: "/de/app", offlineHtml: OFFLINE });
    const two = serviceWorkerSource({ version: "2026-11-26T02:00:00.000Z", scope: "/de/app", offlineHtml: OFFLINE });
    expect(one).not.toBe(two);
    expect(one).toContain('const VERSION = "2026-11-26T01:00:00.000Z";');
  });
});
