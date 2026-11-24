# 0079 — The dashboard on laptops, real template previews and the "Arbeiten" view

**Status.** Accepted (Stage 2, WP2.4, 2026-11-24). It
**supersedes the width rule of [ADR 0063](0063-two-level-sidebar.md)** ("with the panel open every
screen keeps exactly its old width"); the rail, the fold and the panel's look stay as ADR 0063 says.

**Context.** On a laptop the creator dashboard looked like a stretched phone (audit D-10): at 1920 px
the column was about 640 px wide beside 400 px of grey, the 184 px section panel held two anchors on
Home and Page, Design had the panel's tabs and the card's tabs for the same thing, and Invite and
Settings filled half the window. The template pickers drew skeletons ("MA" and bars) instead of the
looks (P-10), and a portfolio had no place to see its work as work (P-11). The founder asked for a
dashboard that uses a laptop screen "at 10".

**Decision.**

1. **The section panel only where a place has four or more parts, or panes of its own:** Stats (while
   it counts), Invite and Settings (`hasSectionPanel` in `features/app/routes.ts`). Home, Page (with
   Arbeiten) and Design give the 184 px to their content. Where there is no panel the rail carries the
   save status and has no fold toggle (there is nothing to fold). Design's three tabs live in its card
   only.
2. **Widths.** A single-column screen uses `layout.column-wide` (840 px) from `lg`; phones and tablets
   keep `prose` (640 px). Home and Invite use `layout.content` and stand in **two columns** once their
   column has room for two (a container query at `column-wide`). CSS columns keep the phone's order, so
   reading and focus run down the first column, then the second; a forced break says where the second
   starts (Home: the link while building, the week once ready; Invite: the people). Beside a panel the
   column starts at its edge, as a detail pane does (x = 288, or 104 folded, as before); without one it
   is centred between the rail and the live page. At 1920 the Page column is 840 px and Home is two
   columns of about 550 px.
3. **Real template previews.** Every template has a WebP capture of the top of its phone first screen
   (9:16, `aspect-short`), taken from the Poster prototype with the fictional sample creator
   (`node scripts/capture-example-shots.mjs templates`; portfolio templates show the portfolio sample).
   Never from a real person's page. The pickers (Design, the welcome flow, the prototype's dashboard)
   and the team's Vorlagen show them. Phones keep one sideways row; laptops get a grid of three or four
   by the room it has. "Alle · Portfolio" filters by the tokens' `use`, so a later template appears
   there without code. The chosen look is brought into view on open and when the filter changes (inside
   the row; in the grid by scrolling the page just enough when it is below the window), instantly under
   reduced motion. 14 files, about 400 kB in total. Design keeps its small copy of the live page under
   the bar on phones and tablets only; from `lg` to `desk` the toolbar's preview button opens the page
   (the copy covered the grid), and from `desk` the page stands beside the screen as before.
4. **"Arbeiten" (`/app/work`)**, a second view of the Page tab for portfolio kinds and any page with a
   project ("Inhalte | Arbeiten" at the top of both views, at every width, since Page has no panel):
   covers in two columns on a phone and four on a laptop, each with title, years, its one next step
   (`nextStep()`, in short words) and how many pictures wait for a description; arrows that swap a
   project with its neighbour (one undo each); the three ways to add (type it, from photos, from a link
   through the Add sheet's link door); and the work layout (`theme.projects`), shared with Design. The
   counts above say what is there, hidden projects included.
5. **Selection is never colour alone:** the phone tab bar's chosen tab gets `icon.stroke-strong`
   (2.25) and a semibold label (drawn with the token directly until Icon takes a `strong` prop).
6. **Buttons:** in a card or an empty state they are rounded (`size="lg"`), never the website's pill.

**Consequences.**

- `e2e/nav-panel-app.spec.ts` now expects no panel on Home, Page and Design and tests folding on
  Settings; `e2e/dashboard-layout-app.spec.ts` covers the widths, the grid, the filter, Arbeiten and
  the tab bar.
- The loading splash (`features/app/gate.tsx`) still draws the panel and a 640 px column on every
  route; until it follows `hasSectionPanel` and the wide column, Home, Page and Design shift once when
  the shell mounts. Toasts are centred as if the panel were there (`--toast-start` in `globals.css`);
  the shell marks panel-less places with `data-panel="none"` for that rule.
- A new template needs its capture and one import in `template-previews.ts`; its unit test fails until
  both exist, and the picker falls back to the template's colours meanwhile.
- Reversible: `hasSectionPanel` and the column classes in `Screen` are the two switches.
