# 0063 — Two-level sidebar: an icon rail and a section panel

**Context.** The founder asked for a sidebar like the pro tools he uses: a narrow column of icons for
the places, and beside it a column with the parts of the place he is in, which he can fold away.
His window is Safari at 1244 px. The dashboard had one 248 px sidebar (logo, page card, Add, the four
places, Team area, Settings, the save status), set in [ADR 0061](0061-dashboard-restructure.md). It
is part of the v6 plan, with the black-and-grey dashboard ([ADR 0062](0062-black-and-grey-dashboard.md))
and the invite program ([ADR 0064]).

**Decision.**

1. **From `lg` (1024 px) up: a 64 px icon rail and a 184 px section panel.** Together they are the
   former 248 px sidebar, so with the panel open every screen keeps exactly its old width and
   content still starts at x = 288. Folded, only the rail stays: content starts at x = 104 and
   gains 184 px. New layout tokens: `layout.nav-rail` (64 px) and `layout.nav-panel` (184 px);
   `layout.sidebar` stays for the team area, `/design` and `/templates`.
2. **The rail** (`features/app/nav.tsx`, `NavRail`), top to bottom:
   - the Linkyo symbol (mono, a picture, not a link);
   - **Add**, a 44 px soft circle (`bg-tinted`), so it never reads as the chosen place;
   - the places Home, Page, Design, Stats and **Invite** (`Gift`, `/app/invite`), then, at the bottom of
     the same nav, Team area (team members only) and Settings;
   - in the foot: View my page (`Eye`), the compact save status (only while folded) and the fold toggle.

   Every control is 44 × 44 with a tooltip that says its name (to the right; to the left in Arabic,
   where the rail sits at the right edge). The accessible names are exactly "Home", "Page",
   "Design", "Stats", "Invite", "Settings", "Team area" and "Add". The chosen place is a filled dark
   tile (`bg-primary`, 17:1 against the rail). `aria-current` is `page` on the place's own route and
   `true` on Settings while one of its panes is open.
3. **The panel** (`SectionPanel`) lists the parts of the current place, never the place itself. Its
   title is the place's name as plain text (a `<p>`, not a heading: the screen's `h1` comes first).
   An item shows only when its target exists, and its label is the screen's own word.

   | Place | Items |
   |---|---|
   | Home | Next step (while building) · Your link · Still to do (ready, not complete) · Last 7 days (ready) |
   | Page | Profile · Content, with one nested row per section of the page (headers and self-titled blocks) |
   | Design | Template · Color, Font, Buttons (tabs) |
   | Stats | Views per day · Top links · Sources · Countries · Devices |
   | Invite | Your invite link · Rewards · People you invited · How it works |
   | Settings | Account · Page address · Legal notice (routes) |

   - **Anchors** scroll to the part (smooth unless reduced motion) and focus its title. The URL and
     the history are left alone; the `href` carries the hash, so "open in new tab" lands on the part
     and then drops the hash.
   - **Design tabs are in the URL** (`/app/design?tab=fonts`), written with
     `window.history.replaceState(null, "", "?tab=…")`: no navigation, no history entry, and a reload
     keeps the tab. The state passed is `null`, never `history.state`: Next 16's patched
     `replaceState` skips `useSearchParams` for a state that carries its own markers. Not
     `router.replace`, which would fetch the route again. The team area keeps the tab in local state.
   - **Settings panes are routes.** A move from the panel (Account → Page address) does not slide the
     pane in or move focus: the shell marks moves to the route just tapped in the chrome (`fromNav`).
     A Settings row in the content still pushes, as before.
   - No current state for anchors (no scroll-spy), no animation of the panel: it shows and hides at once.
4. **Folding is remembered per browser, with no layout shift.** The toggle (`aria-expanded`,
   `aria-controls="nav-panel"`, name "Sidebar") writes `<html data-nav-panel>` and
   `localStorage["linkyo.navPanel"]`. A pre-paint script in the root layout (after the theme script)
   copies the stored choice to the attribute before the first paint; the CSS variant `nav-folded:`
   lays out the server-rendered splash (`AppSplash` draws the same rail and panel) and the shell, so
   nothing moves when the shell mounts. React only mirrors the attribute. Storage that throws leaves
   the panel open and the toggle works for the tab. The panel is open by default at every width; the
   stored choice wins at every width. Tabs are not synced.
5. **One save status at a time.** The panel's foot shows it with "· Demo" (text that wraps, never
   truncated); folded, the rail shows the compact glyph; phones keep the top bar's. Each is hidden
   where another shows, so one live region speaks.
6. **Phones keep the top bar and the tab bar.** Invite is reached from a Settings row (phones only)
   and, once the page is ready, from a Home row; its back link says "‹ Settings". Under any pushed
   screen (Settings, its panes, Invite) the tab it was opened from stays marked.
