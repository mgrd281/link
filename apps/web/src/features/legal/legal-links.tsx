import { cn } from "@linkyo/ui";
import { useLocale, useTranslations } from "next-intl";

import { paymentsEnabled } from "@/lib/flags";

import { legalLinksVisible } from "./company";

// A phone's finger needs 44 px each way, also for a word as short as "AGB": the link reaches 8 px past its
// words on each side (padding drawn back by the negative margin, so the words stay where they were). On a laptop
// the row is 32 px tall (it was 17: under the 24 px of WCAG 2.5.8).
const linkClass =
  "-mx-2 inline-flex min-h-touch-target items-center rounded-xs px-2 text-fg-secondary transition-colors duration-micro hover:text-fg focus-visible:focus-ring md:min-h-control-sm";

const PAGES = [
  { key: "imprint", href: "/impressum" },
  { key: "privacy", href: "/datenschutz" },
  { key: "terms", href: "/agb" },
] as const;

const CONTRACTS = [
  { key: "cancellationPolicy", href: "/widerrufsbelehrung" },
  { key: "withdraw", href: "/widerruf" },
  { key: "cancel", href: "/kuendigen" },
] as const;

/**
 * Linkyo's legal pages at the foot of the website and the sign-up screens. Impressum, Datenschutz
 * and AGB are links once the company data is real (or in a payments test build); until then they
 * stay plain names, so no placeholder draft is published from a footer. Where contracts can be made
 * (payments on, which needs visible legal links: live builds fail without real company data), the
 * withdrawal policy, "Vertrag widerrufen" and "Verträge hier kündigen" are links too: the withdrawal
 * and cancellation functions must be reachable from every page.
 *
 * Plain links, not the router's: these pages are rarely opened, so nothing is fetched ahead of a tap
 * on every page that shows the footer.
 */
export function LegalLinks({ className }: { className?: string }) {
  const t = useTranslations("legal");
  const locale = useLocale();

  if (!legalLinksVisible) {
    // The names only, as before: the pages are drafts until the company data is in.
    return (
      <p className={cn("text-fg-tertiary flex flex-wrap gap-x-4 gap-y-1", className)}>
        <span className="sr-only">{t("label")}:</span>
        {PAGES.map(({ key }) => (
          <span key={key}>{t(`nav.${key}`)}</span>
        ))}
      </p>
    );
  }

  const links = paymentsEnabled ? [...PAGES, ...CONTRACTS] : PAGES;
  return (
    <nav aria-label={t("label")} className={className}>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {links.map(({ key, href }) => (
          <li key={key}>
            <a href={`/${locale}${href}`} className={linkClass}>
              {t(`nav.${key}`)}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
