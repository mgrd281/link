import type { Page } from "@linkyo/blocks";
import { creatorTokens, tokens } from "@linkyo/tokens";
import { resolveCreatorTheme } from "@linkyo/tokens/creator";
import { Badge, cn, Icon } from "@linkyo/ui";
import { Check } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { CSSProperties, ReactNode } from "react";

import { RECORDINGS, type RecordingLocale } from "@/features/ai/recordings";
import { initials } from "@/features/directions/shared/creator-kit";
import { resolveMedia } from "@/features/directions/shared/media";
import { LOOKS } from "@/features/examples/looks";
import { journalistAr, journalistDe, journalistEn } from "@/features/previews/journalist";
import { aiTryPublic } from "@/lib/flags";
import { CREATOR_DOMAIN, pageAddress } from "@/lib/page-url";
import { supabaseEnabled } from "@/lib/supabase/config";

import { phoneSizes } from "./assets";
import { CountUp } from "./count-up";
import { Playground, TryEyebrow, type LookOption } from "./playground";
import { StoryPicture, type StoryArt } from "./story-picture";
import { TRY_LOOKS } from "./try-looks";

const SW = creatorTokens.swatches;

/**
 * A feature tile: a title, one or two lines, and the feature itself to look at. Wide tiles put the
 * words and the picture side by side from tablets up; narrow ones stack them.
 */
function Tile({
  id,
  title,
  badge,
  body,
  extra,
  wide = false,
  className,
  children,
}: {
  id?: string;
  title: string;
  /** A short note beside the title ("In the works"). */
  badge?: ReactNode;
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
        {badge ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-h3 text-balance">{title}</h3>
            {badge}
          </div>
        ) : (
          <h3 className="text-h3 text-balance">{title}</h3>
        )}
        <p className="text-body text-pretty text-fg-secondary">{body}</p>
        {extra}
      </div>
      {children}
    </article>
  );
}

/**
 * The example page the sharing tile shows: Lea Hartmann, the journalist. She is the one example with
 * a page in all three languages, so the tile shows the real card and picture in de, en and ar.
 */
const SHARED: Partial<Record<string, Page>> = { de: journalistDe, en: journalistEn, ar: journalistAr };
const SHARED_SLUG = "journalist";
const SHARED_ADDRESS = pageAddress(SHARED_SLUG);
/** The link preview's pixel size: the cards are made at exactly the og aspect (1200 / 630). */
const [OG_WIDTH = 0, OG_HEIGHT = 0] = tokens.aspect.og.split("/").map(Number);

/**
 * Sharing: what a friend sees when the page is sent to them, and what goes into a story. The chat
 * holds the page's real link preview (the very image WhatsApp and iMessage fetch, in the visitor's
 * language) under the words the messengers print (the page's title and line). With it, the real
 * story picture, drawn by the dashboard's own code. The bubbles are Linkyo's colors, not any
 * messenger's, and they mirror in Arabic (the reply on the left).
 */