7. **One door per place, amended** (ADR 0061): *One door per place in the chrome: the rail is the
   only way to a place's first screen. The panel lists that place's parts and sub-pages, never the
   place itself. Content rows that lead to the same sub-page (the Settings list) stay, because they
   are the phone's only door.*

**Not built.** A hover peek or flyout, a width animation, a keyboard shortcut (`\` is ⌥⇧7 on German
Macs; Ctrl+B opens bookmarks), scroll-spy, captions under the rail icons, and a two-level sidebar on
phones.

**Measured** (Chromium, production build in demo mode, fresh demo accounts, 15 px scrollbar gutter).
- **1244 × 800, en:** rail x 0–64, panel 64–248. `#main h1` x = 288 open, 104 folded. The live
  preview column stays at x 877–1229 in both. Prose column 557 px open / 640 folded; Stats 909 / 1093.
- **No horizontal scroll** at 1024, 1200, 1244, 1280, 1440 and 1512, open and folded, en and ar, on
  Home, Page, Design, Stats, Settings › Account and Invite (144 pages): `scrollWidth` equals the
  root box's width every time (1009, 1185, 1229, 1265, 1425, 1497). Chromium reports
  `documentElement.clientWidth` as the whole window (1024 … 1512) with `scrollbar-gutter: stable`, so
  `scrollWidth` is 15 px less than it, never more. h1 x is 288 open and 104 folded at every width (en).
- **Arabic:** the rail's right edge equals the root box's right edge at every width (1009 … 1497).
  At 1244 × 800 on `/ar/app`, the first rail control (Add, "إضافة", x 1175.5–1219.5, its 20 px
  glyph at 1187.5) opens its tooltip to the left when focused: the tooltip's right edge is at
  x 1163.3, 12.2 px left of the control, 24.2 px left of the glyph and 1.7 px clear of the rail's own
  left edge (1165), because the tooltip's offset (12 px) is now larger than the control's inset in the
  rail (10.5 px).
- **Targets:** all 10 rail controls 44 × 44 (Add, the five places, Settings, View my page, the folded
  status link, the toggle). Panel rows 40 px tall with a mouse and 44 px with `pointer: coarse`
  (Chromium media emulation).
- **Contrast** (computed colours): the chosen rail tile against the rail 17.00:1 in light
  (#1C1C1F on #FFFFFF) and 16.90:1 in dark (#F5F5F7 on #141416); its icon on the tile 17.00:1 and 18.18:1.
- **No layout shift:** with "folded" stored, at `DOMContentLoaded` `<html data-nav-panel="folded">`
  is set, the splash panel's `display` is `none` and the splash title starts at x 104; after the shell
  mounts the `h1` starts at x 104 (0 px shift). With nothing stored: 288 → 288. `#nav-panel` has
  `transition-property: none`.
- **Tests.**
  - Unit: web 192 (11 new: the pre-paint script, 5; Home progress against the old inline logic, 6,
    240 combinations), tokens 52, config 79, blocks 41.
  - Playwright, desktop and phone, on the production build: the new `nav-panel-app.spec.ts` (11
    desktop tests, axe split by language, and the phone test) with `app`, `nav-fixes-app`,
    `settings-fixes-app`, `ui-fixes-app`, `console-theme-app`, `admin` and `a11y`: **423 passed,
    0 failed**, 21 skipped (tests that apply to one project only). Two existing helper lines changed
    in `settings-fixes-app.spec.ts` (`profileRow`, `legalRow` scoped to `#main`): the Settings panel
    adds a second "Legal notice" item. axe finds 0 violations on `/en/app` and `/ar/app`, open and
    folded, light and dark. The review captures (`REVIEW=1`, 63) pass unchanged.

**Known gaps.**
- **Touch at `lg` and up (iPad landscape):** the rail is icons only and tooltips do not show on
  touch. The icons are the phone tab bar's (labelled there), and the panel title names the place.
  Follow-up if it confuses people: captions under the icons on `pointer-coarse` (a 72–80 px rail).
- **Not checked in Safari/WebKit.** The first live check is the founder's Safari at 1244 px after a
  hard reload. With overlay scrollbars the prose column should be 572 px open (computed in the
  design, not measured here).
- **The page outline repeats the creator's section titles** in the panel. New e2e text queries
  scope to `#main`.

**Status.** Accepted.

[ADR 0064]: README.md

**Final integration run (2026-11-22, all of v6 merged: ADRs 0062–0064 plus the review fixes).**
- Unit: web 210, tokens 52, config 79, blocks 41.
- Playwright, production build in demo mode, desktop + phone + review: 670 passed, 35 skipped by design, 0 failed.
- Real accounts against the local stack (`E2E_SUPABASE=1`): 13 of 13. pgTAP: 278 (access 76, referrals 202). `db:lint`: 0 issues.
- An independent review (5 reviewers, each finding checked by a skeptic) confirmed 9 findings, 0 critical; all 9 are fixed
  and covered by the numbers above. 3 more were refuted.
