"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";

import { useAccount } from "@/features/account/store";
import { ORIGIN_TAB_KEY, TABS, type TabKey } from "@/features/app/routes";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

import { installOnApp } from "./app-mode";
import { post } from "./bridge";
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
 * - puts `navigate(path)` (the client router: no reload, whatever the store holds stays) and `back()`
 *   on `window.linkyoApp`;
 * - posts `ready` once the session is known (and again when it changes);
 * - posts `route` for every screen shown: its path, its name and where back leads (routes.ts).
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
    // Leaving the dashboard (a legal page, the website): the methods go with it, unless replaced; the
    // store's flush, reload and signOut (./store-bridge.ts) stay, whichever was installed first.
    return installOnApp({ navigate, back });
  }, [router, pathname, locale]);

  const known = snapshot.status !== "loading";
  const accountId = snapshot.status === "signedIn" ? snapshot.account.id : null;
  useEffect(() => {
    if (known) post({ type: "ready", signedIn: accountId !== null, accountId });
  }, [known, accountId]);

  // The name does not depend on where Settings was opened from; "back" does, and is read in the effect.
  const titleKey = routeParts(pathname, "home").title;
  const title = titleKey ? t(titleKey) : null;
  useEffect(() => {
    // Read here, after the shell has stored the tab this screen was opened from.
    const { back } = routeParts(pathname, readOrigin());
    post({ type: "route", path: withLocale(locale, pathname), title, back: back ? withLocale(locale, back) : null });
  }, [pathname, locale, title]);

  return null;
}
