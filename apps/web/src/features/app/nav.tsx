"use client";

import { tokens } from "@linkyo/tokens";
import { cn, Icon, icons, LogoSymbol, Tooltip } from "@linkyo/ui";
import { ChartNoAxesColumn, Eye, Gift, House, Palette, PanelLeftClose, PanelLeftOpen, Plus, Settings, ShieldCheck, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, type MouseEvent, type ReactNode } from "react";

import { accountStore } from "@/features/account/store";
import { useReferrals } from "@/features/referrals/use-referrals";
import { Link } from "@/i18n/navigation";
import { isRtl } from "@/i18n/routing";
import { haptic } from "@/lib/haptics";

import { jumpTo, rowAnchor } from "./jump";
import { useNavPanel } from "./nav-state";
import { hasSectionPanel, isReturnPath, NAV_ANCHORS, routeInfo, SECTION_HREF, SETTINGS_HREF, type SectionKey } from "./routes";
import { useSite } from "./site-context";
import { statsSource } from "./stats";

/*
 * The wide-screen navigation (lg and up, ADR 0063): a 64 px icon rail with the places, and beside it
 * a 184 px section panel with the parts of the current place. The panel shows only where a place has
 * four or more parts, or panes of its own (Stats, Invite, Settings; see `hasSectionPanel`): Home,
 * Page and Design give its width to their content instead (the "dashboard on laptops" decision). It
 * folds away from the foot of the rail; the choice lives on <html data-nav-panel> (see nav-state.ts),
 * so the width is CSS only.
 */

/** Whether the current place shows the section panel on wide screens (Stats only while it counts). */
export const sectionPanelShown = (section: SectionKey): boolean => hasSectionPanel(section, statsSource() !== "none");

/** A click that opens a new tab or window, which leaves this page as it is. */
export const modified = (event: MouseEvent) => event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

/** The places in the rail, in order; Team area and Settings sit at its bottom. */
const PLACES: readonly { key: SectionKey; icon: LucideIcon }[] = [
  { key: "home", icon: House },
  { key: "page", icon: icons.page },
  { key: "design", icon: Palette },
  { key: "analytics", icon: ChartNoAxesColumn },
  { key: "invite", icon: Gift },
];

const TEAM_HREF = "/admin";

/** Radix sides are physical: the rail is at the right edge in Arabic, so its tooltips open to the left. */
/** A rail control sits 10 px inside the 64 px rail; 12 px puts its tip just outside the rail, never over its edge. */
const RAIL_TIP_OFFSET = tokens.spacing["3"];
const useTooltipSide = () => (isRtl(useLocale()) ? "left" : "right");

/** A 44 px control of the rail (links, the fold toggle): quiet until hovered or chosen. */
const railControl =
  "relative grid size-touch-target place-items-center rounded-md text-fg-secondary transition-colors duration-micro hover:bg-hover hover:text-fg active:bg-pressed focus-visible:focus-ring";

/**
 * The rail item shown as chosen. A tapped place or panel route shows at once, before its screen has
 * loaded: a dashboard path marks its place, anything else (the team area) marks itself.
 */
function railSelection(pathname: string, pending: string | null): string {
  if (pending === null) return SECTION_HREF[routeInfo(pathname).section];
  return isReturnPath(pending) ? SECTION_HREF[routeInfo(pending).section] : pending;
}

interface NavProps {
  /** The current path, without the locale. */
  pathname: string;
  /** The route just tapped in the rail or the panel, until its screen has loaded. */
  pending: string | null;
  onNavigate: (href: string) => void;
}

/**
 * One place of the rail: an icon with its name for screen readers and in a tooltip (the same words,
 * so voice control can say what it sees). `current`: `page` on the place's own route, `true` under it
 * (a Settings pane). `selected` is the filled tile.
 */
