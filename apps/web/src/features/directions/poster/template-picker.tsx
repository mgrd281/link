"use client";

import { hasImage, type Page } from "@linkyo/blocks";
import { creatorTokens, type CreatorTemplateId } from "@linkyo/tokens";
import { resolveCreatorTheme, TEMPLATE_IDS } from "@linkyo/tokens/creator";
import { cn, Icon } from "@linkyo/ui";
import { Check } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { themeStyle } from "@/features/creator/theme";

import { thumbSizes } from "../editor/use-dashboard";
import { initials } from "../shared/creator-kit";
import { resolveMedia } from "../shared/media";
import { displayStyle } from "./styles";

/**
 * Template picker: five looks, each previewed with the creator's own photo and name in that
 * template's real colors and fonts (resolved by the theme engine, so every swatch is AA).
 * Native radio inputs: arrow keys move between templates, screen readers announce the choice.
 */
export function TemplatePicker({
  value,
  profile,
  onChange,
}: {
  value: CreatorTemplateId | undefined;
  profile: Page["profile"];
  onChange: (template: CreatorTemplateId) => void;
}) {
  const t = useTranslations("dashboard");
  const tTemplates = useTranslations("templates");
  const rtlScript = profile.locale === "ar";
  const themes = useMemo(() => TEMPLATE_IDS.map((id) => ({ id, theme: resolveCreatorTheme({ template: id }, { rtlScript }) })), [rtlScript]);
  const photo = hasImage(profile.avatar) ? profile.avatar : hasImage(profile.hero) ? profile.hero : null;
  const avatar = photo ? resolveMedia(photo.src) : null;

  return (
    <fieldset className="grid min-w-0 gap-3">
      <legend className="sr-only">{t("template")}</legend>
      <div className="-mx-5 overflow-x-auto px-5 pb-1 lg:mx-0 lg:overflow-visible lg:px-0">
        <div className="grid auto-cols-[42%] grid-flow-col gap-3 sm:auto-cols-[28%] lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-5">
          {themes.map(({ id, theme }) => {
            const selected = id === value;
            return (
              <label
                key={id}
                className={cn(
                  "group relative grid cursor-pointer content-start gap-2 rounded-lg p-2 transition-colors duration-micro",
                  "has-[:focus-visible]:focus-ring hover:bg-hover",
                  selected && "bg-selected",
                )}
              >
                <input type="radio" name="poster-template" value={id} checked={selected} onChange={() => onChange(id)} className="sr-only" />
                <span
                  aria-hidden
                  style={themeStyle(theme)}
                  className={cn(
                    "relative grid aspect-portrait content-end gap-2 overflow-hidden rounded-md border bg-creator-bg p-3 font-creator-body text-creator-fg",
                    selected ? "border-focus border-emphasis" : "border-line",
                  )}
                >
                  <span className="absolute inset-x-0 top-0 h-3/5 overflow-hidden mask-b-from-30% mask-b-to-100%">
                    {avatar ? (
                      <Image
                        src={avatar}
                        alt=""
                        fill
                        sizes={thumbSizes}
                        className={cn("object-cover", theme.layout.hero === "duotone" && "grayscale mix-blend-screen", theme.layout.hero === "logo" && "blur-glass")}
                        unoptimized={typeof avatar === "string"}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="absolute inset-0 grid place-items-center bg-creator-surface-2 font-creator-display text-h2 text-creator-fg">{initials(profile.displayName)}</span>
                    )}
                  </span>
                  <span className="relative truncate font-creator-display text-body leading-none" style={displayStyle}>
                    {profile.displayName}
                  </span>
                  <span className="relative grid gap-1">
                    <span className="h-2 rounded-xs bg-creator-surface-2" />
                    <span className="h-2 w-3/4 rounded-xs bg-creator-surface-2" />
                    <span className="h-3 w-1/2 rounded-full bg-creator-accent" />
                  </span>
                  {selected ? (
                    <span className="absolute end-2 top-2 grid size-6 place-items-center rounded-full bg-primary text-primary-fg">
                      <Icon icon={Check} size="sm" />
                    </span>
                  ) : null}
                </span>
                <span className="grid gap-0.5 px-1">
                  <span className="text-small font-semibold">{creatorTokens.templates[id].label}</span>
                  <span className="line-clamp-2 text-caption text-fg-secondary">{tTemplates(`${id}.description`)}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>
      <p className="text-caption text-fg-tertiary">{t("templateHint")}</p>
    </fieldset>
  );
}
