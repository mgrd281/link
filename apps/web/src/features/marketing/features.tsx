import { creatorTokens } from "@linkyo/tokens";
import { resolveCreatorTheme } from "@linkyo/tokens/creator";
import { Badge, cn, Icon } from "@linkyo/ui";
import { Check, Link2, Sparkles } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { CSSProperties, ReactNode } from "react";

import { EXAMPLES } from "@/features/examples/catalog";

import { phoneSizes } from "./assets";
import { CountUp } from "./count-up";
import { EXAMPLE_SHOTS, type ExampleShot } from "./examples";
import { Playground, type LookOption } from "./playground";
import { TRY_LOOKS } from "./try-looks";

const SW = creatorTokens.swatches;

/**
 * A feature tile: a title, one or two lines, and the feature itself to look at. Wide tiles put the
 * words and the picture side by side from tablets up; narrow ones stack them.
 */
function Tile({
  id,
  title,
  body,
  extra,
  wide = false,
  className,
  children,
}: {
  id?: string;
  title: string;
  body: string;
  extra?: ReactNode;
  wide?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <article
      id={id}
      className={cn(
        "mk-reveal mk-panel relative isolate grid scroll-mt-24 content-start gap-6 overflow-hidden rounded-xl bg-canvas-muted p-5 md:p-8",
        wide && "md:col-span-2 md:grid-cols-2 md:items-center md:gap-10",
        className,
      )}
    >
      <div className="grid max-w-prose content-start gap-2">
        <h3 className="text-h3 text-balance">{title}</h3>
        <p className="text-body text-pretty text-fg-secondary">{body}</p>
        {extra}
      </div>
      {children}
    </article>
  );
}

/**
 * Sharing: the page's link preview as it lands in a chat, upright, with the story picture in the
 * page's look leaning behind it.
 */
function SharePreview() {
  const t = useTranslations("marketing.features.share");
  const slug: ExampleShot = "mara-vale";
  const page = EXAMPLES[slug];
  return (
    <div className="relative mx-auto grid w-full max-w-preview grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-end gap-3 pt-2">
      <div className="mk-pop grid gap-2">
        <span className="justify-self-start rounded-full bg-surface px-2 py-0.5 text-caption font-semibold text-fg-secondary">{t("preview")}</span>
        <div className="overflow-hidden rounded-xl rounded-ee-xs border border-line bg-surface-elevated">
          <div className="relative aspect-og">
            <Image src={EXAMPLE_SHOTS[slug]} alt="" fill sizes={phoneSizes.side} placeholder="blur" className="object-cover object-[50%_18%]" />
          </div>
          <div className="grid gap-0.5 p-3" dir="ltr">
            <p className="truncate text-small font-semibold">{page?.profile.displayName}</p>
            <p className="truncate text-caption text-fg-secondary">{page?.profile.tagline ?? page?.profile.bio}</p>
            <p className="flex items-center gap-1 text-caption text-fg-tertiary">
              <Icon icon={Link2} size="sm" />
              linkyo.app/{slug}
            </p>
          </div>
        </div>
      </div>
      <div className="mk-fan grid gap-2 rotate-3 rtl:-rotate-3">
        <span className="justify-self-start rounded-full bg-surface px-2 py-0.5 text-caption font-semibold text-fg-secondary">{t("story")}</span>
        <div className="relative aspect-short overflow-hidden rounded-lg border border-line">
          <Image src={EXAMPLE_SHOTS[slug]} alt="" fill sizes={phoneSizes.side} placeholder="blur" className="object-cover object-top" />
        </div>
      </div>
    </div>
  );
}

/** Three languages, both directions: the same word, set as each language sets it. */
function Languages() {
  return (
    <div aria-hidden className="grid gap-1 font-bold">
      <p lang="de" className="text-h1 tracking-tight">
        Hallo
      </p>
      <p lang="en" className="text-h1 tracking-tight text-fg-secondary">
        Hello
      </p>
      <p lang="ar" dir="rtl" className="text-h1 text-link">
        مرحبا
      </p>
    </div>
  );
}

