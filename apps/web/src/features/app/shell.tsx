"use client";

import { hasImage } from "@linkyo/blocks";
import { tokens } from "@linkyo/tokens";
import { Avatar, cn, Icon, initialsOf, Spinner } from "@linkyo/ui";
import { ChartNoAxesColumn, Check, CircleAlert, CircleDot, Eye, House, LayoutList, Palette, Plus, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { haptic } from "@/lib/haptics";
import { useAccount } from "@/features/account/store";
import { useOnTeam } from "@/features/admin/live";
import { Link, usePathname, useRouter } from "@/i18n/navigation";

import { AddSheet } from "./add-sheet";
import { useHasUnsavedDraft } from "./drafts";
import { EditSheet } from "./edit-sheet";
import { modified, NavRail, SectionPanel } from "./nav";
import { LAST_APP_PATH_KEY, ORIGIN_TAB_KEY, routeInfo, SETTINGS_HREF, TAB_HREF, TABS, type TabKey } from "./routes";
import { BackLink, ShellBackContext, ShellChromeContext } from "./screen";
import { useSite } from "./site-context";
import { useScrolled } from "./use-scrolled";

/** The four tabs of the phone tab bar (Add sits in the middle; Settings is the avatar in the top bar). */
const NAV: readonly { key: TabKey; icon: LucideIcon }[] = [
  { key: "home", icon: House },
  { key: "page", icon: LayoutList },
  { key: "design", icon: Palette },
  { key: "analytics", icon: ChartNoAxesColumn },
];

/** Where the legal notice is edited (its unsaved draft links there). */
const LEGAL_HREF = "/app/settings/legal";

/**
 * Browsers keep about 50 history entries per tab (Chrome, Firefox). From there a new page no longer
 * changes the history's length, so a length that stays the same no longer means "replaced".
 */
const HISTORY_CAP = 50;

export function ProfileAvatar({ size = "md", className }: { size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const { doc } = useSite();
  const avatar = doc.profile.avatar;
  return <Avatar name={doc.profile.displayName} src={hasImage(avatar) ? avatar.src : undefined} size={size} className={className} />;
}

/** "Saving…" shows only once a save has taken this long: local saves finish sooner and never flash. */
const SAVING_SETTLE = 1000;

type ShownSave = "saved" | "saving" | "error" | "tooLarge" | "unsavedLegal";

/**
 * What the save status says. An unsaved legal notice comes first (it is the only thing that waits
 * for an explicit save), then an error (a page too large to save says so: retrying cannot help),
 * then a save that is taking a while; otherwise "Saved".
 */
function useShownSave(): ShownSave {
  const { save, account } = useSite();
  const unsavedLegal = useHasUnsavedDraft(account.id);
  const snapshot = useAccount();
  const tooLarge = snapshot.status === "signedIn" && snapshot.syncError === "tooLarge";
  const state = save === "saved" ? "saved" : save === "saving" ? "saving" : "error";
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (state !== "saving") return;
    const timer = window.setTimeout(() => setSlow(true), SAVING_SETTLE);
    return () => {
      window.clearTimeout(timer);
      setSlow(false);
    };
  }, [state]);
  if (unsavedLegal) return "unsavedLegal";
  if (state === "error") return tooLarge ? "tooLarge" : "error";
  return state === "saving" && slow ? "saving" : "saved";
}

/**
 * "Saved" / "Saving…" / "Not saved" / "Legal notice not saved", announced politely. The status
 * element always holds the text it shows, so quick saves change nothing and nothing is read out.
 *
 * - `panel` (the section panel's foot): an inline glyph and text that wraps, never truncated.
 * - `compact` (the phone top bar, and the rail while the panel is folded): a glyph only when there is
 *   something to see; a lone green tick beside the avatar read as a "verified" badge.
 *
 * Only one of them is visible at any width (phone bar `lg:hidden`, panel `nav-folded:hidden`, rail
 * `hidden nav-folded:contents`), so only one live region speaks.
 */
