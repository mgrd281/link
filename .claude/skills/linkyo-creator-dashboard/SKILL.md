---
name: linkyo-creator-dashboard
description: How Linkyo's creator dashboard (/[locale]/app/*) is built and how to change it safely - the black-and-grey console palette, screen anatomy (Screen, Panel, ListGroup, sheets), the tab bar and the rail with its section panel, laptop widths, Arbeiten, demo vs real, toasts, button shapes and the places a new block type must be added. Use when touching apps/web/src/features/app/**, app/[locale]/app/**, a dashboard screen or pane, the template picker, or the app.* messages.
---

# Linkyo creator dashboard

The dashboard is where a creator builds their page: Home, Page (with Arbeiten), Design, Stats,
Invite and Settings. It is phone first and must feel like a modern desktop app on a laptop
([ADR 0063](../../../docs/DECISIONS/0063-two-level-sidebar.md), its width rule superseded by the
"dashboard on laptops" decision, `docs/DECISIONS/*dashboard-on-laptops*`).

## Palette: black and grey (ADR 0062)

- The shell's root carries `data-console="frame"`; the same semantic classes (`bg-primary`,
  `text-link`, `bg-selected`, `bg-tinted`, `bg-canvas-muted`, …) resolve to the console palette, in
  sheets, menus and toasts too. Never palette or tint classes (`teal-*`, `gray-*`, `tint-*`, `white`,
  `ink`) under `features/app`, and no `data-theme`. Exceptions: the phone bezel (`bg-ink`) and the QR
  code on paper.
- Links are body coloured, bold and carry an icon (chevron, arrow, eye); they hover with
  `hover:text-link-hover`. Never `text-link` with `hover:text-fg`, and no links inside running text
  (no `t.rich()` mapping to `<Link>`).
- The creator preview reads only `--creator-*`. The template picker is dashboard chrome around it
  (an allowed exception in the guard).
- Guards: `features/app/console-guard.test.ts` (static), `e2e/console-theme-app.spec.ts` (computed
  colours). The team area (`/admin`) stays teal and never gets `data-console`.

## Screen anatomy

- `Screen` (`features/app/screen.tsx`): title, optional `lead`, `actions` (UndoRedo, PreviewButton),
  `preview` (the live page beside it from `desk`), `wide` (content width), `back` (a pushed pane). In
  the shell: an iOS large title on phones, a sticky 64 px toolbar on wide screens. Outside the shell
  (the team area) it is `PlainScreen`.
- Surfaces: `Panel` (a card; grouped fill, outlined only on wide screens), `ListGroup` + `ListRow`
  (iOS grouped lists: tile, title, subtitle, value, chevron), `Sheet` (`features/app/sheet.tsx`) with
  Abbrechen/Speichern (Cancel/Save) in its footer and a short confirm in the navigation row on phones.
- No shadows, no underlines, tokens only (skill `linkyo-design-tokens`).

## Navigation

- Routes live in one table, `features/app/routes.ts`: title key, tab, parent (where "back" leads)
  and section (the rail place). A new screen: add it there, add `app/[locale]/app/(shell)/<x>/page.tsx`
  (metadata title from messages), extend `routes.test.ts`.
- **Phone tab bar** (`shell.tsx`): Home, Page, Add, Design, Stats. Pushed screens (Settings, its panes,
  Invite) mark no tab (`markedTab`). The chosen tab: tint, `icon.stroke-strong` (2.25) and a semibold
  label, never colour alone. A second view of a tab (Arbeiten under Page) keeps the tab chosen with
  `aria-current="true"`; tapping the tab there opens the tab's own screen.
- **Rail** (`nav.tsx`, `lg` up): symbol, Add, the places, Team area and Settings, View my page, the
  save status and the fold toggle.
- **Section panel**: only for places with four or more parts or panes of their own
  (`hasSectionPanel`: Stats while it counts, Invite, Settings). Home, Page and Design have none; there
  the rail shows the save status and no fold toggle. Panel items are anchors (`NAV_ANCHORS`, focusable
  targets) or routes (Settings panes). A `#hash` jump works on every screen (`useJumpToHash`).

