import type { Page } from "@linkyo/blocks";
import { hasImage } from "@linkyo/blocks/rules";
import type { ResolvedCreatorTheme } from "@linkyo/tokens/creator";
import { getTranslations } from "next-intl/server";

import { mediaSizes, MediaImage, Monogram } from "@/features/directions/shared/creator-kit";

import { themeStyle } from "./theme";

/**
 * What visitors see while the owner has paused the page (Settings › Sichtbarkeit): a calm page in the
 * page's own colours and language with the name, the photo and one sentence. No block, no link of the
 * creator's, no counter (`data-paused` stops the counting script, features/analytics/beacon-script.ts),
 * and the metadata says `noindex`. Server only: nothing here runs in the visitor's browser.
 */
export async function PausedPage({ page, theme, privacyHref }: { page: Page; theme: ResolvedCreatorTheme; privacyHref: string }) {
  const { profile } = page;
  const t = await getTranslations({ locale: profile.locale, namespace: "app.visibility.offline" });
  const tCreator = await getTranslations({ locale: profile.locale, namespace: "creator" });
  return (
    <div data-paused style={themeStyle(theme)} className="grid min-h-dvh grid-rows-[1fr_auto] bg-creator-bg text-creator-fg">
      <main className="grid content-center justify-items-center gap-5 px-6 py-16 text-center">
        <span className="relative size-24 overflow-hidden rounded-full bg-creator-surface-2">
          {hasImage(profile.avatar) ? (
            <MediaImage src={profile.avatar.src} focal={profile.avatar.focal} alt={profile.avatar.alt} sizes={mediaSizes.thumb} priority />
          ) : (
            <Monogram name={profile.displayName} />
          )}
        </span>
        <h1 className="max-w-prose font-creator-display text-h2 text-balance break-words">
          <bdi>{profile.displayName}</bdi>
        </h1>
        <p className="max-w-prose text-body text-creator-fg-muted">{t("title")}</p>
      </main>
      <footer className="flex justify-center px-6 pb-8 text-small">
        <a href={privacyHref} className="rounded-sm font-semibold text-creator-fg-muted transition-colors duration-micro hover:text-creator-fg focus-visible:focus-ring">
          {tCreator("privacy")}
        </a>
      </footer>
    </div>
  );
}
