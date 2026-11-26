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

type FooterKey = "features" | "templates" | "portfolio" | "pricing" | "service" | "changelog" | "help" | "faq" | "editor" | "contact" | "about" | "security";

/**
 * The footer's three groups. Every link leads to the real product: the design system and the design
 * prototypes stay reachable by their address, not from here. The page service joins once it can be
 * booked (payments on).
 */
function groups(payments: boolean): { key: "product" | "support" | "company"; links: { key: FooterKey; href: string }[] }[] {
  return [
    {
      key: "product",
      links: [
        { key: "features", href: "/funktionen" },
        { key: "templates", href: "/templates" },
        { key: "portfolio", href: "/portfolio" },
        { key: "pricing", href: "/#pricing" },
        ...(payments ? [{ key: "service" as const, href: "/service" }] : []),
        { key: "changelog", href: "/changelog" },
      ],
    },
    {
      key: "support",
      links: [
        { key: "help", href: "/hilfe" },
        { key: "faq", href: "/#faq" },
        { key: "editor", href: "/#try" },
        { key: "contact", href: "/kontakt" },
      ],
    },
    {
      key: "company",
      links: [
        { key: "about", href: "/ueber-uns" },
        { key: "security", href: "/sicherheit" },
      ],
    },
  ];
}

/**
 * The footer: the logo and its line, three short groups (the product, help and contact, Linkyo
 * itself), then one quiet band with the rights, the legal pages and the light/dark switch. The legal
 * pages become links with the company details (or in a payments test build); until then they are
 * named only (LegalLinks). Not inside the iPhone app (`data-app-hide`, app mode), where help and legal
 * pages stand alone: the footer leads to the prices and the rest of the website.
 */
export function MarketingFooter() {
  const t = useTranslations("marketing.footer");
  return (
    <footer data-app-hide className="mx-auto grid max-w-content gap-10 px-5 pt-12 pb-10 md:px-10 md:pt-24">
      <div className="grid gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-16">
        <div className="grid content-start gap-3">
          <Logo className="h-8" title="Linkyo" />
          <p className="max-w-prose text-small text-pretty text-fg-secondary">{t("tagline")}</p>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-3">
          {groups(paymentsEnabled).map((group) => (
            <nav key={group.key} aria-label={t(group.key)} className="grid content-start gap-1">
              <p className={groupTitle}>{t(group.key)}</p>
              {group.links.map((link) => (
                <Link key={link.key} href={link.href} className={linkClass}>
                  {t(link.key)}
                </Link>
              ))}
            </nav>
          ))}
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
