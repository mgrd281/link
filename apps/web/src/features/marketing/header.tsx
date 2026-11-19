import { Logo } from "@linkyo/ui";
import { useLocale, useTranslations } from "next-intl";

import { LocaleSwitch } from "@/components/locale-switch";
import { Link } from "@/i18n/navigation";

import { MobileMenu } from "./mobile-menu";

/** A flat bar: logo, in-page links, language, a quiet "log in" and one black action. */
export function MarketingHeader() {
  const t = useTranslations("marketing");
  const locale = useLocale();
  // Absolute links, so the menu also works from other pages (the template gallery).
  const items = [
    { href: `/${locale}#features`, label: t("nav.features") },
    { href: `/${locale}/templates`, label: t("nav.templates") },
    { href: `/${locale}#pricing`, label: t("nav.pricing") },
    { href: `/${locale}#faq`, label: t("nav.faq") },
  ];
  const cta = { href: `/${locale}/signup`, label: t("nav.start") };
  const login = { href: `/${locale}/login`, label: t("nav.login") };
  return (
    <header className="layer-sticky sticky top-0 bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:rounded-sm focus:bg-surface-elevated focus:px-3 focus:py-2 focus:focus-ring"
      >
        {t("skip")}
      </a>
      <div className="mx-auto flex h-16 max-w-content items-center gap-2 px-5 md:px-10">
        <Link href="/" className="rounded-xs focus-visible:focus-ring" aria-label="Linkyo">
          <Logo className="h-6" title="Linkyo" />
        </Link>
        <nav aria-label={t("nav.label")} className="ms-6 hidden items-center gap-1 lg:flex">
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-2 text-small font-medium text-fg-secondary transition-colors duration-micro hover:bg-hover hover:text-fg focus-visible:focus-ring"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-1">
          <div className="hidden items-center gap-1 sm:flex">
            <LocaleSwitch />
          </div>
          <Link
            href="/login"
            className="hidden h-control-md items-center rounded-full bg-canvas-muted px-4 text-small font-semibold text-fg transition-colors duration-micro hover:bg-hover focus-visible:focus-ring md:inline-flex"
          >
            {login.label}
          </Link>
          <Link
            href="/signup"
            className="hidden h-control-md items-center rounded-full bg-fg px-4 text-small font-semibold text-canvas shadow-e1 transition-[box-shadow,scale] duration-micro hover:shadow-e3 focus-visible:focus-ring active:scale-pressed md:inline-flex"
          >
            {cta.label}
          </Link>
          <MobileMenu items={items} cta={cta} secondary={login} labels={{ menu: t("nav.menu"), close: t("nav.close") }} />
        </div>
      </div>
    </header>
  );
}
