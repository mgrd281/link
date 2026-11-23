"use client";

import { hasImage, type Page } from "@linkyo/blocks";
import { creatorTokens, type CreatorTemplateId } from "@linkyo/tokens";
import { resolveCreatorTheme, TEMPLATE_IDS, type HeroStyle } from "@linkyo/tokens/creator";
import { cn, Icon } from "@linkyo/ui";
import { Check } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useLayoutEffect, useMemo, useRef } from "react";

import { themeStyle } from "@/features/creator/theme";

import { thumbSizes } from "../editor/use-dashboard";
import { initials } from "../shared/creator-kit";
import { resolveMedia } from "../shared/media";
import { displayStyle } from "./styles";

/** Where each newer template puts the picture in its card (the others: the top, fading into the page). */
const PICTURE: Partial<Record<HeroStyle, string>> = {
  cinema: "inset-0 mask-b-from-40% mask-b-to-95%",
  halo: "top-4 left-1/2 aspect-square w-1/2 -translate-x-1/2 rounded-full",
  inset: "inset-x-2 top-2 h-1/2 rounded-sm",
  frame: "top-4 left-1/2 aspect-square w-1/2 -translate-x-1/2 rounded-xs border-emphasis border-creator-accent",
  arch: "top-3 left-1/2 h-1/2 w-3/5 -translate-x-1/2 rounded-t-full rounded-b-xs",
  // Werkbogen: a plate from edge to edge under a quiet top line. Tiefdruck: no large picture, a small round portrait.
  plate: "inset-x-0 top-4 h-2/5",
  statement: "start-3 top-3 size-8 rounded-full",
  // Laufbahn: the picture from edge to edge, the name in white at its foot (drawn inside it, below).
  bleed: "inset-x-0 top-0 h-3/5",
};

/**
 * Template picker: fourteen looks, each previewed with the creator's own photo and name in that
 * template's real colors and fonts (resolved by the theme engine, so every swatch is AA).
 * Native radio inputs: arrow keys move between templates, screen readers announce the choice.
 * `still` (the dashboard's Design screen) stops the thumbnails' ambient loops, so nothing moves while
 * the creator compares looks (the live preview shows the real motion), and keeps the phone's single
 * scrolling row at every width.
 */
