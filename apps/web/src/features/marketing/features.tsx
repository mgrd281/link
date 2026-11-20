import { creatorTokens, type CreatorTemplateId } from "@linkyo/tokens";
import { resolveCreatorTheme, type CreatorThemeConfig } from "@linkyo/tokens/creator";
import { Badge, cn, Icon } from "@linkyo/ui";
import { Check, Link2, Sparkles } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { CSSProperties, ReactNode } from "react";

import junoKade from "@/assets/examples/ex6-juno-kade.jpg";
import { EXAMPLES } from "@/features/examples/catalog";

import { phoneSizes } from "./assets";
import { CountUp } from "./count-up";
import { EXAMPLE_SHOTS, type ExampleShot } from "./examples";
import { LookSwitcher, type LookOption } from "./look-switcher";
import { PasteDemo } from "./paste-demo";
import { StepRail, type RailStep } from "./step-rail";

const SW = creatorTokens.swatches;

/** The looks to try in step 1: five templates, each as different from its neighbours as it can be. */
const LOOKS: { template: CreatorTemplateId; config: CreatorThemeConfig }[] = [
  { template: "nocturne", config: { template: "nocturne", accent: SW.aqua } },
  { template: "daylight", config: { template: "daylight", accent: SW.sky, buttonShape: "pill" } },
  { template: "pulse", config: { template: "pulse", accent: SW.flamingo } },
  { template: "atelier", config: { template: "atelier" } },
  { template: "mono", config: { template: "mono" } },
];

const order = (n: number) => ({ "--i": n }) as CSSProperties;

/**
 * One step of the tour: its number and name, a title, one or two lines, and the step itself to try
 * on a soft panel. Words beside the panel on wide screens (alternating sides), above it on phones.
 */
function Step({
  id,
  index,
  label,
  title,
  body,
  tint,
  reverse = false,
  extra,
  children,
}: {
  id: string;
  index: number;
  label: string;
  title: string;
  body: string;
  tint: string;
  reverse?: boolean;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <li id={id} className="grid scroll-mt-32 grid-cols-1 items-center gap-6 md:gap-8 lg:grid-cols-2 lg:gap-16">
      {/* Wide screens: the words stay in view beside a tall step while it scrolls (under the header and the step bar). */}
      <div className={cn("mk-reveal grid max-w-prose content-start gap-3 lg:sticky lg:top-32 lg:self-start lg:py-6", reverse && "lg:order-last")}>
        <p className="flex items-center gap-2 text-small font-semibold text-link">
          <span aria-hidden className="grid size-8 place-items-center rounded-full bg-selected text-selected-fg tabular-nums">
            {index + 1}
          </span>
          {label}
        </p>
        <h3 className="text-h2 tracking-tight text-balance">{title}</h3>
        <p className="text-body-lg text-pretty text-fg-secondary">{body}</p>
        {extra}
      </div>
      <div className={cn("mk-panel relative isolate grid min-w-0 place-items-center overflow-hidden rounded-xl p-4 sm:p-6 md:p-10", tint)}>{children}</div>
    </li>
  );
}

/**
 * Step 3: a shared link as it lands in a chat (a question, the answer with the page's link preview),
 * with the story picture in the page's look leaning behind it. The bubbles pop in one after the
 * other as the panel scrolls in.
 */
function ShareChat() {
  const t = useTranslations("marketing.features.share");
  const slug: ExampleShot = "mara-vale";
  const page = EXAMPLES[slug];
  return (
    <div className="relative w-full max-w-preview py-2">
      <div className="mk-fan absolute end-0 top-10 w-2/5 rotate-6 rtl:-rotate-6">
        <div className="relative aspect-short overflow-hidden rounded-lg border border-line">
          <Image src={EXAMPLE_SHOTS[slug]} alt="" fill sizes={phoneSizes.side} placeholder="blur" className="object-cover object-top" />
        </div>
        <span className="absolute start-2 top-2 rounded-full bg-fg px-2 py-0.5 text-caption font-semibold text-canvas">{t("story")}</span>
      </div>
      <div className="relative grid w-4/5 gap-2">
        <p className="mk-pop justify-self-center rounded-full bg-surface px-3 py-0.5 text-caption font-medium text-fg-secondary" style={order(0)}>
          {t("today")}
        </p>
        <p className="mk-pop max-w-full justify-self-start rounded-xl rounded-es-xs border border-line bg-surface-elevated px-4 py-2 text-small" style={order(1)}>
          {t("chatIn")}
        </p>
        <div className="mk-pop grid justify-items-end gap-1" style={order(2)}>
          <p className="rounded-xl rounded-ee-xs bg-primary px-4 py-2 text-small text-primary-fg">{t("chatOut")}</p>
          <div className="w-full overflow-hidden rounded-xl rounded-ee-xs border border-line bg-surface-elevated">
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
    </div>
  );
}

const VISITS = [42, 58, 51, 66, 74, 96, 83] as const;
const LINKS = [46, 31, 23] as const;

/**
 * Step 4: cookie-free analytics, with clearly marked sample numbers. The figures count up and the
 * bars grow the first time the card scrolls in.
 */
