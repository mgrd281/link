import { creatorTokens } from "@linkyo/tokens";
import { TEMPLATE_IDS } from "@linkyo/tokens/creator";
import { Badge, cn, Icon } from "@linkyo/ui";
import { ArrowRight, Check, Plus, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { CSSProperties, ReactNode } from "react";

import { LOOKS } from "@/features/examples/looks";
import { Link } from "@/i18n/navigation";

import { fullPage, PHONE_SCREEN_RATIO, phoneShots, phoneSizes } from "./assets";
import { ClaimForm } from "./claim-form";
import { order } from "./hero";
import { MarqueeControl } from "./marquee-control";
import { PasteDemo } from "./paste-demo";
import { Phone } from "./phone";

function SectionHeader({ id, title, lead, center = false }: { id: string; title: string; lead?: string; center?: boolean }) {
  return (
    <header className={cn("mk-reveal grid gap-4", center ? "mx-auto max-w-prose justify-items-center text-center" : "max-w-prose")}>
      <h2 id={id} className="text-h1 tracking-tight text-balance md:text-display">
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

/** Three promises as big numbers. The EU figure counts up as it scrolls in. */
export function Proof() {
  const t = useTranslations("marketing.proof");
  return (
    <Shell labelledBy="proof-title" className="py-16 md:py-24">
      <h2 id="proof-title" className="sr-only">
        {t("title")}
      </h2>
      <ul className="grid divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface md:grid-cols-3 md:divide-x md:divide-y-0 rtl:md:divide-x-reverse">
        {(["cookies", "eu", "free"] as const).map((key) => (
          <li key={key} className="mk-reveal grid content-start gap-2 p-8 md:p-10">
            <p className="text-display font-extrabold tracking-display tabular-nums md:text-display-xl">
              {key === "eu" ? (
                <>
                  <span aria-hidden className="mk-count" style={{ "--mk-to": 100 } as CSSProperties} />
                  <span aria-hidden> %</span>
                  <span className="sr-only">{t("eu.value")}</span>
                </>
              ) : (
                t(`${key}.value`)
              )}
            </p>
            <p className="text-body-lg text-fg-secondary">{t(`${key}.label`)}</p>
          </li>
        ))}
      </ul>
    </Shell>
  );
}

/** All five templates on phones, drifting by. Pausable, and still on reduced motion. */
export function Templates() {
  const t = useTranslations("marketing.templates");
  const tTemplates = useTranslations("templates");
  const tExamples = useTranslations("examples");
  const locale = useLocale();
  const shots = phoneShots(locale);
  const loop = [...TEMPLATE_IDS, ...TEMPLATE_IDS];
  return (
    <section id="templates" aria-labelledby="templates-title" className="scroll-mt-24 overflow-clip py-16 md:py-24">
      <div className="mx-auto max-w-content px-5 md:px-10">
        <SectionHeader id="templates-title" title={t("title")} lead={t("lead")} center />
      </div>
      <MarqueeControl pauseLabel={t("pause")} playLabel={t("play")}>
        <div className="mt-12 mask-x-from-85% mask-x-to-100%">
          <ul aria-label={t("label")} className="mk-marquee flex w-max gap-6 px-3 motion-reduce:w-auto motion-reduce:flex-wrap motion-reduce:justify-center">
            {loop.map((id, index) => {
              const copy = index >= TEMPLATE_IDS.length;
              return (
                <li key={`${id}-${index}`} aria-hidden={copy || undefined} className={cn("grid w-[min(44vw,var(--container-menu))] gap-3", copy && "motion-reduce:hidden")}>
                  <Phone>
                    <Image src={shots[id]} alt="" fill sizes={phoneSizes.rail} placeholder="blur" className="object-cover object-top" />
                  </Phone>
                  <span className="grid gap-0.5 px-1">
                    <span className="text-body font-semibold">{creatorTokens.templates[id].label}</span>
                    <span className="line-clamp-2 text-small text-fg-secondary">{tTemplates(`${id}.description`)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </MarqueeControl>
      <div className="mt-10 flex justify-center px-5">
        <Link
          href="/templates"
          className="inline-flex h-control-lg items-center gap-2 rounded-full border border-line-strong bg-surface px-6 text-body font-semibold text-fg shadow-e1 transition-colors duration-micro hover:bg-surface-elevated focus-visible:focus-ring"
        >
          {tExamples("seeAll", { count: Object.keys(LOOKS).length })}
          <Icon icon={ArrowRight} size="md" className="rtl:-scale-x-100" />
        </Link>
      </div>
    </section>
  );
}

/**
 * Scroll story: the steps on one side, a phone on the other that scrolls through a real creator
 * page in step with the reader (the section's view timeline drives the screen; no JavaScript).
 */
export function Story() {
  const t = useTranslations("marketing.story");
  const locale = useLocale();
  const page = fullPage(locale);
  const steps = t.raw("steps") as { title: string; body: string }[];
  const end = -(1 - PHONE_SCREEN_RATIO / (page.height / page.width)) * 100;
  return (
    <Shell id="features" labelledBy="story-title" className="mk-story-timeline py-16 md:py-24">
      <SectionHeader id="story-title" title={t("title")} lead={t("lead")} />
      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
        <ol className="grid gap-10 lg:gap-0">
          {steps.map((step, index) => (
            <li key={step.title} className="grid content-center justify-items-start gap-3 lg:min-h-[65vh]">
              <span aria-hidden className="mk-step grid size-control-md place-items-center rounded-full bg-selected text-small font-bold text-selected-fg tabular-nums">
                {index + 1}
              </span>
              <h3 className="text-h2 text-balance">{step.title}</h3>
              <p className="max-w-prose text-body-lg text-fg-secondary">{step.body}</p>
            </li>
          ))}
        </ol>
        <div className="order-first lg:order-none">
          <div className="sticky top-24 mx-auto w-[min(72vw,var(--container-menu))] lg:w-[min(100%,var(--container-preview))]">
            <Phone>
              <div className="mk-story-screen absolute inset-x-0 top-0" style={{ "--story-end": `${end.toFixed(2)}%` } as CSSProperties}>
                <Image src={page} alt={t("phone")} sizes={phoneSizes.story} placeholder="blur" className="h-auto w-full" />
              </div>
            </Phone>
          </div>
        </div>
      </div>
    </Shell>
  );
}

export function PasteSection() {
  const t = useTranslations("marketing.paste");
  return (
    <Shell labelledBy="paste-title" className="grid grid-cols-1 items-center gap-10 py-16 md:py-24 lg:grid-cols-2 lg:gap-16">
      <SectionHeader id="paste-title" title={t("title")} lead={t("lead")} />
      <div className="mk-reveal">
        <PasteDemo />
      </div>
    </Shell>
  );
}

const VISITS = [42, 58, 51, 66, 74, 96, 83] as const;
const LINKS = [46, 31, 23] as const;

/** Cookie-free analytics, illustrated with clearly marked sample numbers; the bars grow on scroll. */
export function Analytics() {
  const t = useTranslations("marketing.analytics");
  const locale = useLocale();
  const days = t.raw("days") as string[];
  const links = t.raw("links") as string[];
  const points = t.raw("points") as string[];
  const n = new Intl.NumberFormat(locale);
  const pct = new Intl.NumberFormat(locale, { style: "percent" });
  return (
    <Shell id="analytics" labelledBy="analytics-title" className="grid grid-cols-1 items-center gap-10 py-16 md:py-24 lg:grid-cols-2 lg:gap-16">
      <div className="grid gap-6">
        <SectionHeader id="analytics-title" title={t("title")} lead={t("lead")} />
        <ul className="mk-reveal grid gap-3">
          {points.map((point) => (
            <li key={point} className="flex items-center gap-3 text-body-lg">
              <span className="grid size-control-sm shrink-0 place-items-center rounded-full bg-success-subtle text-success-strong">
                <Icon icon={ShieldCheck} size="sm" />
              </span>
              {point}
            </li>
          ))}
        </ul>
      </div>
      <figure className="mk-reveal grid gap-6 rounded-xl border border-line bg-surface p-5 shadow-e2 md:p-8">
        <figcaption className="flex items-center justify-between gap-3">
          <span className="text-small font-semibold">{t("week")}</span>
          <Badge size="sm">{t("sample")}</Badge>
        </figcaption>
        <dl className="grid grid-cols-3 gap-3">
          {[
            [t("visitors"), n.format(12480)],
            [t("clicks"), n.format(3912)],
            [t("ctr"), pct.format(0.31)],
          ].map(([label, value]) => (
            <div key={label} className="grid gap-1 rounded-lg bg-canvas-muted p-3">
              <dt className="text-caption font-medium text-fg-secondary">{label}</dt>
              <dd className="text-h2 tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <div role="img" aria-label={`${t("visitors")}: ${days.map((day, i) => `${day} ${VISITS[i] ?? 0}`).join(", ")} (${t("sample")})`} className="grid h-32 grid-cols-7 gap-2">
          {VISITS.map((value, index) => (
            <div key={days[index]} className="flex h-full flex-col items-center gap-2">
              <span className="relative w-full flex-1">
                <span className={cn("mk-grow absolute inset-x-0 bottom-0 rounded-t-md h-(--h)", index === 5 ? "bg-primary" : "bg-selected")} style={{ "--h": `${value}%`, "--i": index } as CSSProperties} />
              </span>
              <span aria-hidden className="text-caption text-fg-tertiary">
                {days[index]}
              </span>
            </div>
          ))}
        </div>
        <div className="grid gap-3">
          <p className="text-small font-semibold">{t("top")}</p>
          <ul className="grid gap-2">
            {LINKS.map((share, index) => (
              <li key={links[index]} className="grid gap-1">
                <span className="flex justify-between text-small">
                  <span>{links[index]}</span>
                  <span className="text-fg-secondary tabular-nums">{pct.format(share / 100)}</span>
                </span>
                <span className="block h-2 overflow-hidden rounded-full bg-canvas-muted">
                  <span className="mk-grow block h-full origin-left rounded-full bg-primary w-(--w) rtl:origin-right" style={{ "--w": `${share * 2}%`, "--i": index } as CSSProperties} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </figure>
    </Shell>
  );
}

export function Pricing() {
  const t = useTranslations("marketing.pricing");
  const free = t.raw("free.features") as string[];
  const pro = t.raw("pro.features") as string[];
  return (
    <Shell id="pricing" labelledBy="pricing-title" className="grid grid-cols-1 gap-12 py-16 md:py-24">
      <SectionHeader id="pricing-title" title={t("title")} lead={t("lead")} center />
      <div className="mx-auto grid w-full max-w-content gap-4 md:grid-cols-2">
        <article className="mk-reveal grid content-start gap-6 rounded-xl border border-focus bg-surface p-6 shadow-e2 md:p-10">
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
            className="inline-flex h-control-xl items-center justify-center rounded-lg bg-primary px-6 text-body font-semibold text-primary-fg transition-colors duration-micro hover:bg-primary-hover focus-visible:focus-ring active:scale-pressed"
          >
            {t("free.cta")}
          </Link>
        </article>
        <article className="mk-reveal grid content-start gap-6 rounded-xl border border-line bg-canvas-muted p-6 md:p-10">
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
              <li key={feature} className="flex items-start gap-3 text-body text-fg-secondary">
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

export function FinalCta() {
  const t = useTranslations("marketing.final");
  return (
    <section id="start" data-theme="dark" aria-labelledby="final-title" className="relative isolate mx-3 scroll-mt-24 overflow-clip rounded-xl bg-canvas text-fg md:mx-5">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="mk-glow absolute inset-x-0 -bottom-3/4 mx-auto aspect-square w-3/5 rounded-full bg-primary opacity-disabled blur-ambient" />
      </div>
      <div className="relative mx-auto grid max-w-prose justify-items-center gap-6 px-5 py-20 text-center md:py-32">
        <h2 id="final-title" className="mk-reveal text-display tracking-display text-balance md:text-display-xl">
          {t("title")}
        </h2>
        <p className="mk-reveal text-body-lg text-fg-secondary">{t("lead")}</p>
        <ClaimForm id="final-claim" className="mk-reveal w-full text-start" />
      </div>
    </section>
  );
}

export { order };
