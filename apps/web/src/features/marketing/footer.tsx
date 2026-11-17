import { Logo } from "@linkyo/ui";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

const linkClass = "rounded-xs text-small text-fg-secondary transition-colors duration-micro hover:text-fg focus-visible:focus-ring";

/** Footer: product anchors, prototype resources, legal (pages arrive with the Phase 1 legal helper). */
export function MarketingFooter() {
  const t = useTranslations("marketing.footer");
  return (
    <footer className="mx-auto grid max-w-content gap-12 px-5 pt-20 pb-12 md:px-10">
      <div className="grid gap-10 md:grid-cols-4">
        <div className="grid content-start gap-3">
          <Logo className="h-8" title="Linkyo" />
          <p className="text-small text-fg-secondary">{t("tagline")}</p>
        </div>
        <nav aria-label={t("product")} className="grid content-start gap-3">
          <p className="text-small font-semibold">{t("product")}</p>
          <a href="#templates" className={linkClass}>
            {t("templates")}
          </a>
          <a href="#analytics" className={linkClass}>
            {t("analytics")}
          </a>
          <a href="#pricing" className={linkClass}>
            {t("pricing")}
          </a>
          <a href="#faq" className={linkClass}>
            {t("faq")}
          </a>
        </nav>
        <nav aria-label={t("resources")} className="grid content-start gap-3">
          <p className="text-small font-semibold">{t("resources")}</p>
          <Link href="/directions/poster/dashboard" className={linkClass}>
            {t("editor")}
          </Link>
          <Link href="/design" className={linkClass}>
            {t("designSystem")}
          </Link>
          <Link href="/directions" className={linkClass}>
            {t("directions")}
          </Link>
        </nav>
        <div className="grid content-start gap-3">
          <p className="text-small font-semibold">{t("legal")}</p>
          <p className="text-small text-fg-secondary">{t("imprint")}</p>
          <p className="text-small text-fg-secondary">{t("privacy")}</p>
          <p className="text-small text-fg-secondary">{t("terms")}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-caption text-fg-tertiary">
        <span>{t("rights")}</span>
        <span>{t("made")}</span>
      </div>
    </footer>
  );
}