export function TemplatePicker({
  value,
  profile,
  onChange,
  still = false,
}: {
  value: CreatorTemplateId | undefined;
  profile: Page["profile"];
  onChange: (template: CreatorTemplateId) => void;
  still?: boolean;
}) {
  const t = useTranslations("dashboard");
  const tTemplates = useTranslations("templates");
  const rtlScript = profile.locale === "ar";
  const themes = useMemo(() => TEMPLATE_IDS.map((id) => ({ id, theme: resolveCreatorTheme({ template: id }, { rtlScript }) })), [rtlScript]);
  const photo = hasImage(profile.avatar) ? profile.avatar : hasImage(profile.hero) ? profile.hero : null;
  const avatar = photo ? resolveMedia(photo.src) : null;
  const row = useRef<HTMLDivElement>(null);
  // A still picker is one row at every width, so the screen around it stays short. The chosen look is
  // brought into the row's view once, before the first paint, without moving the page. scrollBy is
  // relative, so this works the same in both reading directions.
  useLayoutEffect(() => {
    const box = row.current;
    const chosen = still ? box?.querySelector("input:checked")?.closest("label") : null;
    if (!box || !chosen) return;
    const outer = box.getBoundingClientRect();
    const card = chosen.getBoundingClientRect();
    if (card.left >= outer.left && card.right <= outer.right) return;
    box.scrollBy({ left: card.left + card.width / 2 - (outer.left + outer.width / 2) });
  }, [still]);

  return (
    <fieldset data-still={still ? "" : undefined} className="grid min-w-0 gap-3">
      <legend className="sr-only">{t("template")}</legend>
      {/* Still: the row runs to the edges of the dashboard panel around it (its p-4, lg:p-6), never past them.
          A scroller clips what is outside it: pt-1 (taken back by -mt-1) and pb-1 keep the focus ring whole. */}
      <div ref={row} className={cn("-mt-1 overflow-x-auto pt-1 pb-1", still ? "-mx-4 px-4 lg:-mx-6 lg:px-6" : "-mx-5 px-5 lg:mx-0 lg:overflow-visible lg:px-0")}>
        <div className={cn("grid auto-cols-[42%] grid-flow-col gap-3 sm:auto-cols-[28%]", !still && "lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-4")}>
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
                  {theme.layout.backdrop === "grid" ? <span className="poster-grid absolute inset-0 mask-b-from-10% mask-b-to-90%" /> : null}
                  {theme.layout.backdrop === "aurora" ? <span className="poster-glow poster-glow-1" /> : null}
                  {/* The picture in the template's own shape: full, round with a halo, framed, in corner marks or in an arch. */}
                  <span
                    className={cn(
                      "absolute overflow-hidden",
                      PICTURE[theme.layout.hero] ?? "inset-x-0 top-0 h-3/5 mask-b-from-30% mask-b-to-100%",
                    )}
                  >
                    {theme.layout.hero === "halo" ? <span className="poster-halo absolute inset-0" /> : null}
                    <span className={cn("absolute overflow-hidden", theme.layout.hero === "halo" ? "inset-1 rounded-full" : "inset-0")}>
                      {avatar ? (
                        <Image
                          src={avatar}
                          alt=""
                          fill
                          sizes={thumbSizes}
                          className={cn("object-cover", theme.layout.hero === "duotone" && "grayscale mix-blend-screen", theme.layout.hero === "mono" && "grayscale", theme.layout.hero === "logo" && "blur-glass")}
                          unoptimized={typeof avatar === "string"}
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="absolute inset-0 grid place-items-center bg-creator-surface-2 font-creator-display text-h2 text-creator-fg">{initials(profile.displayName)}</span>
                      )}
                    </span>
                    {/* Laufbahn sets the name in white over a veil at the foot of the picture, as its hero does on phones. */}
                    {theme.layout.hero === "bleed" ? (
                      <>
                        <span className="lb-scrim absolute inset-0" />
                        <span className="absolute inset-x-3 bottom-2 truncate font-creator-display text-body leading-none text-white" style={displayStyle}>
                          {profile.displayName}
                        </span>
                      </>
                    ) : null}
                  </span>
                  {/* Tiefdruck sets the name large: its card does too. Laufbahn's stands on its picture. */}
                  {theme.layout.hero === "bleed" ? null : (
                    <span className={cn("relative truncate font-creator-display leading-none", theme.layout.hero === "statement" ? "text-h3" : "text-body")} style={displayStyle}>
                      {profile.displayName}
                    </span>
                  )}
                  <span className="relative grid gap-1">
                    {/* Laufbahn's signature: a lettered signpost before its first section. */}
                    {theme.layout.headings === "signpost" ? (
                      <span className="flex items-center gap-1">
                        <span className="grid size-4 shrink-0 place-items-center rounded-xs bg-creator-accent font-creator-display text-caption leading-none text-creator-accent-fg" style={displayStyle}>
                          {profile.locale === "ar" ? "أ" : "A"}
                        </span>
                        <span className="h-2 flex-1 rounded-xs bg-creator-surface-2" />
                      </span>
                    ) : (
                      <span className="h-2 rounded-xs bg-creator-surface-2" />
                    )}
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
      {/* One line about the chosen look (the cards only have room for a few words). */}
      <p aria-live="polite" className="text-small text-fg-secondary">
        {value ? (
          <>
            <span className="font-semibold text-fg">{creatorTokens.templates[value].label}</span> · {tTemplates(`${value}.description`)}
          </>
        ) : (
          t("templateHint")
        )}
      </p>
    </fieldset>
  );
}
