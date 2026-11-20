import type { AppStore, BlockOf } from "@linkyo/blocks";
import { cn, Icon } from "@linkyo/ui";
import { Globe } from "lucide-react";
import Image, { type StaticImageData } from "next/image";
import { useLocale, useTranslations } from "next-intl";

import appStoreAr from "@/assets/badges/app-store-ar.svg";
import appStoreDe from "@/assets/badges/app-store-de.svg";
import appStoreEn from "@/assets/badges/app-store-en.svg";
import googlePlayAr from "@/assets/badges/google-play-ar.png";
import googlePlayDe from "@/assets/badges/google-play-de.png";
import googlePlayEn from "@/assets/badges/google-play-en.png";

import { pressable } from "./styles";

type Store = BlockOf<"app">["stores"][number];
type BadgeStore = Exclude<AppStore, "web">;

/** The stores' own artwork, in the visitor's language (see src/assets/badges/README.md). */
const BADGES: Record<BadgeStore, Record<"de" | "en" | "ar", StaticImageData>> = {
  // Next types SVG imports loosely (any); they are static images like the PNGs.
  appstore: { de: appStoreDe as StaticImageData, en: appStoreEn as StaticImageData, ar: appStoreAr as StaticImageData },
  googleplay: { de: googlePlayDe, en: googlePlayEn, ar: googlePlayAr },
};

/** Stores with official badges, App Store first (Apple asks for the first place in a lineup). */
const ORDER: readonly BadgeStore[] = ["appstore", "googleplay"];

/** Whether an app can show the official badges (a web app has none). */
export const hasBadges = (block: BlockOf<"app">): boolean => block.stores.some((store) => store.store !== "web");

/**
 * The official "Download on the App Store" and "Get it on Google Play" badges, exactly as Apple and
 * Google provide them: black, unaltered, never animated, the same height (44 px, above Apple's 40 px
 * minimum and the size of a touch target), a quarter of their height as clear space, App Store first.
 * Served from Linkyo like every other picture, so the page still loads nothing from Apple or Google.
 * The link is named by the badge's own words plus the app ("Laden im App Store: Fokuskreis").
 */
export function StoreBadges({ title, stores, className }: { title: string; stores: readonly Store[]; className?: string }) {
  const t = useTranslations("creator");
  const locale = useLocale();
  const language = locale === "en" || locale === "ar" ? locale : "de";
  const official = ORDER.flatMap((id) => stores.filter((store) => store.store === id));
  const web = stores.find((store) => store.store === "web");
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {official.map((store) => {
        const id = store.store as BadgeStore;
        return (
          <a key={id} href={store.url} aria-label={`${t(`badges.${id}`)}: ${title}`} className="rounded-sm focus-visible:focus-ring">
            <Image src={BADGES[id][language]} alt={t(`badges.${id}`)} unoptimized className="h-touch-target w-auto" />
          </a>
        );
      })}
      {web ? (
        <a
          href={web.url}
          aria-label={t("getApp", { app: title, store: "web" })}
          className={cn("inline-flex h-touch-target items-center gap-2 rounded-full border border-creator-line-strong px-4 text-small font-semibold", pressable)}
        >
          <Icon icon={Globe} size="sm" />
          {t("stores.web")}
        </a>
      ) : null}
    </div>
  );
}