function SharePreview() {
  const t = useTranslations("marketing.features.share");
  const tPreview = useTranslations("preview");
  const tKinds = useTranslations("app.welcome.kinds");
  const locale = useLocale();
  const rtl = locale === "ar";
  const { profile } = SHARED[locale] ?? journalistEn;
  const name = profile.displayName;
  // The same words as the page's og:title and og:description (app/[locale]/p/[slug]/page.tsx).
  const title = tPreview("ogTitle.sample", { name, kind: tKinds("journalist.label") });
  const description = profile.tagline ?? profile.bio;
  // The page's own look (the gallery's "journalist" look, the same one its preview entry names).
  const theme = resolveCreatorTheme(LOOKS.journalist.theme, { rtlScript: rtl });
  const { palette } = theme;
  // The same photo the dashboard's picture uses: the hero, else the avatar.
  const source = profile.hero ?? profile.avatar;
  const media = resolveMedia(source.src);
  const art: StoryArt = {
    name,
    line: description,
    address: SHARED_ADDRESS,
    focal: source.focal,
    colors: { bg: palette.bg, fg: palette.fg, muted: palette.fgMuted, accent: palette.accent, accentFg: palette.accentFg, surface: palette.surface2 },
    upper: Boolean((theme.pairing.display as { uppercase?: boolean }).uppercase),
    rtl,
    grey: theme.layout.hero === "mono",
    initials: initials(name),
  };
  return (
    // Phones: the chat, then the story picture under it. From tablets up the tile's picture column is
    // only about 290px wide, too narrow for both side by side (the address would be cut off), so
    // this wrapper steps aside (contents) and the tile's own two-column grid places them: the chat
    // in the picture column over both rows, the story picture under the title and text.
    <div className="mx-auto grid w-full max-w-preview gap-4 md:contents">
      <div className="grid gap-2 md:row-span-2">
        <span className="justify-self-start rounded-full bg-surface px-2 py-0.5 text-caption font-semibold text-fg-secondary">{t("preview")}</span>
        <p className="me-10 justify-self-start rounded-xl rounded-es-xs border border-line bg-surface px-3 py-2 text-small">{t("chatIn")}</p>
        <div className="mk-pop w-5/6 justify-self-end overflow-hidden rounded-xl rounded-ee-xs bg-primary text-primary-fg">
          <p className="px-3 pt-2 text-small">
            {t("chatOut")}{" "}
            <span dir="ltr" className="font-semibold">
              {SHARED_ADDRESS}
            </span>
          </p>
          {/* The card as a messenger shows it: a picture, then the page's own words. Not a link here. */}
          <div className="m-1 overflow-hidden rounded-lg bg-surface text-fg">
            {/* The real link preview of the page (same origin, so nothing is loaded from elsewhere). */}
            <Image src={`/${locale}/p/${SHARED_SLUG}/opengraph-image`} width={OG_WIDTH} height={OG_HEIGHT} sizes={phoneSizes.story} alt="" className="aspect-og w-full object-cover" />
            <div className="grid gap-0.5 p-3">
              <p dir="auto" className="truncate text-small font-semibold">
                {title}
              </p>
              <p dir="auto" className="line-clamp-2 text-caption text-fg-secondary">
                {description}
              </p>
              {/* Lines up with the words above it in either direction; the domain itself reads left to right. */}
              <p className="text-caption text-fg-tertiary">
                <span dir="ltr">{CREATOR_DOMAIN}</span>
              </p>
            </div>
          </div>
        </div>
        <p className="justify-self-end text-caption text-fg-tertiary">{t("today")}</p>
      </div>
      {/* Upright and whole: the picture as it is posted. It arrives just after the chat bubble. */}
      <div className="mk-pop grid w-1/2 gap-2 justify-self-center md:justify-self-start" style={{ "--i": 1 } as CSSProperties}>
        <span className="justify-self-start rounded-full bg-surface px-2 py-0.5 text-caption font-semibold text-fg-secondary">{t("story")}</span>
        <StoryPicture art={art} photo={typeof media === "string" ? media : media.src} faces={theme.cssVars} />
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
              <Icon icon={Check} size="xs" />
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
 *
 * The AI tab joins them only when it is switched on (NEXT_PUBLIC_AI_TRY) and a real recording of the
 * AI exists in this language, so a visitor never watches test data or an unlabelled run. Phase 1 has
 * no recording (features/ai/recordings), so the tab does not show.
 */
export function TryIt() {
  const t = useTranslations("marketing");
  const names = useTranslations("templates");
  const locale = useLocale();
  const rtl = locale === "ar";
  const aiTab = aiTryPublic && RECORDINGS[locale as RecordingLocale]?.kind === "real";
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
    <section id="try" aria-labelledby="try-title" className="mx-auto w-full max-w-content scroll-mt-16 px-5 py-12 md:px-10 md:py-24">
      <header className="mk-reveal grid max-w-prose gap-4 md:mx-auto md:justify-items-center md:text-center">
        <TryEyebrow ai={aiTab}>{aiTab ? t("try.ai.eyebrow") : t("try.eyebrow")}</TryEyebrow>
        <h2 id="try-title" className="text-h2 tracking-tight text-balance md:text-h1">
          <span className="block">{t("try.title1")}</span>
          <span className="block text-link">{t("try.title2")}</span>
        </h2>
        <p className="text-body-lg text-pretty text-fg-secondary">{aiTab ? t("try.ai.lead") : t("try.lead")}</p>
      </header>
      {head ? (
        <div className="mt-10 md:mt-12">
          <Playground looks={[head, ...tail]} rtl={rtl} ai={aiTab} />
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
    <section id="features" aria-labelledby="features-title" className="mx-auto w-full max-w-content scroll-mt-16 px-5 py-12 md:px-10 md:py-24">
      <header className="mk-reveal grid max-w-prose md:mx-auto md:justify-items-center md:text-center">
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
          // Real accounts have no analytics yet: the title says so (the demo keeps its sample numbers).
          badge={
            supabaseEnabled ? (
              <Badge tone="outline" size="sm">
                {t("real.analyticsBadge")}
              </Badge>
            ) : null
          }
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
