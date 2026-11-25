import { cn, Logo } from "@linkyo/ui";
import { useLocale, useTranslations } from "next-intl";

import { LocaleSwitch } from "@/components/locale-switch";
import { PeopleSearch } from "@/features/search/people-search";
import { Link } from "@/i18n/navigation";

import { HeaderAuth, HeaderPhoneAction, MobileMenu, type MenuItem } from "./mobile-menu";

/**
 * A flat bar: logo, the places on the site, the people search, language, a quiet "log in" and one
 * action in Linkyo Teal. On phones: logo, search and menu; sign-up joins them once the hero's own
 * sign-up has been passed (`signupAfter`, the id of that block). A visitor who is signed in gets
 * their avatar and "To the dashboard" instead of sign-up and log-in.
 */
export function MarketingHeader({
  signupAfter,
  edge = true,
  current,
  wide = false,
}: {
  signupAfter?: string;
  /** The home page: from 2xl the bar spans the hero's wide column, so the logo stands over the words. */
  wide?: boolean;
  /** A hairline under the bar once content scrolls beneath it (off where a band below draws its own). */
  edge?: boolean;
  /** The place this page is: marked in the bar and in the menu. */
  current?: MenuItem["key"] | undefined;
} = {}) {
  const t = useTranslations("marketing");
  const common = useTranslations("common");
  const locale = useLocale();
  // Absolute links, so the menu also works from other pages (the template gallery). Portfolio sits
  // between the gallery and the prices: it is a part of the product, not a section of the homepage.
  // The features and the help have pages of their own; the homepage's questions stay in the footer.
  const items: MenuItem[] = [
    { key: "features", href: `/${locale}/funktionen`, label: t("nav.features"), hint: t("nav.hints.features") },
    { key: "templates", href: `/${locale}/templates`, label: t("nav.templates"), hint: t("nav.hints.templates") },
    { key: "portfolio", href: `/${locale}/portfolio`, label: t("nav.portfolio"), hint: t("nav.hints.portfolio") },
    { key: "pricing", href: `/${locale}#pricing`, label: t("nav.pricing"), hint: t("nav.hints.pricing") },
    { key: "help", href: `/${locale}/hilfe`, label: t("nav.help"), hint: t("nav.hints.help") },
  ];
  const cta = { href: `/${locale}/signup`, label: t("nav.start") };
  const login = { href: `/${locale}/login`, label: t("nav.login") };
  return (
    <header className={cn("layer-sticky sticky top-0 bg-canvas", edge && "mk-stuck-band")}>
      {edge ? <span aria-hidden className="mk-stuck-edge pointer-events-none absolute inset-x-0 bottom-0 border-b border-transparent" /> : null}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:rounded-sm focus:bg-surface-elevated focus:px-3 focus:py-2 focus:focus-ring"
      >
        {t("skip")}
      </a>
      <div className={cn("mx-auto flex h-16 max-w-content items-center gap-2 px-5 md:px-10", wide && "2xl:max-w-content-wide")}>
        {/* The logo is 24 px tall: its link reaches 12 px above and below it (invisible), 48 px in all, inside the 64 px bar. */}
        <Link href="/" className="relative rounded-xs before:absolute before:inset-x-0 before:-inset-y-3 focus-visible:focus-ring" aria-label="Linkyo">
          <Logo className="h-6" title="Linkyo" />
        </Link>
        <nav aria-label={t("nav.label")} className="ms-6 hidden items-center gap-1 lg:flex">
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={item.key === current ? "page" : undefined}
              className="rounded-full px-3 py-2 text-small font-medium text-fg-secondary transition-colors duration-micro hover:bg-hover hover:text-fg focus-visible:focus-ring aria-[current=page]:bg-selected aria-[current=page]:text-selected-fg"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-1">
          {/* Phones: sign-up, once the hero's own has been passed; signed in, the avatar. */}
          <HeaderPhoneAction signupLabel={t("nav.startShort")} after={signupAfter} />
          {/* Find a person: a name, a profession, a place (Ctrl/⌘ K). */}
          <PeopleSearch />
          <div className="hidden items-center gap-1 sm:flex">
            <LocaleSwitch />
          </div>
          <HeaderAuth login={{ href: "/login", label: login.label }} signup={{ href: "/signup", label: t("nav.startShort") }} />
          <MobileMenu
            items={items}
            current={current}
            home={`/${locale}`}
            cta={cta}
            login={login}
            labels={{ menu: t("nav.menu"), close: t("nav.close"), language: common("language"), haveAccount: t("nav.haveAccount") }}
          />
        </div>
      </div>
    </header>
  );
}