function RailLink({
  href,
  icon,
  label,
  current,
  selected,
  onNavigate,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  current?: "page" | "true" | undefined;
  selected: boolean;
  onNavigate?: ((href: string) => void) | undefined;
}) {
  const side = useTooltipSide();
  return (
    <Tooltip content={label} side={side} sideOffset={RAIL_TIP_OFFSET}>
      <Link
        href={href}
        aria-current={current}
        data-selected={selected ? "" : undefined}
        onClick={(event) => {
          if (current !== "page" && !modified(event)) onNavigate?.(href);
        }}
        className={cn(
          railControl,
          // The chosen place is a filled dark tile (17:1 on the rail); Add is a soft circle, so the two never read alike.
          "data-[selected]:bg-primary data-[selected]:text-primary-fg data-[selected]:hover:bg-primary-hover forced-colors:[&[aria-current]]:outline",
        )}
      >
        <Icon icon={icon} size="md" />
        <span className="sr-only">{label}</span>
      </Link>
    </Tooltip>
  );
}

/** Folds the section panel away or brings it back; remembered per browser. No shortcut, no animation. */
function NavPanelToggle() {
  const t = useTranslations("app.nav");
  const side = useTooltipSide();
  const { open, toggle } = useNavPanel();
  return (
    <Tooltip content={t("panel")} side={side} sideOffset={RAIL_TIP_OFFSET}>
      <button type="button" aria-label={t("panel")} aria-expanded={open} aria-controls="nav-panel" onClick={toggle} className={railControl}>
        <Icon icon={open ? PanelLeftClose : PanelLeftOpen} size="md" />
      </button>
    </Tooltip>
  );
}

/**
 * The rail, top to bottom: the Linkyo symbol (a picture, not a link), Add, the places, then Team
 * area and Settings at the bottom of the same nav; in the foot View my page, the compact save status
 * (while the panel is folded or the place has none: the panel shows it otherwise) and the fold
 * toggle (only where there is a panel). Below about 560 px of height the places scroll; the symbol,
 * Add and the foot stay.
 */
export function NavRail({ pathname, pending, onNavigate, onTeam, status, panel }: NavProps & { onTeam: boolean; status: ReactNode; panel: boolean }) {
  const t = useTranslations("app");
  const side = useTooltipSide();
  const { setAddOpen, previewHref } = useSite();
  const { section } = routeInfo(pathname);
  const selected = railSelection(pathname, pending);
  const place = (key: SectionKey, icon: LucideIcon) => {
    const href = SECTION_HREF[key];
    return (
      <li key={key}>
        <RailLink
          href={href}
          icon={icon}
          label={t(`nav.${key}`)}
          current={pathname === href ? "page" : section === key ? "true" : undefined}
          selected={selected === href}
          onNavigate={onNavigate}
        />
      </li>
    );
  };

  return (
    <div className="flex w-nav-rail shrink-0 flex-col items-center border-e border-line bg-surface pb-3">
      {/* Shares the 64 px line with the toolbar and the preview header. */}
      <div className="grid h-16 shrink-0 place-items-center text-fg">
        <LogoSymbol className="size-8" title="Linkyo" tone="mono" />
      </div>
      <Tooltip content={t("nav.add")} side={side} sideOffset={RAIL_TIP_OFFSET}>
        <button
          type="button"
          aria-label={t("nav.add")}
          onClick={() => {
            haptic();
            setAddOpen(true);
          }}
          // A soft circle: the main action, but never mistaken for the chosen place. The transparent
          // border shows in forced colours.
          className="relative grid size-touch-target shrink-0 place-items-center rounded-full border border-transparent bg-tinted text-tinted-fg transition-colors duration-micro hover:bg-tinted-hover focus-visible:focus-ring active:bg-tinted-hover"
        >
          <Icon icon={Plus} size="md" />
        </button>
      </Tooltip>
      {/* py-1 keeps the focus ring inside the scroller. */}
      <nav aria-label={t("nav.label")} className="mt-3 flex min-h-0 w-full flex-1 flex-col items-center overflow-y-auto py-1">
        {/* Safari (VoiceOver) drops the list semantics of a <ul> without bullets unless the role is set. */}
        {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- see above */}
        <ul role="list" className="grid gap-1">
          {PLACES.map(({ key, icon }) => place(key, icon))}
        </ul>
        {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- see above */}
        <ul role="list" className="mt-auto grid gap-1 pt-3">
          {onTeam ? (
            <li>
              <RailLink href={TEAM_HREF} icon={ShieldCheck} label={t("teamArea")} selected={selected === TEAM_HREF} onNavigate={onNavigate} />
            </li>
          ) : null}
          {place("settings", Settings)}
        </ul>
      </nav>
      {/* Not places: outside the nav. */}
      <div className="grid gap-1 pt-1">
        <RailLink href={previewHref} icon={Eye} label={t("viewPage")} selected={false} />
        {/* `contents`, not a grid box: while "Saved" is only read out (sr-only), it takes no row and no gap, so the eye does not move when the panel folds.
            Where the place has no panel, the status lives here, and there is nothing to fold. */}
        <div className={panel ? "hidden nav-folded:contents" : "contents"}>{status}</div>
        {panel ? <NavPanelToggle /> : null}
      </div>
    </div>
  );
}

