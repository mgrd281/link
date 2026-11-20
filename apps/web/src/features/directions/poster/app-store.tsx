"use client";

import type { AppStore, BlockOf } from "@linkyo/blocks";
import { cn, Icon, PlatformIcon } from "@linkyo/ui";
import { Globe } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { siAppstore, siGoogleplay } from "simple-icons";

import { pressable } from "./styles";

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

export function StoreGlyph({ store, size = "sm" }: { store: AppStore; size?: "sm" | "md" }) {
  if (store === "web") return <Icon icon={Globe} size={size} />;
  return <PlatformIcon icon={store === "appstore" ? siAppstore : siGoogleplay} size={size} />;
}

/**
 * One button, the right store: on an iPhone it opens the App Store, on Android Google Play, else the
 * first store the creator added. An app that only lives on the web opens instead of installing.
 */
export function GetButton({ title, stores }: { title: string; stores: readonly Store[] }) {
  const t = useTranslations("creator");
  const store = pick(stores, useDeviceStore());
  if (!store) return null;
  return (
    <a
      href={store.url}
      aria-label={t("getApp", { app: title, store: store.store })}
      className={cn(
        "inline-flex h-control-sm shrink-0 items-center gap-1 rounded-full bg-creator-accent ps-3 pe-4 text-small font-bold text-creator-accent-fg uppercase",
        pressable,
      )}
    >
      <StoreGlyph store={store.store} />
      {store.store === "web" ? t("open") : t("get")}
    </a>
  );
}

/** The app's other stores, one tap away ("Also on Google Play, web"). */
export function OtherStores({ title, stores }: { title: string; stores: readonly Store[] }) {
  const t = useTranslations("creator");
  const chosen = pick(stores, useDeviceStore());
  const others = stores.filter((store) => store !== chosen);
  if (others.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-caption text-creator-fg-muted">{t("alsoOn")}</span>
      {others.map((store) => {
        return (
          <a
            key={store.url}
            href={store.url}
            aria-label={t("getApp", { app: title, store: store.store })}
            className={cn("inline-flex h-control-sm items-center gap-1 rounded-full border border-creator-line-strong px-3 text-caption font-semibold", pressable)}
          >
            <StoreGlyph store={store.store} />
            {t(`stores.${store.store}`)}
          </a>
        );
      })}
    </span>
  );
}
