import { Logo } from "@linkyo/ui";
import { useTranslations } from "next-intl";

import { ThemeSwitch } from "@/components/theme-switch";
import { LegalLinks } from "@/features/legal/legal-links";
import { Link } from "@/i18n/navigation";
import { paymentsEnabled } from "@/lib/flags";

// Phones: each link is a 44 px row, as in an app's list, and gives way under the finger; wide screens: compact.
const linkClass =
  "-mx-3 inline-flex min-h-touch-target items-center self-start rounded-md px-3 text-body text-fg-secondary transition-colors duration-micro hover:text-fg focus-visible:focus-ring active:bg-pressed md:min-h-0 md:py-1 md:text-small";
const groupTitle = "mb-2 text-caption font-semibold text-fg";

/**
 * The footer: the logo and its line, two short groups side by side, then one quiet band with the
 * rights, the legal pages and the light/dark switch. Every link leads to the real product: the
 * design system and the design prototypes stay reachable by their address, not from here. The page
 * service joins once it can be booked (payments on). The legal pages become links with the company
 * details (or in a payments test build); until then they are named only (LegalLinks).
 */
export function MarketingFooter() {
  const t = useTranslations("marketing.footer");
  return (
    <footer className="mx-auto grid max-w-content gap-10 px-5 pt-12 pb-10 md:px-10 md:pt-24">
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
            <Link href="/portfolio" className={linkClass}>
              {t("portfolio")}
            </Link>
            <Link href="/#pricing" className={linkClass}>
              {t("pricing")}
            </Link>
            {paymentsEnabled ? (
              <Link href="/service" className={linkClass}>
                {t("service")}
              </Link>
            ) : null}
          </nav>
          <nav aria-label={t("resources")} className="grid content-start gap-1">
            <p className={groupTitle}>{t("resources")}</p>
            <Link href="/#try" className={linkClass}>
              {t("editor")}
            </Link>
            <Link href="/#analytics" className={linkClass}>
              {t("analytics")}
            </Link>
            <Link href="/#faq" className={linkClass}>
              {t("faq")}
            </Link>
          </nav>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-line pt-6 text-small text-fg-secondary md:text-caption">
        <div className="grid gap-2">
          <p className="flex flex-wrap gap-x-3 gap-y-1">
            <span>{t("rights")}</span>
            <span>{t("made")}</span>
          </p>
          {/* The legal pages: named, or links once the company details are in. */}
          <LegalLinks />
        </div>
        <ThemeSwitch size="md" />
      </div>
    </footer>
  );
}
