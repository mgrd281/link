# 0062 — The creator dashboard is black and grey

**Context.** The founder asked for the dashboard in black and grey: "اللون أسود ورمادي في اللوحة"
("the colour black and grey in the dashboard"). Until now the dashboard used the brand palette:
a teal 50 ground, teal primary buttons, teal links, teal selected rows and a teal logo
([ADR 0033](0033-white-and-teal.md), [ADR 0061](0061-dashboard-restructure.md)).

This ADR amends CLAUDE.md's **Brand** bullet and records an exception to
[ADR 0041](0041-no-underlines.md)'s "a link is marked by colour" for the dashboard. It is part of the
v6 plan (two-level sidebar, [ADR 0063]; invite program, [ADR 0064]).

**Decision.**

1. **One scoped palette, the same classes.** No class name in the app changes colour. 12 semantic
   roles get a second value set, the *console* set, in `tokens.json` under
   `$extensions["app.linkyo"].console` and `.consoleDark`, and a new role `link-hover` is added. The
   token build emits the set as CSS scoped by a `data-console` attribute. `bg-primary`, `text-link`,
   `bg-selected` and the rest resolve to black and grey inside the dashboard, and to teal everywhere
   else.
2. **Where it applies.**

   | Place | Marker |
   |---|---|
   | The shell (every `/app/(shell)/*` screen) and everything it opens: sheets, dialogs, menus, tooltips, toasts | `data-console="frame"` on the shell root (`features/app/shell.tsx`) |
   | `AppSplash`, the loading frame of every `/app/*` route | `data-console="frame"` (`features/app/gate.tsx`); it is in the server HTML, so the first paint is already grey |
   | The welcome flow `/app/welcome` | `data-console="frame"` (`features/app/welcome-screen.tsx`) |
   | "View my page" `/app/preview`: the floating Done/Edit bar only | `data-console="local"` (`features/app/own-page-screen.tsx`); the creator's page under it keeps its colours |
   | The website, sign-up and log-in, creator pages, the team area (`/admin`, its `BrandSplash` too), `/design`, share pictures, the QR code, iOS | none: they stay Linkyo Teal |

3. **The scope reaches portals through `:root:has([data-console="frame"])`.** Radix sheets,
   dialogs, menus and tooltips render in `<body>`, and the toaster is mounted in the root layout.
   They inherit from `:root`, so the palette sits on `:root` while a frame element is mounted.
   `[data-console]` also styles the element itself: that covers the local bar, and it is the
   fallback where `:has()` is missing.
4. **A new cool grey scale, `graphite` (50–700),** at OKLCH hue 286°, the hue of `ink` and `night`,
   with chroma ≤ 0.0083. The website's `gray` is warm (HSL hue 36–48°, the orange-gold border that
   [ADR 0053](0053-audit-nov-2026.md) drew); a ground made from it reads beige next to the cool dark
   mode. `gray` is now "website only". The scale stops at 700: the dark end is `night` and `ink`.

   | Step | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 |
   |---|---|---|---|---|---|---|---|---|
   | Hex | #F5F5F7 | #E8E8EB | #DCDCDF | #CDCDD1 | #A4A4A9 | #808085 | #606065 | #47474C |

5. **Light: black on white and pale grey. Dark: white on black.**

   | Role | Light today (teal) | **Light console** | Dark today | **Dark console** |
   |---|---|---|---|---|
   | `canvas-muted` (the ground) | teal 50 #EFF8F8 | **graphite 50 #F5F5F7** | night 50 | night 50 (repeated on purpose, see Mechanism) |
   | `selected` | teal 100 | **graphite 100 #E8E8EB** | #5BB3B929 | **#F5F5F71A** (graphite 50 at 10 %) |
   | `selected-fg` | teal 800 | **ink** | teal 300 | **paper** |
   | `tinted` | teal 100 | **graphite 100** | #5BB3B929 | **#F5F5F71A** |
   | `tinted-hover` | teal 200 | **graphite 200 #DCDCDF** | #5BB3B93D | **#F5F5F729** (16 %) |
   | `tinted-fg` | teal 800 | **ink** | teal 300 | **paper** |
   | `primary` | teal 700 | **night 200 #1C1C1F** | teal 600 | **graphite 50 #F5F5F7** |
   | `primary-hover` | teal 600 | **night 400 #303035** | teal 500 | **graphite 200** |
   | `primary-pressed` | teal 800 | **ink #0A0A0B** | teal 700 | **graphite 300** |
   | `primary-fg` | white | white | white | **ink** |
   | `link` | teal 700 | **ink** (= `fg`) | teal 350 | **paper** (= `fg`) |
   | `link-hover` **(new)** | ink (= `fg`) | **graphite 600 #606065** | paper (= `fg`) | **graphite 400 #A4A4A9** |
   | `focus` | teal 600 | **ink** | teal 400 | **graphite 50** |

   Unchanged: `canvas`, `surface`, `surface-elevated`, `group`, `hover`, `pressed`,
   `hover-inverse`, the lines, the text alphas, `fg-inverse`, `control-knob`, `spark` (still only
   for "Live"), success, warning, danger, `scrim`, `skeleton` and `tint-*`.
