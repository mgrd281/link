import { Button, Logo } from "@linkyo/ui";
import { useLocale, useTranslations } from "next-intl";

import { LocaleSwitch } from "@/components/locale-switch";
import { ThemeSwitch } from "@/components/theme-switch";
import { Link } from "@/i18n/navigation";

import { MobileMenu } from "./mobile-menu";

/** A floating pill navigation: in-page anchors, theme + language, one primary action. */
export function MarketingHeader() {
  const t = useTranslations("marketing");
  const items = [
    { href: "#features", label: t("nav.features") },
    { href: "#templates", label: t("nav.templates") },
    { href: "#pricing", label: t("nav.pricing") },
    { href: "#faq", label: t("nav.faq") },
  ];
  const locale = useLocale();
  const cta = { href: `/${locale}/signup`, label: t("nav.start") };
  const login = { href: `/${locale}/login`, label: t("nav.login") };
  return (
    <header className="layer-sticky sticky top-0 px-3 pt-3 md:px-5">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:rounded-sm focus:bg-surface-elevated focus:px-3 focus:py-2 focus:focus-ring"
      >
        {t("skip")}
      </a>
      <div className="mx-auto flex h-control-xl max-w-content items-center gap-2 rounded-full border border-line bg-surface ps-5 pe-2 shadow-e2">
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
            <ThemeSwitch />
            <LocaleSwitch />
          </div>
          <Link
            href="/login"
            className="hidden h-control-md items-center rounded-full px-4 text-small font-semibold text-fg hover:bg-hover focus-visible:focus-ring md:inline-flex"
          >
            {login.label}
          </Link>
          <Button asChild variant="primary" size="md" className="hidden rounded-full md:inline-flex">
            <Link href="/signup">{cta.label}</Link>
          </Button>
          <MobileMenu items={items} cta={cta} secondary={login} labels={{ menu: t("nav.menu"), close: t("nav.close") }} />
        </div>
      </div>
    </header>
  );
}
