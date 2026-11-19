import { Logo } from "@linkyo/ui";
import { useLocale, useTranslations } from "next-intl";

import { LocaleSwitch } from "@/components/locale-switch";
import { PeopleSearch } from "@/features/search/people-search";
import { Link } from "@/i18n/navigation";

import { MobileMenu } from "./mobile-menu";

/** A flat bar: logo, in-page links, the people search, language, a quiet "log in" and one action in Linkyo Teal. */
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
          {/* Find a person: a name, a profession, a place (Ctrl/⌘ K). */}
          <PeopleSearch />
          <div className="hidden items-center gap-1 sm:flex">
            <LocaleSwitch />
          </div>
          {/* One switch for both: the teal highlight sits on "sign up" and slides to "log in" under the pointer. */}
          <div className="hidden md:block">
            <div className="mk-auth-switch h-control-md text-small font-semibold">
              <Link href="/login" data-login className="rounded-full px-4 focus-visible:focus-ring">
                {login.label}
              </Link>
              <Link href="/signup" data-signup className="rounded-full px-4 focus-visible:focus-ring">
                {t("nav.startShort")}
              </Link>
            </div>
          </div>
          {/* Phones: the one action stays in reach next to the menu, with a short label. */}
          <Link
            href="/signup"
            className="inline-flex h-control-sm items-center rounded-full bg-primary px-3 text-small font-semibold text-primary-fg transition-[background-color,scale] duration-micro hover:bg-primary-hover focus-visible:focus-ring active:scale-pressed md:hidden"
          >
            {t("nav.startShort")}
          </Link>
          <MobileMenu items={items} cta={cta} secondary={login} labels={{ menu: t("nav.menu"), close: t("nav.close") }} />
        </div>
      </div>
    </header>
  );
}
