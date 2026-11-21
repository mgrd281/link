import { Badge, Button, cn, Icon, LogoGlyph } from "@linkyo/ui";
import { ArrowRight, ChartColumn, Check, EyeOff, Gift, Globe, Mail, Plus, Server, ShieldCheck, ShoppingBag } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { EXAMPLES } from "@/features/examples/catalog";
import { LOOKS, PEOPLE_LOOKS } from "@/features/examples/looks";
import { Link } from "@/i18n/navigation";

import { phoneSizes } from "./assets";
import { ClaimForm } from "./claim-form";
import { EXAMPLE_SHOTS, STRIP, type ExampleShot } from "./examples";
import { order } from "./hero";

function SectionHeader({ id, title, lead, center = false }: { id: string; title: string; lead?: string; center?: boolean }) {
  return (
    <header className={cn("mk-reveal grid gap-4", center ? "max-w-prose md:mx-auto md:justify-items-center md:text-center" : "max-w-prose")}>
      <h2 id={id} className="text-h2 tracking-tight text-balance md:text-h1">
        {title}
      </h2>
      {lead ? <p className="text-body-lg text-pretty text-fg-secondary">{lead}</p> : null}
    </header>
  );
}

function Shell({ id, labelledBy, className, children }: { id?: string; labelledBy: string; className?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn("mx-auto max-w-content scroll-mt-24 px-5 md:px-10", className)}>
      {children}
    </section>
  );
}

const TRUST_ICONS = [Server, ShieldCheck, Gift] as const;

/** Three plain promises on soft cards, each with its icon in Linkyo Teal. */
export function Trust() {
  const t = useTranslations("marketing.trust");
  const items = t.raw("items") as { title: string; body: string }[];
  return (
    <Shell labelledBy="trust-title" className="w-full pb-12 md:pb-24">
      <h2 id="trust-title" className="sr-only">
        {t("title")}
      </h2>
      {/* Phones: one grouped list (icon beside the words, hairlines between); wide screens: three cards. */}
      <ul className="grid grid-cols-1 overflow-hidden rounded-xl bg-canvas-muted max-md:divide-y max-md:divide-line md:grid-cols-3 md:gap-4 md:overflow-visible md:rounded-none md:bg-transparent">
        {items.map((item, index) => (
          <li
            key={item.title}
            className="mk-reveal grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-1 p-5 md:grid-cols-1 md:content-start md:gap-4 md:rounded-xl md:bg-canvas-muted md:p-8"
            style={order(index)}
          >
            <span aria-hidden className="row-span-2 grid size-control-md place-items-center rounded-full bg-tinted text-tinted-fg md:row-span-1">
              <Icon icon={TRUST_ICONS[index] ?? Check} size="md" />
            </span>
            <h3 className="text-body-lg font-semibold text-balance md:text-h3">{item.title}</h3>
            <p className="text-small text-pretty text-fg-secondary md:text-body">{item.body}</p>
          </li>
        ))}
      </ul>
    </Shell>
  );
}

const nameOf = (slug: ExampleShot) => EXAMPLES[slug]?.profile.displayName ?? slug;
const pageHref = (slug: ExampleShot) => `/${LOOKS[slug].locale}/p/${slug}`;

/**
 * Example pages in one row. On wide screens the row slides along as the page scrolls (it has no
 * motion of its own, so there is nothing to pause); on phones it is a row to swipe, card by card.
 * It grows to full size as it scrolls in; reduced motion keeps it still.
 */
