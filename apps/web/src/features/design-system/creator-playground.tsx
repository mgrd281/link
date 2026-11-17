"use client";

import { creatorTokens, tokens, type CreatorPairingId } from "@linkyo/tokens";
import {
  auditPalette,
  BUTTON_SHAPES,
  BUTTON_STYLES,
  PAIRING_IDS,
  PRESET_IDS,
  resolveCreatorTheme,
  shuffleCreatorTheme,
  type CreatorThemeConfig,
  type ResolvedCreatorTheme,
} from "@linkyo/tokens/creator";
import { Badge, Button, cn, Icon, PlatformIcon, Segmented } from "@linkyo/ui";
import { Check, Moon, RotateCcw, Shuffle, Sun, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useId, useMemo, useState, type CSSProperties } from "react";
import { siInstagram, siSpotify, siTiktok, siYoutube } from "simple-icons";

import { CreatorLink } from "@/features/creator/link-button";
import { themeStyle } from "@/features/creator/theme";
import milaAvatar from "@/assets/samples/mila-avatar.jpg";

import { Section, SubSection } from "./section";

const DEFAULT: CreatorThemeConfig = { preset: "paper" };

function MiniPage({ theme, name, bio, links }: { theme: ResolvedCreatorTheme; name: string; bio: string; links: string[] }) {
  return (
    <div
      style={themeStyle(theme)}
      className={cn(
        "grid gap-5 rounded-xl border border-line p-6 font-creator-body text-creator-fg shadow-e2",
        theme.background === "gradient" ? "bg-(image:--creator-gradient)" : "bg-creator-bg",
      )}
    >
      <div className="grid justify-items-center gap-3 text-center">
        <span className="relative size-avatar-xl overflow-hidden rounded-full border border-creator-line bg-creator-surface-2">
          <Image src={milaAvatar} alt="" fill sizes={`${tokens.size.avatarXl}px`} placeholder="blur" className="object-cover" />
        </span>
        <p
          className="font-creator-display text-h1 leading-tight"
          style={{
            fontWeight: "var(--creator-display-weight)",
            letterSpacing: "var(--creator-display-tracking)",
            textTransform: "var(--creator-display-transform)" as "none",
          }}
        >
          {name}
        </p>
        <p className="max-w-prose text-small text-creator-fg-muted">{bio}</p>
        <div className="flex gap-1 text-creator-fg">
          {[siInstagram, siTiktok, siYoutube, siSpotify].map((icon) => (
            <span key={icon.slug} className="grid size-touch-target place-items-center">
              <PlatformIcon icon={icon} size="md" />
            </span>
          ))}
        </div>
      </div>
      <div className="grid gap-3">
        {links.map((label, i) => (
          <CreatorLink key={label} label={label} href="#" external={false} variant={theme.buttonStyle} badge={i === 0 ? "New" : undefined} />
        ))}
      </div>
    </div>
  );
}

