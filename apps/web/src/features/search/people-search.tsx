"use client";

import { Icon, Kbd } from "@linkyo/ui";
import { Search } from "lucide-react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { loadPeople } from "./people-store";

/** The dialog and everything in it load when someone reaches for the search, not with the page. */
const Panel = dynamic(() => import("./people-search-panel").then((module) => module.PeopleSearchPanel), { ssr: false });

const never = () => () => undefined;
const onApple = () => /Mac|iPhone|iPad/.test(navigator.userAgent);

/**
 * The way into the people search: a magnifier in the header (with its name and shortcut where there
 * is room) and Ctrl/⌘ K from anywhere. Reaching for it (pointer, focus, touch) already fetches the
 * dialog and the list of people, so it opens ready.
 */
export function PeopleSearch() {
  const t = useTranslations("search");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false);
  const apple = useSyncExternalStore(never, onApple, () => false);
  const button = useRef<HTMLButtonElement>(null);

  const warm = () => {
    void import("./people-search-panel");
    void loadPeople(locale).catch(() => undefined);
  };
  const show = () => {
    setUsed(true);
    setOpen(true);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      // Another dialog is in front (a page preview, a confirmation): the shortcut is not for us.
      if (document.querySelector("[role=dialog], [role=alertdialog]") && !document.querySelector("[data-people-search]")) return;
      event.preventDefault();
      setUsed(true);
      setOpen((now) => !now);
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
        onClick={show}
        onPointerEnter={warm}
        onFocus={warm}
        onTouchStart={warm}
        aria-label={t("open")}
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
        className="inline-flex size-control-md shrink-0 items-center justify-center gap-2 rounded-full text-fg transition-colors duration-micro hover:bg-hover focus-visible:focus-ring active:scale-pressed xl:w-auto xl:border xl:border-line xl:bg-surface xl:ps-3 xl:pe-2 xl:text-fg-secondary xl:hover:border-line-strong xl:hover:bg-surface xl:hover:text-fg"
      >
        <Icon icon={Search} size="md" />
        <span className="hidden text-small font-medium xl:inline">{t("openShort")}</span>
        {/* The shortcut is drawn, not written: the button's name stays "Search people". */}
        <Kbd aria-hidden dir="ltr" data-keys={apple ? "⌘ K" : "Ctrl K"} className="hidden px-2 after:content-[attr(data-keys)] pointer-fine:xl:inline-flex" />
      </button>
      {used ? <Panel open={open} onOpenChange={setOpen} onClosed={() => button.current?.focus()} locale={locale} /> : null}
    </>
  );
}
