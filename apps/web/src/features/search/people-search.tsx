"use client";

import { Icon, Kbd } from "@linkyo/ui";
import { Search } from "lucide-react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { closeSearch, isSearchOpen, onSearchChange, openSearch } from "./people-history";
import { loadPeople } from "./people-store";

/** The dialog and everything in it load when someone reaches for the search, not with the page. */
const Panel = dynamic(() => import("./people-search-panel").then((module) => module.PeopleSearchPanel), { ssr: false });

const never = () => () => undefined;
const onApple = () => /Mac|iPhone|iPad/.test(navigator.userAgent);
const LENDER = "data-keyboard-lender";

/**
 * Phones only show their keyboard for a field that takes the focus inside the tap itself. The
 * search field arrives a moment later, so an unseen field takes the focus now and hands it on:
 * the keyboard is up when the search appears, as in an app.
 */
function lendKeyboard() {
  if (!window.matchMedia("(pointer: coarse)").matches || document.querySelector(`[${LENDER}]`)) return;
  const lender = document.createElement("input");
  lender.setAttribute(LENDER, "");
  lender.setAttribute("aria-hidden", "true");
  lender.tabIndex = -1;
  lender.className = "mk-keyboard-lender";
  document.body.append(lender);
  lender.focus({ preventScroll: true });
}
const returnKeyboard = () => {
  document.querySelector(`[${LENDER}]`)?.remove();
};

/**
 * The way into the people search: a magnifier in the header (with its name and shortcut where there
 * is room) and Ctrl/⌘ K from anywhere. Reaching for it (pointer, focus, touch) already fetches the
 * dialog and the list of people, so it opens ready. Whether it is open is read from the browser's
 * history (people-history.ts), so back closes it.
 */
export function PeopleSearch() {
  const t = useTranslations("search");
  const locale = useLocale();
  const open = useSyncExternalStore(onSearchChange, isSearchOpen, () => false);
  const [used, setUsed] = useState(false);
  const apple = useSyncExternalStore(never, onApple, () => false);
  const button = useRef<HTMLButtonElement>(null);
  // Once opened, the dialog stays mounted, so it can leave with a motion and open again at once.
  if (open && !used) setUsed(true);

  const warm = () => {
    void import("./people-search-panel");
    void loadPeople(locale).catch(() => undefined);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      // Another dialog is open in front (a page preview, a confirmation, the phone menu): the
      // shortcut is not for us. Closed ones may stay in the page (the menu is a hidden popover).
      const others = document.querySelectorAll<HTMLElement>("[role=dialog]:not([data-people-search]), [role=alertdialog]");
      if (!isSearchOpen() && [...others].some((element) => element.checkVisibility())) return;
      event.preventDefault();
      if (isSearchOpen()) closeSearch();
      else openSearch();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => {
          lendKeyboard();
          openSearch();
        }}
        onPointerEnter={warm}
        onFocus={warm}
        onTouchStart={warm}
        aria-label={t("open")}
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
        className="inline-flex size-control-md shrink-0 items-center justify-center gap-2 rounded-full text-fg transition-[background-color,border-color,color,scale] duration-micro hover:bg-hover focus-visible:focus-ring active:scale-pressed xl:w-auto xl:border xl:border-line xl:bg-surface xl:ps-3 xl:pe-2 xl:text-fg-secondary xl:hover:border-line-strong xl:hover:bg-surface xl:hover:text-fg"
      >
        <Icon icon={Search} size="md" />
        <span className="hidden text-small font-medium xl:inline">{t("openShort")}</span>
        {/* The shortcut is drawn, not written: the button's name stays "Search people". */}
        <Kbd aria-hidden dir="ltr" data-keys={apple ? "⌘ K" : "Ctrl K"} className="hidden px-2 after:content-[attr(data-keys)] pointer-fine:xl:inline-flex" />
      </button>
      {used ? (
        <Panel
          open={open}
          onClose={() => {
            returnKeyboard();
            closeSearch();
          }}
          onReady={returnKeyboard}
          onClosed={() => button.current?.focus()}
          locale={locale}
        />
      ) : null}
    </>
  );
}
