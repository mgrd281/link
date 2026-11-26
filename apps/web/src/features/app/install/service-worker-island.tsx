"use client";

import { useLocale } from "next-intl";
import { useEffect } from "react";

import { startDashboardWorker } from "@/features/pwa/register";

/**
 * Registers the dashboard's service worker for this language's dashboard, after the page has loaded
 * (features/pwa/register.ts). Only the dashboard's layout renders it: the website, sign-in, the team
 * area and creator pages never register a worker.
 */
export function ServiceWorkerIsland() {
  const locale = useLocale();
  useEffect(
    () =>
      startDashboardWorker(locale, {
        serviceWorker: "serviceWorker" in navigator ? navigator.serviceWorker : undefined,
        window,
        document,
        now: Date.now,
      }),
    [locale],
  );
  return null;
}