6. **Links take the body colour in the dashboard.** A link there is a standalone control: bold,
   with an icon (chevron, arrow, eye or a status glyph), and it hovers to a lighter grey through
   `hover:text-link-hover`. Outside the dashboard `link-hover` equals `fg`, so the five links that
   moved from `hover:text-fg` to `hover:text-link-hover` look exactly as before there. The
   dashboard has **no links inside running text**. WCAG 1.4.1 asks for a non-colour cue only for
   links inside running text; weight and the icon carry it here, and a guard test keeps prose links
   out. The address on Home and at the end of the welcome flow now reads
   `<span class="text-fg-secondary">linkyo.app/</span>name`: the prefix steps back instead of the
   name stepping forward in teal.
7. **Monochrome logo in the dashboard** (`tone="mono"`: the sidebar, `AppSplash`, the welcome
   header). The tile and the wordmark take `fg`; the y cut-out still shows the ground. A teal tile
   would be the only hue in the chrome, and the brand tone would follow `text-primary` there
   anyway (#1C1C1F next to an ink wordmark), a near miss that `mono` makes exact. Teal stays at
   every door: the website, sign-up, the favicon and app icons, share pictures and creator pages.
8. **The switch knob** takes `primary-fg` when on (`data-[state=checked]:bg-primary-fg` in
   `packages/ui/src/switch.tsx`). Outside the console that is white, the same as `control-knob`; in
   the dark console the track turns white and the knob ink (18.18:1).
9. **Safari's bars** take the grey ground: the `(shell)` layout exports a viewport `themeColor`
   from `tokens.semantic.canvasMuted.console.light/dark`.
10. **The creator preview keeps the creator's colours.** The renderer reads only `--creator-*` and
    is `inert`. In a neutral room the creator's own colours are the only hue on screen; teal 50
    behind a warm page used to shift how that page looked.
11. **Two layout tokens for the sidebar of [ADR 0063]**: `layout.nav-rail` 64 px and
    `layout.nav-panel` 184 px (together the former 248 px `layout.sidebar`, which stays for the
    team area, `/design` and `/templates`).

**Mechanism.**

- **Tokens.** `graphite` in `color`; `console` and `consoleDark` on the 12 roles; `link-hover` with
  all four values.
- **Build** (`packages/tokens/scripts/build.mjs`). `consolePalette()` collects the pairs and emits
  three blocks into the Tailwind theme (in `@layer base`, right after the `:root [data-theme="light"]`
  block) and into `dist/css/tokens.css`:

  ```css
  :root:has([data-console="frame"]), [data-console] { /* 13 light console values */ }
  :root[data-theme="dark"]:has([data-console="frame"]), [data-theme="dark"] [data-console] { /* 13 dark */ }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]):has([data-console="frame"]),
    :root:not([data-theme="light"]) [data-console] { /* 13 dark */ }
  }
  ```

  The build **throws** when a role has only one of `console` / `consoleDark`, and when a role has
  console and high-contrast values together. `linkyo/typescript` gives every semantic entry
  `console: { light, dark }` (roles the console does not change repeat their own values), so tests
  and server code read `tokens.semantic.primary.console.light`. Swift and the asset catalog ignore
  the console values; iOS gains only the 8 `Graphite` colour sets and `LinkHover`.
- **Why every role needs both values (specificity).** The light theme sits on `:root` in Tailwind's
  theme layer; the dark rules are `[data-theme="dark"]` (0,1,0) and
  `:root:not([data-theme="light"])` (0,2,0). The console's light rule
  `:root:has([data-console="frame"])` is (0,2,0) and comes later, so it beats both dark rules; the
  console's dark rules are (0,3,0) and win back. A role with only a light console value would turn
  the dark dashboard light. That is also why `canvas-muted`'s dark console value repeats night 50.
  High contrast (`prefers-contrast: more`) touches only the lines and the secondary and tertiary
  text, which the console does not change.
- **A light subtree** (`data-theme="light"`) inside the dashboard would bring the teal roles back;
  the guard forbids it.

**Guards.**

- `apps/web/src/features/app/console-guard.test.ts` (Vitest, reads the code with the TypeScript
  parser) fails on:
  1. a `t.rich(` call that maps a tag to `<Link>` or `<a>` under `features/app/**`;
  2. a class list (a string, a `className` or a `cn()` call) with both `text-link` and
     `hover:text-fg`;
  3. palette or tint colours under `features/app/**`: any `bg|text|border|fill|stroke|from|via|to|…`
     utility naming a `tokens.color` entry (`teal-*`, `violet-*`, `lime-*`, `rose-*`, `mint-*`,
     `lavender-*`, `gray-*`, `graphite-*`, `night-*`, the numbered success, warning and danger steps,
     `ink`, `paper`, `white`) or `tint-*`. Allowed: `bg-ink` in `preview.tsx` (the phone bezel) and
     `bg-white`, `text-ink`, `fill-white`, `fill-ink` in `share-tools.tsx` (the QR code on paper);
  4. `data-theme` under `features/app/**` (attribute, string or `dataset.theme`);
  5. `bg-primary`, `text-link`, `bg-selected`, `bg-tinted` or `bg-canvas-muted` (and their
     `-hover`/`-fg` forms) in the creator page renderer, `features/directions/poster/*` and
     `features/directions/shared/*`. Excluded: `poster/template-picker.tsx` and
     `poster/dashboard.tsx` (dashboard chrome) and `shared/dock.tsx` (Linkyo's sign-up bar on public
     pages, mounted by the page routes, never by the renderer).

  Every failure names the file, the line and the offending class. A first block checks the guards
  on a sample, so a broken scanner cannot pass silently.
- `packages/tokens/test/tokens.test.ts`, "dashboard palette": AA for text, links and link hover on
  every dashboard surface; labels on every fill; 3:1 for focus, field edges, filled controls, dimmed
  chart bars and progress fills; the fill steps against teal's; graphite's hue and chroma; no hue in
  any changed role; exactly the 13 roles change; `link-hover` equals `fg` outside; the nav widths add
  up to 248; the build refuses a lone or high-contrast console value; the three generated CSS blocks
  in both outputs; iOS `Primary` stays teal with two appearances.
- `apps/web/e2e/console-theme-app.spec.ts` (desktop and phone; expected values read from
  `tokens.semantic.*.console`): the computed `--color-primary` and a primary button in the
  dashboard and the welcome flow; the portalled Add sheet (outside any `[data-console]` element)
  inherits the palette; in dark mode a white primary with an ink label and an ink knob on an on
  switch; the user's "Hell" wins over the system's dark mode; the live preview's `--creator-accent`
  and background equal `/app/preview`'s, where `:root` is teal and only the owner's bar is grey; the
  team area, the log-in page after "Log out", `/en` and `/en/signup` are teal; the server HTML of
  `/en/app` carries `data-console="frame"`.

**Measured** (WP0 branch, production build, Chromium; contrast computed from the built tokens, alpha
colours composited over the surface they sit on).

- **Contrast: 134 pairs, every one passes** (text ≥ 4.5:1, non-text ≥ 3:1), over all five grounds
  (`canvas`, `canvas-muted`, `surface`, `surface-elevated`, `group`) in both modes.

  | Pair | min | Light console | Dark console |
  |---|---|---|---|
  | fg on the ground (`canvas-muted`) | 4.5 | 18.18 | 17.71 |
  | fg-secondary / fg-tertiary, lowest ground | 4.5 | 5.86 / 4.75 | 7.08 / 6.11 |
  | success-strong / warning-strong / danger-strong, lowest ground | 4.5 | 4.99 / 6.37 / 5.00 | 9.01 / 10.13 / 6.35 |
  | link, lowest ground | 4.5 | 18.18 | 15.72 |
  | link-hover on `group` / lowest ground | 4.5 | 6.25 / 5.74 | 6.85 / 6.85 |
  | primary-fg on primary / hover / pressed | 4.5 | 17.00 / 13.13 / 19.79 | 18.18 / 14.46 / 12.49 |
  | selected-fg on selected (lowest ground) | 4.5 | 16.18 | 11.82 |
  | fg-tertiary on selected (tightest text pair) | 4.5 | 4.62 | 5.12 |
  | tinted-fg on tinted / tinted-hover (lowest ground) | 4.5 | 16.18 / 14.46 | 11.82 / 9.70 |
  | focus vs ground (`canvas-muted`) / lowest | 3 | 18.18 / 18.18 | 17.59 / 15.61 |
  | focus vs selected fill (lowest ground) | 3 | 16.18 | 11.74 |
  | line-input (fields, off switch), lowest ground | 3 | 3.34 | 3.34 |
  | primary (switch track, chart bars), lowest ground | 3 | 15.61 | 15.61 |
  | dimmed chart bars (opacity secondary), lowest ground | 3 | 4.95 | 7.08 |
  | progress fill (`link`) on `tinted`, lowest ground | 3 | 16.18 | 11.82 |
  | switch knob on the on-track | 3 | 17.00 | 18.18 |
  | link-hover vs link (the hover change) | — | 3.16 | 2.29 |
  | selected fill vs surface / ground vs group (fill steps) | — | 1.22 / 1.09 | 1.30 / 1.13 |

- **Graphite** stays at OKLCH hue 286 ± 3 with chroma < 0.01 (unit-tested). The TypeScript output
  gives `tokens.semantic.primary.console` = `{ light: "#1C1C1F", dark: "#F5F5F7" }`. The Tailwind
  theme and `tokens.css` each contain the three console blocks; `pnpm check:tokens-drift` is clean
  after the iOS regeneration.
- **Computed in the browser.** `/de/app`, `/de/app/design`, Settings, Statistik and the editor at
  1244 × 800 and 393 × 852: `:root` `--color-primary` #1c1c1f in light, #f5f5f7 in dark, the ground
  #f5f5f7 / #0f0f11, and Safari's theme colour #F5F5F7 / #0F0F11. In portals: the Add sheet, a
  row's menu and the delete toast compute #1c1c1f (light) and #f5f5f7 (dark), and a tooltip
  #1c1c1f (measured in light only), all while sitting outside every `[data-console]` element. `/app/preview`'s `:root` is #00454c (light) and
  #00565f (dark) with the owner's bar grey; `/admin` and `/en` are teal with no `[data-console]`
  element on the page.
- **Tests.**
  - Unit: tokens 52 (33 before; 19 new), web 166 (158 before; the 8 guard tests), config 79,
    blocks 41.
  - Playwright, desktop and phone, on the production build: `console-theme-app`, `app`,
    `nav-fixes-app`, `settings-fixes-app`, `ui-fixes-app`, `admin` and `a11y`: **411 passed,
    0 failed**, 9 skipped (tests that apply to one project only). The new spec: 11 passed, 1
    skipped (the preview column test on the phone). The `app.spec.ts` axe loop (en and ar, light
    and dark, desktop and phone, every dashboard screen, the Add and edit sheets) finds 0
    violations with the new palette, and no existing test line was changed.
  - `pnpm lint` (token guard included) and `pnpm typecheck` are clean.

**Known gaps.**
- **Not checked in Safari/WebKit or on a real Mac or iPhone.** This environment has no WebKit. The
  founder's Safari at 1244 px is the first live check after deploy, after a hard reload.
- **Browsers without `:has()`** (Safari < 15.4, Firefox < 121): the shell still gets the console
  through `[data-console]`, but sheets, dialogs, menus and toasts stay teal. Both palettes pass AA,
  so nothing becomes unreadable. The app already relies on `:has()` in its root rules.
- **The team area keeps today's dark-mode teal failures** (switch track 2.02:1, chart bars 2.02:1,
  Stats bars 2.28:1, selected tab 1.02:1 against unselected). The console fixes them in the
  dashboard; the team area gets its own ticket.
- **Black chart bars read heavy** at 30 bars. Acceptable now; a later `chart` role (for example
  graphite 700 / graphite 300) could soften them.

**Status.** Accepted.

[ADR 0063]: README.md
[ADR 0064]: README.md

**Final integration run (2026-11-22, all of v6 merged: ADRs 0062–0064 plus the review fixes).**
- Unit: web 210, tokens 52, config 79, blocks 41.
- Playwright, production build in demo mode, desktop + phone + review: 670 passed, 35 skipped by design, 0 failed.
- Real accounts against the local stack (`E2E_SUPABASE=1`): 13 of 13. pgTAP: 278 (access 76, referrals 202). `db:lint`: 0 issues.
- An independent review (5 reviewers, each finding checked by a skeptic) confirmed 9 findings, 0 critical; all 9 are fixed
  and covered by the numbers above. 3 more were refuted.
