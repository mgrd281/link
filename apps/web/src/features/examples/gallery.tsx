"use client";

import { tokens } from "@linkyo/tokens";
import { Button, cn, Icon, IconButton, Kbd, Segmented, Spinner } from "@linkyo/ui";
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Globe, LayoutGrid, Pause, Play, Search, SearchX, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type Dispatch,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from "react";

import { ScrollRow } from "@/components/scroll-row";
import { Link } from "@/i18n/navigation";
import { useDragToDismiss } from "@/features/app/sheet";
import { haptic } from "@/lib/haptics";
import { touchSegmented } from "@/lib/touch";

import { CardFace, CATEGORY_ICONS, type GalleryItem } from "./gallery-card";
import { CATEGORIES, type Category } from "./looks";

export type { GalleryItem } from "./gallery-card";

type Language = GalleryItem["locale"] | "all";
const LANGUAGES = ["de", "en", "ar"] as const;

/** Lower case, accents and Arabic vowel marks removed: "backerei" finds "Bäckerei". */
const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const motion = (): ScrollBehavior => (reducedMotion() ? "auto" : "smooth");

/** Keys typed into a field stay there (also inside the previewed page, another window). */
const typing = (target: EventTarget | null) =>
  target !== null && "closest" in target && (target as Element).closest("input, textarea, select, [contenteditable]") !== null;

/** Widgets in a previewed page that use the arrow keys themselves (month tabs, scrolling rails, players). */
const ARROW_WIDGETS = "[role=tablist], [role=radiogroup], [role=slider], [role=listbox], [role=menu], [role=grid], [role=region], [role=toolbar], video, audio";
const ownsArrows = (target: EventTarget | null) =>
  target !== null && "closest" in target && (target as Element).closest(ARROW_WIDGETS) !== null;

/** The search box. On phones it sits above the filters; on larger screens inside the sticky bar. */
function SearchField({
  id,
  value,
  onChange,
  className,
  ref,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  ref: RefObject<HTMLInputElement | null>;
}) {
  const t = useTranslations("examples.search");
  return (
    <div className={cn("relative flex items-center", className)}>
      <label htmlFor={id} className="sr-only">
        {t("label")}
      </label>
      <Icon icon={Search} size="sm" className="pointer-events-none absolute start-4 text-fg-secondary" />
      <input
        ref={ref}
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("placeholder")}
        autoComplete="off"
        enterKeyHint="search"
        aria-keyshortcuts="/"
        className="h-control-md w-full appearance-none rounded-full border border-transparent bg-canvas-muted ps-10 pe-10 text-body text-fg transition-colors duration-micro placeholder:text-fg-secondary hover:border-line-strong focus-visible:border-focus focus-visible:bg-surface focus-visible:focus-field pointer-coarse:h-touch-target sm:text-small [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange("");
            ref.current?.focus();
          }}
          aria-label={t("clear")}
          className="absolute end-1 grid size-control-sm place-items-center rounded-full text-fg-secondary transition-colors duration-micro hover:bg-hover hover:text-fg focus-visible:focus-ring pointer-coarse:end-0 pointer-coarse:size-touch-target"
        >
          <Icon icon={X} size="sm" />
        </button>
      ) : (
        <Kbd aria-hidden title={t("shortcut")} className="pointer-events-none absolute end-3 pointer-coarse:hidden">
          /
        </Kbd>
      )}
    </div>
  );
}

/**
 * The categories in one row, each with its icon and how many pages match. Scrolls sideways; arrows
 * appear on larger screens when there is more, and the row fades out at the edges (ScrollRow).
 * A chip that would find nothing stays reachable but steps back (its count hidden).
 */
