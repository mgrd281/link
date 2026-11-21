# 0061 — Dashboard restructure: one frame, one field style, one save grammar

**Context.** The founder sent a photo of the dashboard's Settings in Safari on a MacBook. They asked
for a complete restructure "at the best level possible". Their brief measured it against Apple's
HIG and five principles (clarity, deference, depth, consistency, fluidity), against Linear's
precision, Vercel's modernity and Stripe's clarity. They added that more effects do not make a
better design, and that removing an element is often the better move.

They asked for four steps: review, find the weaknesses, improve, then test usability, performance
and accessibility.

**How it was done.**
- **Audit.** Agents audited every dashboard screen at 393, 1024, 1244 and 1512 px, in de, en and
  ar, in light and dark. 1244 px is the founder's Safari window.
- **Design panel.** Three independent designs ("Guided clarity", "Native Apple", "Pro-tool") were
  scored by judges. "Guided clarity" became the base, with grafts from the other two. One plan
  then set strict file ownership per work package.
- **Build.** Six work packages were built in separate git worktrees:
  - WP0: foundation;
  - WP1: shell;
  - WP2: Settings;
  - WP3: Home and Page;
  - WP4: Design and Stats;
  - WP5: sheets and forms.

  Each package was verified on its own with lint, types, unit tests, a build, e2e and axe. They were
  then merged one at a time.
- **Review.**
  - Four independent reviewers checked the merged code: correctness, accessibility and RTL, the
    project rules, and that nothing that worked was lost.
  - A skeptic tried to refute each finding. Of 27 findings, 22 were confirmed (20 different bugs,
    none high) and 5 rejected.
  - All 20 were fixed in three parallel packages. Each fix has a regression test that fails on
    the build before it.
  - Among them:
    - in-app history now follows the browser's (Back, then a back link, no longer lands on the
      wrong screen);
    - focus returns to what opened a confirm dialog, and to the new screen's title when the
      focused link disappears;
    - a fading toast's Undo cannot run twice;
    - an import's Undo no longer takes back an unrelated later change;
    - ⌘Z works right after choosing the page language;
    - an unsaved Impressum warns before the tab closes from any screen;
    - sheets in the team area leave its preview in view;
    - the Design preview sits flush on short screens.

**Decision.**

- **One frame at every width.**
  - **Surfaces.** The ground is teal 50 (`canvas-muted`). Lists and panels are white groups
    (`bg-group`, night 200 in dark mode); they carry a hairline on desktop and none on phones. The
    sidebar is white with a hairline.
  - **Depth.** Ground → group → overlay with a scrim. No glass, no blur, no shadow (ADR 0037).
- **New tokens.**
  - `group`: the grouped-list surface.
  - `control-knob`: the switch knob.
  - `text.title`: section titles.
  - The `desk` breakpoint (1200 px).
  - `preview-compact` (320 px).
- **Desktop.**
  - Every screen gets a sticky 64 px toolbar with its title and actions on the solid ground. Its
    hairline shows only once content scrolls under it.
  - From 1200 px a compact live preview (320 px) stands beside the screen, so the founder's
    1244 px window sees the page. It is a picture of the page: `inert`, mounted only where it shows,
    and it never runs below the window.
- **Phones.**
  - The iOS large title hands over to the top bar. The bar's back label stays whole; the title
    truncates instead.
  - The tab bar remembers each tab's scroll and goes back to the top on a second tap.
- **One door per place.** Removed:
  - the account dropdown;
  - the bottom "Konto" card;
  - the phone gear;
  - the duplicate eye;
  - the end-of-list "Hinzufügen".

  The avatar in the phone bar and the sidebar's Settings entry lead to Settings. The sidebar page
  card opens "Meine Seite ansehen".
- **Settings is a grouped list with three panes.**
  - Panes: `/app/settings/account`, `/app/settings/address` and `/app/settings/legal`.
  - The root holds no text field at all:
    - Profil (opens the one Profile sheet);
    - Seitenadresse;
    - Impressum (with its state);
    - Sprache der Seite;
    - Konto (and the team area for team members);
    - Darstellung (Hell / Dunkel / Automatisch);
    - Sprache der App;
    - Export and Import;
    - Abmelden.
  - Old links with `#legal`, `#address-title`, `#account-title`, `#profile-title` and
    `#signins-title` land on the right pane.
- **One field style.** Fields are outlined with a 3.36:1 border (`border-line-input`): 48 px tall
  on touch, 40 px with a mouse. An error shows a red frame, an icon and live text. This supersedes
  ADR 0060's filled fields.
