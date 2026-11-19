"use client";

import { Button, cn, Icon, Kbd, Skeleton, Spinner } from "@linkyo/ui";
import { ArrowUpRight, LayoutGrid, Search, SearchX, WifiOff, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";

import { ScrollRow } from "@/components/scroll-row";
import { CATEGORY_ICONS } from "@/features/examples/category-icons";
import { CATEGORIES, type Category } from "@/features/examples/looks";
import { faceSize } from "@/features/marketing/assets";
import { Link } from "@/i18n/navigation";

import { loadPeople } from "./people-store";
import { highlights, prepare, searchPeople, termsOf, type Person, type Prepared } from "./search";

/** With nothing typed: a handful of suggestions. With a word or a chip: everyone who fits. */
const SUGGESTED = 6;
const SHOWN = 40;

/** Well-known people first, then the gallery's order. */
const CHIPS: Category[] = ["people", ...CATEGORIES.filter((key) => key !== "people")];

type Load = { status: "loading" } | { status: "ready"; index: Prepared[] } | { status: "error" };

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0]?.toLocaleUpperCase() ?? "")
    .join("");

/** A round face in a hairline ring, as under the homepage's pages; initials when there is no picture. */
function Face({ person }: { person: Person }) {
  return (
    <span className="grid size-touch-target shrink-0 place-items-center rounded-full border border-line-strong p-0.5">
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
  return (
    <bdi>
      {pieces.map((piece, index) =>
        piece.hit ? (
          <mark key={index} className="rounded-xs bg-tint-lime text-fg">
            {piece.text}
          </mark>
        ) : (
          piece.text
        ),
      )}
    </bdi>
  );
}

/**
 * The people search (WAI-ARIA combobox with a list): type a name, a profession or a place, move
 * with the arrow keys, Enter opens the page. It fills the screen on phones and is a panel under the
 * header from tablets up. The list of people is fetched once; searching happens here in the
 * browser (search.ts), so nothing typed is sent anywhere.
 */
export function PeopleSearchPanel({
  open,
  onOpenChange,
  onClosed,
  locale,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** After it has closed: the opener takes the focus back. */
  onClosed: () => void;
  locale: string;
}) {
  const t = useTranslations("search");
  const tx = useTranslations("examples");
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [active, setActive] = useState(0);
  const [opening, setOpening] = useState<string | null>(null);

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

  const index = load.status === "ready" ? load.index : null;
  const typed = termsOf(query).length > 0;
  const found = useMemo(() => (index ? searchPeople(index, query, category) : []), [index, query, category]);
  const shown = found.slice(0, typed || category ? SHOWN : SUGGESTED);
  const chips = useMemo(() => CHIPS.filter((key) => index?.some((entry) => entry.person.category === key)), [index]);
  const optionId = (position: number) => `${id}-option-${position}`;

  const type = (next: string) => {
    setQuery(next);
    setActive(0);
  };
  const pick = (next: Category | null) => {
    setCategory(next);
    setActive(0);
    input.current?.focus();
  };
  const reset = () => {
    type("");
    setCategory(null);
    input.current?.focus();
  };

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || shown.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = (active + (event.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length;
      setActive(next);
      document.getElementById(optionId(next))?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") {
      event.preventDefault();
      document.getElementById(optionId(active))?.click();
    }
  };
  const onOpenPage = (event: MouseEvent, person: Person) => {
    // A plain click leaves this page: show that it is on its way. New tabs keep the search as it is.
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) setOpening(person.slug);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="layer-modal fixed inset-0 bg-scrim motion-safe:animate-fade-in" />
        <Dialog.Content
          data-people-search
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onClosed();
          }}
          className="layer-modal fixed inset-0 flex flex-col bg-surface-elevated text-fg outline-none motion-safe:animate-pop-in md:inset-x-0 md:top-24 md:bottom-auto md:mx-auto md:mk-search-fit md:w-full md:max-w-prose md:overflow-hidden md:rounded-xl md:border md:border-line"
        >
          <Dialog.Title className="sr-only">{t("title")}</Dialog.Title>

          {/* What you type. The line under it turns teal while the field has focus. */}
          <div className="flex h-16 shrink-0 items-center gap-3 border-b border-line ps-5 pe-3 transition-colors duration-micro focus-within:border-link">
            <Icon icon={Search} size="md" className="shrink-0 text-fg-tertiary" />
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
              aria-activedescendant={shown.length > 0 ? optionId(active) : undefined}
              aria-autocomplete="list"
              value={query}
              onChange={(event) => {
                type(event.target.value);
              }}
              onKeyDown={onKey}
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
                className="grid size-control-sm shrink-0 place-items-center rounded-full bg-canvas-muted text-fg-secondary transition-colors duration-micro hover:text-fg focus-visible:focus-ring"
              >
                <Icon icon={X} size="sm" />
              </button>
            ) : null}
            <Dialog.Close className="inline-flex h-control-sm shrink-0 items-center rounded-full px-2 text-small font-semibold text-link transition-colors duration-micro hover:text-fg focus-visible:focus-ring">
              <span className="md:hidden">{t("cancel")}</span>
              <span className="max-md:hidden">
                <Kbd aria-hidden>esc</Kbd>
                <span className="sr-only">{t("close")}</span>
              </span>
            </Dialog.Close>
          </div>

          {/* Narrow by field: the gallery's categories, only those somebody is in. */}
          {chips.length > 0 ? (
            <ScrollRow label={t("filter")} labels={{ back: tx("scroll.back"), next: tx("scroll.next") }} fade="from-surface-elevated" className="shrink-0 px-3 pt-2">
              {([null, ...chips] as const).map((key) => (
                <button
                  key={key ?? "all"}
                  type="button"
                  aria-pressed={category === key}
                  onClick={(event) => {
                    pick(key);
                    event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
                  }}
                  className="inline-flex h-control-sm shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-3 text-small font-medium text-fg-secondary transition-colors duration-micro hover:border-line-strong hover:text-fg focus-visible:focus-ring aria-pressed:border-fg aria-pressed:bg-fg aria-pressed:text-canvas"
                >
                  <Icon icon={key ? CATEGORY_ICONS[key] : LayoutGrid} size="sm" />
                  {key ? tx(`categories.${key}`) : tx("all")}
                </button>
              ))}
            </ScrollRow>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
            {load.status === "loading" ? (
              <div aria-busy className="grid pt-10">
                <p className="sr-only" role="status">
                  {t("loading")}
                </p>
                {Array.from({ length: 5 }, (_, row) => (
                  <div key={row} className="flex h-16 items-center gap-3 px-3">
                    <Skeleton className="size-touch-target shrink-0 rounded-full" />
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
                <p role="status" className="flex h-10 items-center px-3 text-caption font-semibold text-fg-secondary">
                  {typed || category ? t("results", { count: found.length }) : t("suggested")}
                </p>
                {shown.length > 0 ? (
                  <div id={`${id}-list`} role="listbox" aria-label={t("title")} style={{ "--active": active } as CSSProperties} className="mk-search-list">
                    {shown.map((person, position) => (
                      // Each result is the link to its page; the field keeps the focus and moves the choice.
                        <a
                          key={person.slug}
                          id={optionId(position)}
                          role="option"
                          aria-selected={position === active}
                          href={person.href}
                          tabIndex={-1}
                          onPointerMove={() => {
                            if (position !== active) setActive(position);
                          }}
                          onClick={(event) => {
                            onOpenPage(event, person);
                          }}
                          className="group flex h-16 items-center gap-3 rounded-lg px-3"
                        >
                          <Face person={person} />
                          <span className="grid min-w-0 flex-1 text-start">
                            <span className="truncate text-body font-semibold text-fg">
                              <Marked text={person.name} query={query} />
                            </span>
                            <span className="truncate text-small text-fg-secondary">
                              <Marked text={person.role} query={query} />
                            </span>
                          </span>
                          {person.locale === locale ? null : (
                            <span className="shrink-0 text-caption font-semibold text-fg-tertiary uppercase max-sm:hidden">
                              <span aria-hidden>{person.locale}</span>
                              <span className="sr-only">{t("pageIn", { language: tx(`languages.${person.locale}`) })}</span>
                            </span>
                          )}
                          <span className="shrink-0 rounded-full border border-line-strong px-2 py-0.5 text-caption font-medium text-fg-secondary">{t(`badges.${person.badge}`)}</span>
                          {/* The arrow follows the keyboard and the mouse; on touch screens only "on its way" shows. */}
                          <span className={cn("grid size-6 shrink-0 place-items-center text-link", opening === person.slug || "pointer-coarse:hidden")}>
                            {opening === person.slug ? (
                              <Spinner className="size-icon-sm" />
                            ) : (
                              <Icon
                                icon={ArrowUpRight}
                                size="sm"
                                className={cn("transition-opacity duration-micro rtl:-scale-x-100", position === active ? "opacity-100" : "opacity-0")}
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
                      <Link href="/templates" className="rounded-xs text-small font-semibold text-link transition-colors duration-micro hover:text-fg focus-visible:focus-ring">
                        {t("empty.templates")}
                      </Link>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-4 border-t border-line px-5 py-3 text-caption text-fg-secondary">
            <p className="min-w-0 flex-1 text-pretty">{t("note")}</p>
            {/* Keys only where there is a keyboard. */}
            <p aria-hidden className="hidden shrink-0 items-center gap-3 pointer-fine:md:flex">
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
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
