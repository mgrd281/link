"use client";

import { tokens } from "@linkyo/tokens";
import { Button, cn, Icon, ICON_GROUPS, iconStroke, icons, PlatformIcon, type IconMeaning, type IconSize } from "@linkyo/ui";
import { Link2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import {
  siApplemusic,
  siBandcamp,
  siDeezer,
  siDiscord,
  siInstagram,
  siSoundcloud,
  siSpotify,
  siTidal,
  siTiktok,
  siTwitch,
  siX,
  siYoutube,
} from "simple-icons";

import { Section, SubSection } from "./section";

const DURATIONS = [
  { key: "micro", className: "duration-micro" },
  { key: "standard", className: "duration-standard" },
  { key: "slow", className: "duration-slow" },
] as const;

/** Cubic-bezier curve drawn from the easing token (0..1 → 100-unit viewBox). */
function EasingCurve() {
  const [x1, y1, x2, y2] = tokens.motion.easing.standard;
  const p = (v: number) => (v * 100).toFixed(1);
  const inv = (v: number) => (100 - v * 100).toFixed(1);
  return (
    <svg viewBox="-6 -6 112 112" className="size-avatar-2xl text-link" aria-hidden>
      <path d="M0 100H100M0 0V100" className="stroke-line-strong" fill="none" strokeWidth="1" />
      <path
        d={`M0 100C${p(x1)} ${inv(y1)} ${p(x2)} ${inv(y2)} 100 0`}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MotionSection() {
  const t = useTranslations("design.motion");
  const [moved, setMoved] = useState(false);
  return (
    <Section id="motion" index="05" title={t("title")} description={t("description")}>
      <SubSection title={t("durations")} note={t("durationsNote")}>
        <div className="grid gap-6 rounded-lg border border-line bg-surface p-5 md:grid-cols-[auto_1fr] md:items-center">
          <EasingCurve />
          <div className="grid gap-4">
            {DURATIONS.map((d) => (
              <div key={d.key} className="grid gap-2">
                <p className="font-mono text-caption text-fg-secondary">
                  {d.key} · {tokens.motion.duration[d.key]}ms · cubic-bezier({tokens.motion.easing.standard.join(", ")})
                </p>
                <div className="relative h-control-sm rounded-full bg-canvas-muted">
                  <span
                    className={cn(
                      "absolute inset-y-1 start-1 aspect-square rounded-full bg-primary ease-standard",
                      "transition-[inset-inline-start,opacity] motion-reduce:transition-opacity",
                      d.className,
                      moved ? "start-[calc(100%-var(--spacing-8)+var(--spacing-1))] motion-reduce:start-1 motion-reduce:opacity-disabled" : "",
                    )}
                  />
                </div>
              </div>
            ))}
            <div>
              <Button size="sm" onClick={() => setMoved((v) => !v)}>
                {t("play")}
              </Button>
            </div>
          </div>
        </div>
      </SubSection>
      <SubSection title={t("principles")}>
        <ul className="grid gap-3 text-body text-fg-secondary md:grid-cols-3">
          <li className="rounded-lg border border-line bg-surface p-5">{t("principle1")}</li>
          <li className="rounded-lg border border-line bg-surface p-5">{t("principle2")}</li>
          <li className="rounded-lg border border-line bg-surface p-5">{t("principle3")}</li>
        </ul>
      </SubSection>
    </Section>
  );
}

const PLATFORMS = [
  siYoutube,
  siSpotify,
  siApplemusic,
  siSoundcloud,
  siTiktok,
  siInstagram,
  siTwitch,
  siX,
  siBandcamp,
  siDeezer,
  siTidal,
  siDiscord,
];

/** The meanings shown pointing along the line: they mirror in right-to-left text by themselves. */
const DIRECTIONAL_MEANINGS = ["back", "forward", "previous", "next", "external", "undo", "redo", "send", "signIn", "signOut", "sidebarOpen", "increase"] as const satisfies readonly IconMeaning[];
const SIZES = ["xs", "sm", "md", "lg"] as const satisfies readonly IconSize[];
const SIZE_PX: Record<IconSize, number> = { xs: tokens.size.iconXs, sm: tokens.size.iconSm, md: tokens.size.iconMd, lg: tokens.size.iconLg };
/** The stroke an icon draws on screen, in CSS pixels (it is set in the glyph's 24-unit grid). */
const strokePx = (size: IconSize, strong = false) => Math.round(((iconStroke(size, strong) * SIZE_PX[size]) / 24) * 100) / 100;

/** A row of directional icons in one writing direction, to show the mirroring next to the page's own. */
function DirectionRow({ dir, label }: { dir: "ltr" | "rtl"; label: string }) {
  return (
    <div className="grid gap-2">
      <p className="text-caption text-fg-secondary">{label}</p>
      <ul dir={dir} className="flex flex-wrap gap-2" data-direction={dir}>
        {DIRECTIONAL_MEANINGS.map((meaning) => (
          <li key={meaning} data-meaning={meaning} className="grid size-control-xl place-items-center rounded-md border border-line bg-surface text-fg" title={meaning}>
            <Icon icon={icons[meaning]} size="md" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function IconSection() {
  const t = useTranslations("design.icons");
  const bdi = (chunks: ReactNode) => <bdi>{chunks}</bdi>;
  return (
    <Section id="icons" index="06" title={t("title")} description={t("description")}>
      <SubSection title={t("registry")} note={t.rich("registryNote", { bdi })}>
        <div className="grid gap-6">
          {(Object.keys(ICON_GROUPS) as (keyof typeof ICON_GROUPS)[]).map((group) => (
            <div key={group} className="grid gap-3">
              <h4 className="text-small font-semibold text-fg-secondary">{t(`groups.${group}`)}</h4>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8" data-icon-group={group}>
                {ICON_GROUPS[group].map((meaning) => (
                  <li key={meaning} className="grid min-w-0 justify-items-center gap-2 rounded-md border border-line bg-surface px-1 py-3 text-fg">
                    <Icon icon={icons[meaning]} size="md" solid={group === "media"} />
                    <code dir="ltr" className="max-w-full text-center font-mono text-caption break-all text-fg-secondary">
                      {meaning}
                    </code>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </SubSection>
      <SubSection title={t("directional")} note={t("directionalNote")}>
        <div className="grid gap-4 rounded-lg border border-line bg-surface p-5" data-testid="directional-icons">
          <DirectionRow dir="ltr" label={t("ltr")} />
          <DirectionRow dir="rtl" label={t("rtl")} />
        </div>
      </SubSection>
      <SubSection title={t("sizes")} note={t("sizesNote")}>
        <div className="flex flex-wrap items-end gap-8 rounded-lg border border-line bg-surface p-5 text-fg">
          {SIZES.map((size) => (
            <figure key={size} className="grid justify-items-center gap-2">
              <Icon icon={Link2} size={size} />
              <figcaption dir="ltr" className="font-mono text-caption text-fg-tertiary">
                {size} · {SIZE_PX[size]} · {strokePx(size)}
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="text-small text-fg-secondary">{t("uiNote")}</p>
      </SubSection>
      <SubSection title={t("weights")} note={t("weightsNote")}>
        <div className="flex flex-wrap items-center gap-8 rounded-lg border border-line bg-surface p-5 text-fg">
          <figure className="grid justify-items-center gap-2">
            <Icon icon={icons.home} size="md" />
            <figcaption className="text-caption text-fg-secondary">
              {t("regular")} <span dir="ltr" className="font-mono text-fg-tertiary">{strokePx("md")}</span>
            </figcaption>
          </figure>
          <figure className="grid justify-items-center gap-2">
            <Icon icon={icons.home} size="md" strong />
            <figcaption className="text-caption font-semibold text-fg">
              {t("strong")} <span dir="ltr" className="font-mono font-regular text-fg-tertiary">{strokePx("md", true)}</span>
            </figcaption>
          </figure>
          <figure className="grid justify-items-center gap-2">
            <span className="flex gap-2">
              <Icon icon={icons.play} size="md" />
              <Icon icon={icons.pause} size="md" />
            </span>
            <figcaption className="text-caption text-fg-secondary">{t("outline")}</figcaption>
          </figure>
          <figure className="grid justify-items-center gap-2">
            <span className="flex gap-2">
              <Icon icon={icons.play} size="md" solid />
              <Icon icon={icons.pause} size="md" solid />
            </span>
            <figcaption className="text-caption text-fg-secondary">{t("solid")}</figcaption>
          </figure>
        </div>
      </SubSection>
      <SubSection title={t("platforms")} note={t("platformsNote")}>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
          {PLATFORMS.map((platform) => (
            <span
              key={platform.slug}
              className="group grid aspect-square place-items-center rounded-md border border-line bg-surface text-fg"
            >
              <PlatformIcon icon={platform} brandColor="hover" label={platform.title} />
            </span>
          ))}
        </div>
      </SubSection>
    </Section>
  );
}
