"use client";

import { Button, cn, Icon, IconButton, Kbd, Segmented, Spinner } from "@linkyo/ui";
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, LayoutGrid, Search, SearchX, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject } from "react";

import { Link } from "@/i18n/navigation";

import { CardFace, CATEGORY_ICONS, tiltBack, tiltTowards, type GalleryItem } from "./gallery-card";
import { pickShowcase, Showcase } from "./gallery-showcase";
import { CATEGORIES, type Category } from "./looks";

export type { GalleryItem } from "./gallery-card";

type Language = GalleryItem["locale"] | "all";

/** Lower case, accents and Arabic vowel marks removed: "backerei" finds "Bäckerei". */
const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();

const motion = (): ScrollBehavior =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

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
      <Icon icon={Search} size="sm" className="pointer-events-none absolute start-3 text-fg-tertiary" />
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
        className="h-control-md w-full appearance-none rounded-full border border-line bg-surface ps-10 pe-10 text-small text-fg transition-colors duration-micro placeholder:text-fg-tertiary hover:border-line-strong focus-visible:focus-ring [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange("");
            ref.current?.focus();
          }}
          aria-label={t("clear")}
          className="absolute end-1 grid size-control-sm place-items-center rounded-full text-fg-secondary transition-colors duration-micro hover:bg-hover hover:text-fg focus-visible:focus-ring"
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
 * appear on larger screens when there is more, and the row fades out at the edges.
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
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    // Scroll offsets are negative in right-to-left layouts; the distance from the start is what counts.
    const measure = () => {
      const offset = Math.abs(element.scrollLeft);
      setEdges({ start: offset < 2, end: offset + element.clientWidth >= element.scrollWidth - 2 });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", measure);
    };
  }, []);

  const page = (direction: 1 | -1) => {
    const element = scroller.current;
    if (!element) return;
    const rtl = getComputedStyle(element).direction === "rtl";
    element.scrollBy({ left: direction * (rtl ? -1 : 1) * element.clientWidth * 0.7, behavior: motion() });
  };

  const fade = "pointer-events-none absolute inset-y-0 flex items-center from-canvas from-50% to-transparent";
  return (
    <div className="relative min-w-0 flex-1">
      <div
        ref={scroller}
        role="group"
        aria-label={t("filter")}
        className="flex gap-2 overflow-x-auto overscroll-x-contain p-1 [scrollbar-width:none]"
      >
        {(["all", ...CATEGORIES] as const).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={value === key}
            onClick={(event) => {
              onChange(key);
              event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest", behavior: motion() });
            }}
            className="group inline-flex h-control-md shrink-0 items-center gap-2 rounded-full border border-line bg-surface ps-3 pe-2 text-small font-medium text-fg-secondary transition-colors duration-micro hover:border-line-strong hover:text-fg focus-visible:focus-ring aria-pressed:border-fg aria-pressed:bg-fg aria-pressed:text-canvas"
          >
            <Icon icon={key === "all" ? LayoutGrid : CATEGORY_ICONS[key]} size="sm" />
            {key === "all" ? t("all") : t(`categories.${key}`)}
            <span className="min-w-6 rounded-full bg-canvas-muted px-2 py-0.5 text-center text-caption text-fg-secondary tabular-nums group-aria-pressed:bg-primary group-aria-pressed:text-primary-fg">
              {key === "all" ? total : counts[key]}
            </span>
          </button>
        ))}
      </div>
      {edges.start ? null : (
        <div className={cn(fade, "start-0 bg-linear-to-r pe-8 rtl:bg-linear-to-l")}>
          <IconButton
            icon={ChevronLeft}
            label={t("scroll.back")}
            size="sm"
            variant="secondary"
            onClick={() => page(-1)}
            className="pointer-events-auto max-md:hidden rtl:-scale-x-100"
          />
        </div>
      )}
      {edges.end ? null : (
        <div className={cn(fade, "end-0 bg-linear-to-l ps-8 rtl:bg-linear-to-r")}>
          <IconButton
            icon={ChevronRight}
            label={t("scroll.next")}
            size="sm"
            variant="secondary"
            onClick={() => page(1)}
            className="pointer-events-auto max-md:hidden rtl:-scale-x-100"
          />
        </div>
      )}
    </div>
  );
}

/**
 * The gallery: a moving wall of pages next to the intro, then search, language and category filters
 * over a grid of cards. A card opens a phone-sized preview to flip through (buttons or arrow keys),
 * use as a template (sign-up starts with exactly that look) or open in full.
 */