export function CreatorThemesSection() {
  const t = useTranslations("design.creator");
  const sample = useTranslations("sample");
  const [config, setConfig] = useState<CreatorThemeConfig>(DEFAULT);
  const theme = useMemo(() => resolveCreatorTheme(config), [config]);
  const audit = useMemo(() => auditPalette(theme.palette), [theme]);
  const presets = useMemo(() => PRESET_IDS.map((id) => resolveCreatorTheme({ preset: id })), []);
  const seedId = useId();
  const tintId = useId();
  const pairingId = useId();

  const links = [sample("link1"), sample("link2"), sample("link3")];
  const update = (patch: CreatorThemeConfig) => setConfig((current) => ({ ...current, ...patch }));
  const passCount = audit.filter((c) => c.pass).length;

  const swatches: [string, string][] = [
    ["bg", theme.palette.bg],
    ["surface", theme.palette.surface],
    ["surface-2", theme.palette.surface2],
    ["text", theme.palette.fg],
    ["text-muted", theme.palette.fgMuted],
    ["accent", theme.palette.accent],
    ["accent-contrast", theme.palette.accentFg],
    ["border", theme.palette.lineStrong],
  ];

  return (
    <Section id="creator" index="10" title={t("title")} description={t("description")}>
      <SubSection title={t("engine")} note={t("engineNote")}>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="grid content-start gap-6 rounded-lg border border-line bg-surface p-5">
            <div className="grid gap-2">
              <label htmlFor={seedId} className="text-small font-medium">
                {t("seed")}
              </label>
              <div className="flex items-center gap-3">
                <input
                  id={seedId}
                  type="color"
                  value={theme.palette.accent.toLowerCase()}
                  onChange={(event) => update({ accent: event.target.value.toUpperCase(), neutral: undefined, preset: theme.preset })}
                  className="size-control-md cursor-pointer rounded-md border border-line-input bg-transparent p-0.5"
                />
                <span className="font-mono text-small text-fg-secondary">{config.accent ?? creatorTokens.presets[theme.preset].accent}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-6">
              <div className="grid gap-2">
                <span className="text-small font-medium">{t("mode")}</span>
                <Segmented
                  label={t("mode")}
                  value={theme.palette.mode}
                  onValueChange={(mode) => update({ mode })}
                  options={[
                    { value: "light", label: t("light"), icon: Sun },
                    { value: "dark", label: t("dark"), icon: Moon },
                  ]}
                />
              </div>
              <div className="grid min-w-menu flex-1 gap-2">
                <label htmlFor={tintId} className="text-small font-medium">
                  {t("tint")}
                </label>
                <input
                  id={tintId}
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round((config.tint ?? creatorTokens.presets[theme.preset].tint) * 100)}
                  onChange={(event) => update({ tint: Number(event.target.value) / 100 })}
                  className="h-control-md w-full accent-primary"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <label htmlFor={pairingId} className="text-small font-medium">
                {t("pairing")}
              </label>
              <select
                id={pairingId}
                value={theme.pairing.id}
                onChange={(event) => update({ pairing: event.target.value as CreatorPairingId })}
                className="h-control-md rounded-md border border-line-input bg-surface-elevated px-3 text-small text-fg focus-visible:focus-ring"
              >
                {PAIRING_IDS.map((id) => (
                  <option key={id} value={id}>
                    {creatorTokens.pairings[id].label}
                  </option>
                ))}
              </select>
            </div>
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-small font-medium">{t("buttonStyle")}</legend>
              <div className="flex flex-wrap gap-2">
                {BUTTON_STYLES.map((style) => (
                  <button
                    key={style}
                    type="button"
                    aria-pressed={theme.buttonStyle === style}
                    onClick={() => update({ buttonStyle: style })}
                    className={cn(
                      "h-control-sm rounded-full border border-line-strong px-3 text-small capitalize text-fg-secondary",
                      "transition-colors duration-micro hover:bg-hover hover:text-fg focus-visible:focus-ring",
                      "aria-pressed:border-primary aria-pressed:bg-selected aria-pressed:text-selected-fg",
                    )}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-2">
              <span className="text-small font-medium">{t("shape")}</span>
              <Segmented
                label={t("shape")}
                value={theme.buttonShape}
                onValueChange={(shape) => update({ buttonShape: shape })}
                options={BUTTON_SHAPES.map((shape) => ({ value: shape, label: t(`shapes.${shape}`) }))}
              />
            </div>
            <div className="flex flex-wrap gap-2 border-t border-line pt-5">
              <Button icon={Shuffle} onClick={() => setConfig(shuffleCreatorTheme())}>
                {t("shuffle")}
              </Button>
              <Button variant="ghost" icon={RotateCcw} onClick={() => setConfig(DEFAULT)}>
                {t("reset")}
              </Button>
            </div>
          </div>
          <div className="grid content-start gap-4">
            <MiniPage theme={theme} name="Mila Aurel" bio={sample("bio")} links={links} />
            <div className="grid grid-cols-4 gap-2">
              {swatches.map(([role, value]) => (
                <figure key={role} className="grid gap-1">
                  <div className="h-10 rounded-sm border border-line" style={{ backgroundColor: value }} />
                  <figcaption className="grid">
                    <span className="truncate text-caption font-medium">{role}</span>
                    <span className="font-mono text-caption text-fg-tertiary">{value}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </SubSection>

      <SubSection title={t("audit")} note={t("auditNote", { pass: passCount, total: audit.length })}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {audit.map((check) => (
            <div key={check.pair} className="flex items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-2">
              <span className="truncate font-mono text-caption text-fg-secondary">{check.pair}</span>
              <span className={cn("inline-flex items-center gap-1 font-mono text-caption", check.pass ? "text-success-strong" : "text-danger-strong")}>
                <Icon icon={check.pass ? Check : X} size="sm" label={check.pass ? t("pass") : t("fail")} />
                {check.ratio.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </SubSection>

      <SubSection title={t("presets")} note={t("presetsNote")}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {presets.map((preset) => {
            const active = preset.preset === theme.preset && !config.accent && !config.mode && !config.pairing;
            return (
              <button
                key={preset.preset}
                type="button"
                aria-pressed={active}
                onClick={() => setConfig({ preset: preset.preset })}
                style={themeStyle(preset)}
                className={cn(
                  "group grid h-32 content-between rounded-lg border border-line p-4 text-start text-creator-fg",
                  "transition-[box-shadow,scale] duration-standard ease-standard hover:shadow-e2 focus-visible:focus-ring active:scale-pressed",
                  "aria-pressed:focus-ring",
                  preset.background === "gradient" ? "bg-(image:--creator-gradient)" : "bg-creator-bg",
                )}
              >
                <span className="flex items-center justify-between">
                  <span className="font-creator-display text-h3" style={{ fontWeight: "var(--creator-display-weight)" }}>
                    {creatorTokens.presets[preset.preset].label}
                  </span>
                  {active ? <Icon icon={Check} size="sm" /> : null}
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-control-sm flex-1 rounded-creator-button bg-creator-accent" />
                  <span className="size-control-sm rounded-creator-button border border-creator-line-strong" />
                </span>
              </button>
            );
          })}
        </div>
      </SubSection>

      <SubSection title={t("pairings")} note={t("pairingsNote")}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PAIRING_IDS.map((id) => {
            const pairing = creatorTokens.pairings[id];
            const display = pairing.display as { stack: string; weight: number; tracking: string; uppercase?: boolean };
            const isArabic = id === "arabic";
            return (
              <div
                key={id}
                lang={isArabic ? "ar" : undefined}
                dir={isArabic ? "rtl" : undefined}
                className="grid gap-2 rounded-lg border border-line bg-surface p-5"
                style={{ "--pairing-display": display.stack, "--pairing-body": pairing.body.stack } as CSSProperties}
              >
                <p
                  className="truncate font-(family-name:--pairing-display) text-h2"
                  style={{ fontWeight: display.weight, letterSpacing: display.tracking, textTransform: display.uppercase ? "uppercase" : "none" }}
                >
                  {isArabic ? "نور حداد" : "Mila Aurel"}
                </p>
                <p className="font-(family-name:--pairing-body) text-small text-fg-secondary">
                  {isArabic ? "رابط واحد. لكل ما تصنعه." : sample("tagline")}
                </p>
                <Badge size="sm" tone="outline" className="justify-self-start font-sans">
                  {pairing.label}
                </Badge>
              </div>
            );
          })}
        </div>
      </SubSection>

      <SubSection title={t("linkStyles")} note={t("linkStylesNote")}>
        <div style={themeStyle(theme)} className="grid gap-6 rounded-lg border border-line bg-creator-bg p-5 md:grid-cols-3">
          {BUTTON_SHAPES.map((shape) => {
            const shaped = resolveCreatorTheme({ ...config, buttonShape: shape });
            return (
              <div key={shape} style={themeStyle(shaped)} className="grid content-start gap-3">
                <p className="font-mono text-caption text-creator-fg-muted">{t(`shapes.${shape}`)}</p>
                {BUTTON_STYLES.map((style) => (
                  <CreatorLink key={style} label={style} href="#" external={false} variant={style} className="capitalize" />
                ))}
              </div>
            );
          })}
        </div>
      </SubSection>
    </Section>
  );
}
