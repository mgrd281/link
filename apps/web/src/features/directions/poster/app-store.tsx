import type { AppStore, BlockOf } from "@linkyo/blocks";
import { cn, Icon, PlatformIcon } from "@linkyo/ui";
import { Globe } from "lucide-react";
import { siAppstore, siGoogleplay } from "simple-icons";

import { GetButtonIsland, OtherStoresIsland } from "./app-store-island";
import { pressable } from "./styles";

type Store = BlockOf<"app">["stores"][number];

/**
 * An app's stores on a creator page. Which store a visitor gets depends on their device, so the choice
 * is a client island (`./app-store-island.tsx`); its classes and the stores' glyphs are drawn here, on
 * the server for a public page, so the visitor's browser loads no icon kit or store logos (ADR 0008).
 */

export function StoreGlyph({ store, size = "sm" }: { store: AppStore; size?: "sm" | "md" }) {
  if (store === "web") return <Icon icon={Globe} size={size} />;
  return <PlatformIcon icon={store === "appstore" ? siAppstore : siGoogleplay} size={size} />;
}

/**
 * One button, the right store: on an iPhone it opens the App Store, on Android Google Play, else the
 * first store the creator added. Drawn like the stores' own "Get" capsules in their lists (the page's
 * accent on a soft fill); an app that only lives on the web opens instead of installing.
 */
export function GetButton({ title, stores }: { title: string; stores: readonly Store[] }) {
  return (
    <GetButtonIsland
      title={title}
      stores={stores}
      className={cn(
        "inline-flex h-control-sm min-w-touch-target shrink-0 items-center justify-center rounded-full bg-creator-surface-2 px-4 text-small font-bold text-creator-accent-text uppercase",
        pressable,
      )}
    />
  );
}

/** The app's other stores, one tap away ("Also on Google Play, web"). */
export function OtherStores({ title, stores }: { title: string; stores: readonly Store[] }) {
  if (stores.length < 2) return null;
  return (
    <OtherStoresIsland
      title={title}
      stores={stores}
      className={cn("inline-flex h-control-sm items-center gap-1 rounded-full border border-creator-line-strong px-3 text-caption font-semibold", pressable)}
      glyphs={Object.fromEntries(stores.map((store) => [store.store, <StoreGlyph key={store.store} store={store.store} />]))}
    />
  );
}
