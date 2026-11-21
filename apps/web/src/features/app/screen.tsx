"use client";

import { cn, Icon, IconButton } from "@linkyo/ui";
import { ChevronLeft, Redo2, Undo2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { Link } from "@/i18n/navigation";
import { isRtl } from "@/i18n/routing";

import { PlainPreviewAside, PreviewAside } from "./preview";
import { useSite } from "./site-context";
import { useScrolled } from "./use-scrolled";

/**
 * Set by the dashboard shell (AppShell). `navigated`: the user has moved inside the app since it
 * loaded; `pop`: that last move came from the browser's history (Back, Safari's edge swipe).
 * Outside the shell (the team area) there is none, and screens keep their own simple header.
 */
export const ShellChromeContext = createContext<{ navigated: boolean; pop: boolean } | null>(null);

/** True inside the dashboard shell. */
export function useShellChrome(): boolean {
  return useContext(ShellChromeContext) !== null;
}

/**
 * Set by the shell: goes back to `target` through the browser's history when that is where the user
 * just came from (so history and Safari's swipe stay in step) and says whether it did.
 */
export const ShellBackContext = createContext<((target: string) => boolean) | null>(null);

/**
 * "‹ Start", "‹ Einstellungen": back to the parent screen. A real link (it opens in a new tab, and
 * works before scripts load); in the app it steps back through history when the parent is the
 * previous page. The name says what it does: "Zurück: Start".
 */
export function BackLink({ href, label, variant = "bar", className }: { href: string; label: string; variant?: "bar" | "toolbar"; className?: string }) {
  const t = useTranslations("app");
  const goBack = useContext(ShellBackContext);
  return (
    <Link
      href={href}
      onClick={(event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (goBack?.(href)) event.preventDefault();
      }}
      className={cn(
        "inline-flex min-w-0 items-center gap-1 rounded-sm pe-2 text-link transition-colors duration-micro hover:text-link-hover focus-visible:focus-ring",
        variant === "bar" ? "h-touch-target max-w-full text-body font-semibold" : "h-control-sm shrink-0 text-small font-semibold",
        className,
      )}
    >
      <Icon icon={ChevronLeft} size={variant === "bar" ? "md" : "sm"} className="shrink-0 rtl:-scale-x-100" />
      <span className="sr-only">{t("back")}: </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

/**
 * Undo / redo for everything on the page (also ⌘Z / ⇧⌘Z). In Arabic "back" points right, so the
 * arrows are mirrored there, like the chevrons elsewhere in the dashboard.
 */
export function UndoRedo() {
  const t = useTranslations("app");
  const { dispatch, canUndo, canRedo } = useSite();
  return (
    <div className="flex items-center gap-1">
      <IconButton icon={Undo2} label={t("undo")} shortcut="⌘Z" disabled={!canUndo} onClick={() => dispatch({ type: "undo" })} className="rtl:[&_svg]:-scale-x-100" />
      <IconButton icon={Redo2} label={t("redo")} shortcut="⇧⌘Z" disabled={!canRedo} onClick={() => dispatch({ type: "redo" })} className="rtl:[&_svg]:-scale-x-100" />
    </div>
  );
}

interface ScreenProps {
  title: string;
  lead?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** The live page beside the screen (from the desk breakpoint). */
  preview?: boolean;
  /** A wider column (Statistik). */
  wide?: boolean;
  /** A pushed screen (a Settings pane): the desktop toolbar leads with "‹ label". */
  back?: { href: string; label: string } | undefined;
}

/** A dashboard screen: title + actions, a readable column, and (optionally) the live page beside it. */
export function Screen(props: ScreenProps) {
  const chrome = useContext(ShellChromeContext);
  return chrome ? <ShellScreen {...props} chrome={chrome} /> : <PlainScreen {...props} />;
}

/** Content and toolbar share the start edge: x = 288 on every wide screen, whatever the tab. */
const gutters =
  "pl-[max(var(--spacing-4),env(safe-area-inset-left))] pr-[max(var(--spacing-4),env(safe-area-inset-right))] md:pl-[max(var(--spacing-8),env(safe-area-inset-left))] md:pr-[max(var(--spacing-8),env(safe-area-inset-right))] lg:ps-10 lg:pe-8";

/**
 * Inside the shell. Phones: an iOS large title that scrolls up under the top bar (which then shows the
 * name). Wide screens: a sticky 64 px toolbar with the title and the screen's actions, on the solid
 * ground; its hairline appears only once content scrolls under it. One h1 either way.
 */
function ShellScreen({ title, lead, actions, children, preview = false, wide = false, back, chrome }: ScreenProps & { chrome: { navigated: boolean; pop: boolean } }) {
  const scrolled = useScrolled();
  const rtl = isRtl(useLocale());
  const heading = useRef<HTMLHeadingElement>(null);
  // A pane opened from inside the app slides in from the reading direction and takes focus, as a
  // pushed screen does on iOS. Moves through history skip both: Safari has already animated its
  // snapshot, and a direct load has nothing to come from.
  const [pushed] = useState(() => back !== undefined && chrome.navigated && !chrome.pop);
  useEffect(() => {
    if (pushed) heading.current?.focus({ preventScroll: true });
  }, [pushed]);
  const column = wide ? "max-w-content" : "max-w-prose";
  return (
    <div className="flex min-w-0">
      <div
        className={cn("min-w-0 flex-1", pushed && "motion-safe:animate-page-in")}
        // page-in comes from the end side (--step 1); in Arabic the reading direction is mirrored.
        style={pushed && rtl ? ({ "--step": -1 } as CSSProperties) : undefined}
      >
        <header
          data-app-toolbar
          data-scrolled={scrolled ? "" : undefined}
          className={cn(
            gutters,
            "pt-6 lg:layer-sticky lg:sticky lg:top-0 lg:h-16 lg:border-b lg:border-transparent lg:bg-canvas-muted lg:pt-0 lg:transition-colors lg:duration-micro lg:data-[scrolled]:border-line",
          )}
        >
          <div className={cn("mx-auto flex items-end gap-3 lg:mx-0 lg:h-full lg:items-center", column)}>
            {back ? <BackLink href={back.href} label={back.label} variant="toolbar" className="max-lg:hidden" /> : null}
            <h1
              ref={heading}
              tabIndex={-1}
              className="min-w-0 flex-1 text-h2 tracking-tight text-balance outline-none max-lg:line-clamp-2 rtl:tracking-normal lg:truncate lg:text-h3"
            >
              {title}
            </h1>
            {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
          </div>
        </header>
        <div className={cn(gutters, "pt-4 pb-10 lg:pt-2")}>
          <div className={cn("mx-auto grid grid-cols-1 gap-6 lg:mx-0", column)}>
            {lead ? <div className="text-small font-regular text-fg-secondary">{lead}</div> : null}
            {children}
          </div>
        </div>
      </div>
      {preview ? <PreviewAside /> : null}
    </div>
  );
}

/** Outside the shell (the team area): the title in the column, as it always was. */
function PlainScreen({ title, lead, actions, children, preview = false, wide = false }: ScreenProps) {
  return (
    <div className="flex min-w-0">
      <div className="min-w-0 flex-1">
        <div className={cn("mx-auto grid grid-cols-1 gap-6 px-4 pt-6 pb-10 md:px-8 lg:pt-10", wide ? "max-w-content" : "max-w-prose")}>
          <header className="flex flex-wrap items-end gap-3">
            <div className="grid min-w-0 flex-1 gap-1">
              <h1 className="text-h2 tracking-tight">{title}</h1>
              {lead ? <div className="text-small text-fg-secondary">{lead}</div> : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          </header>
          {children}
        </div>
      </div>
      {preview ? <PlainPreviewAside /> : null}
    </div>
  );
}

/**
 * A card on the ground; the dashboard's basic surface. In the app shell it is a group: the group
 * fill, outlined only on wide screens (phones set it apart by the fill alone, as iOS does).
 */
export function Panel({ children, className, title, action, id }: { children: ReactNode; className?: string; title?: string; action?: ReactNode; id?: string }) {
  return (
    <section
      aria-labelledby={title && id ? id : undefined}
      className={cn(
        "grid min-w-0 grid-cols-1 content-start gap-4 rounded-lg border border-line bg-surface p-4 lg:p-6",
        "group-data-[grouped]/app:bg-group max-lg:group-data-[grouped]/app:border-transparent",
        className,
      )}
    >
      {title ? (
        <div className="flex items-center justify-between gap-3">
          {/* With an id it is a jump target of the section panel: focusable by script, no ring of its own. */}
          <h2 id={id} tabIndex={id ? -1 : undefined} className={cn("text-title rtl:tracking-normal", id && "outline-none")}>
            {title}
          </h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