export function SaveStatus({ layout }: { layout: "compact" | "panel" }) {
  const t = useTranslations("app.save");
  const shown = useShownSave();
  const text = t(shown);
  const compact = layout === "compact";
  const failed = shown === "error" || shown === "tooLarge";
  const glyph =
    shown === "saving" ? (
      <Spinner className={compact ? "size-icon-md" : "size-icon-sm"} />
    ) : (
      <Icon
        icon={shown === "saved" ? Check : failed ? CircleAlert : CircleDot}
        size={compact ? "md" : "sm"}
        className={shown === "saved" ? "text-success-strong" : failed ? "text-danger-strong" : undefined}
      />
    );

  if (compact) {
    return (
      // The glyph sits in a 44 px slot, so it lines up with the buttons beside it (or the rail's icons).
      <p role="status" className={shown === "saved" ? "sr-only" : "grid size-touch-target place-items-center"}>
        {shown === "saved" ? (
          text
        ) : shown === "unsavedLegal" ? (
          <Link
            href={LEGAL_HREF}
            className="grid size-touch-target place-items-center rounded-md text-fg transition-colors duration-micro hover:bg-hover active:bg-pressed focus-visible:focus-ring"
          >
            {glyph}
            <span className="sr-only">{text}</span>
          </Link>
        ) : (
          <>
            {glyph}
            <span className="sr-only">{text}</span>
          </>
        )}
      </p>
    );
  }

  // The panel is 144 px of text wide: "Impressum nicht gespeichert" wraps to a second line, and the
  // glyph stays with the first.
  const content = (
    <>
      {glyph}
      <span className="min-w-0">{text}</span>
    </>
  );
  return (
    <p role="status" className={cn("flex min-w-0 items-start", failed && "text-danger-strong")}>
      {shown === "unsavedLegal" ? (
        <Link href={LEGAL_HREF} className="flex min-w-0 items-start gap-2 rounded-sm font-semibold text-link transition-colors duration-micro hover:text-link-hover focus-visible:focus-ring">
          {content}
        </Link>
      ) : (
        <span className="flex min-w-0 items-start gap-2">{content}</span>
      )}
    </p>
  );
}

/**
 * Whether the screen's large title (the `h1` in `#main`) has scrolled up under the phone top bar.
 * The bar then shows the screen's name, as an iOS navigation bar does. A new observer is made for
 * each route, because each screen renders its own heading.
 */
function useTitleScrolledAway(pathname: string) {
  const [away, setAway] = useState(false);
  useEffect(() => {
    const heading = document.querySelector("#main h1");
    if (!heading) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Only "above the bar" counts: a heading below the fold is not intersecting either.
        if (entry) setAway(!entry.isIntersecting && entry.boundingClientRect.top < tokens.spacing["16"]);
      },
      // The top bar is h-16: the heading counts as gone once it is fully under the bar.
      { rootMargin: `-${tokens.spacing["16"]}px 0% 0% 0%` },
    );
    observer.observe(heading);
    return () => observer.disconnect();
  }, [pathname]);
  return away;
}

/*
 * Whether the last move came from the browser's history (Back, Forward, Safari's edge swipe) rather
 * than from a tap in the app. Any click starts a new move; a popstate marks one from history.
 */
let lastMoveWasPop = false;

function subscribeHistory(onChange: () => void) {
  const onPop = () => {
    lastMoveWasPop = true;
    onChange();
  };
  const onPress = () => {
    if (!lastMoveWasPop) return;
    lastMoveWasPop = false;
    onChange();
  };
  window.addEventListener("popstate", onPop);
  document.addEventListener("click", onPress, true);
  return () => {
    window.removeEventListener("popstate", onPop);
    document.removeEventListener("click", onPress, true);
  };
}

/*
 * The router renders the restored screen inside its own popstate listener, which is added at start-up
 * and so runs before ours (React finishes popstate updates at once). A render during that event is
 * therefore a history move too.
 */
const readLastMove = () =>
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- the only way to see the event being dispatched; React checks popstate the same way
  lastMoveWasPop || window.event?.type === "popstate";

function readOriginTab(): TabKey {
  try {
    const stored = window.sessionStorage.getItem(ORIGIN_TAB_KEY);
    return TABS.find((tab) => tab === stored) ?? "home";
  } catch {
    return "home";
  }
}

function remember(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Storage is blocked (private mode, settings): the app works the same, it only forgets.
  }
}

