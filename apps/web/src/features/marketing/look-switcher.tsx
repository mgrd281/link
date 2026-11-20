"use client";

import type { CreatorButtonStyle, CreatorTemplateId } from "@linkyo/tokens";
import type { HeroStyle } from "@linkyo/tokens/creator";
import { cn, Icon, PlatformIcon } from "@linkyo/ui";
import { ArrowUpRight, Music2, Palette, ShoppingBag, Ticket } from "lucide-react";
import Image, { type StaticImageData } from "next/image";
import { useRef, useState, type KeyboardEvent } from "react";
import { siInstagram, siSpotify, siTiktok, siYoutube } from "simple-icons";

import { linkStyleClasses } from "@/features/creator/link-button";
import { displayStyle } from "@/features/directions/poster/styles";

import { phoneSizes } from "./assets";

/** One look as the theme engine resolved it (on the server, so the page needs no engine to show it). */
export interface LookOption {
  id: string;
  template: CreatorTemplateId;
  name: string;
  description: string;
  vars: Record<string, string>;
  buttonStyle: CreatorButtonStyle;
  hero: HeroStyle;
}

const LINK_ICONS = [Music2, Ticket, ShoppingBag];
const SOCIALS = [siInstagram, siTiktok, siYoutube, siSpotify];

/**
 * "A page that looks like you", to try: one small page, and the looks under it. A tap puts the page
 * in that look at once, with its colors, type, button shape and photo treatment, exactly as the
 * theme engine dresses real pages. The last button takes any color: the engine turns it into a full
 * palette that stays readable (it adjusts lightness, never the hue), which is the promise in the
 * words beside it, shown.
 *
 * The looks are a WAI-ARIA radio group (arrow keys, mirrored in Arabic). The small page is a
 * picture of a page: screen readers get the name of the look instead.
 */
