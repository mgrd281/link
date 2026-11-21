"use client";

import { creatorTokens, type CreatorButtonShape, type CreatorButtonStyle } from "@linkyo/tokens";
import { BUTTON_SHAPES, BUTTON_STYLES, PAIRING_IDS, resolveCreatorTheme, type CreatorThemeConfig } from "@linkyo/tokens/creator";
import { Button, cn, Icon, Segmented, toast } from "@linkyo/ui";
import { Check, Moon, PaintBucket, RotateCcw, Sun, SwatchBook } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useMemo, type CSSProperties, type ReactNode } from "react";

import { themeStyle } from "@/features/creator/theme";
import { linkStyleClasses } from "@/features/creator/link-button";
import { displayStyle } from "@/features/directions/poster/styles";
import { TemplatePicker } from "@/features/directions/poster/template-picker";

import { PhonePreview, PreviewButton } from "./preview";
import { Panel, Screen, UndoRedo } from "./screen";
import { useSite } from "./site-context";

/**
 * Twelve accents that look different from each other, by hue, each with a name people recognise. (The
 * template and preset accents included three blacks and three reds that nobody could tell apart.)
 */
const NAMED = ["ink", "wine", "poppy", "clay", "saffron", "mint", "pine", "teal", "sky", "navy", "grape", "rose"] as const;
type SwatchName = (typeof NAMED)[number];
const SWATCHES = NAMED.map((name) => ({ name, hex: creatorTokens.swatches[name].toUpperCase() }));

type Mode = "light" | "dark" | "vivid";

/** One color chip: a native radio (arrow keys, screen readers) drawn as a disc, with a mark when chosen. */
function Swatch({ name, hex, checked, label, onChange }: { name: string; hex: string; checked: boolean; label: string; onChange: () => void }) {
  return (
    <label className="relative grid size-control-lg cursor-pointer place-items-center rounded-full transition-[scale] duration-micro has-[:focus-visible]:focus-ring active:scale-pressed motion-reduce:active:scale-none">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" aria-label={label} />
      <span
        aria-hidden
        style={{ "--swatch": hex } as CSSProperties}
        className={cn("grid size-control-md place-items-center rounded-full border border-line bg-(--swatch)", checked && "border-emphasis border-focus")}
      >
        {checked ? (
          <span className="grid size-5 place-items-center rounded-full bg-surface-elevated text-fg">
            <Icon icon={Check} size="sm" />
          </span>
        ) : null}
      </span>
    </label>
  );
}

