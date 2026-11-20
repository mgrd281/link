import type { AppStore } from "@linkyo/blocks";

/** Store names are brands: they stay the same in every language. A web app is named by its address. */
export const STORE_NAMES: Record<Exclude<AppStore, "web">, string> = { appstore: "App Store", googleplay: "Google Play" };

/** "App Store", "Google Play" or the web app's host (language-neutral, for summaries and labels). */
export function storeLabel(store: { store: AppStore; url: string }): string {
  if (store.store !== "web") return STORE_NAMES[store.store];
  try {
    return new URL(store.url).host.replace(/^www\./, "");
  } catch {
    return store.url;
  }
}
