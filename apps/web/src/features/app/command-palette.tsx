"use client";

import { CommandPalette, icons, Kbd, type PaletteCommand } from "@linkyo/ui";
import { ChartNoAxesColumn, CircleHelp, CreditCard, Eye, FolderKanban, Gift, House, Keyboard, Link2, Palette, Scale, Settings, UserRound, View } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";

import { accountStore } from "@/features/account/store";
import { blockIcon } from "@/features/directions/editor/ui";
import { useRouter } from "@/i18n/navigation";

import { addMenu, entryKey, searchText, type AddEntry } from "./add-search";
import { shortcutKeys, SHORTCUTS, useApplePlatform, type ShortcutId } from "./keys";
import { isPortfolioKind, type CreatorKind } from "./kinds";
import { helpLink, INVITE_HREF, SETTINGS_HREF, SETTINGS_PANES, TAB_HREF, WORK_HREF, type SettingsPane } from "./routes";
import { Sheet } from "./sheet";
import { useSite } from "./site-context";

const PANE_ICONS: Record<SettingsPane, typeof Settings> = { plan: CreditCard, account: UserRound, address: Link2, legal: Scale, visibility: View };

/** Whether this device has a fine pointer (a mouse or a trackpad): touch-only devices get no shortcut list. */
const subscribeNever = () => () => undefined;
const hasFinePointer = () => window.matchMedia("(any-pointer: fine)").matches;
const useFinePointer = () => useSyncExternalStore(subscribeNever, hasFinePointer, () => false);

/**
 * Focus goes back where it was when the palette closes. The palette opens from a key press or a button
 * without a Radix trigger, so Radix has nothing to return to (the same as `Sheet`): what had focus is
 * read before the palette takes it (a layout effect runs before Radix's focus scope moves it), and it
 * gets focus back once the palette is gone, unless something else took it meanwhile (a sheet a command
 * opened) or it left with the screen (a command that navigated: the shell focuses the new title).
 */