- **One save grammar.**
  - Page content saves by itself and can be undone.
  - Edit sheets confirm.
  - The Impressum is an explicit record with "Nicht gespeichert", "Verwerfen" and "Speichern". Its
    draft survives leaving the screen, and the save status says "Impressum nicht gespeichert"
    instead of "Gespeichert".
  - Changing the address or the email has consequences, so each asks for a confirm first.
  - Preferences (theme, app language) apply at once.
- **Home has one next step.**
  - One primary action per state: building, ready, complete.
  - Then the link card (copy, share, QR code, story picture).
  - Sample statistics appear only once the page is ready.
  - On a fresh account at 393 × 852 the next step's button sits at y 315–363, well above the tab
    bar.
- **Page.**
  - Blocks form grouped rows.
  - Each row's edit button holds only the title and is stretched over the row. Its accessible name
    stays "Edit {title} ({type})", and axe's label-in-name check passes on a filled page.
  - Rows glide to their new place on a move, delete or undo (FLIP). This is off under reduced
    motion and for drag drops, which dnd-kit animates itself.
- **Design.**
  - The template comes first, as one still row that scrolls sideways.
  - Then three tabs: Farbe, Schrift and Buttons. They are Radix tabs, mirrored in Arabic, and only
    the active panel is mounted.
  - Design measured 1.22 screens tall at 1244 × 800, down from 2.27 with the old grid.
- **Stats.**
  - "Beispieldaten" appears once, as a badge.
  - A line names the most-tapped link. It is hidden when nothing was tapped.
- **The Add sheet** has two steps (type, then form) with a Back that keeps what was typed. The
  browser's Back closes an open sheet instead of leaving it over another screen.
- **Motion explains change only.** It covers four things:
  - list moves;
  - the push inside the Add sheet;
  - the push into a Settings pane;
  - a settled save status.

  Nothing ambient runs; the template picker stands still in the dashboard. Reduced motion removes
  every movement, and an e2e test checks that no endless animation runs.

**Deliberately not built now.**
- **A ⌘K command menu and single-key shortcuts.** The dashboard has five places. A menu would be a
  second way to do everything before the first is proven.
- **A non-modal inspector with live edits.** It needs a different save model from the one above.
- **Sheets in the URL, so they reopen on Forward.** This is risky with the current sheet stack. Back
  already closes them.
- **Tablet two-column layouts**, swipe actions on rows and drag pickup haptics.

**Measured** (production build, Chromium):
- **Tests.**
  - The full Playwright suite (desktop, phone and review projects) on the final build: 550 passed,
    0 failed and 83 skipped. The skipped tests are the review screenshots (they run only with
    `REVIEW=1`), the real-account specs (run separately below) and tests that apply to only one
    project.
  - Real accounts on a local Supabase stack: 11 of 11 passed. They cover sign-up, the Impressum
    saved on the server, sign-ins on the Konto pane, the address and the email changed only after
    a confirm, account deletion and the team console.
  - Unit tests: web 158, config 79, blocks 41, tokens 33.
- **axe.** 0 violations on every dashboard screen, pane and sheet, in en and ar, light and dark, on
  phone and desktop. A filled editor (8 block types) is included.
- **Height in screens, and overflow.** No horizontal scroll at any width.

  | Screen | 1512 × 945 | 1244 × 800 | 393 × 852 |
  |---|---|---|---|
  | Settings root | 1.00 | 1.19 | 1.38 |
  | Konto, Seitenadresse and Impressum panes | 1.00 | 1.00 | 1.00–1.03 |
  | Design | 1.06 | 1.22 (2.27 with the old grid) | 1.77 |
  | Home | 1.00 | 1.13 | 1.21 |

  At 1244 the live preview stands beside every screen that has one.
- **Fresh account on a phone.** On an account named "1", the next step's button sits at y 315–363
  on a 852 px screen.

**Known gaps.**
- **Not checked in Safari/WebKit or on a real iPhone or Mac.** This environment has no WebKit.
- **Not tried with creators.** The plan's tasks are:
  - change the address;
  - add the Impressum;
  - show the page in English;
  - change the bio, then go to Design;
  - delete a block and undo.

  Each should take under 30 s.
- **An open Radix menu.** It marks the background `aria-hidden`, and axe then reports
  `aria-hidden-focus`. This predates the restructure; focus is trapped in the menu.
- **Home cards on wide screens.** Rows stop 8 px short of the card edge.
- **The Add sheet at 1200–1279 px.** Opened from a screen without a preview column (Statistik), the
  sheet hides its Preview button although no column is shown.
- **Back scroll position.** Back to a taller screen can land higher than where it was left: the
  browser restores the position before the screen has its full height. This predates the change.

**Status.** Applied.
