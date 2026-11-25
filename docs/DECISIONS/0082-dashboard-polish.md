# 0082 — The dashboard polish after Stage 3: calm Design, 44 px targets, one edge, clear toasts

**Status.** Accepted (polish pass after Stage 3, 2026-11-25). It **amends [ADR 0079](0079-dashboard-on-laptops.md)**
in two places: point 2 ("a single-column screen uses `layout.column-wide`") for the screens listed
below, and point 3 ("in the grid by scrolling the page just enough"). It also amends one sentence of
[ADR 0078](0078-portfolio-welcome.md) point 4 (the platform kinds' logos in the kind grid, point 4
below). Everything else in 0078 and 0079 stands.

**Context.** Two fresh scorers walked the live Stage 3 product and listed concrete defects of the creator
dashboard; their numbers were reproduced before anything was changed: `/app/design` scrolled the page by
472 px at 1440 (292 at 1920) as soon as it opened, the pinned preview on a phone took 30 % of the
screen in a black bezel and showed only the page's head, switches (42 px wide), "Erledigte anzeigen"
(40 px), the project arrows (36 px), the week card's link (22 px) and the toast's own Undo and close
(32 px) were smaller than 44 px to a finger, the sheet header's "Speichern" stood 9 px from the edge
against 21 px for "Abbrechen", three glyphs said the wrong thing, Plan, Konto, Arbeiten and the editor
left dead areas at 1440 and 1920, and three small things (weekday letters, a broken word, a toast over
rows) were crafted carelessly.

**Decision.**

1. **The picker never moves the page.** The grid on laptops has no scroller of its own, so it scrolls
   nothing; the row on phones still centres the chosen card inside itself. The chosen card is marked by
   frame, tick and fill. (Amends 0079 point 3.)
2. **The pinned preview on a phone** is at most a quarter of the screen (`25svh` with its padding), in
   a hairline frame (`PhoneFrame frame="hairline"`; the preview column and the full-screen preview keep
   the dark bezel). It follows the part being changed with the mechanism the edit sheet already used
   (`PhonePreview focus`): the first button for colour and buttons, the top for fonts and a new look.
3. **Targets are 44 px to a finger, measured by hit-testing.** The kit grows a small control with a
   `::before` that only touch screens get (`pointer-fine:before:hidden`): `Button` md (and sm, as
   before), `Switch` (46 × 46), the toast's Undo and close; text links and toggles of the dashboard do
   the same by hand. The project arrows are `IconButton` md (40 px, 44 px to touch) so the two hit
   areas sit side by side. The sheet header's two ends sit 20 px in, like the body (`edges`); the quiet
   button pulls its own padding back (`-ms-3`).
4. **Icons say what they mean.** The registry gained `page` (a sheet, the Seite tab and rail), `plan` (a
   price tag, the free plan's row) and `section` (a split box, "Abschnitt"; the letter H read as a
   letter); the welcome kind grid draws every kind as one outline glyph (the three platform logos went).
5. **One start edge, no dead gutters.** Page, Arbeiten, Design and the Plan and Konto panes take
   `layout.content` from `lg` (`Screen grow`, `isGrownPath`; the loading frame reads the same list), so
   they start where Home starts (x = 104 at 1440) and the editor has 150 px of gutter at 1920, not 290.
   Forms keep `column-wide`. Plan and Konto put their independent groups in two columns once the column
   is 840 px wide (`ColumnGroups`, the CSS columns Home uses). Arbeiten's covers stand as many across as
   there are projects, up to four, and never wider than `--work-tile-max` (352 px). Design's grid has
   five columns from a room of 840 px, so its cards stay about 200 px wide. (Amends 0079 point 2.)
6. **Weekday names that tell the days apart:** two letters in German (Mo Di Mi Do Fr Sa So), the `Intl`
   short names in English and Arabic; a screen reader hears the whole day. The Add sheet's cards stack
   the glyph over the name on phones (the name had 92 px for a 109 px word) and hyphenate nothing.
7. **A toast covers no control it can avoid.** On a phone it starts above the tab bar and takes the top,
   under the bar (`--toast-top`, named only by the dashboard), when the bottom would cover the control
   just pressed or more controls than the top, never a preview marked `data-toast-avoid`
   (`pickToastSide`, unit-tested geometry). With a sheet open it stands above it: the sheet stops 64 px
   (and the notch) short of the top.

**Consequences.**

- `e2e/dashboard-polish.spec.ts` guards each point by geometry at 390, 1440 and 1920; the unit tests are
  `routes.test.ts` (grown paths), `weekday.test.ts`, `packages/ui/test/icons.test.ts` and
  `toast-placement.test.ts`. `dashboard-layout-app.spec.ts` now expects the Page column to be Home's.
- `Button` md, `Switch`, `Toast` and the sheet's height changed in `packages/ui`/the shell for every
  surface that uses them; on a mouse nothing moves (the hit areas are touch only).
- Reversible: `grow` on a screen, `PhoneFrame`'s `frame`, `--toast-top` (without it toasts stay at the
  bottom) and the registry entries are the switches.
