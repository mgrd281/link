import { Button, Icon, Logo } from "@linkyo/ui";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { NOINDEX } from "@/lib/seo";

export const metadata: Metadata = { title: "Linkyo", robots: NOINDEX };

/**
 * An address nobody has (yet): Linkyo's own calm page, in the language of the layout around it, with
 * the way to make one. Answered with status 404.
 */
export default async function CreatorNotFound() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "creator.notFound" });
  return (
    <main className="bg-canvas text-fg grid min-h-dvh place-items-center px-4 py-16">
      <div className="grid max-w-prose justify-items-center gap-6 text-center">
        <Logo className="h-8" title="Linkyo" />
        <div className="grid gap-2">
          <h1 className="text-h2 font-semibold text-balance">{t("title")}</h1>
          <p className="text-body text-fg-secondary text-pretty">{t("body")}</p>
        </div>
        <Button asChild variant="primary" size="cta" className="group">
          <a href={`/${locale}/signup`}>
            {t("cta")}
            <Icon icon={ArrowRight} size="md" className="duration-micro transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
          </a>
        </Button>
      </div>
    </main>
  );
}
