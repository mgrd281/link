"use client";

import { useLocale } from "next-intl";
import { useEffect } from "react";

import { serviceWorkerScope, serviceWorkerUrl } from "@/features/pwa/paths";

/** At most this often a window that comes back to the front asks whether a new worker was deployed. */
const UPDATE_EVERY = 60 * 60 * 1000;

/**
 * Registers the dashboard's service worker (features/pwa/service-worker.ts) for this language's
 * dashboard, after the page has loaded. Only the dashboard's layout renders it: the website, sign-in,
 * the team area and creator pages never register a worker. `updateViaCache: "none"`: the script is
 * always fetched fresh when the browser checks it, and a window that comes back to the front checks
 * (at most hourly), so a deploy reaches dashboards that stay open for days.
 */
export function ServiceWorkerIsland() {
  const locale = useLocale();
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let registration: ServiceWorkerRegistration | null = null;
    let checked = Date.now();
    const register = () => {
      navigator.serviceWorker
        .register(serviceWorkerUrl(locale), { scope: serviceWorkerScope(locale), updateViaCache: "none" })
        .then((done) => {
          registration = done;
        })
        // No worker (a browser that refuses it, private modes): the dashboard works the same online.
        .catch(() => undefined);
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !registration || Date.now() - checked < UPDATE_EVERY) return;
      checked = Date.now();
      registration.update().catch(() => undefined);
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("load", register);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [locale]);
  return null;
}
