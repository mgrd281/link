"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { useAccount } from "@/features/account/store";
import { ORIGIN_TAB_KEY, TABS, type TabKey } from "@/features/app/routes";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

import { announceReady, installOnApp, readyFor, withdrawReady } from "./app-object";
import { BRIDGE_VERSION, post } from "./bridge";
import { navigationTarget, routeParts } from "./route";
import { useAppMode, useKeepAppSignal } from "./use-app-mode";

/** The tab Settings was opened from, as the shell keeps it (Settings' "back" leads there). */
function readOrigin(): TabKey {
  try {
    const stored = window.sessionStorage.getItem(ORIGIN_TAB_KEY);
    return TABS.find((tab) => tab === stored) ?? "home";
  } catch {
    return "home";
  }
}

/** A path with the language in front, as the address bar shows it. */
const withLocale = (locale: string, path: string) => `/${locale}${path === "/" ? "" : path}`;

/**
 * The dashboard's side of the app (`./bridge.ts`), mounted by its layout. In a browser it renders
 * nothing and runs nothing. In the app it:
 * - puts `navigate(path)` (a dashboard path, with the client router: no reload, whatever the store
 *   holds stays) and `back()` on `window.linkyoApp`;
 * - posts `ready` (with the web's bridge version) once the session is known, each time the dashboard
 *   mounts (a page load, a return from a page outside it, a change of language), when the browser
 *   restores it from its back/forward cache (the app's `goBack()` after a page it loaded itself: nothing
 *   mounts again, so `pageshow` says so) and whenever the session changes; then the current `route`,
 *   then the store's half posts its `saveState`. Nothing reaches the app before `ready` (ADR 0087
 *   decision 4);
 * - posts `route` for every screen shown after that: its path, its name and where back leads (routes.ts).
 *
 * All five methods live only while a dashboard page is shown: leaving it for a page outside the
 * dashboard (a legal page, help) takes off `navigate` and `back` here and `flush`, `reload` and
 * `signOut` in the store's half (`./store-bridge.ts`); the app brings the web view back to the
 * dashboard and waits for `ready` before it calls them again (ADR 0088 §4).
 */
export function AppModeIsland() {
  // Once, before the browser paints: where React rendered the document anew and dropped the app's
  // `<html data-app>`, it is put back from window.linkyoApp, so the CSS and the code agree on app mode.
  useKeepAppSignal();
  return useAppMode() ? <AppBridge /> : null;
}

function AppBridge() {
  const t = useTranslations("app");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const snapshot = useAccount();

  useEffect(() => {
    const navigate = (path: string): boolean => {
      const target = navigationTarget(path, window.location.origin);
      if (!target) return false;
      router.push(target.href, { locale: target.locale ?? locale });
      return true;
    };
    const back = (): boolean => {
      const target = routeParts(pathname, readOrigin()).back;
      if (!target) return false;
      router.push(target);
      return true;
    };
    // Leaving the dashboard (a legal page, help): navigate and back go with it, as the store's half
    // takes flush, reload and signOut with it; each half takes off only its own.
    return installOnApp({ navigate, back });
  }, [router, pathname, locale]);

  const known = snapshot.status !== "loading";
  const accountId = snapshot.status === "signedIn" ? snapshot.account.id : null;
  // The name does not depend on where Settings was opened from; "back" does, and is read in the effect.
  const titleKey = routeParts(pathname, "home").title;
  const title = titleKey ? t(titleKey) : null;
  // What this mount told the app last: the account of its `ready` (undefined: none yet) and the route.
  const told = useRef<{ ready: string | null | undefined; route: string | null }>({ ready: undefined, route: null });
  // Restores from the back/forward cache: the page comes back as it was left, effects and all, so it
  // says again what it says when it mounts. Left for that cache, it says nothing until it is back.
  const [restores, setRestores] = useState(0);
  useEffect(() => {
    const left = (event: PageTransitionEvent) => {
      if (event.persisted) withdrawReady();
    };
    const back = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      told.current = { ready: undefined, route: null };
      setRestores((count) => count + 1);
    };
    window.addEventListener("pagehide", left);
    window.addEventListener("pageshow", back);
    return () => {
      window.removeEventListener("pagehide", left);
      window.removeEventListener("pageshow", back);
    };
  }, []);
  useEffect(() => {
    if (!known) return;
    const fresh = told.current.ready !== accountId;
    if (fresh) {
      post({ type: "ready", bridge: BRIDGE_VERSION, signedIn: accountId !== null, accountId });
      told.current.ready = accountId;
    }
    // Read here, after the shell has stored the tab this screen was opened from.
    const { back } = routeParts(pathname, readOrigin());
    const route = { type: "route", path: withLocale(locale, pathname), title, back: back ? withLocale(locale, back) : null } as const;
    const key = JSON.stringify(route);
    if (fresh || key !== told.current.route) {
      post(route);
      told.current.route = key;
    }
    // The store's half may tell this account's save state now.
    if (fresh) announceReady(accountId);
  }, [known, accountId, pathname, locale, title, restores]);
  // Leaving the dashboard: the next mount posts `ready` first again. (Mounted again without leaving, as
  // React's development checks do, it says again what this mount already told the app, posting nothing.)
  useEffect(() => {
    if (told.current.ready !== undefined && readyFor() === undefined) announceReady(told.current.ready, false);
    return withdrawReady;
  }, []);

  return null;
}