/** One entry of the section panel. */
type PanelItem =
  /** A real page (a Settings pane). */
  | { kind: "route"; key: string; label: string; href: string }
  /** A part of this screen: scrolls there and focuses its title. */
  | { kind: "anchor"; key: string; label: string; target: string };

const anchor = (target: string, label: string): PanelItem => ({ kind: "anchor", key: target, label, target });

/**
 * What the panel lists for a place: its parts, never the place itself (the rail is its one door). An
 * item shows only when its target exists in the current state, and its label is the screen's own word.
 * Places without a panel (`sectionPanelShown`) list nothing.
 */
function usePanelItems(section: SectionKey): PanelItem[] {
  const t = useTranslations("app");
  // The Invite screen leaves its people list out when the program could not be loaded; so does the panel.
  const referrals = useReferrals(section === "invite");
  const peopleShown = !(referrals.status === "error" || (referrals.status === "ready" && !referrals.data));

  switch (section) {
    case "analytics":
      // Real accounts see an empty state (no counting yet), so its parts have nothing to point at.
      if (statsSource() === "none") return [];
      return [
        anchor(NAV_ANCHORS.statsViews, t("analytics.viewsPerDay")),
        anchor(NAV_ANCHORS.statsLinks, t("analytics.topLinks")),
        // The screen's own title ("Where visitors come from") would wrap here.
        anchor(NAV_ANCHORS.statsSources, t("navPanel.sources")),
        anchor(NAV_ANCHORS.statsCountries, t("analytics.countries")),
        anchor(NAV_ANCHORS.statsDevices, t("analytics.devices")),
      ];
    case "invite":
      return [
        anchor(NAV_ANCHORS.inviteLink, t("invite.link.eyebrow")),
        anchor(NAV_ANCHORS.inviteRewards, t("invite.rewards.title")),
        ...(peopleShown ? [anchor(NAV_ANCHORS.invitePeople, t("invite.people.title"))] : []),
        anchor(NAV_ANCHORS.inviteRules, t("invite.rules.title")),
      ];
    case "settings":
      return (["plan", "account", "address", "legal"] as const).map((pane) => ({ kind: "route", key: pane, label: t(`settings.panes.${pane}`), href: `${SETTINGS_HREF}/${pane}` }));
    case "home":
    case "page":
    case "design":
      return [];
  }
}

/** The ids a `#hash` may name when a screen loads: the panel's anchors and the outline's rows. */
const JUMP_IDS: ReadonlySet<string> = new Set(Object.values(NAV_ANCHORS));
const isJumpId = (id: string) => JUMP_IDS.has(id) || id.startsWith(rowAnchor(""));

