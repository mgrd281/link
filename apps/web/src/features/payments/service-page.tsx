import { Button, Icon } from "@linkyo/ui";
import { ArrowDown, ArrowRight, Check, PenTool, RotateCcw, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { COMPANY } from "@/features/legal/company";
import { Link } from "@/i18n/navigation";

import { formatEuro, PRICES, VAT_MODE } from "./prices";

type Locale = "de" | "en" | "ar";

const PACKAGES = [
  { id: "start", price: PRICES["service-start"], icon: Sparkles },
  { id: "premium", price: PRICES["service-premium"], icon: PenTool },
] as const;

/**
 * The page service ("Seitenservice", r3 §10.1 variant A with the founder's two packages): two
 * packages side by side from `md` (stacked on phones), each with who designs it, what is in it, the
 * one-off price and its button; the money-back promise with a link to its conditions; the delivery
 * rule; VAT and payment methods (§ 312j Abs. 1 BGB); the statutory rights; the conditions. No
 * struck-through price, no superlatives, no promised results.
 */
export function ServicePage() {
  const t = useTranslations("service");
  const tOrders = useTranslations("orders.package");
  const locale = useLocale() as Locale;
  return (
    <main id="main" className="mx-auto grid w-full max-w-content grid-cols-1 gap-12 px-5 pt-10 pb-16 md:gap-16 md:px-10 md:pt-16">
      <header className="grid max-w-prose gap-4">
        <h1 className="text-h1 tracking-tight text-balance md:text-display-sm">{t("title")}</h1>
        <p className="text-body-lg text-pretty text-fg-secondary">{t("lead")}</p>
      </header>

      <section aria-labelledby="packages-title" className="grid gap-4">
        <h2 id="packages-title" className="sr-only">
          {t("meta.title")}
        </h2>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {PACKAGES.map(({ id, price, icon }) => {
            const features = t.raw(`${id}.features`) as string[];
            return (
              <li key={id} className="grid content-start gap-6 rounded-xl border border-line bg-surface-elevated p-6 md:p-8">
                <div className="grid gap-3">
                  <span aria-hidden className="grid size-control-md place-items-center rounded-full bg-tinted text-tinted-fg">
                    <Icon icon={icon} size="md" />
                  </span>
                  <h3 id={`package-${id}`} className="text-h2 tracking-tight">
                    {tOrders(id)}
                  </h3>
                  <p className="text-body text-pretty text-fg-secondary">{t(`${id}.who`)}</p>
                </div>
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-display-sm font-extrabold tracking-display tabular-nums">{formatEuro(price.amountCents, locale)}</span>
                  <span className="text-body font-medium text-fg-secondary">{t("once")}</span>
                </p>
                <ul className="grid gap-3 border-t border-line pt-6">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-body">
                      <span aria-hidden className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-selected text-selected-fg">
                        <Icon icon={Check} size="sm" />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button asChild variant="primary" size="cta" className="group w-full text-center whitespace-normal">
                  <Link href={`/checkout/service?package=${id}`} aria-describedby={`package-${id}`}>
                    {t(`${id}.cta`)}
                    <Icon icon={ArrowRight} size="md" className="transition-transform duration-micro group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
                  </Link>
                </Button>
              </li>
            );
          })}
        </ul>
        <p className="text-small text-pretty text-fg-secondary">{t("signIn")}</p>
      </section>

      <section aria-labelledby="refund-title" className="grid max-w-prose gap-3 rounded-xl bg-canvas-muted p-6 md:p-8">
        <span aria-hidden className="grid size-control-md place-items-center rounded-full bg-surface text-fg">
          <Icon icon={RotateCcw} size="md" />
        </span>
        <h2 id="refund-title" className="text-h3 text-balance">
          {t("refund.title")}
        </h2>
        <p className="text-body text-pretty text-fg-secondary">{t("refund.body")}</p>
        <a
          href="#bedingungen"
          className="inline-flex min-h-touch-target items-center gap-2 self-start rounded-sm font-semibold text-link transition-colors duration-micro hover:text-fg focus-visible:focus-ring"
        >
          {t("refund.link")}
          <Icon icon={ArrowDown} size="sm" />
        </a>
      </section>

      <div className="grid max-w-prose gap-2 text-small text-pretty text-fg-secondary">
        <p>{t("delivery")}</p>
        <p>{t(`vat.${VAT_MODE}`)}</p>
        <p>{t("payments")}</p>
        <p className="font-medium text-fg">{t("rights")}</p>
      </div>

      <section id="bedingungen" aria-labelledby="conditions-title" className="grid max-w-prose scroll-mt-24 gap-4 border-t border-line pt-10">
        <h2 id="conditions-title" className="text-h2 tracking-tight">
          {t("conditions.title")}
        </h2>
        <p className="text-body text-pretty">{t("conditions.revisions")}</p>
        <p className="text-body text-pretty">{t("conditions.refund", { email: COMPANY.email })}</p>
        <p className="text-body text-pretty">{t("conditions.who")}</p>
      </section>
    </main>
  );
}
