"use client";

import { resolveCreatorTheme } from "@linkyo/tokens/creator";
import { Button, Icon } from "@linkyo/ui";
import { ArrowLeft } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

import { PosterRenderer } from "@/features/directions/poster/renderer";
import { Link } from "@/i18n/navigation";

import { usePublished } from "./data";
import { useAdmin } from "./session";
import { LOCALES } from "./types";

/** A prepared page full screen, exactly as the creator will see it, with a way back to the editor. */
export function TeamPreviewScreen({ slug, lang }: { slug: string; lang: string | undefined }) {
  const t = useTranslations("admin.preview");
  const uiLocale = useLocale();
  const { db } = useAdmin();
  const published = usePublished(db.token);
  const source = db.drafts[slug] ?? (published.status === "ready" ? published.pages.find((page) => page.slug === slug) : undefined);
  const locale = LOCALES.find((code) => code === lang && source?.pages[code]) ?? LOCALES.find((code) => code === uiLocale && source?.pages[code]) ?? LOCALES.find((code) => source?.pages[code]);
  const page = locale ? source?.pages[locale] : undefined;
  const verified = source && "verified" in source ? source.verified : false;
  const theme = useMemo(() => (source ? resolveCreatorTheme(source.theme, { rtlScript: locale === "ar" }) : null), [source, locale]);

  return (
    <>
      {page && theme ? (
        <PosterRenderer page={{ ...page, profile: { ...page.profile, verified } }} theme={theme} preview />
      ) : (
        <p className="p-8 text-body text-fg-secondary">{published.status === "loading" ? t("loading") : t("missing")}</p>
      )}
      <nav aria-label={t("label")} className="layer-sticky fixed inset-x-0 bottom-0 flex justify-center px-4 pb-[max(var(--spacing-4),env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2 rounded-full border border-line bg-surface-elevated p-1 ps-4 text-fg">
          <span className="text-small font-medium">{t("badge")}</span>
          <Button asChild variant="primary" className="rounded-full">
            <Link href={`/admin/creators/${slug}`}>
              <Icon icon={ArrowLeft} size="sm" />
              {t("back")}
            </Link>
          </Button>
        </div>
      </nav>
    </>
  );
}
