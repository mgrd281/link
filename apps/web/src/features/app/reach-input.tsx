"use client";

import type { CreatorKind } from "@linkyo/blocks";
import { cn, Icon } from "@linkyo/ui";
import { CalendarDays, Mail, MessageCircle, Phone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";

import { TextInput } from "./form";
import { isPresetLabel, presetLabel, reachFrom, reachIcon, reachPresets, reachUrl, REACH_WAYS, type PageLocale, type ReachWay, type ReachValue } from "./reach";

// The rules live in a plain module (validate.ts checks contact ways with them too); they are
// re-exported here for the forms that import them with the field.
export { isPresetLabel, isReachWay, presetLabel, reachesBy, reachFrom, reachIcon, reachPresets, reachUrl, REACH_WAYS, shapeWay } from "./reach";
export type { PageLocale, ReachPreset, ReachValue, ReachWay } from "./reach";

const INPUT: Record<ReachWay, { type: string; inputMode: "url" | "email" | "tel"; autoComplete: string }> = {
  calendar: { type: "url", inputMode: "url", autoComplete: "url" },
  email: { type: "email", inputMode: "email", autoComplete: "email" },
  whatsapp: { type: "tel", inputMode: "tel", autoComplete: "tel" },
  phone: { type: "tel", inputMode: "tel", autoComplete: "tel" },
};

const WAY_ICONS = { calendar: CalendarDays, email: Mail, whatsapp: MessageCircle, phone: Phone } as const;

/**
 * The page's one button: how people reach the owner (a segmented choice), one address field typed
 * left to right in every language, and the button's words with presets for the kind of page. It
 * returns `{ label, url, icon }`, the address built by code (`reachUrl`). The welcome flow and the
 * contact block's form both use it. The button's preset words are in the page's language, which
 * can differ from the dashboard's.
 */
export function ReachInput({
  value,
  onValue,
  kind,
  locale,
  labels,
  errors = {},
}: {
  value: ReachValue;
  onValue: (value: ReachValue) => void;
  kind: CreatorKind | undefined;
  /** The page's language, for the preset words visitors read (the dashboard's when not given). */
  locale?: PageLocale | undefined;
  /** The field names where a form has its own words (the welcome flow). */
  labels?: { address?: string | undefined; label?: string | undefined } | undefined;
  errors?: { url?: string | undefined; label?: string | undefined } | undefined;
}) {
  const t = useTranslations("app.portfolio.contact");
  const tWays = useTranslations("app.welcome.portfolio.ways");
  const tErrors = useTranslations("app.errors");
  const tPlatforms = useTranslations("app.welcome.platforms");
  const dashboard = useLocale();
  const words = locale ?? (dashboard === "en" || dashboard === "ar" ? dashboard : "de");
  const id = useId();
  const [state, setState] = useState(() => reachFrom(value.url));
  const [touched, setTouched] = useState(false);
  const presets = reachPresets(state.way, kind);
  // The label follows the way while it is empty or still one of our presets (in any language).
  const ownLabel = value.label.trim() !== "" && !isPresetLabel(value.label);
  const firstPreset = (way: ReachWay) => presetLabel(reachPresets(way, kind)[0] ?? "call", words);

  // A button needs words: the way's first preset, until the owner writes or picks others.
  const emit = (way: ReachWay, typed: string, label = value.label) => {
    const url = reachUrl(way, typed) ?? "";
    onValue({ label: label.trim() ? label : firstPreset(way), url, icon: reachIcon(way) });
  };
  const choose = (way: ReachWay) => {
    // A number typed for WhatsApp stays when switching to phone (and back); other addresses start over.
    const phoneLike = (way === "phone" || way === "whatsapp") && (state.way === "phone" || state.way === "whatsapp");
    const typed = phoneLike ? state.typed : "";
    setState({ way, typed });
    setTouched(false);
    emit(way, typed, ownLabel ? value.label : firstPreset(way));
  };

  const invalid = touched && state.typed.trim() !== "" && reachUrl(state.way, state.typed) === null;
  const urlError = invalid ? tErrors(state.way === "email" ? "invalidEmail" : state.way === "calendar" ? "url" : "invalid") : errors.url;

  return (
    <div className="grid grid-cols-1 gap-4">
      {/* Four ways in two rows on phones, one row from sm: every label stays whole. */}
      <div role="radiogroup" aria-label={t("primary")} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {REACH_WAYS.map((way) => {
          const checked = state.way === way;
          return (
            <label
              key={way}
              className={cn(
                "flex min-h-touch-target min-w-0 cursor-pointer items-center gap-2 rounded-md border px-3 text-small font-medium transition-[background-color,border-color] duration-micro has-[:focus-visible]:focus-ring",
                checked ? "border-focus bg-selected text-selected-fg" : "border-line-strong hover:border-line-input",
              )}
            >
              <input type="radio" name={`${id}-way`} value={way} checked={checked} onChange={() => choose(way)} className="sr-only" />
              <Icon icon={WAY_ICONS[way]} size="sm" className="shrink-0" />
              <span className="min-w-0 break-words">{tWays(way)}</span>
            </label>
          );
        })}
      </div>
      <TextInput
        id={`${id}-address`}
        label={labels?.address ?? t("primaryUrl")}
        // WhatsApp needs the country code ("WhatsApp (number with country code)"): said before it is missed.
        hint={state.way === "whatsapp" ? tPlatforms("whatsapp") : undefined}
        value={state.typed}
        ltr
        type={INPUT[state.way].type}
        inputMode={INPUT[state.way].inputMode}
        autoComplete={INPUT[state.way].autoComplete}
        autoCapitalize="none"
        spellCheck={false}
        error={urlError}
        onValue={(typed) => {
          // An e-mail address typed into another way's field is an e-mail: the choice follows it.
          const way = state.way !== "email" && reachUrl(state.way, typed) === null && reachUrl("email", typed) !== null ? "email" : state.way;
          setState({ way, typed });
          emit(way, typed, way === state.way || ownLabel ? value.label : firstPreset(way));
        }}
        onBlur={() => setTouched(true)}
      />
      <div className="grid grid-cols-1 gap-2">
        <TextInput
          id={`${id}-label`}
          label={labels?.label ?? t("primaryLabel")}
          value={value.label}
          maxLength={40}
          error={errors.label}
          onValue={(label) => onValue({ ...value, label })}
        />
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => {
            const text = presetLabel(preset, words);
            const chosen = value.label === text;
            return (
              <button
                key={preset}
                type="button"
                aria-pressed={chosen}
                onClick={() => onValue({ ...value, label: text, icon: reachIcon(state.way) })}
                className={cn(
                  "inline-flex min-h-touch-target items-center rounded-full border px-4 text-small font-medium transition-colors duration-micro focus-visible:focus-ring",
                  chosen ? "border-focus bg-selected text-selected-fg" : "border-line-strong text-fg-secondary hover:border-line-input hover:text-fg",
                )}
              >
                {text}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