export function ExampleGallery({ items, intro }: { items: GalleryItem[]; intro: ReactNode }) {
  const t = useTranslations("examples");
  const [category, setCategory] = useState<Category | "all">("all");
  const [language, setLanguage] = useState<Language>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<GalleryItem | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const searchWide = useRef<HTMLInputElement>(null);
  const searchPhone = useRef<HTMLInputElement>(null);

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
  const showcase = useMemo(() => pickShowcase(items, 15), [items]);

  const terms = fold(query).split(/\s+/).filter(Boolean);
  const matching = items.filter(
    (item) =>
      (language === "all" || item.locale === language) &&
      terms.every((term) => haystack.get(item.slug)?.includes(term)),
  );
  const shown = category === "all" ? matching : matching.filter((item) => item.category === category);
  const counts = Object.fromEntries(
    CATEGORIES.map((key) => [key, matching.filter((item) => item.category === key).length]),
  ) as Record<Category, number>;

  // After a filter change deep down the grid, bring the top of the results back into view.
  const settle = (behavior: ScrollBehavior = motion()) => {
    const element = anchor.current;
    if (element && element.getBoundingClientRect().top < 0) element.scrollIntoView({ block: "start", behavior });
  };
  const reset = () => {
    setQuery("");
    setLanguage("all");
    setCategory("all");
  };

  // "/" jumps to the search box, as on many sites with search.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable], [role=dialog]")) return;
      const field = [searchWide.current, searchPhone.current].find((input) => input?.offsetParent);
      if (!field) return;
      event.preventDefault();
      field.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const deck = open && shown.includes(open) ? shown : items;
  const position = open ? deck.indexOf(open) : -1;
  const step = (delta: 1 | -1) => {
    if (position < 0) return;
    setOpen(deck[(position + delta + deck.length) % deck.length] ?? null);
  };
  const onDialogKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    event.preventDefault();
    step((event.key === "ArrowRight") !== rtl ? 1 : -1);
  };
  const searchProps = {
    value: query,
    onChange: (next: string) => {
      setQuery(next);
      settle("auto");
    },
  };

  return (
    <>
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
        {intro}
        <Showcase items={showcase} onOpen={setOpen} />
      </div>

      <section id="gallery" aria-labelledby="gallery-title" className="grid scroll-mt-24 grid-cols-1 gap-5">
        <div className="relative flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          {/* Where "back to the top of the results" scrolls to: just above the search and filters. */}
          <div ref={anchor} aria-hidden className="absolute inset-x-0 bottom-0 scroll-mt-24" />
          <div className="grid gap-1">
            <h2 id="gallery-title" className="text-h2 tracking-tight">
              {t("galleryTitle")}
            </h2>
            <p aria-live="polite" className="text-small text-fg-secondary">
              {t("results", { count: shown.length })}
            </p>
          </div>
          <Segmented
            size="sm"
            label={t("language.label")}
            value={language}
            onValueChange={(next) => {
              setLanguage(next);
              settle();
            }}
            options={[
              { value: "all", label: t("language.all") },
              { value: "de", label: t("languages.de") },
              { value: "en", label: t("languages.en") },
              { value: "ar", label: t("languages.ar") },
            ]}
          />
        </div>

        <SearchField id="examples-search-phone" ref={searchPhone} className="md:hidden" {...searchProps} />

        <div className="layer-raised sticky top-20 -mx-5 border-b border-line bg-canvas px-4 py-1 md:mx-0 md:flex md:items-center md:gap-2 md:rounded-full md:border md:py-1 md:ps-2 md:pe-1 md:shadow-e1">
          <SearchField id="examples-search" ref={searchWide} className="max-md:hidden md:w-(--container-sidebar) md:shrink-0" {...searchProps} />
          <CategoryBar
            value={category}
            onChange={(next) => {
              setCategory(next);
              settle();
            }}
            counts={counts}
            total={matching.length}
          />
        </div>

        {shown.length > 0 ? (
          <ul key={`${category}|${language}`} className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
            {shown.map((item, index) => (
              <li key={item.slug} className="mk-card-in" style={{ "--i": index } as CSSProperties}>
                <button
                  type="button"
                  onClick={() => setOpen(item)}
                  onPointerMove={tiltTowards}
                  onPointerLeave={tiltBack}
                  className="group block w-full rounded-xl text-start focus-visible:focus-ring"
                >
                  <span className="sr-only">{t("preview", { name: item.name })}</span>
                  {/* The card is a picture of the page; the button's name says what it does. */}
                  <span
                    aria-hidden
                    className="block rounded-xl shadow-e1 transition-[translate,box-shadow] duration-standard ease-standard group-hover:-translate-y-1 group-hover:shadow-e3 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
                  >
                    <CardFace item={item} label={label(item)} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid justify-items-center gap-3 rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
            <span className="grid size-control-xl place-items-center rounded-full bg-canvas-muted text-fg-secondary">
              <Icon icon={SearchX} size="lg" />
            </span>
            <p className="text-h3">{t("empty.title")}</p>
            <p className="max-w-prose text-small text-fg-secondary">{t("empty.text")}</p>
            <Button variant="secondary" onClick={reset}>
              {t("empty.reset")}
            </Button>
          </div>
        )}
      </section>

      <Dialog.Root open={open !== null} onOpenChange={(next) => (next ? undefined : setOpen(null))}>
        <Dialog.Portal>
          <Dialog.Overlay className="layer-modal fixed inset-0 bg-scrim motion-safe:animate-fade-in" />
          <Dialog.Content
            aria-describedby={undefined}
            onKeyDown={onDialogKey}
            // Focus the dialog itself, not the first tabbable element: on large screens that is the
            // page frame, and keys pressed inside a frame never reach Escape or the arrow keys here.
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
            }}
            className="layer-modal fixed inset-0 flex flex-col gap-3 p-3 outline-none motion-safe:animate-pop-in sm:p-6 lg:flex-row lg:items-center lg:justify-center lg:gap-8"
          >
            {open ? (
              <>
                <div className="flex items-center gap-2 lg:hidden">
                  <Dialog.Title className="min-w-0 flex-1 truncate rounded-full bg-surface-elevated px-3 py-1 text-small font-semibold text-fg shadow-e1">
                    {open.name}
                  </Dialog.Title>
                  <IconButton icon={ChevronLeft} label={t("prev")} variant="secondary" onClick={() => step(-1)} className="rtl:-scale-x-100" />
                  <IconButton icon={ChevronRight} label={t("next")} variant="secondary" onClick={() => step(1)} className="rtl:-scale-x-100" />
                  <Dialog.Close asChild>
                    <IconButton icon={X} label={t("close")} variant="secondary" />
                  </Dialog.Close>
                </div>
                {/* A spinner until the page inside has loaded. */}
                <div className="mx-auto grid min-h-0 w-full max-w-preview flex-1 grid-cols-1 grid-rows-1 overflow-hidden rounded-xl border border-line-strong bg-canvas p-1 shadow-e3 lg:mx-0 lg:h-full lg:max-h-dvh lg:flex-none">
                  {loaded === open.slug ? null : (
                    <Spinner className="col-start-1 row-start-1 size-icon-lg place-self-center text-fg-tertiary" />
                  )}
                  <iframe
                    key={open.slug}
                    title={t("frame", { name: open.name })}
                    src={`/${open.locale}/p/${open.slug}`}
                    onLoad={() => setLoaded(open.slug)}
                    className="col-start-1 row-start-1 size-full rounded-lg"
                  />
                </div>
                <div className="grid gap-2 rounded-xl bg-surface-elevated p-3 text-fg shadow-e3 lg:w-(--container-preview) lg:gap-4 lg:p-6">
                  <div className="hidden items-start justify-between gap-2 lg:flex">
                    <div className="grid min-w-0 gap-2">
                      <span className="inline-flex items-center gap-2 justify-self-start rounded-full bg-selected px-3 py-1 text-caption font-semibold text-selected-fg">
                        <Icon icon={CATEGORY_ICONS[open.category]} size="sm" />
                        {label(open)} · {t(`languages.${open.locale}`)}
                      </span>
                      <p dir="auto" className="text-h3 text-balance">
                        {open.name}
                      </p>
                    </div>
                    <Dialog.Close asChild>
                      <IconButton icon={X} label={t("close")} />
                    </Dialog.Close>
                  </div>
                  {open.badge ? <p className="text-caption text-fg-secondary">{t(`badgeNotes.${open.badge}`)}</p> : null}
                  <Link
                    href={open.signup}
                    className="inline-flex h-control-lg items-center justify-center gap-2 rounded-full bg-primary px-5 text-body font-semibold text-primary-fg shadow-e1 transition-colors duration-micro hover:bg-primary-hover focus-visible:focus-ring active:scale-pressed"
                  >
                    {t("use")}
                    <Icon icon={ArrowRight} size="md" className="rtl:-scale-x-100" />
                  </Link>
                  <p className="hidden text-caption text-fg-secondary lg:block">{t("useHint")}</p>
                  <a
                    href={`/${open.locale}/p/${open.slug}`}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex h-control-md items-center justify-center gap-2 rounded-full px-4 text-small font-semibold text-fg transition-colors duration-micro hover:bg-hover focus-visible:focus-ring"
                  >
                    {t("open")}
                    <Icon icon={ExternalLink} size="sm" />
                  </a>
                  <div className="hidden items-center justify-between gap-2 border-t border-line pt-4 lg:flex">
                    <IconButton icon={ChevronLeft} label={t("prev")} variant="secondary" onClick={() => step(-1)} className="rtl:-scale-x-100" />
                    <span className="text-caption text-fg-secondary tabular-nums">
                      {t("position", { index: position + 1, total: deck.length })}
                    </span>
                    <IconButton icon={ChevronRight} label={t("next")} variant="secondary" onClick={() => step(1)} className="rtl:-scale-x-100" />
                  </div>
                </div>
              </>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