/**
 * The dashboard frame, one structure on every width.
 *
 * - Wide screens (ADR 0063): an icon rail (the symbol, Add, the places, Team area and Settings, then
 *   View my page and the fold toggle) and the section panel with the current place's parts and the
 *   save status. Rail + panel are the former 248 px sidebar; folded, only the 64 px rail stays.
 * - Phones: an iOS-style top bar (avatar → Settings, or "‹ back" on pushed screens; the screen's name
 *   once its title scrolls away; save state; the page) and a bottom tab bar with a labelled Add in
 *   the middle, within thumb reach.
 *
 * `data-grouped` and `group/app` mark the grouped look: a tinted ground with white groups, as in iOS
 * Settings. The team area has no such marker, so the screens it shares keep their outlined cards.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations("app");
  const pathname = usePathname();
  const router = useRouter();
  const { doc, account, setAddOpen, edit } = useSite();
  // Linkyo team members also see the way into the team area.
  const onTeam = useOnTeam(account.email);
  const info = routeInfo(pathname);
  // Settings, its panes and Invite are pushed over a tab (phones): that tab stays marked meanwhile.
  const pushedScreen = info.tab === null;
  const titleAway = useTitleScrolledAway(pathname);
  const scrolled = useScrolled();
  const lastMoveWasHistory = useSyncExternalStore(subscribeHistory, readLastMove, () => false);

  // Bookkeeping for a new path, done while rendering so the new screen sees it on its first render:
  // whether the user has moved inside the app (pushed panes animate only then) and how.
  const [route, setRoute] = useState({ path: pathname, navigated: false, pop: false, fromNav: false });
  // The place just tapped shows as selected at once, before its screen has loaded.
  const [pending, setPending] = useState<string | null>(null);
  // The tab Settings was opened from: it stays marked under Settings, and "‹ back" names it.
  const [origin, setOrigin] = useState<TabKey>(readOriginTab);
  if (route.path !== pathname) {
    // A move to the route just tapped in the chrome (rail, panel, tab bar) is a nav move: its item
    // stays where it is with focus, so the new screen does not slide in or take focus. Read before
    // `pending` is cleared.
    setRoute({ path: pathname, navigated: true, pop: lastMoveWasHistory, fromNav: pending === pathname });
    setPending(null);
  }
  if (info.tab && info.tab !== origin) setOrigin(info.tab);

  useEffect(() => remember(LAST_APP_PATH_KEY, pathname), [pathname]);
  useEffect(() => remember(ORIGIN_TAB_KEY, origin), [origin]);

  // A route change closes the Add and edit sheets (Back, the edge swipe, any link): a sheet never
  // stays open over another screen. Sheets that belong to a screen leave with it.
  const shownPath = useRef(pathname);
  useEffect(() => {
    if (shownPath.current === pathname) return;
    shownPath.current = pathname;
    setAddOpen(false);
    edit(null);
  }, [pathname, setAddOpen, edit]);

  // The paths visited in this tab, in step with the browser's history, so "‹ back" can go back
  // through history (Safari's swipe and Back then agree) when the parent is the previous page.
  // `index` is the entry shown: after a Back the entries ahead stay (Forward) until a new page drops
  // them. How the history's length changed tells a new page (the entries ahead go, one is added) from
  // a replaced one (a redirect: the length stays). When a move fits neither, only this page is known
  // and "‹ back" opens its link until the paths are known again: a wrong step back is worse.
  const visited = useRef({ paths: [] as string[], index: -1, length: 0 });
  useEffect(() => {
    const model = visited.current;
    const { paths } = model;
    const length = window.history.length;
    const ahead = paths.length - 1 - model.index;
    const restart = () => {
      paths.splice(0, Infinity, pathname);
      model.index = 0;
    };
    if (paths.length === 0) {
      restart();
    } else if (route.pop) {
      // One step, back first: if both neighbours match, a wrong guess then only costs a link.
      if (paths[model.index - 1] === pathname) model.index -= 1;
      else if (paths[model.index + 1] === pathname) model.index += 1;
      else restart();
    } else if (length === model.length - ahead + 1) {
      // A new page. With one entry ahead this is also what a replace looks like; in the app only
      // old Settings links are replaced, and they never follow a Back.
      paths.splice(model.index + 1, Infinity, pathname);
      model.index += 1;
    } else if (length === model.length && length < HISTORY_CAP) {
      paths[model.index] = pathname;
    } else {
      restart();
    }
    model.length = length;
    const extra = paths.length - HISTORY_CAP;
    if (extra > 0) {
      paths.splice(0, extra);
      model.index -= extra;
    }
  }, [pathname, route.pop]);
  const goBack = useCallback(
    (target: string) => {
      const { paths, index } = visited.current;
      if (index < 1 || paths[index - 1] !== target) return false;
      router.back();
      return true;
    },
    [router],
  );

  // Each tab keeps its scroll position while you visit another tab and come back with the tab bar.
  const scrollMemory = useRef(new Map<string, number>());
  const restoreFor = useRef<string | null>(null);
  const leave = useCallback(
    (to: string | null) => {
      scrollMemory.current.set(pathname, window.scrollY);
      restoreFor.current = to;
    },
    [pathname],
  );
  useLayoutEffect(() => {
    const target = restoreFor.current;
    restoreFor.current = null;
    const saved = scrollMemory.current.get(pathname);
    if (target === pathname) window.scrollTo({ top: saved ?? 0, behavior: "instant" });
    else if (route.pop && saved !== undefined) window.scrollTo({ top: saved, behavior: "instant" });
    // A position is used once: the user scrolls on from there, and only the next tap away saves it
    // again. Otherwise a later Back would jump to where the screen was before that.
    scrollMemory.current.delete(pathname);
  }, [pathname, route.pop]);

  // A move that removed the focused element (the avatar, "‹ back", a pane's toolbar) would leave focus
  // on the page itself: the new screen's title takes it instead. Screens run their effects first, so a
  // pushed pane has already focused its own title, and a tab or sidebar row that stays keeps focus.
  useEffect(() => {
    if (!route.navigated) return;
    const focused = document.activeElement;
    if (focused && focused !== document.body) return;
    document.querySelector<HTMLElement>("#main h1")?.focus({ preventScroll: true });
  }, [pathname, route.navigated]);

  // Unsaved edits (the legal notice) live outside their screen, so closing or reloading the tab asks
  // first wherever the user is, not only on the screen they were typed on.
  const unsaved = useHasUnsavedDraft(account.id);
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  const chrome = useMemo(() => ({ navigated: route.navigated, pop: route.pop, fromNav: route.fromNav }), [route.navigated, route.pop, route.fromNav]);

  const photo = hasImage(doc.profile.avatar);
  const initials = initialsOf(doc.profile.displayName);
  // Without a photo the avatar shows the initials, so its name contains them too: a voice control user
  // can say what they see (WCAG 2.5.3). A name without letters shows a person glyph and no initials.
  const avatarName = !photo && initials ? t("settingsButtonInitials", { initials }) : t("settingsButton");
  const pendingTab = NAV.find((item) => TAB_HREF[item.key] === pending)?.key;
  const selectedTab = pendingTab ?? info.tab ?? (pushedScreen ? origin : null);
  const backTarget = info.parent === "origin" ? { href: TAB_HREF[origin], label: t(`nav.${origin}`) } : info.parent ? { href: info.parent, label: t("nav.settings") } : null;

  return (
    <ShellChromeContext.Provider value={chrome}>
      <ShellBackContext.Provider value={goBack}>
        {/* data-console="frame": the dashboard and everything it opens (sheets, menus, toasts) are black and grey (ADR 0062). */}
        <div data-grouped data-console="frame" className="group/app flex min-h-dvh bg-canvas-muted text-fg">
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:layer-toast focus:rounded-sm focus:bg-surface-elevated focus:px-3 focus:py-2 focus:focus-ring"
          >
            {t("skip")}
          </a>

          {/* Wide screens: the rail and the section panel. A plain box, not an <aside>: it holds the
              main navigation, which is named. The panel's width is CSS only (nav-folded:), set before
              paint, so the frame never shifts. */}
          <div data-nav className="sticky top-0 hidden h-dvh shrink-0 lg:flex">
            <NavRail pathname={pathname} pending={pending} onNavigate={setPending} onTeam={onTeam} status={<SaveStatus layout="compact" />} />
            <SectionPanel pathname={pathname} pending={pending} onNavigate={setPending} status={<SaveStatus layout="panel" />} />
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            {/* Phones: one row like an iOS navigation bar, on the solid ground; its hairline shows only
                once content scrolls under it. The side columns share the width equally, so the name
                stays centred, but never shrink below their content: a long back label stays whole and
                the title truncates instead. Safe areas are physical (pl/pr): they do not mirror in Arabic. */}
            <header
              data-scrolled={scrolled ? "" : undefined}
              className="layer-sticky sticky top-0 grid h-16 grid-cols-[minmax(max-content,1fr)_minmax(0,auto)_minmax(max-content,1fr)] items-center border-b border-transparent bg-canvas-muted pr-[max(var(--spacing-2),env(safe-area-inset-right))] pl-[max(var(--spacing-2),env(safe-area-inset-left))] transition-colors duration-micro data-[scrolled]:border-line short:static lg:hidden"
            >
              {backTarget ? (
                <BackLink href={backTarget.href} label={backTarget.label} className="justify-self-start" />
              ) : (
                <Link
                  href={SETTINGS_HREF}
                  aria-label={avatarName}
                  onClick={(event) => {
                    if (!modified(event)) leave(null);
                  }}
                  className="grid size-touch-target place-items-center justify-self-start rounded-full transition-colors duration-micro hover:bg-hover active:bg-pressed focus-visible:focus-ring"
                >
                  <ProfileAvatar size="sm" />
                </Link>
              )}
              {/* The h1 already names the screen for screen readers; this copy is only for the eyes. */}
              <p aria-hidden className={cn("min-w-0 truncate text-center text-body font-semibold transition-opacity duration-micro", titleAway ? "opacity-100" : "opacity-0")}>
                {t(info.title)}
              </p>
              <div className="flex items-center justify-self-end">
                <SaveStatus layout="compact" />
                <Link
                  href="/app/preview"
                  aria-label={t("viewPage")}
                  className="grid size-touch-target place-items-center rounded-md transition-colors duration-micro hover:bg-hover active:bg-pressed focus-visible:focus-ring"
                >
                  <Icon icon={Eye} size="md" />
                </Link>
              </div>
            </header>
            <main id="main" tabIndex={-1} className="min-w-0 flex-1 pb-[calc(var(--spacing-24)+env(safe-area-inset-bottom))] outline-none lg:pb-0">
              {children}
            </main>
          </div>

          <nav
            data-tabbar
            aria-label={t("nav.label")}
            className="layer-sticky fixed inset-x-0 bottom-0 border-t border-line bg-surface pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] lg:hidden"
          >
            <ul className="mx-auto grid h-16 max-w-prose grid-cols-5">
              {NAV.slice(0, 2).map((item) => (
                <TabLink
                  key={item.key}
                  item={item}
                  label={t(`nav.${item.key}`)}
                  current={info.tab === item.key}
                  origin={pushedScreen && origin === item.key}
                  pending={pendingTab === item.key}
                  selected={selectedTab === item.key}
                  onLeave={(href) => {
                    setPending(href);
                    leave(href);
                  }}
                />
              ))}
              {/* Add is a tab like the others: flat in the bar and labelled, so its meaning is plain. The
                  teal pill marks it as the main action without lifting it out of the bar. */}
              <li className="grid">
                <button
                  type="button"
                  onClick={() => {
                    haptic();
                    setAddOpen(true);
                  }}
                  className="group grid content-center justify-items-center gap-1 text-caption font-medium text-link focus-visible:focus-ring"
                >
                  <span className="grid h-control-sm w-12 place-items-center rounded-full bg-primary text-primary-fg transition-[background-color,scale] duration-spring ease-spring group-hover:bg-primary-hover group-active:scale-pressed group-active:duration-micro motion-reduce:group-active:scale-none">
                    <Icon icon={Plus} size="md" />
                  </span>
                  {t("nav.add")}
                </button>
              </li>
              {NAV.slice(2, 4).map((item) => (
                <TabLink
                  key={item.key}
                  item={item}
                  label={t(`nav.${item.key}`)}
                  current={info.tab === item.key}
                  origin={pushedScreen && origin === item.key}
                  pending={pendingTab === item.key}
                  selected={selectedTab === item.key}
                  onLeave={(href) => {
                    setPending(href);
                    leave(href);
                  }}
                />
              ))}
            </ul>
          </nav>

          <AddSheet />
          <EditSheet />
        </div>
      </ShellBackContext.Provider>
    </ShellChromeContext.Provider>
  );
}

