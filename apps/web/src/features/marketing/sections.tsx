import { Badge, cn, Icon } from "@linkyo/ui";
import { ArrowRight, Check, Gift, Link2, Plus, Server, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { CSSProperties, ReactNode } from "react";

import { EXAMPLES } from "@/features/examples/catalog";
import { LOOKS } from "@/features/examples/looks";
import { Link } from "@/i18n/navigation";

import { phoneSizes } from "./assets";
import { ClaimForm } from "./claim-form";
import { EXAMPLE_SHOTS, STRIP, type ExampleShot } from "./examples";
import { order } from "./hero";
import { PasteDemo } from "./paste-demo";

function SectionHeader({ id, title, lead, center = false }: { id: string; title: string; lead?: string; center?: boolean }) {
  return (
    <header className={cn("mk-reveal grid gap-4", center ? "mx-auto max-w-prose justify-items-center text-center" : "max-w-prose")}>
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
    <Shell labelledBy="trust-title" className="w-full pb-16 md:pb-24">
      <h2 id="trust-title" className="sr-only">
        {t("title")}
      </h2>
      {/* Phones: compact rows (icon beside the words); wide screens: three cards side by side. */}
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
        {items.map((item, index) => (
          <li
            key={item.title}
            className="mk-reveal grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-1 rounded-xl bg-canvas-muted p-5 md:grid-cols-1 md:content-start md:gap-4 md:p-8"
            style={order(index)}
          >
            <span aria-hidden className="row-span-2 grid size-control-md place-items-center rounded-full bg-primary text-primary-fg shadow-cta md:row-span-1">
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
    <section id="templates" aria-labelledby="templates-title" className="scroll-mt-24 overflow-clip py-16 md:py-24">
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
                className="group block overflow-hidden rounded-xl border border-line bg-surface shadow-e2 transition-[translate,box-shadow] duration-standard ease-standard hover:-translate-y-1 hover:shadow-e3 focus-visible:focus-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0"
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
      <div className="mt-10 flex justify-center px-5">
        <Link
          href="/templates"
          className="inline-flex h-control-lg items-center gap-2 rounded-full bg-primary px-6 text-body font-semibold text-primary-fg shadow-cta transition-[background-color,translate,scale] duration-micro hover:-translate-y-0.5 hover:bg-primary-hover focus-visible:focus-ring active:translate-y-0 active:scale-pressed motion-reduce:hover:translate-y-0"
        >
          {tExamples("seeAll", { count: Object.keys(LOOKS).length })}
          <Icon icon={ArrowRight} size="md" className="rtl:-scale-x-100" />
        </Link>
      </div>
    </section>
  );
}

/** One feature: words on one side, a tinted panel with the product in motion on the other. */
function FeatureRow({ title, body, tint, reverse = false, children }: { title: string; body: string; tint: string; reverse?: boolean; children: ReactNode }) {
  return (
    <article className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-16">
      <div className={cn("mk-reveal grid max-w-prose gap-3", reverse && "lg:order-last")}>
        <h3 className="text-h2 text-balance">{title}</h3>
        <p className="text-body-lg text-pretty text-fg-secondary">{body}</p>
      </div>
      <div className={cn("mk-panel relative isolate grid min-w-0 place-items-center overflow-hidden rounded-xl p-6 md:p-10", tint)}>{children}</div>
    </article>
  );
}

/** A page capture as a card (the top of the page). */
function Shot({ slug, className, sizes = phoneSizes.side }: { slug: ExampleShot; className?: string; sizes?: string }) {
  return (
    <div className={cn("relative aspect-portrait overflow-hidden rounded-lg border border-line bg-surface shadow-e3", className)}>
      <Image src={EXAMPLE_SHOTS[slug]} alt="" fill sizes={sizes} placeholder="blur" className="object-cover object-top" />
    </div>
  );
}

const VISITS = [42, 58, 51, 66, 74, 96, 83] as const;
const LINKS = [46, 31, 23] as const;

/** Cookie-free analytics, with clearly marked sample numbers; the bars grow as they scroll in. */
function AnalyticsCard() {
  const t = useTranslations("marketing.analytics");
  const locale = useLocale();
  const days = t.raw("days") as string[];
  const links = t.raw("links") as string[];
  const n = new Intl.NumberFormat(locale);
  const pct = new Intl.NumberFormat(locale, { style: "percent" });
  return (
    <figure className="mk-pop grid w-full max-w-prose gap-5 rounded-xl bg-surface-elevated p-5 shadow-e3 md:p-6">
      <figcaption className="flex items-center justify-between gap-3">
        <span className="text-small font-semibold">{t("week")}</span>
        <Badge size="sm">{t("sample")}</Badge>
      </figcaption>
      <dl className="grid grid-cols-3 gap-2">
        {[
          [t("visitors"), n.format(12480)],
          [t("clicks"), n.format(3912)],
          [t("ctr"), pct.format(0.31)],
        ].map(([label, value]) => (
          <div key={label} className="grid gap-1 rounded-lg bg-canvas-muted p-3">
            <dt className="text-caption font-medium text-fg-secondary">{label}</dt>
            <dd className="text-h3 tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <div role="img" aria-label={`${t("visitors")}: ${days.map((day, i) => `${day} ${VISITS[i] ?? 0}`).join(", ")} (${t("sample")})`} className="grid h-24 grid-cols-7 gap-2">
        {VISITS.map((value, index) => (
          <div key={days[index]} className="flex h-full flex-col items-center gap-2">
            <span className="relative w-full flex-1">
              <span className={cn("mk-grow absolute inset-x-0 bottom-0 h-(--h) rounded-t-md", index === 5 ? "bg-primary" : "bg-selected")} style={{ "--h": `${value}%`, "--i": index } as CSSProperties} />
            </span>
            <span aria-hidden className="text-caption text-fg-tertiary">
              {days[index]}
            </span>
          </div>
        ))}
      </div>
      <ul className="grid gap-2">
        {LINKS.map((share, index) => (
          <li key={links[index]} className="grid gap-1">
            <span className="flex justify-between text-small">
              <span>{links[index]}</span>
              <span className="text-fg-secondary tabular-nums">{pct.format(share / 100)}</span>
            </span>
            <span className="block h-2 overflow-hidden rounded-full bg-canvas-muted">
              <span className="mk-grow block h-full w-(--w) origin-left rounded-full bg-primary rtl:origin-right" style={{ "--w": `${share * 2}%`, "--i": index } as CSSProperties} />
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** A shared link as it appears in a chat, next to the story picture in the page's look. */
function ShareCard() {
  const t = useTranslations("marketing.features.share");
  const slug: ExampleShot = "mara-vale";
  const page = EXAMPLES[slug];
  return (
    <div className="relative grid w-full max-w-prose grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-end gap-4">
      <div className="mk-fan grid gap-2 -rotate-3">
        <span className="justify-self-start rounded-full bg-fg px-2 py-0.5 text-caption font-semibold text-canvas">{t("story")}</span>
        <div className="relative aspect-short overflow-hidden rounded-lg border border-line shadow-e3">
          <Image src={EXAMPLE_SHOTS[slug]} alt="" fill sizes={phoneSizes.side} placeholder="blur" className="object-cover object-top" />
        </div>
      </div>
      <div className="mk-pop grid gap-2" style={order(1)}>
        <span className="justify-self-start rounded-full bg-fg px-2 py-0.5 text-caption font-semibold text-canvas">{t("preview")}</span>
        <div className="overflow-hidden rounded-xl rounded-ee-xs bg-surface-elevated shadow-e3">
          <div className="relative aspect-og">
            <Image src={EXAMPLE_SHOTS[slug]} alt="" fill sizes={phoneSizes.side} placeholder="blur" className="object-cover object-[50%_18%]" />
          </div>
          <div className="grid gap-0.5 p-3" dir="ltr">
            <p className="truncate text-small font-semibold">{page?.profile.displayName}</p>
            <p className="line-clamp-2 text-caption text-fg-secondary">{page?.profile.tagline ?? page?.profile.bio}</p>
            <p className="flex items-center gap-1 text-caption text-fg-tertiary">
              <Icon icon={Link2} size="sm" />
              linkyo.app/{slug}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Everything a page can do, as four rows on light Linkyo Teal panels; what is inside each panel moves in as it scrolls in. */
export function Features() {
  const t = useTranslations("marketing");
  return (
    <Shell id="features" labelledBy="features-title" className="grid w-full gap-16 py-16 md:gap-24 md:py-24">
      <header className="mk-reveal mx-auto grid max-w-prose justify-items-center text-center">
        <h2 id="features-title" className="text-h2 tracking-tight text-balance md:text-h1">
          <span className="block text-fg-tertiary">{t("features.title1")}</span>
          <span className="block">{t("features.title2")}</span>
        </h2>
      </header>

      <FeatureRow title={t("features.look.title")} body={t("features.look.body")} tint="bg-tint-teal">
        <div className="relative grid aspect-square w-full max-w-prose place-items-center sm:aspect-4/3">
          <Shot slug="juno-kade" className="mk-fan absolute w-5/12 -translate-x-3/4 -rotate-6 sm:w-1/3 rtl:translate-x-3/4" />
          <Shot slug="salma-rahhal" className="mk-fan absolute w-5/12 translate-x-3/4 rotate-6 sm:w-1/3 rtl:-translate-x-3/4" />
          <Shot slug="nico-hale" className="relative w-1/2 sm:w-5/12" sizes={phoneSizes.hero} />
        </div>
      </FeatureRow>

      <FeatureRow title={t("paste.title")} body={t("paste.lead")} tint="bg-canvas-muted" reverse>
        <div className="mk-pop w-full max-w-prose">
          <PasteDemo />
        </div>
      </FeatureRow>

      <FeatureRow title={t("analytics.title")} body={t("analytics.lead")} tint="bg-tint-teal">
        <AnalyticsCard />
      </FeatureRow>

      <FeatureRow title={t("features.share.title")} body={t("features.share.body")} tint="bg-canvas-muted" reverse>
        <ShareCard />
      </FeatureRow>
    </Shell>
  );
}

export function Pricing() {
  const t = useTranslations("marketing.pricing");
  const free = t.raw("free.features") as string[];
  const pro = t.raw("pro.features") as string[];
  return (
    <Shell id="pricing" labelledBy="pricing-title" className="grid w-full grid-cols-1 gap-12 py-16 md:py-24">
      <SectionHeader id="pricing-title" title={t("title")} lead={t("lead")} center />
      <div className="mx-auto grid w-full gap-4 md:grid-cols-2">
        <article className="mk-reveal grid content-start gap-6 rounded-xl border border-line bg-surface-elevated p-6 shadow-e2 md:p-10">
          <div className="grid gap-2">
            <h3 className="text-h3">{t("free.name")}</h3>
            <p className="flex items-baseline gap-2">
              <span className="text-display font-extrabold tracking-display">{t("free.price")}</span>
              <span className="text-body text-fg-secondary">{t("free.per")}</span>
            </p>
          </div>
          <ul className="grid gap-3">
            {free.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-body">
                <Icon icon={Check} size="md" className="shrink-0 text-success-strong" />
                {feature}
              </li>
            ))}
          </ul>
          <Link
            href="/signup"
            className="inline-flex h-control-xl items-center justify-center rounded-full bg-primary px-6 text-body font-semibold text-primary-fg shadow-cta transition-[background-color,translate,scale] duration-micro hover:-translate-y-0.5 hover:bg-primary-hover focus-visible:focus-ring active:translate-y-0 active:scale-pressed motion-reduce:hover:translate-y-0"
          >
            {t("free.cta")}
          </Link>
        </article>
        <article className="mk-reveal grid content-start gap-6 rounded-xl bg-tint-teal p-6 md:p-10">
          <div className="grid gap-2">
            <h3 className="flex items-center gap-3 text-h3">
              {t("pro.name")}
              <Badge tone="primary" dot>
                {t("pro.badge")}
              </Badge>
            </h3>
          </div>
          <ul className="grid gap-3">
            {pro.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-body">
                <Icon icon={Plus} size="md" className="shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </Shell>
  );
}

export function Faq() {
  const t = useTranslations("marketing.faq");
  const items = t.raw("items") as { q: string; a: string }[];
  return (
    <Shell id="faq" labelledBy="faq-title" className="grid grid-cols-1 gap-10 py-16 md:py-24 lg:grid-cols-3 lg:gap-16">
      <SectionHeader id="faq-title" title={t("title")} />
      <div className="grid gap-2 lg:col-span-2">
        {items.map((item) => (
          <details key={item.q} className="group mk-reveal rounded-lg border border-line bg-surface has-[summary:focus-visible]:focus-ring">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-body-lg font-semibold outline-none [&::-webkit-details-marker]:hidden">
              {item.q}
              <Icon icon={Plus} size="md" className="shrink-0 text-fg-secondary transition-transform duration-standard ease-standard group-open:rotate-45 motion-reduce:transition-none" />
            </summary>
            <p className="px-5 pb-5 text-body text-fg-secondary">{item.a}</p>
          </details>
        ))}
      </div>
    </Shell>
  );
}


/**
 * The last word, in the brand color: a Linkyo Teal card with its lighter band along the bottom,
 * white text, the address field and what Pro will add.
 */
export function FinalCta() {
  const t = useTranslations("marketing");
  const pro = t.raw("pricing.pro.features") as string[];
  return (
    <section id="start" aria-labelledby="final-title" className="mx-auto w-full max-w-content scroll-mt-24 px-5 md:px-10">
      <div className="mk-reveal grid overflow-hidden rounded-xl bg-primary text-primary-fg shadow-e2">
        <div className="grid justify-items-center gap-6 px-5 py-16 text-center md:px-10 md:py-24">
          <h2 id="final-title" className="text-h1 tracking-tight text-balance md:text-display">
            {t("final.title")}
          </h2>
          <p className="max-w-prose text-body-lg text-pretty">{t("final.lead")}</p>
          <ClaimForm id="final-claim" tone="brand" className="w-full max-w-prose text-start" />
          <div className="grid justify-items-center gap-3 pt-6">
            <p className="text-small font-semibold">{t("final.soon")}</p>
            <ul className="flex max-w-prose flex-wrap justify-center gap-2">
              {pro.map((feature) => (
                <li key={feature} className="inline-flex h-control-sm items-center rounded-full bg-primary-hover px-3 text-small font-medium text-primary-fg">
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div aria-hidden className="h-6 bg-primary-hover md:h-8" />
      </div>
    </section>
  );
}

export { order };