export function LookSwitcher({
  looks,
  person,
  links,
  labels,
  rtl,
}: {
  looks: LookOption[];
  person: { name: string; tagline: string; photo: StaticImageData };
  links: { title: string; subtitle: string }[];
  labels: { choose: string; custom: string; customHint: string };
  rtl: boolean;
}) {
  const [active, setActive] = useState(0);
  const [custom, setCustom] = useState<LookOption | null>(null);
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  const frame = useRef(0);
  const first = looks[0];
  const look = (active === -1 ? custom : looks[active]) ?? first;
  if (!look) return null;

  const choose = (index: number, focus = false) => {
    const next = (index + looks.length) % looks.length;
    setActive(next);
    if (focus) radios.current[next]?.focus();
  };

  const onKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const reversed = getComputedStyle(event.currentTarget).direction === "rtl";
    const step = { ArrowRight: reversed ? -1 : 1, ArrowDown: 1, ArrowLeft: reversed ? 1 : -1, ArrowUp: -1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    choose(Math.max(active, 0) + step, true);
  };

  // Any color, in the look that is showing. The engine loads on first use; one result per frame
  // while the picker is being dragged.
  const pickColor = (accent: string) => {
    cancelAnimationFrame(frame.current);
    const base = look;
    frame.current = requestAnimationFrame(() => {
      void import("@linkyo/tokens/creator").then(({ resolveCreatorTheme }) => {
        const theme = resolveCreatorTheme({ template: base.template, accent }, { rtlScript: rtl });
        setCustom({ ...base, id: "custom", name: labels.custom, description: labels.customHint, vars: theme.cssVars, buttonStyle: theme.buttonStyle, hero: theme.layout.hero });
        setActive(-1);
      });
    });
  };

  return (
    <div className="grid w-full justify-items-center gap-5">
      <div
        aria-hidden
        data-look-preview
        style={look.vars}
        className="relative isolate w-full max-w-preview overflow-hidden rounded-xl border border-line bg-creator-bg font-creator-body text-creator-fg transition-colors duration-slow ease-standard motion-reduce:transition-none"
      >
        <div className={cn("relative aspect-3/2 mask-b-from-40% mask-b-to-100%", look.hero === "duotone" && "isolate bg-creator-bg")}>
          <Image
            src={person.photo}
            alt=""
            fill
            sizes={phoneSizes.hero}
            placeholder="blur"
            className={cn(
              "object-cover object-[50%_30%] transition-[filter] duration-slow ease-standard motion-reduce:transition-none",
              look.hero === "duotone" && "grayscale contrast-125 mix-blend-screen",
              look.hero === "mono" && "grayscale",
            )}
          />
        </div>
        <div className="relative -mt-10 grid justify-items-center gap-1 px-5 text-center">
          <p className="font-creator-display text-h2 leading-tight" style={displayStyle}>
            {person.name}
          </p>
          <p className="text-small text-creator-fg-muted">{person.tagline}</p>
        </div>
        <ul className="grid gap-2 p-4">
          {links.map((link, index) => {
            const LinkIcon = LINK_ICONS[index] ?? Music2;
            // The first link is the highlighted one, in the accent color, as on real pages.
            const lead = index === 0;
            const onColor = lead || look.buttonStyle === "filled";
            return (
              <li
                key={link.title}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-creator-button py-2 ps-2 pe-3 transition-colors duration-slow ease-standard motion-reduce:transition-none",
                  lead ? "bg-creator-accent text-creator-accent-fg" : linkStyleClasses[look.buttonStyle],
                )}
              >
                <span className={cn("relative grid size-8 shrink-0 place-items-center rounded-creator-button", !onColor && "text-creator-accent-text")}>
                  <span className="absolute inset-0 rounded-[inherit] bg-current opacity-pressed" />
                  <Icon icon={LinkIcon} size="sm" className="relative" />
                </span>
                <span className="grid min-w-0 flex-1 text-start leading-tight">
                  <span className="truncate text-small font-semibold">{link.title}</span>
                  <span className={cn("truncate text-caption", !onColor && "text-creator-fg-muted")}>{link.subtitle}</span>
                </span>
                <Icon icon={ArrowUpRight} size="sm" className="shrink-0 rtl:-scale-x-100" />
              </li>
            );
          })}
        </ul>
        <ul className="flex justify-center gap-2 px-4 pb-5">
          {SOCIALS.map((platform) => (
            <li key={platform.slug} className="grid size-10 place-items-center rounded-full bg-creator-surface-2 text-creator-fg transition-colors duration-slow ease-standard motion-reduce:transition-none">
              <PlatformIcon icon={platform} size="sm" />
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1">
        <div role="radiogroup" aria-label={labels.choose} className="flex items-center gap-1">
          {looks.map((option, index) => {
            const selected = index === active;
            return (
              <button
                key={option.id}
                ref={(node) => {
                  radios.current[index] = node;
                }}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={option.name}
                tabIndex={selected || (active === -1 && index === 0) ? 0 : -1}
                onClick={() => {
                  choose(index);
                }}
                onKeyDown={onKey}
                style={option.vars}
                className={cn(
                  "grid size-touch-target shrink-0 place-items-center rounded-full border-emphasis p-1 transition-[border-color,scale] duration-standard ease-standard focus-visible:focus-ring active:scale-pressed motion-reduce:transition-none",
                  selected ? "border-link" : "border-transparent hover:border-line-strong",
                )}
              >
                <span className="size-full rounded-full border border-line bg-linear-135 from-creator-bg from-50% to-creator-accent to-50%" />
              </button>
            );
          })}
        </div>
        {/* Any color: the native picker, styled as one more look. */}
        <label
          style={custom?.vars}
          className={cn(
            "relative grid size-touch-target shrink-0 cursor-pointer place-items-center rounded-full border-emphasis p-1 transition-[border-color,scale] duration-standard ease-standard has-[input:focus-visible]:focus-ring active:scale-pressed motion-reduce:transition-none",
            active === -1 ? "border-link" : "border-transparent hover:border-line-strong",
          )}
        >
          <input
            type="color"
            aria-label={labels.custom}
            onChange={(event) => {
              pickColor(event.target.value);
            }}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
          <span
            className={cn(
              "pointer-events-none grid size-full place-items-center rounded-full",
              active === -1 ? "bg-creator-accent text-creator-accent-fg" : "border border-dashed border-line-input text-fg-secondary",
            )}
          >
            <Icon icon={Palette} size="sm" />
          </span>
        </label>
      </div>
      <p aria-live="polite" className="max-w-prose text-center text-small text-pretty">
        <span className="font-semibold text-fg">{look.name}</span>
        <span className="text-fg-secondary"> · {look.description}</span>
      </p>
    </div>
  );
}
