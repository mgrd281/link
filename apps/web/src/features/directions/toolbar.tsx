"use client";

import { creatorTokens, type CreatorPresetId, type CreatorTemplateId } from "@linkyo/tokens";
import { isTemplate, TEMPLATE_IDS } from "@linkyo/tokens/creator";
import { cn, Icon, IconButton } from "@linkyo/ui";
import { SlidersHorizontal, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Link, useRouter } from "@/i18n/navigation";

import { DIRECTIONS, isThemeMode, type DirectionId, type ThemeModeParam } from "./registry";

/** Prototype-only controls to compare directions, views and themes. Not part of the product UI. */
export function DirectionToolbar({
  direction,
  view,
  activeTemplate,
}: {
  direction: DirectionId;
  view: "page" | "dashboard";
  activeTemplate?: CreatorTemplateId | null | undefined;
}) {
  const t = useTranslations("directions");
  const params = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const preset = params.get("preset") ?? "";
  const modeParam = params.get("mode") ?? undefined;
  const mode = isThemeMode(modeParam) ? modeParam : null;
  const templateParam = params.get("template") ?? undefined;
  const template = isTemplate(templateParam) ? templateParam : null;
  if (params.get("chrome") === "0") return null;

  const query = (next: { preset?: string; mode?: ThemeModeParam | null; template?: CreatorTemplateId | null }) => {
    const search = new URLSearchParams();
    const p = next.preset ?? preset;
    const m = next.mode === undefined ? mode : next.mode;
    const tpl = next.template === undefined ? template : next.template;
    if (tpl) search.set("template", tpl);
    if (p) search.set("preset", p);
    if (m) search.set("mode", m);
    const text = search.toString();
    return text ? `?${text}` : "";
  };
  const href = (d: DirectionId, v: "page" | "dashboard") => `/directions/${d}${v === "dashboard" ? "/dashboard" : ""}${v === "page" ? query({}) : ""}` as const;

  if (!open) {
    return (
      <div className="layer-overlay fixed end-4 bottom-4" data-theme="dark">
        <IconButton icon={SlidersHorizontal} label={t("toolbar.show")} variant="secondary" onClick={() => setOpen(true)} />
      </div>
    );
  }
  const seg = "inline-flex h-control-sm items-center rounded-sm border border-transparent px-3 text-small font-medium text-fg-secondary transition-colors duration-micro hover:text-fg focus-visible:focus-ring";
  return (
    <div data-theme="dark" className="layer-overlay fixed inset-x-0 bottom-4 flex justify-center px-4">
      <nav
        aria-label={t("toolbar.label")}
        className="flex max-w-full flex-wrap items-center gap-2 overflow-x-auto rounded-xl border border-line-strong bg-surface-elevated p-1 text-fg"
      >
        <div className="flex gap-0.5 rounded-md bg-canvas-muted p-0.5" role="group" aria-label={t("toolbar.direction")}>
          {DIRECTIONS.map((d) => (
            <Link key={d} href={href(d, view)} aria-current={d === direction ? "page" : undefined} className={cn(seg, d === direction && "border-line bg-surface text-fg")}>
              {t(`${d}.name`)}
            </Link>
          ))}
        </div>
        <div className="flex gap-0.5 rounded-md bg-canvas-muted p-0.5" role="group" aria-label={t("toolbar.view")}>
          {(["page", "dashboard"] as const).map((v) => (
            <Link key={v} href={href(direction, v)} aria-current={v === view ? "page" : undefined} className={cn(seg, v === view && "border-line bg-surface text-fg")}>
              {t(`toolbar.${v}`)}
            </Link>
          ))}
        </div>
        {view === "page" && direction === "poster" ? (
          <div className="flex gap-0.5 rounded-md bg-canvas-muted p-0.5" role="group" aria-label={t("toolbar.template")}>
            {TEMPLATE_IDS.map((id) => {
              const active = id === (template ?? activeTemplate);
              return (
                <Link key={id} href={`/directions/${direction}${query({ template: id, preset: "", mode: null })}`} aria-current={active ? "true" : undefined} className={cn(seg, active && "border-line bg-surface text-fg")}>
                  {creatorTokens.templates[id].label}
                </Link>
              );
            })}
          </div>
        ) : null}
        {view === "page" ? (
          <label className="flex items-center gap-2 px-2 text-small text-fg-secondary">
            <span>{t("toolbar.theme")}</span>
            <select
              value={preset}
              onChange={(event) => {
                const next = event.target.value;
                router.replace(`/directions/${direction}${query({ preset: next })}`);
              }}
              className="h-control-sm rounded-sm border border-line-strong bg-surface px-2 text-small text-fg focus-visible:focus-ring"
            >
              <option value="">{t("toolbar.default")}</option>
              {(Object.keys(creatorTokens.presets) as CreatorPresetId[]).map((id) => (
                <option key={id} value={id}>
                  {creatorTokens.presets[id].label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button type="button" onClick={() => setOpen(false)} aria-label={t("toolbar.hide")} className="grid size-control-sm place-items-center rounded-sm text-fg-secondary hover:bg-hover hover:text-fg focus-visible:focus-ring">
          <Icon icon={X} size="sm" />
        </button>
      </nav>
    </div>
  );
}