## Widths on laptops

- Single column: `max-w-prose lg:max-w-column-wide` (840 px from `lg`). Home and Invite: `wide`
  (`layout.content`) with two columns once the column is at least `column-wide`
  (`@container` + `@column-wide:columns-2`). CSS columns keep the phone's order for reading and focus;
  put `break-before-column` on the item that starts the second column, `break-inside-avoid` on items.
- Beside the panel a column starts at the panel's edge (x = 288, folded 104); without a panel it is
  centred. `ShellChrome.panel` tells `Screen` which.
- Check at 390, 1024, 1440 and 1920: at 1920 the main column is at least 760 px, or Home is two
  columns. The team area's `PlainScreen` does not change with these rules.

## Template picker and previews

- `features/directions/poster/template-picker.tsx`: real first screens from
  `template-previews.ts` (WebP in `src/assets/templates`, captured with
  `node scripts/capture-example-shots.mjs templates` against a running build, from the Poster
  prototype with the fictional sample, never a real person's page). A row on phones, a grid of 3–4 on
  laptops, "Alle · Portfolio" from the tokens' `use`, the chosen card brought into view. `order` (the
  welcome flow) puts a kind's starter and suggestions first.
- A new template: capture it (`template:<id>`), add its import, run `template-previews.test.ts`.
- The live page on Design: a copy under the bar below `lg`, the toolbar's preview button from `lg`
  to `desk`, the preview column from `desk`.

## Arbeiten (`/app/work`)

- For portfolio kinds (`PORTFOLIO_KINDS`) and any page with a project (`showsWork`). "Inhalte |
  Arbeiten" (`PageViews`) sits at the top of both Page views.
- Covers with title, years, the next step (`nextStep()` from `@linkyo/blocks`, short words under
  `app.work.next`) and the pictures waiting for a description (`missingAlt`). Arrows swap a project
  with its neighbour (`swapProject`, one `replace` = one undo). The three ways to add
  (`AddWorkWays`): type it (edit sheet), from photos (picked in the tap), from a link (the Add sheet's
  `workLink` door, `OpenAddContext`). `WorkLayoutControl` writes `theme.projects` (also on Design).

## Demo vs real

- `accountStore.demo` is the browser demo; real accounts run on Supabase. Stats: `statsSource()`
  ("sample" numbers labelled as such, or "none" with an honest empty state). Never invent numbers,
  dates or cities; never say "saved" when nothing was saved.
- Real accounts have no newsletter backend: the Add sheet does not offer it, public pages drop it, and
  the editor marks existing newsletter blocks "Noch nicht sichtbar".

## Toasts

- A change with Undo passes `undoable: { before, latestOnly }`; `toast.settle` closes it when its
  change is undone or redone by any route, and toasts make room for open sheets
  (`--sheet-toast-start`). On wide screens they centre over the content column (`--toast-start` in
  `globals.css`).

## Buttons

- Pill (`size="cta"`) only for flow footers (welcome, AI builder) and the website's lone CTA. In a
  card or an empty state buttons are rounded (`size="lg"` / `md`). Quiet partners are `tinted`.

## A new block type: the silent places

`blockIcon` (`features/directions/editor/ui.tsx`), `blockTitle` (`features/directions/editor/use-editor.ts`),
`mapSources` (`features/account/media-migrate.ts`), the Add sheet's groups (`ADD_GROUPS` in
`features/app/blocks.ts`) and its `desc.*` line, `dashboard.types.*` in three languages, the editor
row's `Thumb` and `blockSummary`.

## Acceptance for a dashboard change

- `console-guard.test.ts`, `routes.test.ts`, the screen's unit tests; Playwright on desktop and
  mobile for the specs that touch the screen (`dashboard-layout-app`, `nav-panel-app`,
  `nav-fixes-app`, `app.spec`), axe in en and ar (light and dark).
- Screenshots at 390, 1440 and 1920 in de and ar: Arabic mirrored, nothing cut off, no shadow, no
  underline, black and grey only.
