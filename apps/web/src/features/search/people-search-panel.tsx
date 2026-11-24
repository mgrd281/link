"use client";

import { Button, cn, Icon, Kbd, Skeleton, Spinner } from "@linkyo/ui";
import { ChevronRight, LayoutGrid, Search, SearchX, WifiOff, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";

import { ScrollRow } from "@/components/scroll-row";
import { CATEGORY_ICONS } from "@/features/examples/category-icons";
import { CATEGORIES, type Category } from "@/features/examples/looks";
import { faceSize } from "@/features/marketing/assets";
import { Link } from "@/i18n/navigation";

import { heldSearch, rememberSearch } from "./people-history";
import { loadPeople } from "./people-store";
import { highlights, prepare, searchPeople, termsOf, type Person, type Prepared } from "./search";

/** With nothing typed: suggestions that fill the first screen. With a word or a field: everyone who fits. */
const SUGGESTED = { phone: 8, wide: 6 };
const SHOWN = 40;

/** Well-known people first, then the gallery's order. */
const CHIPS: Category[] = ["people", ...CATEGORIES.filter((key) => key !== "people")];
const isCategory = (value: string | null): value is Category => CHIPS.includes(value as Category);

type Load = { status: "loading" } | { status: "ready"; index: Prepared[] } | { status: "error" };

/** Wide enough for the panel (the md breakpoint, as the layout classes below). */
const wideQuery = "(min-width: 48rem)";
const onWide = (notify: () => void) => {
  const query = window.matchMedia(wideQuery);
  query.addEventListener("change", notify);
  return () => {
    query.removeEventListener("change", notify);
  };
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0]?.toLocaleUpperCase() ?? "")
    .join("");

/** A round face in a hairline ring, as under the homepage's pages; initials when there is no picture. */
function Face({ person }: { person: Person }) {
  return (
    <span className="grid size-12 shrink-0 place-items-center rounded-full border border-line-strong p-0.5">
      <span className="relative grid size-full place-items-center overflow-hidden rounded-full bg-selected text-small font-semibold text-selected-fg">
        {person.photo ? <Image src={person.photo} alt="" fill sizes={faceSize} className="object-cover object-top" /> : <span aria-hidden>{initials(person.name)}</span>}
      </span>
    </span>
  );
}

/** A line of a result with what was typed marked in it, as a text marker would. */
function Marked({ text, query }: { text: string; query: string }) {
  const pieces: { text: string; hit: boolean }[] = [];
  let at = 0;
  for (const [start, end] of highlights(text, query)) {
    if (start > at) pieces.push({ text: text.slice(at, start), hit: false });
    pieces.push({ text: text.slice(start, end), hit: true });
    at = end;
  }
  if (at < text.length) pieces.push({ text: text.slice(at), hit: false });
  return pieces.map((piece, index) =>
    piece.hit ? (
      <mark key={index} className="rounded-xs bg-selected text-selected-fg">
        {piece.text}
      </mark>
    ) : (
      piece.text
    ),
  );
}

/**
 * The people search, built like a screen in an app.
 *
 * - Phones: a full screen with a soft pill to type in and "Cancel" beside it. The keyboard is up
 *   when it opens, the screen ends above the keyboard, and dragging the results puts it away.
 * - From tablets up: a panel under the header with one borderless line to type in, a highlight that
 *   glides to the chosen row, arrow keys and Enter.
 * - Everywhere: type a name, a profession or a place; a field narrows; every row opens its page.
 *
 * The list of people is fetched once; searching happens here in the browser (search.ts), so
 * nothing typed is sent anywhere. A WAI-ARIA combobox with a list.
 */
