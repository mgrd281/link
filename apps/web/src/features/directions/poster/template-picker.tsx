"use client";

import type { Page } from "@linkyo/blocks";
import { creatorTokens, type CreatorTemplateId } from "@linkyo/tokens";
import { orderTemplates, resolveCreatorTheme, TEMPLATE_IDS, templatesFor } from "@linkyo/tokens/creator";
import { cn, Icon, Segmented } from "@linkyo/ui";
import { Check } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { themeStyle } from "@/features/creator/theme";

import { displayStyle } from "./styles";
import { TEMPLATE_PREVIEW_SIZES, TEMPLATE_PREVIEWS } from "./template-previews";

type Filter = "all" | "portfolio";

/**
 * Template picker: every look, each shown by its real first screen (a capture of the template with
 * the fictional sample creator, see template-previews.ts), so the choice is made on the real thing.
 * Native radio inputs: arrow keys move between templates, screen readers announce the choice.
 *
 * - Phones: one row that scrolls sideways. Laptops (lg): a grid, three, four or five columns by the
 *   room it has (container queries; five from a room of `layout.column-wide`, so the cards stay
 *   about 200 px wide in the wide column of a 1920 px screen), every look in sight at once.
 * - "Alle · Portfolio" narrows the looks to those made for portfolios (tokens: `use`), so a template
 *   added later appears there without code.
 * - The chosen look is brought into view when the picker opens and when the filter changes, inside
 *   the row (phones), instantly under reduced motion. The page itself never moves: the grid on
 *   laptops has no scroller of its own, and scrolling the page to a card below the window put the
 *   screen's title, the filter and the first row under the sticky bar a moment after it opened.
 *   The chosen card is marked (frame, tick, filled) and named in the line below the grid.
 * - `still`: the picker sits in a dashboard panel (Design), so the row runs to the panel's edges.
 * - `order` puts those template ids first (a kind's default and suggestions, see
 *   `suggestedTemplates`); every other look follows in token order, so none is hidden.
 *
 * `profile` decides the script the colours are resolved for (cards without a capture fall back to
 * the template's colours and its display face).
 */
export function TemplatePicker({
  value,
  profile,
  onChange,
  still = false,
  order,
}: {
  value: CreatorTemplateId | undefined;
  profile: Page["profile"];
  onChange: (template: CreatorTemplateId) => void;
  still?: boolean;
  order?: readonly CreatorTemplateId[] | undefined;
}) {
  const t = useTranslations("dashboard");
  const tTemplates = useTranslations("templates");
  const tFilter = useTranslations("app.design.filter");
  const rtlScript = profile.locale === "ar";
  const [filter, setFilter] = useState<Filter>("all");
  const orderKey = order?.join(",") ?? "";
  const ids = useMemo(() => {
    const all = orderKey ? orderTemplates(orderKey.split(",")) : [...TEMPLATE_IDS];
    if (filter === "all") return all;
    const portfolio = new Set<CreatorTemplateId>(templatesFor("portfolio"));
    return all.filter((id) => portfolio.has(id));
  }, [orderKey, filter]);
  const box = useRef<HTMLDivElement>(null);
  const opened = useRef(false);

  useLayoutEffect(() => {
    const scroller = box.current;
    const chosen = scroller?.querySelector("input:checked")?.closest("label");
    // The first run is the picker opening: in the row it happens before the first paint.
    const first = !opened.current;
    opened.current = true;
    // Only the row scrolls (sideways, on phones). In the grid there is nothing to scroll: the page stays put.
    if (!scroller || !chosen || scroller.scrollWidth <= scroller.clientWidth) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Centre the card in the row. scrollBy is relative, so this works in both reading directions.
    const outer = scroller.getBoundingClientRect();
    const card = chosen.getBoundingClientRect();
    if (card.left >= outer.left && card.right <= outer.right) return;
    scroller.scrollBy({ left: card.left + card.width / 2 - (outer.left + outer.width / 2), behavior: first || reduced ? "instant" : "smooth" });
  }, [filter]);

  return (
    <fieldset data-still={still ? "" : undefined} className="@container grid min-w-0 gap-3">
      <legend className="sr-only">{t("template")}</legend>
      <Segmented<Filter>
        label={tFilter("label")}
        value={filter}
        onValueChange={setFilter}
        className="justify-self-start pointer-coarse:h-control-lg"
        options={[
          { value: "all", label: tFilter("all") },
          { value: "portfolio", label: tFilter("portfolio") },
        ]}
      />
      {/* Phones: the row runs to the edges of what is around it (a dashboard panel's p-4, or the page's
          gutter), never past them. A scroller clips what is outside it: pt-1 (taken back by -mt-1) and
          pb-1 keep the focus ring whole. Laptops: a grid in place, nothing to scroll. */}
      <div ref={box} className={cn("-mt-1 overflow-x-auto pt-1 pb-1 lg:overflow-visible", still ? "-mx-4 px-4 lg:mx-0 lg:px-0" : "-mx-5 px-5 lg:mx-0 lg:px-0")}>
        <div className="grid auto-cols-[38%] grid-flow-col gap-3 sm:auto-cols-[26%] lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-3 lg:@prose:grid-cols-4 lg:@column-wide:grid-cols-5">
          {ids.map((id) => {
            const selected = id === value;
            const preview = TEMPLATE_PREVIEWS[id];
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
                <span aria-hidden className={cn("relative block aspect-short overflow-hidden rounded-md border", selected ? "border-focus border-emphasis" : "border-line")}>
                  {preview ? (
                    <Image src={preview} alt="" fill sizes={TEMPLATE_PREVIEW_SIZES} className="object-cover object-top" />
                  ) : (
                    // No capture yet (a template just added): its own colours and display face.
                    <span
                      style={themeStyle(resolveCreatorTheme({ template: id }, { rtlScript }))}
                      className="absolute inset-0 grid place-items-center bg-creator-bg p-3 text-center font-creator-display text-h3 leading-none text-creator-fg"
                    >
                      <span style={displayStyle}>{creatorTokens.templates[id].label}</span>
                    </span>
                  )}
                  {selected ? (
                    <span className="absolute end-2 top-2 grid size-6 place-items-center rounded-full bg-primary text-primary-fg">
                      <Icon icon={Check} size="sm" />
                    </span>
                  ) : null}
                </span>
                <span className="grid gap-0.5 px-1">
                  <span className={cn("text-small", selected ? "font-semibold" : "font-medium")}>{creatorTokens.templates[id].label}</span>
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
