"use client";

import { normalizeUrl, type CreatorKind, type LinkIcon } from "@linkyo/blocks";
import { cn, Icon } from "@linkyo/ui";
import { CalendarDays, Mail, MessageCircle, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { TextInput } from "./form";

/** The ways a page's one button can reach its owner. */
export const REACH_WAYS = ["calendar", "email", "whatsapp", "phone"] as const;
export type ReachWay = (typeof REACH_WAYS)[number];

/** Label presets (`app.portfolio.contact.presets.*`). */
export type ReachPreset = "call" | "email" | "whatsapp" | "phone" | "project" | "shoot";

/** The page's one primary action, as the contact block stores it. */
export interface ReachValue {
  label: string;
  url: string;
  icon?: LinkIcon | undefined;
}

const ICONS: Record<ReachWay, LinkIcon> = { calendar: "calendar", email: "mail", whatsapp: "chat", phone: "phone" };

/** The icon a way's button carries on the page. */
export const reachIcon = (way: ReachWay): LinkIcon => ICONS[way];

/** At least this many digits make a phone number (a short service number has more than this). */
const MIN_DIGITS = 6;
const MAX_DIGITS = 15;
const EMAIL = /^[^\s@/:]+@[^\s@/:]+\.[^\s@/:]{2,}$/;

/**
 * The address a way leads to, built by code from what was typed: a booking link stays a web
 * address, an e-mail becomes `mailto:`, a WhatsApp number `https://wa.me/<digits>` and a phone
 * number `tel:`. Null when what was typed is not such an address (never a half-made link).
 */
export function reachUrl(way: ReachWay, typed: string): string | null {
  const raw = typed.trim();
  if (!raw) return null;
  switch (way) {
    case "calendar": {
      const url = normalizeUrl(raw);
      return url && /^https?:$/.test(url.protocol) ? url.toString() : null;
    }
    case "email": {
      const address = raw.replace(/^mailto:/i, "");
      return EMAIL.test(address) ? `mailto:${address}` : null;
    }
    case "whatsapp": {
      // A pasted wa.me link or a number with spaces, dashes, brackets or a leading +.
      const number = raw.replace(/^(?:https?:\/\/)?(?:www\.)?wa\.me\//i, "");
      if (!/^\+?[\d\s()./-]+$/.test(number)) return null;
      const digits = number.replace(/\D/g, "");
      return digits.length >= MIN_DIGITS && digits.length <= MAX_DIGITS ? `https://wa.me/${digits}` : null;
    }
    case "phone": {
      const number = raw.replace(/^tel:/i, "");
      if (!/^\+?[\d\s()./-]+$/.test(number)) return null;
      const digits = number.replace(/\D/g, "");
      if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return null;
      return `tel:${number.trim().startsWith("+") ? "+" : ""}${digits}`;
    }
  }
}

/** Which way a stored address belongs to, and what to show in its field. */
export function reachFrom(url: string): { way: ReachWay; typed: string } {
  if (/^mailto:/i.test(url)) return { way: "email", typed: url.replace(/^mailto:/i, "") };
  if (/^tel:/i.test(url)) return { way: "phone", typed: url.replace(/^tel:/i, "") };
  const whatsapp = /^https?:\/\/(?:www\.)?wa\.me\/(\d+)/i.exec(url);
  if (whatsapp) return { way: "whatsapp", typed: `+${whatsapp[1] ?? ""}` };
  return { way: "calendar", typed: url };
}

/** The label presets of a way, best first, by the kind of page: photographers are booked for shoots. */
export function reachPresets(way: ReachWay, kind: CreatorKind | undefined): ReachPreset[] {
  const work: ReachPreset = kind === "photographer" ? "shoot" : "project";
  if (way === "calendar") return kind === "photographer" ? ["shoot", "call"] : ["call", work];
  return [way, work];
}

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
 * contact block's form both use it.
 */
export function ReachInput({
  value,
  onValue,
  kind,
  labels,
  errors = {},
}: {
  value: ReachValue;
  onValue: (value: ReachValue) => void;
  kind: CreatorKind | undefined;
  /** The field names where a form has its own words (the welcome flow). */
  labels?: { address?: string | undefined; label?: string | undefined } | undefined;
  errors?: { url?: string | undefined; label?: string | undefined } | undefined;
}) {
  const t = useTranslations("app.portfolio.contact");
  const tWays = useTranslations("app.welcome.portfolio.ways");
  const tErrors = useTranslations("app.errors");
  const id = useId();
  const [state, setState] = useState(() => reachFrom(value.url));
  const [touched, setTouched] = useState(false);
  const presets = reachPresets(state.way, kind);
  const presetLabels = new Set(REACH_WAYS.flatMap((way) => reachPresets(way, kind)).map((preset) => t(`presets.${preset}`)));
  // The label follows the way while it is empty or still one of our presets.
  const ownLabel = value.label.trim() !== "" && !presetLabels.has(value.label);

  // A button needs words: the way's first preset, until the owner writes or picks others.
  const emit = (way: ReachWay, typed: string, label = value.label) => {
    const url = reachUrl(way, typed) ?? "";
    onValue({ label: label.trim() ? label : t(`presets.${reachPresets(way, kind)[0] ?? "call"}`), url, icon: reachIcon(way) });
  };
  const choose = (way: ReachWay) => {
    // A number typed for WhatsApp stays when switching to phone (and back); other addresses start over.
    const phoneLike = (way === "phone" || way === "whatsapp") && (state.way === "phone" || state.way === "whatsapp");
    const typed = phoneLike ? state.typed : "";
    setState({ way, typed });
    setTouched(false);
    emit(way, typed, ownLabel ? value.label : t(`presets.${reachPresets(way, kind)[0] ?? "call"}`));
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
          emit(way, typed, way === state.way || ownLabel ? value.label : t(`presets.${reachPresets(way, kind)[0] ?? "call"}`));
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
            const text = t(`presets.${preset}`);
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