function AnalyticsCard() {
  const t = useTranslations("marketing.analytics");
  const locale = useLocale();
  const days = t.raw("days") as string[];
  const links = t.raw("links") as string[];
  const pct = new Intl.NumberFormat(locale, { style: "percent" });
  const figures: [string, number, boolean][] = [
    [t("visitors"), 12480, false],
    [t("clicks"), 3912, false],
    [t("ctr"), 0.31, true],
  ];
  return (
    <figure className="mk-pop grid w-full max-w-prose gap-5 rounded-xl border border-line bg-surface-elevated p-4 sm:p-6">
      <figcaption className="flex items-center justify-between gap-3">
        <span className="text-small font-semibold">{t("week")}</span>
        <Badge size="sm">{t("sample")}</Badge>
      </figcaption>
      <dl className="grid grid-cols-3 gap-2">
        {figures.map(([label, value, percent]) => (
          <div key={label} className="grid gap-1 rounded-lg bg-canvas-muted p-3">
            <dt className="truncate text-caption font-medium text-fg-secondary">{label}</dt>
            <dd className="text-h3 tabular-nums">
              <CountUp value={value} percent={percent} />
            </dd>
          </div>
        ))}
      </dl>
      <div role="img" aria-label={`${t("visitors")}: ${days.map((day, i) => `${day} ${VISITS[i] ?? 0}`).join(", ")} (${t("sample")})`} className="grid h-24 grid-cols-7 gap-2">
        {VISITS.map((value, index) => (
          <div key={days[index]} className="flex h-full flex-col items-center gap-2">
            <span className="relative w-full flex-1">
              <span className={cn("mk-grow absolute inset-x-0 bottom-0 h-(--h) rounded-t-md", index === 5 ? "bg-primary" : "bg-selected")} style={{ "--h": `${value}%`, "--i": index } as CSSProperties} />
            </span>
            <span aria-hidden className={cn("text-caption", index === 5 ? "font-semibold text-fg" : "text-fg-tertiary")}>
              {days[index]}
            </span>
          </div>
        ))}
      </div>
      <ul className="grid gap-3">
        {LINKS.map((share, index) => (
          <li key={links[index]} className="grid gap-1">
            <span className="flex justify-between text-small">
              <span className="font-medium">{links[index]}</span>
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

/**
 * Everything a page can do, as the four steps of using it, in the order people do them: give it a
 * look, fill it, share it, see what works (ADR 0050). A bar under the header follows the reader
 * through the steps; each step is something to try, not a picture of it.
 */
export function Features() {
  const t = useTranslations("marketing");
  const names = useTranslations("templates");
  const locale = useLocale();
  const rtl = locale === "ar";

  const looks: LookOption[] = LOOKS.map(({ template, config }) => {
    const theme = resolveCreatorTheme(config, { rtlScript: rtl });
    return {
      id: template,
      template,
      name: creatorTokens.templates[template].label,
      description: names(`${template}.description`),
      vars: theme.cssVars,
      buttonStyle: theme.buttonStyle,
      hero: theme.layout.hero,
    };
  });

  const steps: RailStep[] = [
    { id: "step-look", label: t("features.steps.look") },
    { id: "step-paste", label: t("features.steps.paste") },
    { id: "step-share", label: t("features.steps.share") },
    // The footer links here as "/#analytics".
    { id: "analytics", label: t("features.steps.analytics") },
  ];
  const points = t.raw("analytics.points") as string[];

  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-16 py-16 md:py-24">
      <header className="mk-reveal mx-auto grid max-w-prose justify-items-center gap-4 px-5 text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 ps-1 pe-3 text-small font-semibold text-fg-secondary">
          <span className="grid size-6 place-items-center rounded-full bg-selected text-selected-fg">
            <Icon icon={Sparkles} size="sm" />
          </span>
          {t("features.eyebrow")}
        </p>
        <h2 id="features-title" className="text-h2 tracking-tight text-balance md:text-h1">
          <span className="block text-fg-tertiary">{t("features.title1")}</span>
          <span className="block">{t("features.title2")}</span>
        </h2>
        <p className="text-body-lg text-pretty text-fg-secondary">{t("features.lead")}</p>
      </header>

      <div className="mt-10 md:mt-12">
        <StepRail steps={steps} label={t("features.steps.label")} />
        <ol className="mx-auto grid max-w-content gap-20 px-5 pt-10 md:gap-24 md:px-10 md:pt-16">
          <Step id="step-look" index={0} label={t("features.steps.look")} title={t("features.look.title")} body={t("features.look.body")} tint="bg-tint-teal">
            <LookSwitcher
              looks={looks}
              rtl={rtl}
              person={{ name: "Juno Kade", tagline: t("features.look.tagline"), photo: junoKade }}
              links={t.raw("features.look.links") as { title: string; subtitle: string }[]}
              labels={{ choose: t("features.look.choose"), custom: t("features.look.custom"), customHint: t("features.look.customHint") }}
            />
          </Step>

          <Step id="step-paste" index={1} label={t("features.steps.paste")} title={t("paste.title")} body={t("paste.lead")} tint="bg-canvas-muted" reverse>
            <div className="mk-pop w-full max-w-prose">
              <PasteDemo />
            </div>
          </Step>

          <Step id="step-share" index={2} label={t("features.steps.share")} title={t("features.share.title")} body={t("features.share.body")} tint="bg-tint-teal">
            <ShareChat />
          </Step>

          <Step
            id="analytics"
            index={3}
            label={t("features.steps.analytics")}
            title={t("analytics.title")}
            body={t("analytics.lead")}
            tint="bg-canvas-muted"
            reverse
            extra={
              <ul className="mt-2 grid gap-2">
                {points.map((point) => (
                  <li key={point} className="flex items-center gap-3 text-body">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-selected text-selected-fg">
                      <Icon icon={Check} size="sm" />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            }
          >
            <AnalyticsCard />
          </Step>
        </ol>
      </div>
    </section>
  );
}