export function Templates() {
  const t = useTranslations("marketing.templates");
  const tExamples = useTranslations("examples");
  return (
    <section id="templates" aria-labelledby="templates-title" className="scroll-mt-24 overflow-clip py-12 md:py-24">
      <div className="mx-auto max-w-content px-5 md:px-10">
        <SectionHeader id="templates-title" title={t("title")} lead={t("lead")} center />
      </div>
      <div className="mk-zoom mk-no-scrollbar mt-10 snap-x snap-mandatory scroll-px-5 overflow-x-auto md:mt-12 md:snap-none md:overflow-x-hidden md:mask-x-from-90% md:mask-x-to-100%">
        <ul aria-label={t("label")} className="mk-drift flex w-max gap-4 px-5 py-4 md:px-10">
          {STRIP.map((slug) => (
            <li key={slug} className="w-[min(62vw,var(--container-menu))] shrink-0 snap-start">
              <a
                href={pageHref(slug)}
                aria-label={t("open", { name: nameOf(slug) })}
                className="group block overflow-hidden rounded-xl border border-line bg-surface transition-[translate,scale] duration-standard ease-standard hover:-translate-y-1 focus-visible:focus-ring active:scale-pressed active:duration-micro motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-none"
              >
                <span className="relative block aspect-short">
                  <Image
                    src={EXAMPLE_SHOTS[slug]}
                    alt=""
                    fill
                    sizes={phoneSizes.rail}
                    placeholder="blur"
                    className="object-cover object-top transition-transform duration-slow ease-standard group-hover:scale-lift motion-reduce:transition-none"
                  />
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-10 grid px-5 sm:flex sm:justify-center">
        <Button asChild variant="primary" size="cta" className="group">
          <Link href="/templates">
            {tExamples("seeAll", { count: Object.keys(LOOKS).length + Object.keys(PEOPLE_LOOKS).length })}
            <Icon icon={ArrowRight} size="md" className="transition-transform duration-micro group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

const PRO_ICONS = [Globe, ShoppingBag, Mail, ChartColumn, EyeOff] as const;

/**
 * Two plans. Free is the offer: the price, everything in it, one button. Pro is what comes later,
 * quieter, as a list of what it will add (no button: there is nothing to buy yet).
 */
export function Pricing() {
  const t = useTranslations("marketing.pricing");
  const free = t.raw("free.features") as string[];
  const pro = t.raw("pro.features") as string[];
  return (
    <Shell id="pricing" labelledBy="pricing-title" className="grid w-full grid-cols-1 gap-10 py-12 md:gap-12 md:py-24">
      <SectionHeader id="pricing-title" title={t("title")} lead={t("lead")} center />
      <div className="mx-auto grid w-full max-w-content gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <article className="mk-reveal grid content-start gap-6 rounded-xl border border-line bg-surface-elevated p-6 md:p-10">
          <header className="grid gap-1">
            <h3 className="text-h3">{t("free.name")}</h3>
            <p className="text-body text-fg-secondary">{t("free.lead")}</p>
          </header>
          <p className="flex items-baseline gap-2">
            <span className="text-display font-extrabold tracking-display tabular-nums">{t("free.price")}</span>
            <span className="text-body font-medium text-fg-secondary">{t("free.per")}</span>
          </p>
          <ul className="grid gap-3 border-t border-line pt-6 sm:grid-cols-2 sm:gap-x-6">
            {free.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-body">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-selected text-selected-fg">
                  <Icon icon={Check} size="sm" />
                </span>
                {feature}
              </li>
            ))}
          </ul>
          <Button asChild variant="primary" size="cta" className="group">
            <Link href="/signup">
              {t("free.cta")}
              <Icon icon={ArrowRight} size="md" className="transition-transform duration-micro group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
            </Link>
          </Button>
        </article>
        <article className="mk-reveal grid content-start gap-5 rounded-xl bg-canvas-muted p-6 md:p-10">
          <header className="grid gap-1">
            <h3 className="flex items-center gap-3 text-h3">
              {t("pro.name")}
              <Badge tone="primary" dot>
                {t("pro.badge")}
              </Badge>
            </h3>
            <p className="text-body text-fg-secondary">{t("pro.lead")}</p>
          </header>
          {/* One grouped list, as in an app's settings: rows with hairlines, not separate buttons. */}
          <ul className="divide-y divide-line overflow-hidden rounded-lg bg-surface">
            {pro.map((feature, index) => (
              <li key={feature} className="flex min-h-12 items-center gap-3 px-4 py-2 text-body">
                <Icon icon={PRO_ICONS[index] ?? Plus} size="md" className="shrink-0 text-fg-secondary" />
                {feature}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </Shell>
  );
}

/**
 * Questions as a calm list: hairlines between them, a round button that turns into a cross, and the
 * answer that opens smoothly in place (where the browser can animate it; it simply opens elsewhere).
 */
export function Faq() {
  const t = useTranslations("marketing.faq");
  const items = t.raw("items") as { q: string; a: string }[];
  return (
    <Shell id="faq" labelledBy="faq-title" className="grid grid-cols-1 gap-8 py-12 md:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16">
      <header className="mk-reveal grid content-start gap-3 lg:sticky lg:top-24 lg:self-start">
        <h2 id="faq-title" className="text-h2 tracking-tight text-balance md:text-h1">
          {t("title")}
        </h2>
        <p className="text-body-lg text-pretty text-fg-secondary">{t("lead")}</p>
      </header>
      <div className="divide-y divide-line border-y border-line">
        {items.map((item) => (
          <details key={item.q} className="group mk-faq">
            <summary className="-mx-3 flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 rounded-md px-3 py-4 text-body-lg font-semibold text-balance outline-none transition-colors duration-micro focus-visible:focus-ring active:bg-pressed [&::-webkit-details-marker]:hidden">
              {item.q}
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-canvas-muted text-fg-secondary transition-[rotate,background-color,color] duration-standard ease-standard group-open:rotate-45 group-open:bg-primary group-open:text-primary-fg motion-reduce:transition-none">
                <Icon icon={Plus} size="sm" />
              </span>
            </summary>
            <p className="pe-12 pb-5 text-body text-pretty text-fg-secondary">{item.a}</p>
          </details>
        ))}
      </div>
    </Shell>
  );
}

/**
 * The last word, in the brand color: a Linkyo Teal card with the Linkyo y as a large, quiet mark
 * in its corner, the promise, and the address field.
 */
export function FinalCta() {
  const t = useTranslations("marketing");
  return (
    <section id="start" aria-labelledby="final-title" className="mx-auto w-full max-w-content scroll-mt-24 px-5 md:px-10">
      <div className="mk-reveal relative isolate grid justify-items-center gap-6 overflow-hidden rounded-xl bg-primary px-5 py-16 text-center text-primary-fg md:px-10 md:py-24">
        {/* The Linkyo y, large and tone on tone, leaning out of the top corner. Painted first and the words
            positioned after it, so it stays behind them. */}
        <LogoGlyph className="pointer-events-none absolute -end-12 -top-12 h-auto w-2/5 rotate-12 text-primary-hover md:-end-16 md:-top-20 md:w-1/4 rtl:-rotate-12" />
        <h2 id="final-title" className="relative text-h1 tracking-tight text-balance md:text-display">
          {t("final.title")}
        </h2>
        <p className="relative max-w-prose text-body-lg text-pretty">{t("final.lead")}</p>
        <ClaimForm id="final-claim" tone="brand" className="relative w-full max-w-prose text-start" />
      </div>
    </section>
  );
}

export { order };
