import { Badge, Button, cn, Icon, icons, LogoGlyph } from "@linkyo/ui";
import { Check, Gift, Plus, Server, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { EXAMPLES } from "@/features/examples/catalog";
import { LOOKS, PEOPLE_LOOKS } from "@/features/examples/looks";
import { VAT_MODE } from "@/features/payments/prices";
import { Link } from "@/i18n/navigation";

import { phoneSizes } from "./assets";
import { ClaimForm } from "./claim-form";
import { EXAMPLE_SHOTS, STRIP, type ExampleShot } from "./examples";
import { order } from "./hero";
import { bdi } from "./pages/text";
import { billingQuestions, faqQuestions, freeTrustBody, pricingPlans, pricingValues, type Plan, type PlanLine, type SiteState } from "./pricing";
import { siteState } from "./site-state";

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
  const marketing = useTranslations("marketing");
  // Where pages are not counted, the "free for good" promise names no analytics.
  const third = freeTrustBody(siteState());
  const items = (t.raw("items") as { title: string; body: string }[]).map((item, index) => (index === 2 ? { ...item, body: marketing(third.key) } : item));
  return (
    <Shell labelledBy="trust-title" className="w-full pb-12 md:pb-24">
      <h2 id="trust-title" className="sr-only">
        {t("title")}
      </h2>
      {/* Phones: one grouped list (icon beside the words, hairlines between); wide screens: three cards. */}
      <ul className="grid grid-cols-1 overflow-clip rounded-xl bg-canvas-muted max-md:divide-y max-md:divide-line md:grid-cols-3 md:gap-4 md:overflow-visible md:rounded-none md:bg-transparent">
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
            <Icon icon={icons.forward} size="md" className="transition-transform duration-micro group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

/** The words a plan card shows above its lines (Pro's line is `ProLive`). */
const PLAN_TEXT = {
  free: { name: "pricing.free.name", lead: "pricing.free.lead" },
  pro: { name: "pricing.pro.name", lead: null },
  service: { name: "pricing.service.name", lead: "pricing.service.lead" },
} as const;

/**
 * Pro's line under its name: what Pro holds when it is sold (AI drafts), in both states. Never the old
 * coming-soon promise to sell and grow: selling is planned, and listed as planned below it.
 */
function ProLive() {
  const t = useTranslations("marketing.pricing");
  return <p className="text-body text-pretty text-fg-secondary">{t("proLive.lead")}</p>;
}

/** One line of a plan: a check where it is part of the plan, a calendar where it is planned. */
function PlanLineItem({ line, children }: { line: PlanLine; children: ReactNode }) {
  const planned = line.when === "planned";
  return (
    <li data-when={line.when} className="flex items-start gap-3 text-body">
      <span aria-hidden className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full", planned ? "bg-canvas-muted text-fg-secondary" : "bg-selected text-selected-fg")}>
        <Icon icon={planned ? icons.event : Check} size="sm" />
      </span>
      <span className={cn("min-w-0", planned && "text-fg-secondary")}>{children}</span>
    </li>
  );
}

/**
 * A plan as a card: its name and whether it is there now or comes with the start, its price, what it
 * holds, and what is planned for it under its own heading. Only a plan that can be had today leads
 * somewhere: Free to sign-up; Pro to its checkout and the page service to its page once payments are on.
 */
function PlanCard({ plan, state }: { plan: Plan; state: SiteState }) {
  const t = useTranslations("marketing");
  const locale = useLocale() as "de" | "en" | "ar";
  const values = pricingValues(locale);
  const text = (key: string) => t.rich(key, { ...values, bdi });
  const current = plan.lines.filter((line) => line.when !== "planned");
  const planned = plan.lines.filter((line) => line.when === "planned");
  const vat = VAT_MODE === "standard19" ? t("pricing.proLive.vat") : null;
  const titleId = `plan-${plan.id}`;
  const free = plan.id === "free";
  const lead = PLAN_TEXT[plan.id].lead;
  return (
    <article
      aria-labelledby={titleId}
      data-plan={plan.id}
      data-when={plan.when}
      className={cn(
        "mk-reveal grid content-start gap-6 rounded-xl p-6 md:p-8",
        free ? "border border-line bg-surface-elevated md:col-span-2 lg:col-span-1" : "bg-canvas-muted",
      )}
    >
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h3 id={titleId} className="text-h3">
            {t(PLAN_TEXT[plan.id].name)}
          </h3>
          <Badge tone={plan.when === "now" ? "primary" : "outline"} dot={plan.when === "now"} data-when-badge>
            {t(`pricing.when.${plan.when}`)}
          </Badge>
        </div>
        {lead === null ? <ProLive /> : <p className="text-body text-pretty text-fg-secondary">{t(lead)}</p>}
      </header>
      <p data-price className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {free ? (
          <>
            <span className="text-display-sm font-extrabold tracking-display tabular-nums">{t("pricing.free.price")}</span>
            <span className="text-body font-medium text-fg-secondary">{t("pricing.free.per")}</span>
          </>
        ) : plan.id === "pro" ? (
          <>
            <bdi className="text-display-sm font-extrabold tracking-display tabular-nums">{values.price}</bdi>
            <span className="text-body font-medium text-fg-secondary">{t("pricing.proLive.per")}</span>
            {vat ? <span className="text-small text-fg-secondary">{vat}</span> : null}
          </>
        ) : (
          <>
            <span className="text-display-sm font-extrabold tracking-display tabular-nums">{text("pricing.service.from")}</span>
            <span className="text-body font-medium text-fg-secondary">{t("pricing.service.once")}</span>
            {vat ? <span className="text-small text-fg-secondary">{vat}</span> : null}
          </>
        )}
      </p>
      <ul className="grid gap-3 border-t border-line pt-6">
        {current.map((line) => (
          <PlanLineItem key={line.key} line={line}>
            {text(line.key)}
          </PlanLineItem>
        ))}
      </ul>
      {planned.length > 0 ? (
        <div className="grid gap-3">
          <p className="text-caption font-semibold text-fg-secondary">{t("pricing.when.planned")}</p>
          <ul className="grid gap-3">
            {planned.map((line) => (
              <PlanLineItem key={line.key} line={line}>
                {text(line.key)}
              </PlanLineItem>
            ))}
          </ul>
        </div>
      ) : null}
      {free ? (
        <Button asChild variant="primary" size="cta" className="group text-center whitespace-normal">
          <Link href="/signup">
            {t("pricing.free.cta")}
            <Icon icon={icons.forward} size="md" className="transition-transform duration-micro group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
          </Link>
        </Button>
      ) : null}
      {plan.id === "pro" && state.payments ? (
        <div className="grid gap-3">
          <p className="text-small text-fg-secondary">{t("pricing.proLive.terms")}</p>
          <Button asChild variant="primary" size="cta" className="group text-center whitespace-normal">
            <Link href="/checkout/pro">
              {t("pricing.proLive.cta")}
              <Icon icon={icons.forward} size="md" className="transition-transform duration-micro group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
            </Link>
          </Button>
        </div>
      ) : null}
      {plan.id === "service" && state.payments ? (
        <Button asChild variant="tinted" size="lg" className="group justify-self-start">
          <Link href="/service">
            {t("pricing.service.cta")}
            <Icon icon={icons.forward} size="md" className="transition-transform duration-micro group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
          </Link>
        </Button>
      ) : null}
    </article>
  );
}

/**
 * Free, Pro and the page service in one comparison that keeps "now" apart from "with the start"
 * (W-06): each card says which it is, its price (ADR 0066), what it holds and what is planned for it.
 * Free is the offer today. While payments are off, Pro and the page service carry their prices as
 * "comes with the start" and lead nowhere: there is nothing to buy yet. Under the cards, the questions
 * about paying and cancelling, answered with what the code does.
 */
export function Pricing() {
  const t = useTranslations("marketing");
  const locale = useLocale() as "de" | "en" | "ar";
  const state = siteState();
  const plans = pricingPlans(state);
  const questions = billingQuestions(state, locale);
  return (
    <Shell id="pricing" labelledBy="pricing-title" className="grid w-full grid-cols-1 gap-10 py-12 md:gap-12 md:py-24">
      <SectionHeader id="pricing-title" title={t("pricing.title")} lead={state.payments ? t("pricing.leadPaid") : t("pricing.lead")} center />
      <div role="group" aria-label={t("pricing.compare")} className="mx-auto grid w-full max-w-content gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} state={state} />
        ))}
      </div>
      <section aria-labelledby="billing-title" className="mk-reveal mx-auto grid w-full max-w-content gap-6 border-t border-line pt-8 md:pt-10">
        <h3 id="billing-title" className="text-h3">
          {t("pricing.billing.title")}
        </h3>
        <dl className="grid gap-x-10 gap-y-6 md:grid-cols-2">
          {questions.map(({ q, a }) => (
            <div key={q.key} className="grid content-start gap-1">
              <dt className="text-body font-semibold text-balance">{t.rich(q.key, { ...q.values, bdi })}</dt>
              <dd className="text-body text-pretty text-fg-secondary">{t.rich(a.key, { ...a.values, bdi })}</dd>
            </div>
          ))}
        </dl>
      </section>
    </Shell>
  );
}

