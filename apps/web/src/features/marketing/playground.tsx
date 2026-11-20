"use client";

import { detectLink, type Detection } from "@linkyo/blocks";
import type { CreatorButtonStyle, CreatorTemplateId } from "@linkyo/tokens";
import { cn, Icon, LogoGlyph, PlatformIcon } from "@linkyo/ui";
import { ArrowRight, ArrowUpRight, CircleCheck, Clapperboard, Image as ImageIcon, Link2, Music2, Palette, Plus, Radio, ShoppingBag, Ticket, Type, Video, X, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { siSpotify, siTwitch, siYoutube, type SimpleIcon } from "simple-icons";

import { saveTryDraft } from "@/features/account/try-draft";
import { suggestUsername } from "@/features/account/username";
import { linkStyleClasses } from "@/features/creator/link-button";
import { displayStyle } from "@/features/directions/poster/styles";
import { Link } from "@/i18n/navigation";

/** One look as the theme engine resolved it (on the server, so nothing has to be computed here). */
export interface LookOption {
  id: string;
  template: CreatorTemplateId;
  name: string;
  description: string;
  vars: Record<string, string>;
  buttonStyle: CreatorButtonStyle;
}

type Tab = "name" | "links" | "look";
const TABS: { id: Tab; icon: LucideIcon }[] = [
  { id: "name", icon: Type },
  { id: "links", icon: Link2 },
  { id: "look", icon: Palette },
];

const TYPE_ICONS: Record<string, LucideIcon> = { music: Music2, video: Video, shorts: Clapperboard, events: Ticket, product: ShoppingBag, live: Radio, image: ImageIcon };
const PLATFORM_ICONS: Partial<Record<string, SimpleIcon>> = { spotify: siSpotify, youtube: siYoutube, twitch: siTwitch };
const KNOWN = new Set(["music", "video", "shorts", "events", "product", "live", "image", "card", "link"]);
const MAX_LINKS = 4;

const EXAMPLES = [
  { label: "Spotify", url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC", icon: siSpotify },
  { label: "YouTube", url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ", icon: siYoutube },
  { label: "Twitch", url: "https://www.twitch.tv/milaaurel", icon: siTwitch },
  { label: "Shop", url: "https://shop.milaaurel.com/products/nachtstrom-vinyl", icon: null },
] as const;

/** What the playground shows by itself, once: a name typed, two links pasted, a look picked. */
const TOUR = { name: "Juno Kade", links: [EXAMPLES[0].url, EXAMPLES[1].url], look: "pulse" } as const;

interface Added {
  key: string;
  url: string;
  type: string;
  platform: string | undefined;
}

const typeKey = (detection: Detection): string => (KNOWN.has(detection.type) ? detection.type : "link");

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0]?.toLocaleUpperCase() ?? "")
    .join("");

function BlockIcon({ type, platform }: { type: string; platform: string | undefined }) {
  const mark = platform ? PLATFORM_ICONS[platform] : undefined;
  return mark ? <PlatformIcon icon={mark} size="sm" /> : <Icon icon={TYPE_ICONS[type] ?? Link2} size="sm" />;
}

/**
 * The page as it would look: the initials in the accent color (as new pages start, before a photo),
 * the name, the address, the links as buttons in the look's style, and Linkyo's mark at the foot.
 */
function Preview({ look, name, address, items, labels }: { look: LookOption; name: string; address: string; items: Added[]; labels: { name: string; empty: string; type: (type: string) => string } }) {
  return (
    <div
      aria-hidden
      data-try-preview
      style={look.vars}
      className="relative isolate aspect-short w-full overflow-hidden rounded-xl border border-line bg-creator-bg font-creator-body text-creator-fg transition-colors duration-slow ease-standard motion-reduce:transition-none"
    >
      <div className="absolute inset-x-0 top-0 h-1/3 bg-linear-to-b from-creator-surface-2 to-transparent" />
      <div className="relative flex h-full flex-col items-center gap-1 px-4 pt-8 pb-4 text-center">
        <span className="mb-2 grid size-16 shrink-0 place-items-center rounded-full bg-creator-accent font-creator-display text-h3 text-creator-accent-fg transition-colors duration-slow ease-standard motion-reduce:transition-none">
          {initials(name) || <Icon icon={Type} size="md" />}
        </span>
        <p className={cn("max-w-full truncate font-creator-display text-h3 leading-tight", !name.trim() && "opacity-secondary")} style={displayStyle}>
          {name.trim() || labels.name}
        </p>
        <p dir="ltr" className="max-w-full truncate text-caption text-creator-fg-muted">
          linkyo.app/{address || "…"}
        </p>
        <ul className="mt-4 grid w-full gap-2">
          {items.length === 0
            ? [0, 1, 2].map((row) => (
                <li key={row} className="grid min-h-control-md place-items-center rounded-creator-button border border-dashed border-creator-line-strong text-caption text-creator-fg-muted">
                  {row === 0 ? labels.empty : null}
                </li>
              ))
            : items.map((item, index) => {
                // The first link is the highlighted one, in the accent color, as on real pages.
                const lead = index === 0;
                const onColor = lead || look.buttonStyle === "filled";
                return (
                  <li
                    key={item.key}
                    className={cn(
                      "flex min-h-control-md items-center gap-2 rounded-creator-button py-1 ps-1 pe-3 transition-colors duration-slow ease-standard motion-safe:animate-pop-in motion-reduce:transition-none",
                      lead ? "bg-creator-accent text-creator-accent-fg" : linkStyleClasses[look.buttonStyle],
                    )}
                  >
                    <span className={cn("relative grid size-8 shrink-0 place-items-center rounded-creator-button", !onColor && "text-creator-accent-text")}>
                      <span className="absolute inset-0 rounded-[inherit] bg-current opacity-pressed" />
                      <span className="relative">
                        <BlockIcon type={item.type} platform={item.platform} />
                      </span>
                    </span>
                    <span className="min-w-0 flex-1 truncate text-start text-small font-semibold">{labels.type(item.type)}</span>
                    <Icon icon={ArrowUpRight} size="sm" className="shrink-0 rtl:-scale-x-100" />
                  </li>
                );
              })}
        </ul>
        <p className="mt-auto inline-flex items-center gap-1 pt-3 text-caption text-creator-fg-muted">
          <LogoGlyph className="size-3" />
          linkyo
        </p>
      </div>
    </div>
  );
}

/**
 * Try Linkyo before signing up: a name, links and a look in three tabs, and the page that grows from
 * them beside it (above it on phones, so both fit one screen). Links go through the real detector;
 * looks are the real theme engine, and the last swatch takes any color.
 *
 * The first time it scrolls into view it fills itself in once (a name typed, two links pasted, a
 * look picked) and stops for good at the visitor's first touch; what it typed stays and is selected
 * on focus, so typing replaces it. "Keep this page" goes to sign-up with the address, name and look;
 * the links follow in this tab's session storage to the welcome flow (try-draft.ts).
 */
export function Playground({ looks, rtl }: { looks: [LookOption, ...LookOption[]]; rtl: boolean }) {
  const t = useTranslations("marketing.try");
  const tPaste = useTranslations("marketing.paste");
  const tLook = useTranslations("marketing.features.look");
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  const touched = useRef(false);
  const frame = useRef(0);
  const [tab, setTab] = useState<Tab>("name");
  const [name, setName] = useState("");
  const [draft, setDraft] = useState("");
  const [items, setItems] = useState<Added[]>([]);
  const [error, setError] = useState<"invalid" | "limit" | null>(null);
  const [lookIndex, setLookIndex] = useState(0);
  const [custom, setCustom] = useState<{ look: LookOption; accent: string } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const look = (lookIndex === -1 ? custom?.look : looks[lookIndex]) ?? looks[0];
  const detection = draft.trim() ? detectLink(draft.trim()) : null;
  const address = suggestUsername(name);
  const typeLabel = (type: string) => tPaste(`types.${type}`);

  const add = (text: string, quietly = false) => {
    const found = text.trim() ? detectLink(text.trim()) : null;
    if (!found) {
      setError("invalid");
      return;
    }
    if (items.length >= MAX_LINKS) {
      setError("limit");
      return;
    }
    const type = typeKey(found);
    setItems((current) => [...current, { key: `${Date.now()}-${current.length}`, url: found.url, type, platform: found.platform }].slice(0, MAX_LINKS));
    if (!quietly) setAnnouncement(tPaste("added", { type: typeLabel(type) }));
    setDraft("");
    setError(null);
  };

  // The tour, once, when most of the playground is on screen, unless someone got there first.
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const timers: number[] = [];
    const at = (ms: number, run: () => void) => {
      timers.push(
        window.setTimeout(() => {
          if (!touched.current) run();
        }, ms),
      );
    };
    const pulse = Math.max(
      0,
      looks.findIndex((option) => option.id === TOUR.look),
    );
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || touched.current) return;
        observer.disconnect();
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          // No motion: the finished example at once.
          setName(TOUR.name);
          setItems(TOUR.links.map((url, index) => ({ key: `tour-${index}`, url, type: typeKey(detectLink(url) ?? { type: "link", url, label: url }), platform: detectLink(url)?.platform })));
          setLookIndex(pulse);
          return;
        }
        let time = 500;
        Array.from(TOUR.name).forEach((_, index) => {
          time += 70;
          at(time, () => {
            setName(TOUR.name.slice(0, index + 1));
          });
        });
        time += 600;
        at(time, () => {
          setTab("links");
        });
        TOUR.links.forEach((url) => {
          time += 500;
          at(time, () => {
            setDraft(url);
          });
          time += 900;
          at(time, () => {
            const found = detectLink(url);
            if (found) setItems((current) => [...current, { key: `tour-${current.length}`, url: found.url, type: typeKey(found), platform: found.platform }]);
            setDraft("");
          });
        });
        time += 700;
        at(time, () => {
          setTab("look");
        });
        time += 700;
        at(time, () => {
          setLookIndex(pulse);
        });
      },
      { threshold: 0.4 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      timers.forEach((timer) => {
        window.clearTimeout(timer);
      });
    };
  }, [looks]);

  /** The visitor took over: the tour stops where it is. */
  const takeOver = () => {
    touched.current = true;
  };

  const showTab = (index: number, focus = false) => {
    const next = TABS[(index + TABS.length) % TABS.length];
    if (!next) return;
    setTab(next.id);
    if (focus) tabs.current[TABS.indexOf(next)]?.focus();
  };
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const reversed = getComputedStyle(event.currentTarget).direction === "rtl";
    const current = TABS.findIndex((entry) => entry.id === tab);
    const step = { ArrowRight: reversed ? -1 : 1, ArrowLeft: reversed ? 1 : -1 }[event.key];
    if (step !== undefined) showTab(current + step, true);
    else if (event.key === "Home") showTab(0, true);
    else if (event.key === "End") showTab(TABS.length - 1, true);
    else return;
    event.preventDefault();
  };

  const chooseLook = (index: number, focus = false) => {
    const next = (index + looks.length) % looks.length;
    setLookIndex(next);
    if (focus) radios.current[next]?.focus();
  };
  const onLookKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const reversed = getComputedStyle(event.currentTarget).direction === "rtl";
    const step = { ArrowRight: reversed ? -1 : 1, ArrowDown: 1, ArrowLeft: reversed ? 1 : -1, ArrowUp: -1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    chooseLook(Math.max(lookIndex, 0) + step, true);
  };
  // Any color, in the look that is showing; the engine loads on first use, one result per frame.
  const pickColor = (accent: string) => {
    cancelAnimationFrame(frame.current);
    const base = look;
    frame.current = requestAnimationFrame(() => {
      void import("@linkyo/tokens/creator").then(({ resolveCreatorTheme }) => {
        const theme = resolveCreatorTheme({ template: base.template, accent }, { rtlScript: rtl });
        setCustom({ look: { ...base, id: "custom", name: tLook("custom"), description: tLook("customHint"), vars: theme.cssVars, buttonStyle: theme.buttonStyle }, accent });
        setLookIndex(-1);
      });
    });
  };

  const params = new URLSearchParams();
  if (address) params.set("name", address);
  if (name.trim()) params.set("display", name.trim());
  params.set("template", look.template);
  if (lookIndex === -1 && custom) params.set("accent", custom.accent.replace("#", ""));
  const signup = `/signup?${params.toString()}`;

  const tabId = (entry: Tab) => `${id}-tab-${entry}`;
  const panelId = (entry: Tab) => `${id}-panel-${entry}`;
  const panel = (entry: Tab) => ({
    id: panelId(entry),
    role: "tabpanel" as const,
    "aria-labelledby": tabId(entry),
    inert: tab !== entry,
    // All panels share one cell, so switching tabs never changes the card's height.
    className: cn("col-start-1 row-start-1 grid content-start gap-3 transition-opacity duration-standard ease-standard motion-reduce:transition-none", tab === entry ? "opacity-100" : "invisible opacity-0"),
  });

  return (
    <div
      ref={root}
      onPointerDownCapture={takeOver}
      onFocusCapture={takeOver}
      onKeyDownCapture={takeOver}
      className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16"
    >
      {/* The page, above the controls on phones and beside them on wide screens. */}
      <div className="relative grid place-items-center py-2 lg:order-last">
        <div aria-hidden className="mk-deck-halo w-[150%] border border-line max-lg:hidden" />
        <div aria-hidden className="mk-deck-halo w-[120%] bg-tint-teal max-lg:hidden" />
        <div className="relative w-full max-w-menu lg:max-w-sidebar">
          <Preview look={look} name={name} address={address} items={items} labels={{ name: t("preview.name"), empty: t("preview.empty"), type: typeLabel }} />
        </div>
      </div>

      <div className="grid w-full max-w-prose gap-4 justify-self-center rounded-xl border border-line bg-surface p-3 sm:p-5 lg:justify-self-start">
        <div role="tablist" aria-label={t("tabs.label")} className="grid grid-cols-3 gap-1 rounded-full bg-canvas-muted p-1">
          {TABS.map((entry, index) => {
            const selected = tab === entry.id;
            return (
              <button
                key={entry.id}
                ref={(node) => {
                  tabs.current[index] = node;
                }}
                id={tabId(entry.id)}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId(entry.id)}
                tabIndex={selected ? 0 : -1}
                onClick={() => {
                  setTab(entry.id);
                }}
                onKeyDown={onTabKey}
                className={cn(
                  "inline-flex h-control-md min-w-0 items-center justify-center gap-2 rounded-full border text-small font-semibold transition-colors duration-micro focus-visible:focus-ring",
                  selected ? "border-line bg-surface-elevated text-fg" : "border-transparent text-fg-secondary hover:text-fg",
                )}
              >
                <Icon icon={entry.icon} size="sm" />
                <span className="truncate">{t(`tabs.${entry.id}`)}</span>
                {entry.id === "links" && items.length > 0 ? (
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-caption text-primary-fg tabular-nums">{items.length}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="grid">
          <div {...panel("name")}>
            <label htmlFor={`${id}-name`} className="text-small font-semibold">
              {t("name.label")}
            </label>
            <input
              id={`${id}-name`}
              value={name}
              onChange={(event) => {
                setName(event.target.value.slice(0, 60));
              }}
              onFocus={(event) => {
                if (event.currentTarget.value === TOUR.name) event.currentTarget.select();
              }}
              maxLength={60}
              autoComplete="name"
              placeholder={t("name.placeholder")}
              className="h-control-lg w-full rounded-full border border-transparent bg-canvas-muted px-4 text-body text-fg outline-none transition-colors duration-micro placeholder:text-fg-tertiary focus-visible:border-link focus-visible:focus-ring"
            />
            <p className="flex min-w-0 items-center gap-2 px-4 text-small text-fg-secondary">
              <Icon icon={Link2} size="sm" className="shrink-0" />
              <span className="truncate">{t("name.address", { address: `linkyo.app/${address || "…"}` })}</span>
            </p>
          </div>

          <div {...panel("links")}>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                add(draft);
              }}
              className="grid gap-1"
            >
              <label htmlFor={`${id}-link`} className="sr-only">
                {tPaste("label")}
              </label>
              <div className="flex h-control-lg items-center gap-2 rounded-full border border-transparent bg-canvas-muted ps-4 pe-1 transition-colors duration-micro has-[input:focus-visible]:border-link has-[input:focus-visible]:focus-ring">
                <Icon icon={Link2} size="md" className="shrink-0 text-fg-tertiary" />
                <input
                  id={`${id}-link`}
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    setError(null);
                  }}
                  onFocus={(event) => {
                    const field = event.currentTarget;
                    if (TOUR.links.some((url) => url === field.value)) field.select();
                  }}
                  onPaste={(event) => {
                    const text = event.clipboardData.getData("text");
                    if (detectLink(text.trim())) {
                      event.preventDefault();
                      add(text);
                    }
                  }}
                  dir="ltr"
                  inputMode="url"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={tPaste("placeholder")}
                  aria-invalid={error === "invalid" || undefined}
                  aria-describedby={`${id}-link-hint`}
                  className="h-full min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-fg-tertiary"
                />
                <button
                  type="submit"
                  aria-label={tPaste("add")}
                  className="grid size-control-md shrink-0 place-items-center rounded-full bg-primary text-primary-fg transition-[background-color,scale] duration-micro hover:bg-primary-hover focus-visible:focus-ring active:scale-pressed"
                >
                  <Icon icon={Plus} size="md" />
                </button>
              </div>
              <p id={`${id}-link-hint`} className={cn("flex min-h-6 items-center gap-2 px-4 text-small", error ? "text-danger-strong" : "text-link")}>
                {error === "invalid" ? (
                  tPaste("invalid")
                ) : error === "limit" ? (
                  t("limit")
                ) : detection ? (
                  <span key={detection.type} className="inline-flex items-center gap-2 font-semibold motion-safe:animate-fade-in">
                    <Icon icon={CircleCheck} size="sm" />
                    {tPaste("detected", { type: typeLabel(typeKey(detection)) })}
                  </span>
                ) : null}
              </p>
            </form>
            <div role="group" aria-label={tPaste("examples")} className="mk-no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
              {EXAMPLES.map((example) => (
                <button
                  key={example.label}
                  type="button"
                  onClick={() => {
                    add(example.url);
                  }}
                  className="inline-flex h-control-sm shrink-0 items-center gap-2 rounded-full border border-line bg-surface ps-2 pe-3 text-small font-medium text-fg transition-[border-color,background-color,scale] duration-micro hover:border-line-strong hover:bg-hover focus-visible:focus-ring active:scale-pressed"
                >
                  {example.icon ? <PlatformIcon icon={example.icon} size="sm" /> : <Icon icon={ShoppingBag} size="sm" />}
                  {example.label}
                </button>
              ))}
            </div>
            {items.length > 0 ? (
              <ul aria-label={t("added")} className="mk-no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
                {items.map((item) => (
                  <li key={item.key} className="inline-flex h-control-sm shrink-0 items-center gap-2 rounded-full bg-selected ps-3 pe-1 text-small font-medium text-selected-fg">
                    <BlockIcon type={item.type} platform={item.platform} />
                    {typeLabel(item.type)}
                    <button
                      type="button"
                      onClick={() => {
                        setItems((current) => current.filter((candidate) => candidate.key !== item.key));
                        setError(null);
                      }}
                      aria-label={tPaste("remove", { title: typeLabel(item.type) })}
                      className="grid size-6 place-items-center rounded-full transition-colors duration-micro hover:bg-hover focus-visible:focus-ring"
                    >
                      <Icon icon={X} size="sm" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div {...panel("look")}>
            <div className="flex flex-wrap items-center gap-1">
              <div role="radiogroup" aria-label={tLook("choose")} className="flex items-center gap-1">
                {looks.map((option, index) => {
                  const selected = index === lookIndex;
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
                      tabIndex={selected || (lookIndex === -1 && index === 0) ? 0 : -1}
                      onClick={() => {
                        chooseLook(index);
                      }}
                      onKeyDown={onLookKey}
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
              <label
                style={custom?.look.vars}
                className={cn(
                  "relative grid size-touch-target shrink-0 cursor-pointer place-items-center rounded-full border-emphasis p-1 transition-[border-color,scale] duration-standard ease-standard has-[input:focus-visible]:focus-ring active:scale-pressed motion-reduce:transition-none",
                  lookIndex === -1 ? "border-link" : "border-transparent hover:border-line-strong",
                )}
              >
                <input
                  type="color"
                  aria-label={tLook("custom")}
                  onChange={(event) => {
                    pickColor(event.target.value);
                  }}
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                />
                <span className={cn("pointer-events-none grid size-full place-items-center rounded-full", lookIndex === -1 ? "bg-creator-accent text-creator-accent-fg" : "border border-dashed border-line-input text-fg-secondary")}>
                  <Icon icon={Palette} size="sm" />
                </span>
              </label>
            </div>
            <p aria-live="polite" className="text-small text-pretty">
              <span className="font-semibold text-fg">{look.name}</span>
              <span className="text-fg-secondary"> · {look.description}</span>
            </p>
          </div>
        </div>

        <div className="grid gap-2 border-t border-line pt-4">
          <Link
            href={signup}
            onClick={() => {
              saveTryDraft({ name: name.trim(), links: items.map((item) => item.url) });
            }}
            className="group inline-flex h-control-xl items-center justify-center gap-2 rounded-full bg-primary px-6 text-body font-semibold text-primary-fg transition-[background-color,scale] duration-micro hover:bg-primary-hover focus-visible:focus-ring active:scale-pressed"
          >
            {t("cta")}
            <Icon icon={ArrowRight} size="md" className="transition-transform duration-micro group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
          </Link>
          <p className="text-center text-caption text-fg-secondary">{t("ctaHint")}</p>
        </div>
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
