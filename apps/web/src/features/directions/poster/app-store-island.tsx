"use client";

import type { AppStore, BlockOf } from "@linkyo/blocks";
import { useTranslations } from "next-intl";
import { useSyncExternalStore, type ReactNode } from "react";

type Store = BlockOf<"app">["stores"][number];

/** The store a visitor's device uses: the App Store on an iPhone or iPad, Google Play on Android. */
function deviceStore(): AppStore | null {
  const { userAgent, maxTouchPoints } = window.navigator;
  if (/iP(hone|ad|od)/.test(userAgent) || (userAgent.includes("Macintosh") && maxTouchPoints > 1)) return "appstore";
  if (userAgent.includes("Android")) return "googleplay";
  return null;
}
/** The device never changes while the page is open: nothing to subscribe to. */
const unsubscribe = () => undefined;
const noChanges = () => unsubscribe;

/** Read on the visitor's device after it loads (the server renders for no device in particular). */
function useDeviceStore(): AppStore | null {
  return useSyncExternalStore(noChanges, deviceStore, () => null);
}

/** The store this visitor gets: their device's own if the app is there, the first one otherwise. */
function pick(stores: readonly Store[], device: AppStore | null): Store | undefined {
  return stores.find((store) => store.store === device) ?? stores[0];
}

/**
 * One button, the right store: on an iPhone it opens the App Store, on Android Google Play, else the
 * first store the creator added (`./app-store.tsx` draws its class).
 */
export function GetButtonIsland({ title, stores, className }: { title: string; stores: readonly Store[]; className: string }) {
  const t = useTranslations("creator");
  const store = pick(stores, useDeviceStore());
  if (!store) return null;
  return (
    <a href={store.url} aria-label={t("getApp", { app: title, store: store.store })} className={className}>
      {store.store === "web" ? t("open") : t("get")}
    </a>
  );
}

/** The app's other stores, one tap away ("Also on Google Play, web"); their glyphs come drawn. */
export function OtherStoresIsland({ title, stores, className, glyphs }: { title: string; stores: readonly Store[]; className: string; glyphs: Partial<Record<AppStore, ReactNode>> }) {
  const t = useTranslations("creator");
  const chosen = pick(stores, useDeviceStore());
  const others = stores.filter((store) => store !== chosen);
  if (others.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-caption text-creator-fg-muted">{t("alsoOn")}</span>
      {others.map((store) => {
        return (
          <a key={store.url} href={store.url} aria-label={t("getApp", { app: title, store: store.store })} className={className}>
            {glyphs[store.store]}
            {t(`stores.${store.store}`)}
          </a>
        );
      })}
    </span>
  );
}