/** Four very different accents, each with the text color the engine picked for it. */
function Readable({ swatches }: { swatches: Record<string, string>[] }) {
  return (
    <ul aria-hidden className="grid grid-cols-4 gap-2">
      {swatches.map((vars, index) => (
        <li key={index} style={vars} className="grid aspect-square place-items-center rounded-lg bg-creator-accent text-h3 font-semibold text-creator-accent-fg">
          <span className="grid justify-items-center gap-1">
            Aa
            <span className="inline-flex items-center gap-0.5 rounded-full bg-creator-accent-fg px-2 text-caption text-creator-accent">
              <Icon icon={Check} size="sm" className="size-3" />
              AA
            </span>
          </span>
        </li>
      ))}
    </ul>
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
 * Try it: build a page right here, before signing up (ADR 0051). A title that invites, then the
 * playground: name, links and look in three tabs with the page growing beside them.
 */
export function TryIt() {
  const t = useTranslations("marketing");
  const names = useTranslations("templates");
  const locale = useLocale();
  const rtl = locale === "ar";
  const [head, ...tail]: LookOption[] = TRY_LOOKS.map(({ id, config }) => {
    const template = config.template ?? "nocturne";
    const theme = resolveCreatorTheme(config, { rtlScript: rtl });
    return {
      id,
      config,
      name: creatorTokens.templates[template].label,
      description: names(`${template}.description`),
      vars: theme.cssVars,
      button: theme.buttonStyle,
      hero: theme.layout.hero,
    };
  });
  return (
    <section id="try" aria-labelledby="try-title" className="mx-auto w-full max-w-content scroll-mt-16 px-5 py-16 md:px-10 md:py-24">
      <header className="mk-reveal mx-auto grid max-w-prose justify-items-center gap-4 text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 ps-1 pe-3 text-small font-semibold text-fg-secondary">
          <span className="grid size-6 place-items-center rounded-full bg-selected text-selected-fg">
            <Icon icon={Sparkles} size="sm" />
          </span>
          {t("try.eyebrow")}
        </p>
        <h2 id="try-title" className="text-h2 tracking-tight text-balance md:text-h1">
          <span className="block">{t("try.title1")}</span>
          <span className="block text-link">{t("try.title2")}</span>
        </h2>
        <p className="text-body-lg text-pretty text-fg-secondary">{t("try.lead")}</p>
      </header>
      {head ? (
        <div className="mt-10 md:mt-12">
          <Playground looks={[head, ...tail]} rtl={rtl} />
        </div>
      ) : null}
    </section>
  );
}

/** Accents for the "every color readable" tile: as different as colors get. */
const READABLE = [SW.lemon, SW.flamingo, SW.aqua, SW.grape];

/**
 * Everything else a page has, as tiles of different sizes (a bento): sharing and analytics large,
 * languages and readable colors small. Each shows the thing itself rather than describing it.
 */
export function Features() {
  const t = useTranslations("marketing");
  const swatches = READABLE.map((accent) => resolveCreatorTheme({ accent, mode: "vivid" }).cssVars);
  const points = t.raw("analytics.points") as string[];
  return (
    <section id="features" aria-labelledby="features-title" className="mx-auto w-full max-w-content scroll-mt-16 px-5 py-16 md:px-10 md:py-24">
      <header className="mk-reveal mx-auto grid max-w-prose justify-items-center text-center">
        <h2 id="features-title" className="text-h2 tracking-tight text-balance md:text-h1">
          <span className="block text-fg-tertiary">{t("more.title1")}</span>
          <span className="block">{t("more.title2")}</span>
        </h2>
      </header>
      {/* Wide and narrow, then narrow and wide: a bento of two rows on wide screens. */}
      <div className="mt-10 grid grid-cols-1 gap-4 md:mt-12 md:grid-cols-2 lg:grid-cols-3">
        <Tile wide title={t("features.share.title")} body={t("features.share.body")}>
          <SharePreview />
        </Tile>
        <Tile title={t("more.languages.title")} body={t("more.languages.body")}>
          <Languages />
        </Tile>
        <Tile title={t("more.colors.title")} body={t("more.colors.body")}>
          <Readable swatches={swatches} />
        </Tile>
        {/* The footer links here as "/#analytics". */}
        <Tile
          id="analytics"
          wide
          title={t("analytics.title")}
          body={t("analytics.lead")}
          extra={
            <ul className="mt-2 grid gap-2">
              {points.map((point) => (
                <li key={point} className="flex items-center gap-3 text-small">
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
        </Tile>
      </div>
    </section>
  );
}