/** A radio card: native input (arrow keys, screen readers), custom look. */
function Choice({ name, checked, onChange, children, label }: { name: string; checked: boolean; onChange: () => void; children: ReactNode; label: string }) {
  return (
    <label
      className={cn(
        "relative grid cursor-pointer content-start gap-2 rounded-lg border p-2 transition-[background-color,border-color,scale] duration-micro has-[:focus-visible]:focus-ring active:scale-pressed motion-reduce:active:scale-none",
        // Hover only darkens the edge of a card that is not chosen; the chosen one keeps its fill and frame.
        checked ? "border-focus bg-selected" : "border-line bg-surface hover:border-line-input",
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      {children}
      <span className="flex items-center justify-between gap-2 px-1 text-small font-medium">
        {label}
        {checked ? <Icon icon={Check} size="sm" className="text-link" /> : null}
      </span>
    </label>
  );
}

/**
 * Design: start from a template, then make it yours: color, background, fonts, buttons. Every
 * combination is checked by the theme engine, so text always stays readable (WCAG AA).
 */
export function DesignScreen() {
  const t = useTranslations("app.design");
  const { doc, dispatch } = useSite();
  const id = useId();
  const theme = doc.theme;
  const rtlScript = doc.profile.locale === "ar";
  const resolved = useMemo(() => resolveCreatorTheme(theme, { rtlScript }), [theme, rtlScript]);
  // The accent the page has when no color is chosen: the template's (or the preset's), as the engine resolves it.
  const templateAccent = useMemo(
    () => resolveCreatorTheme({ ...theme, accent: undefined, neutral: undefined, tint: undefined }, { rtlScript }).palette.accent,
    [theme, rtlScript],
  );
  // A cleared choice is dropped, not kept as an empty key: "customized" (and the reset button) reads the keys.
  const setTheme = (patch: Partial<CreatorThemeConfig>) =>
    dispatch({ type: "theme", theme: Object.fromEntries(Object.entries({ ...theme, ...patch }).filter(([, value]) => value !== undefined)) });
  const customized = Object.keys(theme).some((key) => key !== "template");
  const mode: Mode = resolved.palette.mode;
  const accent = theme.accent?.toUpperCase();
  const named: SwatchName | undefined = SWATCHES.find((swatch) => swatch.hex === accent)?.name;
  const colorName = !accent ? t("templateColor") : named ? t(`swatches.${named}`) : t("custom");

  return (
    <Screen
      title={t("title")}
      lead={t("lead")}
      preview
      actions={
        <>
          <UndoRedo />
          <PreviewButton className="xl:hidden" />
        </>
      }
    >
      {/* Phones and laptops: the page stays in sight while you change it (wide screens have it beside). */}
      <div className="sticky top-16 layer-raised -mx-4 bg-canvas px-4 pb-3 max-lg:group-data-[grouped]/app:bg-canvas-muted md:-mx-8 md:px-8 lg:top-0 xl:hidden">
        <PhonePreview className="h-[30dvh]" />
      </div>

      <Panel title={t("template")} id={`${id}-template`}>
        <TemplatePicker
          value={theme.template}
          profile={doc.profile}
          onChange={(template) => {
            dispatch({ type: "theme", theme: { template } });
            toast({ title: t("applied", { name: creatorTokens.templates[template].label }), tone: "success", action: { label: t("undo"), onAction: () => dispatch({ type: "undo" }) } });
          }}
        />
      </Panel>

      <Panel
        title={t("color")}
        id={`${id}-color`}
        action={
          theme.accent ? (
            <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setTheme({ accent: undefined, neutral: undefined, tint: undefined })}>
              {t("reset")}
            </Button>
          ) : null
        }
      >
        <fieldset className="grid min-w-0 grid-cols-1 gap-3">
          <legend className="sr-only">{t("color")}</legend>
          <div className="flex flex-wrap gap-2">
            {/* First the template's own color: chosen whenever no color of your own is set. */}
            <Swatch
              name={`${id}-accent`}
              hex={templateAccent}
              checked={!accent}
              label={t("templateColor")}
              onChange={() => setTheme({ accent: undefined, neutral: undefined, tint: undefined })}
            />
            {SWATCHES.map((swatch) => (
              <Swatch
                key={swatch.name}
                name={`${id}-accent`}
                hex={swatch.hex}
                checked={accent === swatch.hex}
                label={t(`swatches.${swatch.name}`)}
                onChange={() => setTheme({ accent: swatch.hex })}
              />
            ))}
            {/* A color of your own that is none of the twelve marks this pill as the chosen one. */}
            <label
              className={cn(
                "relative inline-flex h-control-lg cursor-pointer items-center gap-2 rounded-full border px-3 text-small font-medium transition-[background-color,scale] duration-micro has-[:focus-visible]:focus-ring active:scale-pressed motion-reduce:active:scale-none",
                accent && !named ? "border-focus bg-selected text-selected-fg" : "border-line-strong hover:bg-hover",
              )}
            >
              <Icon icon={SwatchBook} size="sm" />
              {t("custom")}
              <input
                type="color"
                value={(theme.accent ?? resolved.palette.accent).slice(0, 7)}
                onChange={(event) => setTheme({ accent: event.target.value.toUpperCase() })}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label={t("customLabel")}
              />
            </label>
          </div>
          <p className="text-small text-fg-secondary">{t("colorSelected", { name: colorName })}</p>
          <p className="text-small text-fg-secondary">{t("colorHint")}</p>
        </fieldset>
      </Panel>

      <Panel title={t("background")} id={`${id}-mode`}>
        {/* Full width on phones, like an iOS segmented control; its natural width from sm up. */}
        <Segmented<Mode>
          label={t("background")}
          value={mode}
          onValueChange={(value) => setTheme({ mode: value })}
          className="w-full *:flex-1 sm:w-auto sm:*:flex-none"
          options={[
            { value: "light", label: t("modes.light"), icon: Sun },
            { value: "dark", label: t("modes.dark"), icon: Moon },
            // Not the palette: that is the Design tab's own icon.
            { value: "vivid", label: t("modes.vivid"), icon: PaintBucket },
          ]}
        />
        <p className="text-small text-fg-secondary">{t(`modeHints.${mode}`)}</p>
      </Panel>

      <Panel title={t("fonts")} id={`${id}-fonts`}>
        {rtlScript ? <p className="rounded-md bg-selected p-3 text-small text-selected-fg">{t("arabicFonts")}</p> : null}
        <fieldset className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4" disabled={rtlScript}>
          <legend className="sr-only">{t("fonts")}</legend>
          {PAIRING_IDS.filter((pairing) => pairing !== "arabic").map((pairing) => (
            <Choice key={pairing} name={`${id}-pairing`} checked={resolved.pairing === creatorTokens.pairings[pairing]} onChange={() => setTheme({ pairing })} label={creatorTokens.pairings[pairing].label}>
              <span aria-hidden style={themeStyle(resolveCreatorTheme({ ...theme, pairing }))} className="grid h-16 place-items-center rounded-md bg-creator-bg text-creator-fg">
                <span className="font-creator-display text-h2" style={displayStyle}>
                  Aa
                </span>
              </span>
            </Choice>
          ))}
        </fieldset>
      </Panel>

      <Panel title={t("buttons")} id={`${id}-buttons`}>
        <fieldset className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
          <legend className="mb-3 text-small font-medium">{t("buttonStyle")}</legend>
          {BUTTON_STYLES.map((style: CreatorButtonStyle) => (
            <Choice key={style} name={`${id}-style`} checked={resolved.buttonStyle === style} onChange={() => setTheme({ buttonStyle: style })} label={t(`styles.${style}`)}>
              <span aria-hidden style={themeStyle(resolved)} className="grid h-16 place-items-center rounded-md bg-creator-bg px-3">
                <span className={cn("grid h-control-sm w-full place-items-center rounded-creator-button font-creator-body text-caption font-medium", linkStyleClasses[style])}>{t("sampleButton")}</span>
              </span>
            </Choice>
          ))}
        </fieldset>
        <Segmented<CreatorButtonShape>
          label={t("buttonShape")}
          value={resolved.buttonShape}
          onValueChange={(buttonShape) => setTheme({ buttonShape })}
          className="w-full *:flex-1 sm:w-auto sm:*:flex-none"
          options={BUTTON_SHAPES.map((shape) => ({ value: shape, label: t(`shapes.${shape}`) }))}
        />
      </Panel>

      {customized ? (
        <Button
          variant="ghost"
          icon={RotateCcw}
          className="justify-self-start"
          onClick={() => {
            dispatch({ type: "theme", theme: { template: theme.template } });
            toast({ title: t("resetDone"), action: { label: t("undo"), onAction: () => dispatch({ type: "undo" }) } });
          }}
        >
          {t("resetAll")}
        </Button>
      ) : null}
    </Screen>
  );
}
