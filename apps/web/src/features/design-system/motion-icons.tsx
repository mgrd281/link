"use client";

import { tokens } from "@linkyo/tokens";
import { Button, cn, Icon, PlatformIcon } from "@linkyo/ui";
import {
  BarChart3,
  Calendar,
  Command,
  Copy,
  Eye,
  GripVertical,
  Image as ImageIcon,
  Inbox,
  Link2,
  Mail,
  Music2,
  Palette,
  Plus,
  QrCode,
  Search,
  Settings,
  Share2,
  ShoppingBag,
  Trash2,
  Undo2,
  Video,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
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

const UI_ICONS = [
  Plus,
  Link2,
  ImageIcon,
  Video,
  Music2,
  Calendar,
  ShoppingBag,
  Mail,
  BarChart3,
  Palette,
  Inbox,
  Settings,
  Search,
  Command,
  Share2,
  QrCode,
  Eye,
  Copy,
  Trash2,
  Undo2,
  GripVertical,
];
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

export function IconSection() {
  const t = useTranslations("design.icons");
  return (
    <Section id="icons" index="06" title={t("title")} description={t("description")}>
      <SubSection title={t("ui")} note={t("uiNote")}>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-12">
          {UI_ICONS.map((glyph) => (
            <div
              key={glyph.displayName}
              className="grid aspect-square place-items-center rounded-md border border-line bg-surface text-fg"
              title={glyph.displayName}
            >
              <Icon icon={glyph} size="md" />
            </div>
          ))}
        </div>
        <div className="flex items-end gap-6 text-fg">
          {(["sm", "md", "lg"] as const).map((size) => (
            <figure key={size} className="grid justify-items-center gap-2">
              <Icon icon={Link2} size={size} />
              <figcaption className="font-mono text-caption text-fg-tertiary">
                {size} · {tokens.size[size === "sm" ? "iconSm" : size === "md" ? "iconMd" : "iconLg"]}
              </figcaption>
            </figure>
          ))}
          <p className="font-mono text-caption text-fg-tertiary">stroke · {tokens.icon.stroke}</p>
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