function CategoryBar({
  value,
  onChange,
  counts,
  total,
}: {
  value: Category | "all";
  onChange: (next: Category | "all") => void;
  counts: Record<Category, number>;
  total: number;
}) {
  const t = useTranslations("examples");
  return (
    <ScrollRow label={t("filter")} labels={{ back: t("scroll.back"), next: t("scroll.next") }} fade="from-canvas" className="min-w-0 flex-1">
      {(["all", ...CATEGORIES] as const).map((key) => {
        const count = key === "all" ? total : counts[key];
        return (
          <button
            key={key}
            type="button"
            aria-pressed={value === key}
            data-empty={count === 0 && value !== key ? "" : undefined}
            // Keyboard focus never lands under the row's fading edge or its arrow.
            onFocus={(event) => event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest", behavior: motion() })}
            onClick={(event) => {
              onChange(key);
              event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest", behavior: motion() });
            }}
            // A 44 px target on touch: the chip stays 40 px and the invisible extension reaches into the row's own padding.
            className="group relative inline-flex h-control-md shrink-0 items-center gap-2 rounded-full bg-canvas-muted ps-3 pe-2 text-small font-medium text-fg-secondary transition-[background-color,color,scale] duration-micro ease-spring before:absolute before:inset-0 pointer-coarse:before:-inset-0.5 hover:bg-selected hover:text-fg focus-visible:focus-ring active:scale-pressed aria-pressed:bg-primary aria-pressed:text-primary-fg aria-pressed:hover:bg-primary-hover aria-pressed:hover:text-primary-fg data-empty:text-fg-tertiary"
          >
            <Icon icon={key === "all" ? LayoutGrid : CATEGORY_ICONS[key]} size="sm" />
            {key === "all" ? t("all") : t(`categories.${key}`)}
            <span className="min-w-6 rounded-full bg-surface px-2 py-0.5 text-center text-caption text-fg-secondary tabular-nums transition-colors duration-micro ease-standard group-aria-pressed:bg-primary-fg group-aria-pressed:text-primary group-data-empty:hidden">
              {count}
            </span>
          </button>
        );
      })}
    </ScrollRow>
  );
}

/** How fast a previewed page scrolls by itself (px per ms): a calm read, a long page in about half a minute. */
const GLIDE = 0.12;
/** A long frame (a busy moment, a tab coming back) moves the page no more than two frames would. */
const FRAME_CAP = 34;

/**
 * Once a previewed page has loaded, it scrolls down by itself, top to bottom, as someone reading it
 * would (the page's own scroll, so its sections rise in as they would for a visitor). It eases in and
 * out (as the glide easing), once, never in a loop. The visitor takes over at any time: a wheel turn,
 * a touch, a click or a key in the page, or any key or tap in the preview around it, pauses it; the
 * pause button does the same and starts it again (WCAG 2.2.2). Reduced motion: it never starts.
 * Reaching the end pauses it too, and marks `ended`, so turning to the next page starts that one.
 * Only our own page is touched: after a link in it was followed, the frame holds another site.
 */
function useAutoScroll(
  frame: RefObject<HTMLIFrameElement | null>,
  page: string | null,
  paused: boolean,
  setPaused: Dispatch<SetStateAction<boolean>>,
  ended: RefObject<boolean>,
) {
  useEffect(() => {
    const element = frame.current;
    const doc = element?.contentDocument;
    const view = doc?.defaultView;
    if (!element || !doc || !view || !page || paused || reducedMotion()) return;
    let raf = 0;
    let began = 0;
    let last = 0;
    let position = view.scrollY;
    const root = doc.documentElement;
    let end = root.scrollHeight - view.innerHeight;
    // At the end already (played through before): start again from the top.
    if (position >= end - 1) {
      view.scrollTo(0, 0);
      position = 0;
    }
    // The page's height is read when it changes, not in every frame (no layout work while gliding).
    const resize = new ResizeObserver(() => {
      end = root.scrollHeight - view.innerHeight;
    });
    resize.observe(root);
    const glide = (time: number) => {
      // A link in the page was followed (with a screen reader, say, so nothing paused it): stop here.
      if (element.contentDocument !== doc) return;
      if (!began) began = time;
      const elapsed = last ? Math.min(time - last, FRAME_CAP) : 0;
      last = time;
      const k = Math.min(1, (time - began) / tokens.motion.duration.reveal);
      const rampIn = k * k * (3 - 2 * k);
      const rampOut = Math.min(1, Math.max(0.15, (end - position) / (view.innerHeight / 2)));
      position = Math.min(end, position + elapsed * GLIDE * rampIn * rampOut);
      view.scrollTo(0, position);
      if (position >= end) {
        ended.current = true;
        setPaused(true);
        return;
      }
      raf = requestAnimationFrame(glide);
    };
    const takeOver = () => setPaused(true);
    const interactions = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    for (const type of interactions) view.addEventListener(type, takeOver, { passive: true });
    const onVisibility = () => {
      last = 0;
    };
    document.addEventListener("visibilitychange", onVisibility);
    // The first screen stays a moment before the page starts to move; a resumed page goes on at once.
    const start = window.setTimeout(
      () => {
        raf = requestAnimationFrame(glide);
      },
      position > 0 ? 0 : tokens.motion.delay.glide,
    );
    return () => {
      window.clearTimeout(start);
      cancelAnimationFrame(raf);
      resize.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      // The frame may hold another site by now; its window is out of reach then, and so are the listeners.
      if (element.contentDocument === doc) for (const type of interactions) view.removeEventListener(type, takeOver);
    };
  }, [frame, page, paused, setPaused, ended]);
}

/** Cards per step: a full last row with two, three or four columns. */
const STEP = 12;

/**
 * A link may name a category ("/templates?category=portfolio#gallery", from the Portfolio page): the
 * gallery opens with that chip chosen. Read in the browser only, so the page stays static.
 */
const askedCategory = (): Category | null => {
  const asked = new URLSearchParams(window.location.search).get("category");
  return CATEGORIES.find((key) => key === asked) ?? null;
};
const stayPut = () => () => undefined;

/**
 * The gallery: the still wall of pages next to the intro, then search, language and category filters
 * over a grid of cards. A card opens a phone-sized preview to flip through (buttons or arrow keys),
 * use as a template (sign-up starts with exactly that look) or open in full. On phones the preview is
 * a sheet: pull it down to close it.
 *
 * The grid shows twelve cards, then twelve more at each "Show more" (any filter starts over at
 * twelve): the page opens fast and stays easy to scan; the preview still flips through all results.
 */
export function ExampleGallery({ items, intro, wall }: { items: GalleryItem[]; intro: ReactNode; wall: ReactNode }) {
  const t = useTranslations("examples");
  const locale = useLocale();
  // The chip the visitor chose; until then the one the address names, else "all".
  const asked = useSyncExternalStore(stayPut, askedCategory, () => null);
  const [chosen, setCategory] = useState<Category | "all" | null>(null);
  const category = chosen ?? asked ?? "all";
  const [language, setLanguage] = useState<Language>("all");
  const [query, setQuery] = useState("");
  // The grid follows the search once typing pauses: the results come in as one wave, not card by card.
  const [settled, setSettled] = useState("");
  const [open, setOpen] = useState<GalleryItem | null>(null);
  // The page the sheet shows: it stays while the sheet slides away, so a closing sheet is never empty.
  const [sheet, setSheet] = useState<GalleryItem | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  const [limit, setLimit] = useState(STEP);
  const [paused, setPaused] = useState(false);
  const [stepped, setStepped] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);
  // The pages' own typefaces load once the first screen is done (see data-fonts in globals.css).
  const [faces, setFaces] = useState(false);
  const grid = useRef<HTMLUListElement>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const searchWide = useRef<HTMLInputElement>(null);
  const searchPhone = useRef<HTMLInputElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const lastShown = useRef<string | null>(null);
  const warmed = useRef(new Set<string>());
  const frameKey = useRef<(event: globalThis.KeyboardEvent) => void>(() => undefined);
  // The glide stopped because the page was read to its end (not because the visitor paused it).
  const ended = useRef(false);

  useEffect(() => {
    const id = window.setTimeout(() => setSettled(query), tokens.motion.duration.standard);
    return () => window.clearTimeout(id);
  }, [query]);

  useEffect(() => {
    const go = () => window.setTimeout(() => setFaces(true), 0);
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
    return () => window.removeEventListener("load", go);
  }, []);

  useEffect(() => {
    if (open) lastShown.current = open.slug;
  }, [open]);

  // A chip chosen by the address may sit past the edge of the sideways row: bring it to the middle
  // of the row (the row scrolls, the page does not).
  useEffect(() => {
    if (!asked) return;
    const chip = document.querySelector<HTMLElement>('#gallery [role="group"] button[aria-pressed="true"]');
    const row = chip?.parentElement;
    if (!chip || !row) return;
    const at = chip.getBoundingClientRect();
    const frame = row.getBoundingClientRect();
    row.scrollBy({ left: (at.left + at.right) / 2 - (frame.left + frame.right) / 2, behavior: "auto" });
  }, [asked]);

  const label = (item: GalleryItem) => (item.badge ? t(`badges.${item.badge}`) : t(`categories.${item.category}`));
  const haystack = useMemo(
    () =>
      new Map(
        items.map((item) => [
          item.slug,
          fold(
            [
              item.name,
              item.tagline,
              item.keywords ?? "",
              t(`categories.${item.category}`),
              item.badge ? t(`badges.${item.badge}`) : "",
              t(`languages.${item.locale}`),
              ...item.links,
            ].join(" "),
          ),
        ]),
      ),
    [items, t],
  );

  const terms = fold(settled).split(/\s+/).filter(Boolean);
  const matching = items.filter(
    (item) =>
      (language === "all" || item.locale === language) &&
      terms.every((term) => haystack.get(item.slug)?.includes(term)),
  );
  const shown = category === "all" ? matching : matching.filter((item) => item.category === category);
  const counts = Object.fromEntries(
    CATEGORIES.map((key) => [key, matching.filter((item) => item.category === key).length]),
  ) as Record<Category, number>;

  // After a filter change deep down the grid, bring the top of the results back into view: smoothly
  // when it is close, at once when it is far (the cards' entrance carries the motion then).
  const settle = (behavior: ScrollBehavior = motion()) => {
    const element = anchor.current;
    if (!element) return;
    const top = element.getBoundingClientRect().top;
    if (top < 0) element.scrollIntoView({ block: "start", behavior: -top > window.innerHeight ? "auto" : behavior });
  };
  const reset = () => {
    setQuery("");
    setSettled("");
    setLanguage("all");
    setCategory("all");
    setLimit(STEP);
  };
  const visible = shown.slice(0, limit);
  const more = Math.min(STEP, shown.length - visible.length);
  /** Twelve more; focus goes to the first new card, and the first new row comes fully into view. */
  const showMore = () => {
    const first = limit;
    setLimit(limit + STEP);
    requestAnimationFrame(() => {
      const card = grid.current?.querySelectorAll<HTMLButtonElement>(":scope > li > button")[first];
      card?.focus({ preventScroll: true });
      card?.scrollIntoView({ block: "nearest", behavior: motion() });
    });
  };

  /** Fetches a page ahead of time (on hover, focus or touch), so its preview opens fast. */
  const warm = (item: GalleryItem | undefined) => {
    if (!item || warmed.current.has(item.slug)) return;
    warmed.current.add(item.slug);
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "document";
    link.href = `/${item.locale}/p/${item.slug}`;
    document.head.append(link);
  };

  const current = open ?? sheet;
  const deck = current && shown.includes(current) ? shown : items;
  const position = current ? deck.indexOf(current) : -1;
  const show = (item: GalleryItem) => {
    if (open?.slug !== item.slug) setLoaded(null);
    setOpen(item);
    setSheet(item);
  };
  const openCard = (item: GalleryItem, button: HTMLButtonElement) => {
    haptic();
    opener.current = button;
    setStepped(false);
    ended.current = false;
    setPaused(false);
    setDirection(1);
    setLoaded(null);
    setOpen(item);
    setSheet(item);
  };
  const close = () => setOpen(null);
  const step = (delta: 1 | -1) => {
    if (position < 0) return;
    const next = deck[(position + delta + deck.length) % deck.length];
    if (!next || next === open) return;
    // A page read to its end does not keep the next one still: stepping on starts the glide again.
    if (ended.current) {
      ended.current = false;
      setPaused(false);
    }
    // The next page comes in from the side it was asked for (mirrored in Arabic).
    const rtl = document.documentElement.dir === "rtl";
    setDirection(rtl ? (delta === 1 ? -1 : 1) : delta);
    setStepped(true);
    show(next);
  };
  const stepByKey = (key: string, rtl: boolean) => step((key === "ArrowRight") !== rtl ? 1 : -1);

  // Keys pressed inside the previewed page (another window) still close the preview or turn the page.
  useEffect(() => {
    frameKey.current = (event) => {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      // The page's own tabs, rails and players keep their arrow keys.
      if (event.defaultPrevented || typing(event.target) || ownsArrows(event.target)) return;
      event.preventDefault();
      stepByKey(event.key, document.documentElement.dir === "rtl");
    };
  });

  const onDialogKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      if (typing(event.target)) return;
      event.preventDefault();
      stepByKey(event.key, getComputedStyle(event.currentTarget).direction === "rtl");
      return;
    }
    // With the preview itself focused, the scroll keys scroll the page inside it.
    const view = frame.current?.contentDocument?.defaultView;
    if (!view || event.target !== event.currentTarget) return;
    const screen = view.innerHeight * 0.85;
    const line = view.innerHeight / 10;
    const by: Partial<Record<string, number>> = { ArrowDown: line, ArrowUp: -line, PageDown: screen, PageUp: -screen, " ": event.shiftKey ? -screen : screen };
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      view.scrollTo({ top: event.key === "Home" ? 0 : view.document.documentElement.scrollHeight, behavior: motion() });
      return;
    }
    const delta = by[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    view.scrollBy({ top: delta, behavior: motion() });
  };

  // "/" jumps to the search box while focus is in the gallery (a single-key shortcut, so only there: WCAG 2.1.4).
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || typing(event.target)) return;
      if (!(event.target instanceof Node && section.current?.contains(event.target))) return;
      const field = [searchWide.current, searchPhone.current].find((input) => input?.offsetParent);
      if (!field) return;
      event.preventDefault();
      field.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The previewed page scrolls down by itself once it has loaded (see useAutoScroll).
  useAutoScroll(frame, open !== null && loaded === open.slug ? open.slug : null, paused, setPaused, ended);
  // The preview on phones: pull it down (its top bar or its action panel) to close it, as with every sheet.
  const { content: previewSheet, overlay: previewScrim, handle: previewHandle } = useDragToDismiss(close);
  const searchProps = {
    value: query,
    onChange: (next: string) => {
      setQuery(next);
      setLimit(STEP);
      settle("auto");
    },
  };
  const languageFilter = (className: string) => (
    <Segmented
      size="md"
      label={t("language.label")}
      value={language}
      onValueChange={(next) => {
        setLanguage(next);
        setLimit(STEP);
        settle();
      }}
      // The visitor's own language first; short codes, as on the cards, with the full name for screen readers.
      options={[
        { value: "all", label: t("language.all"), icon: Globe, iconOnly: true },
        ...[locale, ...LANGUAGES.filter((code) => code !== locale)].map((code) => ({
          value: code as Language,
          label: code.toUpperCase(),
          ariaLabel: `${t(`languages.${code}`)} (${code.toUpperCase()})`,
        })),
      ]}
      className={cn("shrink-0", touchSegmented, className)}
    />
  );
  const playLabel = paused ? t("glide.play") : t("glide.pause");
  const playButton = (className?: string) => (
    <IconButton
      icon={paused ? Play : Pause}
      solid
      label={playLabel}
      variant="tinted"
      data-keep-glide=""
      onClick={() => {
        ended.current = false;
        setPaused((now) => !now);
      }}
      className={cn("rounded-full motion-reduce:hidden", className)}
    />
  );

  return (
    <>
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-stretch lg:gap-12">
        {intro}
        {wall}
      </div>

      <section ref={section} id="gallery" aria-labelledby="gallery-title" className="grid scroll-mt-24 grid-cols-1 gap-5">
        <div className="relative grid gap-1">
          {/* Where "back to the top of the results" scrolls to: just above the search and filters. */}
          <div ref={anchor} aria-hidden className="absolute inset-x-0 bottom-0 scroll-mt-24" />
          <h2 id="gallery-title" className="text-h2 tracking-tight">
            {t("galleryTitle")}
          </h2>
          <div className="flex min-h-control-md items-center justify-between gap-3">
            <p aria-live="polite" className="text-small text-fg-secondary">
              {t("results", { count: shown.length })}
            </p>
            {languageFilter("md:hidden")}
          </div>
        </div>

        <SearchField id="examples-search-phone" ref={searchPhone} className="md:hidden" {...searchProps} />

        {/* Sticks right under the header (no gap for cards to show through) on a solid band: on phones
            a full-width strip with a hairline, on larger screens search, language and categories in one
            row. On very short screens it scrolls away with the page. */}
        <div data-filters className="layer-raised mk-stuck-band sticky top-16 -mx-5 border-b border-line bg-canvas px-4 py-1 short:static md:mx-0 md:-my-3 md:border-b-0 md:px-0 md:py-3">
          {/* Larger screens: a hairline under the band only while it is stuck, where cards slide beneath it. */}
          <span aria-hidden className="mk-stuck-edge pointer-events-none absolute inset-x-0 bottom-0 hidden border-b border-transparent md:block" />
          <div className="md:flex md:items-center md:gap-3">
            <SearchField id="examples-search" ref={searchWide} className="max-md:hidden md:w-(--container-sidebar) md:shrink" {...searchProps} />
            {languageFilter("max-md:hidden")}
            <CategoryBar
              value={category}
              onChange={(next) => {
                setCategory(next);
                setLimit(STEP);
                settle();
              }}
              counts={counts}
              total={matching.length}
            />
          </div>
        </div>

        {shown.length > 0 ? (
          <>
            <ul
              ref={grid}
              key={`${category}|${language}|${settled}`}
              data-fonts={faces ? undefined : "later"}
              className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4"
            >
              {visible.map((item, index) => (
                // Each new set comes in with its own short stagger, not after the cards above it.
                <li key={item.slug} className="mk-card-in" style={{ "--i": index % STEP } as CSSProperties}>
                  <button
                    type="button"
                    data-slug={item.slug}
                    aria-describedby={`${item.slug}-about`}
                    onClick={(event) => openCard(item, event.currentTarget)}
                    onPointerEnter={(event) => {
                      if (event.pointerType === "mouse") warm(item);
                    }}
                    onPointerDown={() => warm(item)}
                    onFocus={() => warm(item)}
                    // Focus scrolling stops below the sticky header and band.
                    className="group block w-full scroll-mt-32 scroll-mb-4 rounded-lg text-start outline-none md:scroll-mt-[calc(var(--spacing-32)+var(--spacing-4))] md:rounded-xl"
                  >
                    <span className="sr-only">
                      {t("preview", { name: item.name, category: label(item), language: t(`languages.${item.locale}`) })}
                    </span>
                    {/* The card is a picture of the page; the button's name says what it does. The
                        focus ring sits on the card itself, so it rises with it. */}
                    <span
                      aria-hidden
                      className="block rounded-lg transition-[translate,scale] duration-spring ease-spring group-hover:-translate-y-1 group-focus-visible:focus-ring group-active:scale-pressed group-active:duration-micro md:rounded-xl motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
                    >
                      <CardFace item={item} label={label(item)} />
                    </span>
                  </button>
                  <span id={`${item.slug}-about`} hidden>
                    <span lang={item.locale}>{item.tagline}</span>
                    {item.badge ? ` ${t(`badgeNotes.${item.badge}`)}` : null}
                  </span>
                </li>
              ))}
            </ul>
            {more > 0 ? (
              // One wide, quiet button, as in an app (full width on phones), with the count beneath it.
              <div className="grid justify-items-center gap-3 pt-6">
                <Button variant="tinted" size="xl" onClick={showMore} className="group w-full rounded-full font-semibold sm:w-auto sm:min-w-(--container-sidebar)">
                  {t("more", { count: more })}
                  <Icon icon={ChevronDown} size="md" className="transition-transform duration-micro group-hover:translate-y-0.5 motion-reduce:transition-none" />
                </Button>
                <p className="flex items-center gap-3 text-caption text-fg-secondary tabular-nums">
                  <span aria-hidden className="h-1 w-16 overflow-hidden rounded-full bg-line">
                    <span className="block h-full origin-left rounded-full bg-primary transition-[scale] duration-standard ease-standard motion-reduce:transition-none rtl:origin-right" style={{ scale: `${visible.length / shown.length} 1` }} />
                  </span>
                  {t("shownOf", { shown: visible.length, total: shown.length })}
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <div className="grid justify-items-center gap-3 rounded-xl bg-canvas-muted px-6 py-16 text-center">
            <span className="grid size-control-xl place-items-center rounded-full bg-surface text-fg-secondary">
              <Icon icon={SearchX} size="lg" />
            </span>
            <p className="text-h3">{t("empty.title")}</p>
            <p className="max-w-prose text-small text-fg-secondary">{t("empty.text")}</p>
            <Button variant="tinted" size="lg" onClick={reset} className="rounded-full font-semibold">
              {t("empty.reset")}
            </Button>
          </div>
        )}
      </section>

      <Dialog.Root open={open !== null} onOpenChange={(next) => (next ? undefined : close())}>
        <Dialog.Portal>
          <Dialog.Overlay
            ref={previewScrim}
            className="layer-modal fixed inset-0 bg-scrim motion-safe:animate-scrim-in data-[state=closed]:animate-fade-out motion-reduce:animate-fade-in lg:backdrop-blur-glass"
          />
          <Dialog.Content
            ref={previewSheet}
            onKeyDown={onDialogKey}
            // Any key or tap in the preview pauses the self-scrolling page, except turning the page
            // and the pause button itself.
            onKeyDownCapture={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Escape") return;
              const activates = event.key === "Enter" || event.key === " ";
              if (activates && event.target instanceof Element && event.target.closest("[data-keep-glide]")) return;
              setPaused(true);
            }}
            onPointerDownCapture={(event) => {
              if (!(event.target instanceof Element && event.target.closest("[data-keep-glide]"))) setPaused(true);
            }}
            // Large screens: a click on the dimmed space around the phone and the panel closes it.
            onPointerDown={(event) => {
              if (event.target === event.currentTarget && window.matchMedia(`(min-width: ${tokens.breakpoint.lg}px)`).matches) close();
            }}
            // Focus the dialog itself, not the first tabbable element: on large screens that is the
            // page frame, and keys pressed inside a frame never reach Escape or the arrow keys here.
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
            }}
            // Back to the card of the page last shown (after flipping through), or the card that opened it.
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              const card = grid.current?.querySelector<HTMLButtonElement>(`button[data-slug="${lastShown.current ?? ""}"]`) ?? opener.current;
              card?.focus({ preventScroll: true });
              card?.scrollIntoView({ block: "nearest", behavior: motion() });
            }}
            // Phones and tablets: a sheet that slides up over the dimmed page (pull it down to close).
            // Large screens: the phone and its panel side by side over the dimmed page.
            className={cn(
              "layer-modal fixed inset-x-0 top-3 bottom-0 flex flex-col gap-3 rounded-t-xl border-t border-line bg-canvas-muted px-3 pb-[max(var(--spacing-3),env(safe-area-inset-bottom))] outline-none sm:top-6 sm:px-6",
              "lg:inset-0 lg:flex-row lg:items-center lg:justify-center lg:gap-8 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-6",
              "motion-safe:animate-sheet-in data-[state=closed]:motion-safe:animate-sheet-out lg:motion-safe:animate-pop-in lg:data-[state=closed]:motion-safe:animate-fade-out",
              "motion-reduce:animate-fade-in data-[state=closed]:motion-reduce:animate-fade-out",
            )}
          >
            {current ? (
              <>
                {/* No word about a self-scrolling page where it never moves (reduced motion). */}
                <Dialog.Description className="sr-only">
                  <span className="motion-reduce:hidden">{t("previewGlide")} </span>
                  {t("previewHint")}
                </Dialog.Description>
                {/* Prev and next are announced: which page, and where in the list. */}
                <p role="status" className="sr-only">
                  {stepped ? `${current.name}, ${t("position", { index: position + 1, total: deck.length })}` : ""}
                </p>
                <div {...previewHandle} className="grid touch-none gap-2 pt-2 lg:hidden">
                  <span aria-hidden className="mx-auto h-1 w-10 rounded-full bg-line-strong" />
                  <div className="flex items-center gap-2">
                    <Dialog.Title className="min-w-0 flex-1 truncate text-body-lg font-semibold text-fg">
                      {current.name}
                    </Dialog.Title>
                    {playButton()}
                    <IconButton icon={ChevronLeft} label={t("prev")} variant="tinted" data-keep-glide="" onClick={() => step(-1)} className="rounded-full" />
                    <IconButton icon={ChevronRight} label={t("next")} variant="tinted" data-keep-glide="" onClick={() => step(1)} className="rounded-full" />
                    <Dialog.Close asChild>
                      <IconButton icon={X} label={t("close")} variant="tinted" className="rounded-full" />
                    </Dialog.Close>
                  </div>
                </div>
                {/* The panel comes before the page for the keyboard (Close, then its main action), last on screen. */}
                <div
                  {...previewHandle}
                  className="order-last mx-auto grid w-full max-w-preview touch-none gap-2 rounded-xl border border-line bg-surface-elevated p-3 text-fg lg:mx-0 lg:w-(--container-preview) lg:touch-auto lg:gap-4 lg:p-6"
                >
                  <div className="hidden items-start justify-between gap-2 lg:flex">
                    <div className="grid min-w-0 gap-2">
                      <span key={`chip-${current.slug}`} className="inline-flex items-center gap-2 justify-self-start rounded-full bg-selected px-3 py-1 text-caption font-semibold text-selected-fg motion-safe:animate-fade-in">
                        <Icon icon={CATEGORY_ICONS[current.category]} size="sm" />
                        {label(current)} · {t(`languages.${current.locale}`)}
                      </span>
                      <p key={`name-${current.slug}`} dir="auto" className="text-h3 text-balance motion-safe:animate-fade-in">
                        {current.name}
                      </p>
                    </div>
                    <Dialog.Close asChild>
                      <IconButton icon={X} label={t("close")} className="rounded-full" />
                    </Dialog.Close>
                  </div>
                  {current.badge ? <p className="text-caption text-fg-secondary">{t(`badgeNotes.${current.badge}`)}</p> : null}
                  <Button asChild variant="primary" size="lg" block className="rounded-full">
                    <Link href={current.signup}>
                      {t("use")}
                      <Icon icon={ArrowRight} size="md" />
                    </Link>
                  </Button>
                  <p className="text-center text-caption text-fg-secondary lg:text-start">{t("useHint")}</p>
                  <a
                    href={`/${current.locale}/p/${current.slug}`}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex h-control-md items-center justify-center gap-2 rounded-full px-4 text-small font-semibold text-fg transition-colors duration-micro hover:bg-hover focus-visible:focus-ring"
                  >
                    {t("open")}
                    <span className="sr-only">{t("newTab")}</span>
                    <Icon icon={ExternalLink} size="sm" />
                  </a>
                  <div className="hidden items-center justify-between gap-2 border-t border-line pt-4 lg:flex">
                    <IconButton icon={ChevronLeft} label={t("prev")} variant="tinted" data-keep-glide="" onClick={() => step(-1)} className="rounded-full" />
                    <span className="flex items-center gap-2">
                      <span className="text-caption text-fg-secondary tabular-nums">{t("position", { index: position + 1, total: deck.length })}</span>
                      {playButton()}
                    </span>
                    <IconButton icon={ChevronRight} label={t("next")} variant="tinted" data-keep-glide="" onClick={() => step(1)} className="rounded-full" />
                  </div>
                  <p className="hidden text-center text-caption text-fg-tertiary lg:pointer-fine:block">{t("keys")}</p>
                </div>
                {/* The phone frame takes the next page's own background at once; a spinner shows only if
                    loading takes a while; the page comes in from the side it was asked for. */}
                <div
                  style={current.style}
                  className="mx-auto grid min-h-0 w-full max-w-preview flex-1 grid-cols-1 grid-rows-1 overflow-hidden rounded-xl border border-line-strong bg-creator-bg p-1 transition-colors duration-standard ease-standard lg:mx-0 lg:aspect-phone lg:h-auto lg:max-h-full lg:flex-none"
                >
                  {loaded === current.slug ? null : (
                    <span className="col-start-1 row-start-1 place-self-center animate-spinner-in">
                      <Spinner className="size-icon-lg text-creator-fg-muted" />
                    </span>
                  )}
                  <iframe
                    ref={frame}
                    // A new frame per page: no history entries pile up in the visitor's back button.
                    key={current.slug}
                    data-linkyo-preview=""
                    title={t("frame", { name: current.name })}
                    src={`/${current.locale}/p/${current.slug}`}
                    onLoad={(event) => {
                      const view = event.currentTarget.contentDocument?.defaultView;
                      // The page inside scrolls without a grey bar at its edge: a preview, not a window.
                      view?.document.documentElement.classList.add("mk-no-scrollbar");
                      view?.addEventListener("keydown", (key) => frameKey.current(key));
                      setLoaded(current.slug);
                      // The pages either side are fetched ahead, so flipping is quick.
                      warm(deck[(position + 1) % deck.length]);
                      warm(deck[(position - 1 + deck.length) % deck.length]);
                    }}
                    style={{ "--step": direction } as CSSProperties}
                    className={cn("col-start-1 row-start-1 size-full rounded-lg", loaded === current.slug ? "motion-safe:animate-page-in" : "opacity-0")}
                  />
                </div>
              </>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