export function PeopleSearchPanel({
  open,
  onClose,
  onReady,
  onClosed,
  locale,
}: {
  open: boolean;
  /** Someone wants to leave (Cancel, Escape, a click beside the panel). */
  onClose: () => void;
  /** The field has the focus: the keyboard lent on the tap can go. */
  onReady: () => void;
  /** After it has closed: the opener takes the focus back. */
  onClosed: () => void;
  locale: string;
}) {
  const t = useTranslations("search");
  const tx = useTranslations("examples");
  const id = useId();
  const sheet = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  // Coming back from a person's page: the search is as it was left (people-history.ts).
  const [held] = useState(heldSearch);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState(held?.query ?? "");
  const [category, setCategory] = useState<Category | null>(held && isCategory(held.category) ? held.category : null);
  const [active, setActive] = useState(0);
  const [opening, setOpening] = useState<string | null>(null);
  // A row is "chosen" where there is something to choose with: a mouse, or arrow keys once used.
  // On a touch screen nothing is chosen until a finger taps it.
  const [choosing, setChoosing] = useState(() => window.matchMedia("(pointer: fine)").matches);
  const wide = useSyncExternalStore(onWide, () => window.matchMedia(wideQuery).matches, () => true);

  useEffect(() => {
    let alive = true;
    loadPeople(locale).then(
      (people) => {
        if (alive) setLoad({ status: "ready", index: prepare(people) });
      },
      () => {
        if (alive) setLoad({ status: "error" });
      },
    );
    return () => {
      alive = false;
    };
  }, [locale, attempt]);

  // Back from a page we opened (the browser kept this one): nothing is "opening" any more.
  useEffect(() => {
    const onShow = () => {
      setOpening(null);
    };
    window.addEventListener("pageshow", onShow);
    return () => {
      window.removeEventListener("pageshow", onShow);
    };
  }, []);

  // Phones: the screen is exactly what is visible, so it ends above the keyboard instead of under it.
  useEffect(() => {
    const viewport = window.visualViewport;
    const element = sheet.current;
    if (!open || !viewport || !element) return;
    const fit = () => {
      // Not while someone has zoomed in: then the visible part is a detail, not the screen.
      if (Math.abs(viewport.scale - 1) > 0.01) return;
      element.style.setProperty("--visible-height", `${viewport.height}px`);
      element.style.setProperty("--visible-top", `${viewport.offsetTop}px`);
    };
    fit();
    viewport.addEventListener("resize", fit);
    viewport.addEventListener("scroll", fit);
    return () => {
      viewport.removeEventListener("resize", fit);
      viewport.removeEventListener("scroll", fit);
    };
  }, [open]);

  const index = load.status === "ready" ? load.index : null;
  const typed = termsOf(query).length > 0;
  const found = useMemo(() => (index ? searchPeople(index, query, category) : []), [index, query, category]);
  const shown = found.slice(0, typed || category ? SHOWN : wide ? SUGGESTED.wide : SUGGESTED.phone);
  const chips = useMemo(() => CHIPS.filter((key) => index?.some((entry) => entry.person.category === key)), [index]);
  const optionId = (position: number) => `${id}-option-${position}`;

  const type = (next: string) => {
    setQuery(next);
    setActive(0);
  };
  const pick = (next: Category | null) => {
    setCategory(next);
    setActive(0);
    // With a keyboard at hand the field keeps the focus, so typing and the arrow keys go on.
    // On a touch screen it does not: that would bring the keyboard back over the results.
    if (window.matchMedia("(pointer: fine)").matches) input.current?.focus();
  };
  const reset = () => {
    type("");
    setCategory(null);
    input.current?.focus();
  };

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (shown.length === 0) return;
      // The first arrow key only shows the choice; from then on the keys move it.
      const next = choosing ? (active + (event.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length : active;
      setChoosing(true);
      setActive(next);
      document.getElementById(optionId(next))?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") {
      event.preventDefault();
      // With a row chosen, Enter opens it. On a touch keyboard "Search" just puts the keyboard away.
      if (choosing) document.getElementById(optionId(active))?.click();
      else event.currentTarget.blur();
    }
  };
  const onOpenPage = (event: MouseEvent, person: Person) => {
    rememberSearch({ query, category });
    // A plain click leaves this page: show that it is on its way. New tabs keep the search as it is.
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) setOpening(person.slug);
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="mk-search-scrim layer-modal fixed inset-0 bg-scrim" />
        <Dialog.Content
          ref={sheet}
          data-people-search
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onClosed();
          }}
          className="mk-search-panel layer-modal fixed inset-x-0 flex flex-col bg-canvas text-fg outline-none max-md:mk-search-sheet md:top-24 md:mx-auto md:mk-search-fit md:w-full md:max-w-prose md:overflow-hidden md:rounded-xl md:border md:border-line md:bg-surface-elevated"
        >
          <Dialog.Title className="sr-only">{t("title")}</Dialog.Title>

          {/* What you type. Phones: a soft pill with "Cancel" beside it. Wider: one line, a hairline under it.
              Focus stays visible but quiet, as in a native search field: a neutral hairline and a teal
              magnifier, never a heavy dark ring. */}
          <div className="flex shrink-0 items-center gap-1 px-3 pt-3 pb-1 md:gap-0 md:border-b md:border-line md:p-0">
            <div className="group/field flex h-control-lg min-w-0 flex-1 items-center gap-3 rounded-full border border-transparent bg-canvas-muted ps-4 pe-1 transition-colors duration-micro focus-within:border-line-strong md:h-16 md:rounded-none md:border-0 md:bg-transparent md:ps-5">
              <Icon icon={Search} size="md" className="shrink-0 text-fg-secondary transition-colors duration-micro group-focus-within/field:text-link" />
              <label htmlFor={`${id}-input`} className="sr-only">
                {t("placeholder")}
              </label>
              <input
                ref={input}
                id={`${id}-input`}
                type="text"
                role="combobox"
                aria-expanded={shown.length > 0}
                aria-controls={shown.length > 0 ? `${id}-list` : undefined}
                aria-activedescendant={choosing && shown.length > 0 ? optionId(active) : undefined}
                aria-autocomplete="list"
                value={query}
                onChange={(event) => {
                  type(event.target.value);
                }}
                onKeyDown={onKey}
                onFocus={onReady}
                placeholder={t("placeholder")}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
                className="h-full min-w-0 flex-1 bg-transparent text-body-lg text-fg outline-none placeholder:text-fg-tertiary"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    type("");
                    input.current?.focus();
                  }}
                  aria-label={t("clear")}
                  className="group grid size-control-md shrink-0 place-items-center rounded-full focus-visible:focus-ring"
                >
                  <span className="grid size-5 place-items-center rounded-full bg-fg-tertiary text-canvas transition-colors duration-micro group-hover:bg-fg-secondary md:text-surface-elevated">
                    <Icon icon={X} size="xs" />
                  </span>
                </button>
              ) : null}
            </div>
            <Dialog.Close className="inline-flex h-control-lg shrink-0 items-center rounded-full px-3 text-body font-semibold text-link transition-[color,scale] duration-micro hover:text-fg focus-visible:focus-ring active:scale-pressed md:me-3 md:h-control-sm md:px-2">
              <span className="md:hidden">{t("cancel")}</span>
              <span className="max-md:hidden">
                <Kbd aria-hidden>esc</Kbd>
                <span className="sr-only">{t("close")}</span>
              </span>
            </Dialog.Close>
          </div>

          {/* Narrow by field: the gallery's categories, only those somebody is in. */}
          {chips.length > 0 ? (
            <ScrollRow
              label={t("filter")}
              labels={{ back: tx("scroll.back"), next: tx("scroll.next") }}
              fade="from-canvas md:from-surface-elevated"
              className="shrink-0 px-2 pt-1 md:px-3 md:pt-2"
            >
              {([null, ...chips] as const).map((key) => (
                <button
                  key={key ?? "all"}
                  type="button"
                  aria-pressed={category === key}
                  onClick={(event) => {
                    pick(key);
                    event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
                  }}
                  className="inline-flex h-control-sm shrink-0 items-center gap-2 rounded-full bg-canvas-muted px-3 text-small font-medium text-fg-secondary transition-[background-color,color,scale] duration-micro hover:text-fg focus-visible:focus-ring active:scale-pressed aria-pressed:bg-primary aria-pressed:text-primary-fg"
                >
                  <Icon icon={key ? CATEGORY_ICONS[key] : LayoutGrid} size="sm" />
                  {key ? tx(`categories.${key}`) : tx("all")}
                </button>
              ))}
            </ScrollRow>
          ) : null}

          {/* Dragging the results puts the keyboard away, as in an app. */}
          <div
            onTouchMove={() => {
              if (document.activeElement === input.current) input.current?.blur();
            }}
            className="mk-safe-bottom min-h-0 flex-1 overflow-y-auto overscroll-contain px-2"
          >
            {load.status === "loading" ? (
              <div aria-busy className="grid pt-10">
                <p className="sr-only" role="status">
                  {t("loading")}
                </p>
                {Array.from({ length: 6 }, (_, row) => (
                  <div key={row} className="flex h-16 items-center gap-3 px-3">
                    <Skeleton className="size-12 shrink-0 rounded-full" />
                    <div className="grid flex-1 gap-2">
                      <Skeleton className="h-3 w-1/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : load.status === "error" ? (
              <div className="grid justify-items-center gap-3 px-6 py-12 text-center">
                <span className="grid size-control-xl place-items-center rounded-full bg-canvas-muted text-fg-secondary">
                  <Icon icon={WifiOff} size="lg" />
                </span>
                <p className="text-h3">{t("error.title")}</p>
                <p className="max-w-prose text-small text-fg-secondary">{t("error.text")}</p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setLoad({ status: "loading" });
                    setAttempt((count) => count + 1);
                  }}
                >
                  {t("error.retry")}
                </Button>
              </div>
            ) : (
              <>
                {/* The count is always announced; with nothing found the message below says it for the eye. */}
                <p role="status" className={shown.length > 0 ? "flex h-10 items-end px-3 pb-2 text-caption font-semibold text-fg-secondary" : "sr-only"}>
                  {typed || category ? t("results", { count: found.length }) : t("suggested")}
                </p>
                {shown.length > 0 ? (
                  <div
                    id={`${id}-list`}
                    role="listbox"
                    aria-label={t("title")}
                    data-choosing={choosing ? "" : undefined}
                    style={{ "--active": active } as CSSProperties}
                    className="mk-search-list pb-2"
                  >
                    {shown.map((person, position) => (
                      // Each result is the link to its page; the field keeps the focus and moves the choice.
                      <a
                        key={person.slug}
                        id={optionId(position)}
                        role="option"
                        aria-selected={choosing && position === active}
                        href={person.href}
                        tabIndex={-1}
                        onPointerMove={(event) => {
                          if (event.pointerType !== "mouse") return;
                          setChoosing(true);
                          if (position !== active) setActive(position);
                        }}
                        onClick={(event) => {
                          onOpenPage(event, person);
                        }}
                        style={{ "--i": position } as CSSProperties}
                        // Suggestions arrive one after the other; results while typing are simply there.
                        className={cn("group flex h-16 items-center gap-3 rounded-lg px-3 transition-colors duration-micro pointer-coarse:active:bg-canvas-muted", typed ? null : "mk-search-row")}
                      >
                        <Face person={person} />
                        {/* Each line keeps its own direction (a Latin name on the Arabic site is cut at its end,
                            not at its start) and still sits at the start of the row. */}
                        <span className="grid min-w-0 flex-1 justify-items-start">
                          <span dir="auto" className="max-w-full truncate text-body font-semibold text-fg">
                            <Marked text={person.name} query={query} />
                          </span>
                          <span dir="auto" className="max-w-full truncate text-small text-fg-secondary">
                            <Marked text={person.role} query={query} />
                          </span>
                        </span>
                        {/* What kind of page it is, quietly; and its language when it is not the visitor's. */}
                        <span className="shrink-0 text-caption text-fg-secondary">
                          {t(`badges.${person.badge}`)}
                          {person.locale === locale ? null : (
                            <>
                              <span aria-hidden className="uppercase">
                                {" · "}
                                {person.locale}
                              </span>
                              <span className="sr-only">, {t("pageIn", { language: tx(`languages.${person.locale}`) })}</span>
                            </>
                          )}
                        </span>
                        <span className="grid size-5 shrink-0 place-items-center">
                          {opening === person.slug ? (
                            <Spinner className="size-icon-sm text-link" />
                          ) : (
                            <Icon
                              icon={ChevronRight}
                              size="sm"
                              className={cn("transition-[color,translate] duration-micro", choosing && position === active ? "translate-x-0.5 text-link rtl:-translate-x-0.5" : "text-fg-tertiary")}
                            />
                          )}
                        </span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="grid justify-items-center gap-3 px-6 py-10 text-center">
                    <span className="grid size-control-xl place-items-center rounded-full bg-canvas-muted text-fg-secondary">
                      <Icon icon={SearchX} size="lg" />
                    </span>
                    <p className="text-h3">{t("empty.title")}</p>
                    <p className="max-w-prose text-small text-pretty text-fg-secondary">{t("empty.text")}</p>
                    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                      <Button variant="secondary" onClick={reset}>
                        {t("empty.reset")}
                      </Button>
                      <Link
                        href="/templates"
                        onClick={() => {
                          rememberSearch({ query, category });
                        }}
                        className="rounded-xs text-small font-semibold text-link transition-colors duration-micro hover:text-fg focus-visible:focus-ring"
                      >
                        {t("empty.templates")}
                      </Link>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Keys, only where there is a keyboard and room. */}
          <p aria-hidden className="hidden shrink-0 items-center justify-end gap-4 border-t border-line px-5 py-2 text-caption text-fg-secondary pointer-fine:md:flex">
            <span className="inline-flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              {t("keys.move")}
            </span>
            <span className="inline-flex items-center gap-1">
              <Kbd>↵</Kbd>
              {t("keys.open")}
            </span>
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
