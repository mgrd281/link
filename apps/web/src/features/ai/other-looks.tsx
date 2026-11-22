"use client";

import { creatorTokens, type CreatorTemplateId } from "@linkyo/tokens";
import { resolveCreatorTheme, TEMPLATE_IDS, type CreatorThemeConfig } from "@linkyo/tokens/creator";
import { cn, Icon } from "@linkyo/ui";
import { Check, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useMemo } from "react";

import { themeStyle } from "@/features/creator/theme";

import { templateLabel } from "./timeline";

/**
 * Three other looks for the draft, made here without the AI (no call, no draft used): the next three
 * templates after the AI's choice, in the tokens' order, that share its light or dark mode (else any).
 * A photo or chosen accent stays, so the alternatives are still the owner's colours.
 */
export function otherLooks(draft: CreatorThemeConfig, count = 3): { id: CreatorTemplateId; theme: CreatorThemeConfig }[] {
  const mode = resolveCreatorTheme(draft).palette.mode;
  const start = draft.template ? TEMPLATE_IDS.indexOf(draft.template) : -1;
  const order = TEMPLATE_IDS.map((_, i) => TEMPLATE_IDS[(start + 1 + i) % TEMPLATE_IDS.length]).filter((id): id is CreatorTemplateId => id !== undefined && id !== draft.template);
  const sameMode = order.filter((id) => resolveCreatorTheme({ template: id }).palette.mode === mode);
  const picked = [...sameMode, ...order.filter((id) => !sameMode.includes(id))].slice(0, count);
  return picked.map((id) => ({ id, theme: { template: id, ...(draft.accent ? { accent: draft.accent } : {}) } }));
}

/** Two swatches of a look: its page colour and its accent, as the theme engine resolves them (always AA). */
function Swatches({ theme, rtl }: { theme: CreatorThemeConfig; rtl: boolean }) {
  const resolved = useMemo(() => resolveCreatorTheme(theme, { rtlScript: rtl }), [theme, rtl]);
  return (
    <span aria-hidden style={themeStyle(resolved)} className="flex items-center gap-1">
      <span className="size-6 rounded-full border border-creator-line-strong bg-creator-bg" />
      <span className="size-6 rounded-full border border-creator-line-strong bg-creator-accent" />
    </span>
  );
}

/**
 * The AI's look and three others as radio cards (native radios: arrow keys move, screen readers say
 * the choice). Picking one re-themes the phone at once.
 */
export function OtherLooks({
  draft,
  value,
  onChange,
  rtl,
  aiPick = true,
}: {
  draft: CreatorThemeConfig;
  value: CreatorThemeConfig | null;
  onChange: (theme: CreatorThemeConfig | null) => void;
  rtl: boolean;
  /** False when the AI did not choose the draft's look (a team proposal without AI content): no "AI's choice" label. */
  aiPick?: boolean;
}) {
  const t = useTranslations("app.ai.review");
  const name = useId();
  const looks = useMemo(() => otherLooks(draft), [draft]);
  const chosen = value?.template ?? null;
  const options = [
    { key: "ai", theme: draft, label: templateLabel(draft), detail: aiPick ? t("lookCurrent") : null, selected: value === null },
    ...looks.map((look) => ({ key: look.id, theme: look.theme, label: creatorTokens.templates[look.id].label, detail: null, selected: chosen === look.id })),
  ];
  return (
    <fieldset className="grid min-w-0 grid-cols-1 gap-3">
      <legend className="mb-1 grid gap-0.5">
        <span className="text-title rtl:tracking-normal">{t("looks")}</span>
        <span className="text-small text-fg-secondary">{t("looksHint")}</span>
      </legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((option) => (
          <label
            key={option.key}
            className={cn(
              "relative grid cursor-pointer content-start gap-3 rounded-lg border p-3 transition-colors duration-micro has-[:focus-visible]:focus-ring hover:bg-hover",
              option.selected ? "border-focus bg-selected" : "border-line bg-surface",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.key}
              checked={option.selected}
              onChange={() => onChange(option.key === "ai" ? null : option.theme)}
              className="sr-only"
            />
            <span className="flex items-center justify-between gap-2">
              <Swatches theme={option.theme} rtl={rtl} />
              {option.selected ? <Icon icon={Check} size="sm" className="text-fg" /> : null}
            </span>
            <span className="grid min-w-0 gap-0.5">
              <span className="truncate text-small font-semibold">{option.label}</span>
              {option.detail ? (
                <span className="flex items-center gap-1 text-caption text-fg-secondary">
                  <Icon icon={Sparkles} size="sm" className="shrink-0" />
                  {option.detail}
                </span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
