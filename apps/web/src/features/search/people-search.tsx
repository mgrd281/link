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
  // How the visitor last acted: a tap or click closes the search without a focus ring on the way back.
  const lastInput = useRef<"pointer" | "keyboard">("pointer");
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
    const onPointer = () => {
      lastInput.current = "pointer";
    };
    const onAnyKey = () => {
      lastInput.current = "keyboard";
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onAnyKey, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onAnyKey, true);
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
        // The quiet return (see onClosed) lasts until the next key or until focus moves on.
        onKeyDown={(event) => {
          delete event.currentTarget.dataset.quietFocus;
        }}
        onBlur={(event) => {
          delete event.currentTarget.dataset.quietFocus;
        }}
        onTouchStart={warm}
        aria-label={t("open")}
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
        className="relative inline-flex size-control-md shrink-0 items-center justify-center gap-2 rounded-full text-fg transition-[background-color,border-color,color,scale] duration-micro before:absolute before:inset-0 pointer-coarse:before:-inset-0.5 hover:bg-hover active:bg-pressed focus-visible:focus-ring data-quiet-focus:focus-visible:outline-none active:scale-pressed xl:w-auto xl:bg-canvas-muted xl:ps-3 xl:pe-2 xl:text-fg-secondary xl:hover:bg-tinted xl:hover:text-tinted-fg"
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
          // Focus goes back to the magnifier either way, so keyboards and screen readers land where they
          // left. After a tap or a click it shows no ring, as in an app: the ring is for keyboard use.
          onClosed={() => {
            const target = button.current;
            if (!target) return;
            if (lastInput.current === "pointer") target.dataset.quietFocus = "";
            target.focus({ preventScroll: true });
          }}
          locale={locale}
        />
      ) : null}
    </>
  );
}
