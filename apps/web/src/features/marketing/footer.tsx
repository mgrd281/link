import { Logo } from "@linkyo/ui";
import { useTranslations } from "next-intl";

import { ThemeSwitch } from "@/components/theme-switch";
import { Link } from "@/i18n/navigation";

// Each link is a 28 px row (comfortable for a finger), the rows 32 px apart as before.
const linkClass = "inline-flex items-center self-start rounded-xs py-1 text-small text-fg-secondary transition-colors duration-micro hover:text-fg focus-visible:focus-ring";
const groupTitle = "mb-2 text-caption font-semibold text-fg";

/**
 * The footer: the logo and its line, two short groups side by side, then one quiet band with the
 * rights, the legal pages and the light/dark switch. The legal pages are named but not links yet:
 * they arrive with the company details.
 */
export function MarketingFooter() {
  const t = useTranslations("marketing.footer");
  return (
    <footer className="mx-auto grid max-w-content gap-10 px-5 pt-16 pb-10 md:px-10 md:pt-24">
      <div className="grid gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-16">
        <div className="grid content-start gap-3">
          <Logo className="h-8" title="Linkyo" />
          <p className="max-w-prose text-small text-pretty text-fg-secondary">{t("tagline")}</p>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-10">
          <nav aria-label={t("product")} className="grid content-start gap-1">
            <p className={groupTitle}>{t("product")}</p>
            <Link href="/#features" className={linkClass}>
              {t("features")}
            </Link>
            <Link href="/templates" className={linkClass}>
              {t("templates")}
            </Link>
            <Link href="/#pricing" className={linkClass}>
              {t("pricing")}
            </Link>
            <Link href="/#faq" className={linkClass}>
              {t("faq")}
            </Link>
          </nav>
          <nav aria-label={t("resources")} className="grid content-start gap-1">
            <p className={groupTitle}>{t("resources")}</p>
            <Link href="/directions/poster/dashboard" className={linkClass}>
              {t("editor")}
            </Link>
            <Link href="/#analytics" className={linkClass}>
              {t("analytics")}
            </Link>
            <Link href="/design" className={linkClass}>
              {t("designSystem")}
            </Link>
            <Link href="/directions" className={linkClass}>
              {t("directions")}
            </Link>
          </nav>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-line pt-6 text-caption text-fg-secondary">
        <div className="grid gap-2">
          <p className="flex flex-wrap gap-x-3 gap-y-1">
            <span>{t("rights")}</span>
            <span>{t("made")}</span>
          </p>
          {/* The legal pages, named; they become links with the company details. */}
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-fg-tertiary">
            <span className="sr-only">{t("legal")}:</span>
            <span>{t("imprint")}</span>
            <span>{t("privacy")}</span>
            <span>{t("terms")}</span>
          </p>
        </div>
        <ThemeSwitch />
      </div>
    </footer>
  );
}