const panelLink =
  "flex min-h-control-md items-center rounded-sm px-3 py-2 text-small font-medium text-fg-secondary transition-colors duration-micro hover:bg-hover hover:text-fg active:bg-pressed focus-visible:focus-ring data-[selected]:bg-selected data-[selected]:font-semibold data-[selected]:text-selected-fg pointer-coarse:min-h-touch-target forced-colors:[&[aria-current]]:outline";

function PanelEntry({ item, pathname, pending, onNavigate }: NavProps & { item: PanelItem }) {
  const text = <span className="truncate">{item.label}</span>;

  if (item.kind === "route") {
    const current = pathname === item.href;
    return (
      <li>
        <Link
          href={item.href}
          aria-current={current ? "page" : undefined}
          data-selected={(pending ? pending === item.href : current) ? "" : undefined}
          onClick={(event) => {
            if (!current && !modified(event)) onNavigate(item.href);
          }}
          className={panelLink}
        >
          {text}
        </Link>
      </li>
    );
  }

  return (
    <li>
      <Link
        // The full path: opened in a new tab it lands on the part (see useJumpToHash).
        href={`${pathname}#${item.target}`}
        onClick={(event) => {
          if (modified(event)) return;
          const target = document.getElementById(item.target);
          // Without its target the link just navigates.
          if (!target) return;
          event.preventDefault();
          jumpTo(target);
        }}
        className={panelLink}
      >
        {text}
      </Link>
    </li>
  );
}

/**
 * A link opened in a new tab (or a bookmark) can carry a part of a screen as a #hash: once the
 * screen is there, jump to it without the smooth scroll, then drop the hash so a reload starts at the
 * top. Only the panel's own ids and the editor's rows count; Settings' old #legal-style links are
 * handled there. It lives in the shell, so it works on screens without a panel too.
 */
export function useJumpToHash(pathname: string) {
  useEffect(() => {
    // A hand-typed or truncated hash ("#%E0") must not take the dashboard down.
    let id: string;
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return;
    }
    if (!isJumpId(id)) return;
    const target = document.getElementById(id);
    if (target) jumpTo(target, { instant: true });
    // `null`, never `history.state`: see setDesignTabUrl in jump.ts.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, [pathname]);
}

/**
 * The section panel: the current place's name (plain text, not a heading: the screen's h1 comes
 * first in the outline), its parts, and the save status with "Demo" at its foot. It follows the
 * route, not the pending tap, so an anchor never points into a screen that has not loaded yet. It
 * appears and disappears at once: animating a column's width would reflow the editor and the live
 * preview every frame.
 */
export function SectionPanel({ pathname, pending, onNavigate, status }: NavProps & { status: ReactNode }) {
  const t = useTranslations("app");
  const { section } = routeInfo(pathname);
  const items = usePanelItems(section);

  return (
    <div id="nav-panel" className="flex w-nav-panel shrink-0 flex-col border-e border-line bg-surface transition-none nav-folded:hidden">
      <div className="flex h-16 shrink-0 items-center px-5">
        <p id="nav-panel-title" className="truncate text-body font-semibold">
          {t(`nav.${section}`)}
        </p>
      </div>
      <nav aria-labelledby="nav-panel-title" className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
        {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- Safari (VoiceOver) drops the list semantics without it */}
        <ul role="list" className="grid gap-0.5">
          {items.map((item) => (
            <PanelEntry key={item.key} item={item} pathname={pathname} pending={pending} onNavigate={onNavigate} />
          ))}
        </ul>
      </nav>
      <div className="px-2 pt-2 pb-3">
        <div className="flex items-start gap-2 px-3 text-caption text-fg-tertiary">
          {status}
          {accountStore.demo ? <span className="shrink-0">· {t("demo")}</span> : null}
        </div>
      </div>
    </div>
  );
}