/**
 * A tab. As on iOS, the chosen tab is marked by the tint alone (no pill behind it). Under a pushed
 * screen (Settings, its panes, Invite) the tab it was opened from stays marked (`data-origin`),
 * without claiming to be the current page. Tapping the current tab again scrolls its screen back to
 * the top.
 */
function TabLink({
  item,
  label,
  current,
  origin,
  pending,
  selected,
  onLeave,
}: {
  item: { key: TabKey; icon: LucideIcon };
  label: string;
  current: boolean;
  origin: boolean;
  pending: boolean;
  selected: boolean;
  onLeave: (href: string) => void;
}) {
  const href = TAB_HREF[item.key];
  return (
    <li className="grid">
      <Link
        href={href}
        // Each tab restores its own scroll position (see AppShell).
        scroll={false}
        aria-current={current ? "page" : undefined}
        data-origin={origin ? "" : undefined}
        data-pending={pending ? "" : undefined}
        data-selected={selected ? "" : undefined}
        onClick={(event) => {
          if (modified(event)) return;
          if (current) {
            event.preventDefault();
            const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
            return;
          }
          haptic();
          onLeave(href);
        }}
        className="group grid content-center justify-items-center gap-1 text-caption font-medium text-fg-secondary transition-colors duration-micro focus-visible:focus-ring data-[selected]:font-semibold data-[selected]:text-link"
      >
        {/* A press dips the icon like a native tab: in fast, back out on the spring. */}
        <span className="grid h-control-sm w-12 place-items-center transition-[scale] duration-spring ease-spring group-active:scale-pressed group-active:duration-micro motion-reduce:group-active:scale-none">
          <Icon icon={item.icon} size="lg" />
        </span>
        {label}
      </Link>
    </li>
  );
}