function useReturnFocus(open: boolean) {
  const returnTo = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open) {
      const active = document.activeElement;
      returnTo.current = active instanceof HTMLElement && active !== document.body ? active : null;
      return;
    }
    const target = returnTo.current;
    returnTo.current = null;
    if (!target) return;
    let timer = 0;
    // After Radix's own close focus (a task after the dialog unmounts), which lands on the page.
    const frame = requestAnimationFrame(() => {
      timer = window.setTimeout(() => {
        const now = document.activeElement;
        if (target.isConnected && (!now || now === document.body)) target.focus({ preventScroll: true });
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [open]);
}

/**
 * The ⌘K palette of the dashboard (D-15), on the kit's palette (a combobox with a listbox, the result
 * count read out, right to left with the page), with focus back where it was on close (`useReturnFocus`). Three kinds of result:
 * the dashboard's screens, a block type to add (the Add sheet's entries, opened at that type's form) and
 * the blocks on the page, found by their title (the edit sheet opens). Every way leads inside the
 * dashboard, apart from help; the iPhone app shows no palette at all (the shell leaves it out).
 */
export function DashboardPalette({
  open,
  onOpenChange,
  onAdd,
  onShortcuts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (entry: AddEntry) => void;
  onShortcuts: () => void;
}) {
  const t = useTranslations("app.palette");
  const tApp = useTranslations("app");
  const tAdd = useTranslations("app.add");
  const tTypes = useTranslations("dashboard.types");
  const locale = useLocale();
  const router = useRouter();
  const { doc, site, edit, label } = useSite();
  const fine = useFinePointer();
  useReturnFocus(open);

  const commands = useMemo<PaletteCommand[]>(() => {
    const go = (href: string) => () => router.push(href);
    const screens = t("groups.screens");
    const place = (id: string, name: string, href: string, icon: PaletteCommand["icon"], keywords: string[] = []): PaletteCommand => ({ id, label: name, group: screens, icon, keywords, onSelect: go(href) });
    // Arbeiten shows for pages that show work (`showsWork` in work-screen.tsx): a portfolio kind or a project on the page.
    const work = isPortfolioKind(site.kind as CreatorKind | undefined) || doc.blocks.some((block) => block.type === "project");
    const list: PaletteCommand[] = [
      place("go-home", tApp("nav.home"), TAB_HREF.home, House),
      place("go-page", tApp("nav.page"), TAB_HREF.page, icons.page, [t("words.page")]),
      ...(work ? [place("go-work", tApp("nav.work"), WORK_HREF, FolderKanban)] : []),
      place("go-design", tApp("nav.design"), TAB_HREF.design, Palette, [t("words.design")]),
      place("go-analytics", tApp("nav.analytics"), TAB_HREF.analytics, ChartNoAxesColumn, [t("words.analytics")]),
      place("go-invite", tApp("nav.invite"), INVITE_HREF, Gift),
      place("go-settings", tApp("nav.settings"), SETTINGS_HREF, Settings),
      ...SETTINGS_PANES.map((pane) => place(`go-${pane}`, tApp(`settings.panes.${pane}`), `${SETTINGS_HREF}/${pane}`, PANE_ICONS[pane], [tApp("nav.settings"), t(`words.${pane}`)])),
      place("go-preview", tApp("viewPage"), "/app/preview", Eye),
    ];

    const adding = t("groups.add");
    for (const group of addMenu(site.kind, accountStore.demo)) {
      for (const entry of group.entries) {
        const key = entryKey(entry);
        const name = entry.type ? tTypes(entry.type) : tAdd(`presets.${entry.preset}`);
        const words = [tAdd(`desc.${key}`), tAdd(`keywords.${key}`)];
        list.push({
          id: `add-${key}`,
          label: name,
          group: adding,
          icon: entry.type ? blockIcon[entry.type] : blockIcon.brands,
          // The folded forms too ("صوره" finds "صورة"): the kit compares accents away, not Arabic spellings.
          keywords: [...words, searchText(`${name} ${words.join(" ")}`)],
          onSelect: () => onAdd(entry),
        });
      }
    }

    const onPage = t("groups.blocks");
    for (const block of doc.blocks) {
      const title = label(block);
      list.push({ id: `block-${block.id}`, label: title, group: onPage, icon: blockIcon[block.type], keywords: [tTypes(block.type), searchText(title)], onSelect: () => edit({ mode: "edit", id: block.id }) });
    }

    const help = t("groups.help");
    list.push({ id: "help", label: t("help"), group: help, icon: CircleHelp, keywords: [t("words.help")], onSelect: go(helpLink(locale)) });
    // Touch-only devices have no keyboard to press them with: no list there.
    if (fine) list.push({ id: "shortcuts", label: t("shortcuts"), group: help, icon: Keyboard, hint: "?", onSelect: onShortcuts });
    return list;
  }, [doc.blocks, edit, fine, label, locale, onAdd, onShortcuts, router, site.kind, t, tAdd, tApp, tTypes]);

  return (
    <CommandPalette
      open={open}
      onOpenChange={onOpenChange}
      commands={commands}
      label={t("label")}
      placeholder={t("placeholder")}
      emptyLabel={t("empty")}
      resultsLabel={(count) => t("results", { count })}
    />
  );
}

/** The keys of a shortcut, each in its own chip, in the order they are pressed (left to right in every language). */
function Keys({ id, apple }: { id: ShortcutId; apple: boolean }) {
  return (
    <span dir="ltr" className="inline-flex shrink-0 items-center gap-1">
      {shortcutKeys(id, apple).map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
    </span>
  );
}

/**
 * "?": the dashboard's keyboard shortcuts, as this device writes them (⌘ on a Mac, Ctrl elsewhere).
 * Only shortcuts that exist; the shell opens it only on a key press, and the palette lists it only where
 * there is a fine pointer, so touch-only devices never see it.
 */
export function ShortcutsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("app.shortcuts");
  const apple = useApplePlatform();
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("title")} description={t("lead")} closeLabel={t("close")}>
      <dl className="grid grid-cols-1">
        {SHORTCUTS.map((id) => (
          <div key={id} className="flex min-h-control-lg items-center justify-between gap-4 border-b border-line py-2 last:border-b-0">
            <dt className="text-body">{t(`items.${id}`)}</dt>
            <dd>
              <Keys id={id} apple={apple} />
            </dd>
          </div>
        ))}
      </dl>
    </Sheet>
  );
}
