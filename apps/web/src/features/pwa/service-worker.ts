/**
 * The dashboard's service worker (ADR draft "installable app"), one per language, served from
 * `/<locale>/app/sw.js` and registered for the scope `/<locale>/app` by the dashboard alone
 * (features/app/install/service-worker-island.tsx). It does one thing: when a page of the dashboard
 * cannot load because the device is offline, it answers with the offline page in that language.
 *
 * - Scope: `/<locale>/app` and below. Creator pages (`/u/…`, `/<name>`, `/<locale>/p/…`), the website,
 *   sign-in and the team area are outside it, so it never controls them; the fetch handler checks the
 *   path again (a scope is a prefix: `/de/app` would also match `/de/apple`).
 * - Nothing is cached: no Cache Storage at all. Page loads go to the network (with navigation preload,
 *   so the worker costs no waiting); everything else (API calls, account data, Supabase, pictures,
 *   scripts) never reaches the worker: Chrome routes it to the network directly (static routing) and
 *   elsewhere the handler leaves it alone. The offline page lives in the worker's own script.
 * - Updates: every build writes a new version into the script, the dashboard registers it with
 *   `updateViaCache: "none"` and asks for updates when a window comes back to the front
 *   (features/pwa/register.ts). A new worker takes over at once (`skipWaiting`, `clients.claim`): it
 *   holds no cache and no state, so there is nothing to hand over. It never serves the dashboard's code:
 *   an open window keeps the code it has until its next navigation, where Next sees the new build and
 *   loads the page in full from the network.
 *
 * Plain JavaScript, no dependency. `serviceWorkerSource` writes the constants in front of `WORKER`.
 */

/** The worker itself. It reads VERSION, SCOPE and OFFLINE_HTML, which `serviceWorkerSource` defines. */
const WORKER = String.raw`
const inScope = (url) => url.origin === self.location.origin && (url.pathname === SCOPE || url.pathname.startsWith(SCOPE + "/"));

self.addEventListener("install", (event) => {
  self.skipWaiting();
  // Chrome 123+: requests that are not page loads go straight to the network and never wake the worker.
  if (typeof event.addRoutes === "function") {
    try {
      event.waitUntil(
        event
          .addRoutes([{ condition: { or: [{ requestMode: "cors" }, { requestMode: "no-cors" }, { requestMode: "same-origin" }] }, source: "network" }])
          .catch(() => undefined),
      );
    } catch {
      // An older form of the API: the fetch handler below leaves those requests alone anyway.
    }
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

const offline = () =>
  new Response(OFFLINE_HTML, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Linkyo-Offline": VERSION },
  });

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.mode !== "navigate" || request.method !== "GET" || !inScope(new URL(request.url))) return;
  event.respondWith(
    (async () => {
      try {
        const preloaded = await event.preloadResponse;
        if (preloaded) return preloaded;
        return await fetch(request);
      } catch {
        // Only a failed connection lands here; an answer from the server (a 404, a 500) is shown as it is.
        return offline();
      }
    })(),
  );
});
`;

export interface ServiceWorkerOptions {
  /** This build's version (written into the script, so every build installs a new worker). */
  version: string;
  /** The dashboard of one language, e.g. "/de/app" (no trailing slash). */
  scope: string;
  /** The offline page of that language (features/pwa/offline-page.ts). */
  offlineHtml: string;
}

/** The worker's script for one language. */
export function serviceWorkerSource({ version, scope, offlineHtml }: ServiceWorkerOptions): string {
  return [
    `// Linkyo: the dashboard's service worker for ${scope} (apps/web/src/features/pwa/service-worker.ts).`,
    `"use strict";`,
    `const VERSION = ${JSON.stringify(version)};`,
    `const SCOPE = ${JSON.stringify(scope)};`,
    `const OFFLINE_HTML = ${JSON.stringify(offlineHtml)};`,
    WORKER.trim(),
    "",
  ].join("\n");
}