/**
 * Questions as a calm list: hairlines between them, a round button that turns into a cross, and the
 * answer that opens smoothly in place (where the browser can animate it; it simply opens elsewhere).
 * The first answer follows the build (`faqQuestions`): it names the cookie-free statistics only where
 * pages are counted, and what Pro holds once it can be bought. Under the title, the way to the help pages.
 */
export function Faq() {
  const t = useTranslations("marketing");
  const items = faqQuestions(siteState(), (t.raw("faq.items") as unknown[]).length);
  return (
    <Shell id="faq" labelledBy="faq-title" className="grid grid-cols-1 gap-8 py-12 md:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16">
      <header className="mk-reveal grid content-start justify-items-start gap-3 lg:sticky lg:top-24 lg:self-start">
        <h2 id="faq-title" className="text-h2 tracking-tight text-balance md:text-h1">
          {t("faq.title")}
        </h2>
        <p className="text-body-lg text-pretty text-fg-secondary">{t("faq.lead")}</p>
        <Link
          href="/hilfe"
          className="-mx-2 inline-flex min-h-touch-target items-center gap-2 rounded-md px-2 text-body font-semibold text-link transition-colors duration-micro hover:text-fg focus-visible:focus-ring active:bg-pressed"
        >
          <Icon icon={icons.help} size="md" />
          {t("faq.more")}
          <Icon icon={icons.next} size="sm" />
        </Link>
      </header>
      <div className="divide-y divide-line border-y border-line">
        {items.map(({ q, a }) => (
          <details key={q.key} className="group mk-faq">
            <summary className="-mx-3 flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 rounded-md px-3 py-4 text-body-lg font-semibold text-balance outline-none transition-colors duration-micro focus-visible:focus-ring active:bg-pressed [&::-webkit-details-marker]:hidden">
              {t.rich(q.key, { bdi })}
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-canvas-muted text-fg-secondary transition-[rotate,background-color,color] duration-standard ease-standard group-open:rotate-45 group-open:bg-primary group-open:text-primary-fg motion-reduce:transition-none">
                <Icon icon={Plus} size="sm" />
              </span>
            </summary>
            <p className="pe-12 pb-5 text-body text-pretty text-fg-secondary">{t.rich(a.key, { bdi })}</p>
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
