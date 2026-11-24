---
name: linkyo-design-tokens
description: Linkyo's design-token rules. Use before writing or changing any UI in apps/web or packages/ui (colors, spacing, sizes, fonts, z-index, radii, borders and depth (Linkyo uses no shadows), motion), when adding a creator accent color or theme, or when ESLint reports linkyo/no-raw-design-values or an unknown Tailwind class.
---

# Linkyo design tokens

Every visual value comes from `packages/tokens/tokens.json`. App code never contains a raw value.
The build fails otherwise: ESLint runs the rule `linkyo/no-raw-design-values` and better-tailwindcss
reports unknown classes.

## Rules

- **No shadows. Ever.** Linkyo is flat (ADR 0037). No `shadow-*`, `drop-shadow-*`, `inset-shadow-*` or
  `text-shadow-*` classes, no `boxShadow`/`textShadow` styles, no `drop-shadow()` filters, no canvas
  `shadowBlur`, on any screen, creator page, share picture or iOS view. The tokens have no shadow scale,
  so these classes do not even exist; the lint rule and Stylelint reject them too (`shadow-none` and
  `box-shadow: none` stay allowed). A surface stands apart in one of three ways:
  - a hairline border: `border border-line` (cards, chips, menus, popovers, dialogs, sheets);
  - a stronger border: `border-line-strong` / `border-line-input` (fields, secondary buttons);
  - a step in the fill: a `bg-surface` tile on a `bg-canvas-muted` panel. A chosen tab or segment in a
    muted track is `bg-surface-elevated` + `border-line`; give every item `border border-transparent`
    so nothing jumps.
  - Drag and drop: the lifted item scales (`scale-lift`) and gets `border-primary`.
  - Creator pages: `border-creator-line(-strong)`. The button style saved as `shadow` is the "Card"
    style: `bg-creator-surface` + `border-creator-line`.
- **No underlines. Ever.** No `underline`, `hover:underline`, `underline-offset-*` or `decoration-*`
  anywhere (ADR 0041); the lint rule rejects them and Stylelint allows only `text-decoration: none`
  or `line-through` (old prices). Links: `text-link font-semibold` with `hover:text-fg` and a
  `transition-colors`; in the dashboard `hover:text-link-hover` (see "Dashboard palette"); on creator
  pages `hover:text-creator-fg`; keyboard focus shows `focus-ring`.
- **Buttons and focus that feel like an app (ADR 0059):**
  - The quiet partner of a primary action is `variant="tinted"` (`bg-tinted text-tinted-fg`, a soft
    teal fill), on `Button` and `IconButton`; not a white outlined button.
  - A lone primary action on the website (sign up, keep this page, see all) is `size="cta"` (56 px
    pill, semibold); on phones, pairs are equal and full width, stacked.
  - Text fields show focus with `focus-field` (the 2 px teal inside the field's edge) together with
    `border-focus`, never `focus-ring` around a framed field. Buttons and links keep `focus-ring`.
  - Grow a small control's tap area on touch with `before:absolute before:inset-0
    pointer-coarse:before:-inset-0.5` (and `relative`), as `IconButton` does.
- **Sticky bars sit flush under the header** (`sticky top-16`: the header is `h-16`) on a solid
  `bg-canvas` band, so no content shows between them.
- **No raw colors, lengths or fonts** in `apps/web` or `packages/ui`. That rules out `#hex`, `rgb()`,
  `12px`, arbitrary Tailwind values like `p-[13px]` and `z-10`, and inline `style` lengths.
- **Use token utilities.**
  - Surfaces and text: `bg-surface`, `bg-canvas`, `text-fg`, `text-fg-secondary`, `border-line`.
  - Brand: `bg-primary` / `text-primary-fg`.
  - Creator pages: `bg-creator-bg`, `bg-creator-surface(-2)`, `text-creator-fg(-muted)`,
    `bg-creator-accent` / `text-creator-accent-fg`, `text-creator-accent-text`, `border-creator-line(-strong)`.
- **Stacking:** `layer-*` utilities (`layer-raised`, `layer-sticky`, `layer-overlay`, `layer-modal`),
  never `z-*`.
- **Sizes:**
  - spacing: the token scale only (`p-1`, `gap-3`; no half steps that the scale lacks);
  - controls: `h-control-sm|md|lg|xl`, `size-control-*`;
  - icons: `size-icon-*` via the `Icon` component's `size`.
- **Motion:** `duration-micro|standard|slow` and `ease-standard`. Always add a `motion-reduce:` variant
  for anything that moves.
- **Springs and sheets (ADR 0056):** `ease-spring` + `duration-spring` are the iOS spring of
  `motion.spring` (response 0.35 s, damping 0.85) sampled into CSS `linear()`, so web and the Swift
  design system move alike. Use them for things that settle (a sheet, a pressed tab pill). Things
  leaving the screen use `ease-exit`. Ready-made: `animate-sheet-in`, `animate-sheet-out` (starts from
  `--sheet-drag`), `animate-fade-out`. Haptics: `haptic()` from `@/lib/haptics`, only on a user's tap.
- **Opacity:** `opacity-hover`, `opacity-pressed`, `opacity-secondary` (overlays use `bg-current`
  with these).
- **Radii:** `rounded-creator-button`, `rounded-creator-card`, `rounded-xl`. Depth: borders and fills only (see the first rule).
- **Button shapes (one rule, D-14):** every button is `rounded-md` (the default): in cards, lists,
  sheets, dialogs, toolbars and empty states. A pill (`rounded-full`) only for the footer of a
  step-by-step flow (welcome, checkout: Weiter / Zurück) and for the lone call to action of a
  website section (`size="cta"`). Round icon-only buttons (`IconButton` + `rounded-full`: a sheet's
  close, a rail's previous and next) carry no text and are not pills. Never mix both shapes in a row.

## Icons (design system v2)

- **One glyph per meaning.** Import the meaning from the registry, not a lucide name:
  `import { icons } from "@linkyo/ui"` → `<Icon icon={icons.analytics} />`. The registry
  (`packages/ui/src/icons.ts`) maps about 80 meanings (actions, ways through the product, states,
  areas, content, playback); /design#icons shows them all. Need a new meaning? Add it there (and to
  `ICON_GROUPS`), never a second glyph for an existing one. Lucide stays the only icon library; brand
  logos come from Simple Icons through `PlatformIcon`.
- **Deprecated aliases are banned** (`no-restricted-imports` in `packages/config/eslint`):
  `AlertTriangle` → `icons.warning`, `MoreHorizontal` → `icons.more`, `BarChart3`/`ChartColumn` →
  `icons.analytics` (`ChartNoAxesColumn`), `Music2` → `icons.music`, `Briefcase` → `icons.work`.
  The rule warns until the Stage 2 codemod, then errors. Laufbahn's files are exempt (its rendering
  does not change).
- **Sizes and strokes.** `size="xs" | "sm" | "md" | "lg"` (12, 16, 20, 24 px; never a `size-3`
  override). `Icon` sets the stroke so it is `icon.stroke-sm` (1.5 px) at xs and sm, `icon.stroke-md`
  (1.6 px) at md and `icon.stroke-lg` (1.75 px) at lg on screen (`iconStroke(size)`), so small icons
  are as strong as the text beside them. Do not pass `strokeWidth` yourself.
- **Selected state:** `strong` (the token `icon.stroke-strong`, 2.25 px) together with a semibold
  label, in both tab bars; never colour alone.
- **Media transport** (play, pause, stop, skip) is always `solid` (`<Icon solid />`,
  `<IconButton solid />`), so a toggle never mixes a filled and an outlined glyph. It never mirrors.
- **Right to left.** Every glyph in `DIRECTIONAL` (arrows, chevrons, undo and redo, send, sign in and
  out, lists, panels, trends) mirrors itself inside `dir="rtl"` (`MIRROR_IN_RTL`; a `dir="ltr"` island in
  an Arabic page keeps its arrows; not `:dir(rtl)`, which the CSS minifier rewrites into `:lang()`
  selectors). So: **never** add `rtl:-scale-x-100`, never
  `[&_svg]:rtl:-scale-x-100` on a button, and never flip a button or a wrapper around an icon (a second
  flip undoes the first). For a glyph that must keep its screen direction pass `mirror={false}`.
- **Arabic companions of the creator faces (C-03).** Each pairing in `tokens.json` has
  `creator.pairing.<id>.$extensions["app.linkyo"].arabic` (`display` and `body`: family, face,
  weight); a template can override it with its own `arabic` (Nocturne: Rakkas) or keep the Arabic
  pairing as it is (`{ "pairing": "arabic" }`, Laufbahn). On Arabic pages `resolveCreatorTheme`
  puts the companion first and the template's Latin stack after it; `theme.pairing` stays the
  Arabic pairing (name fitting, link cards and share pictures read it). The faces are vendored OFL
  files in `apps/web/src/assets/fonts/<family>/` (Arabic subset, at most two weights, `OFL.txt`
  beside them), declared in `apps/web/src/fonts.ts` with an Arabic-only `unicode-range`,
  `preload: false` and `adjustFontFallback: false`: German pages never download them, and Latin
  letters skip them to reach the template's own face. Add one: copy the woff2 and licence from
  `npm pack @fontsource/<family>` (never install it), add a `localFont` like the others, the `arabic`
  token, and extend `packages/tokens/test/arabic-companions.test.ts`.


## When a general design or motion skill says otherwise

The vendored skills (`ui-ux-pro-max`, `web-design-guidelines`, `motion`, `motion-design`,
`gsap-*`, `accessibility`, `performance`, …) give general advice. In this repository these rules win:

- **Flat, not shadowed.** Advice to add a shadow, an elevation scale, "shadow lift" on hover or a soft
  glow under buttons does not apply here: use a border, a fill step or a color change instead.
- **Values come from tokens.** Palettes, font pairings and spacing scales that a search suggests are
  ideas to discuss, not values to paste. Add new values to `tokens.json` first, then use the
  generated utility.
- **Motion is CSS first.** Use `transition`/`@keyframes`, scroll-driven animations and the
  `mk-*` utilities in `globals.css`, all timed with `--duration-*` and `--ease-*`. Add the `motion`
  or `gsap` package only when CSS cannot do the job (e.g. physics or a gesture). Even then, take
  durations from the tokens and honour `prefers-reduced-motion`, and record the new dependency
  in an ADR.
- **No third-party requests from pages.** No Google Fonts or CDN links, and no analytics or embed
  scripts by default. Fonts are self-hosted, as they are today.
- **Three languages, both directions.** German, English and Arabic: check every layout in RTL.

## Dashboard palette (ADR 0062)

The creator dashboard (`/app/*`) is black and grey; the website, sign-up, creator pages, the team area,
share pictures and iOS stay teal. Nothing changes in class names: inside the dashboard the same
semantic classes (`bg-primary`, `text-link`, `bg-selected`, `bg-tinted`, `bg-canvas-muted`, …) resolve
to the console palette. Its greys come from the cool `graphite` scale, never the website's warm `gray`.

- **Two markers.**
  - `data-console="frame"` on a screen's root element (the shell, `AppSplash`, the welcome flow)
    gives the palette to the whole window through `:root:has(…)`, so sheets, dialogs, menus, tooltips
    and toasts, which render in `<body>`, follow it. Use it only on a root that fills the window.
  - `data-console="local"` gives it to one subtree only (the owner's bar over "View my page", where
    the creator's page under it keeps its colours).
- **Console values come in pairs.** A role gets the console palette through `console` *and*
  `consoleDark` in its `$extensions["app.linkyo"]`. The token build throws when one is missing (the
  console's light rule outranks the plain dark rule, so dark mode would turn light) and when a role
  has console and high-contrast values together. Read them in code as
  `tokens.semantic.<role>.console.light | .dark` (every role has them; unchanged roles repeat their
  own values).
- **No palette or tint classes under `features/app`** (`teal-*`, `gray-*`, `graphite-*`, `night-*`,
  `ink`, `white`, `tint-*` …): they would not follow the palette. Only the preview's phone bezel
  (`bg-ink`) and the QR code on paper (`bg-white`, `text-ink`, `fill-white`, `fill-ink`) are allowed.
  No `data-theme` there either: a light subtree would bring the teal roles back.
- **Links in the dashboard** are body coloured (`link` = `fg` there): a link is a standalone control,
  `text-link font-semibold` with an icon (chevron, arrow, eye or status glyph), and hovers with
  `hover:text-link-hover` (a lighter grey; outside the dashboard `link-hover` equals `fg`, so it
  behaves like `hover:text-fg`). No links inside running text, so no `t.rich()` that maps to `<Link>`
  or `<a>`. Never `text-link` with `hover:text-fg`.
- **Switch thumb:** on, the knob is `bg-primary-fg` (white on the black track; ink on the white
  track of the dark dashboard). Anything drawn on a `bg-primary` fill takes `text-primary-fg` too.
- **Logo:** `tone="mono"` inside the dashboard.
- **The creator preview** reads only `--creator-*`; never use the roles above in
  `features/directions/poster` or `features/directions/shared` (except the dashboard chrome in
  `template-picker.tsx`, `dashboard.tsx` and Linkyo's bar in `dock.tsx`).
- **Tests:** `apps/web/src/features/app/console-guard.test.ts` (the five rules above, as static
  checks), the "dashboard palette" tests in `packages/tokens/test/tokens.test.ts` (AA in both modes,
  graphite stays cool, the generated CSS blocks, iOS stays teal) and
  `apps/web/e2e/console-theme-app.spec.ts` (computed colours in the dashboard, in a portalled sheet,
  in dark mode, in the preview and outside the dashboard).

## Creator colors

- Creator pages are themed by `resolveCreatorTheme(config)` from `@linkyo/tokens/creator`. The config
  holds a template, accent, neutral, tint, mode, pairing, button style and button shape.
- The engine guarantees WCAG AA. It adjusts lightness, never hue, so any accent is safe.
- Named accents live in `creator.swatch` in `tokens.json` and are read as `creatorTokens.swatches`.
  To add one:
  1. add `"name": { "$value": "#RRGGBB" }` under `creator.swatch`;
  2. run `pnpm --filter @linkyo/tokens build`;
  3. use `SW.name` (with `const SW = creatorTokens.swatches`). Hex values belong only in `tokens.json`.
- To try a theme quickly, run a tsx script in `packages/tokens` that calls `resolveCreatorTheme` and
  prints `palette.bg`, `accent` and `accentFg`.

## UI kit (packages/ui)

Reach for these before writing a one-off: `Select` (the system's own select, framed like a text
field; never an unstyled `<select>`), `Segmented` (one line, scrolls sideways, optional counts),
`FilterSheet` + `FilterGroup` + `FilterChip` + `ActiveFilters` (a long list's filters behind one
button), `DataList` (card rows on phones, aligned columns from md), `KpiTile` (inside a `<dl>`;
change as arrow + signed text + words, optional sparkline), `ChartTable` (the numbers behind a
chart; replaces `<details>`), `CommandPalette` (⌘K; `useCommandPaletteShortcut`). They take all
their words as props; the shared wording is in the `ui.*` messages. None of them may carry
`data-console` (the team area stays teal: `features/design-system/team-area-guard.test.ts`).

## Checks

```bash
cd apps/web && npx eslint src e2e && npx tsc --noEmit -p .
pnpm --filter @linkyo/tokens test   # palette guard, AA checks, Arabic companions
pnpm --filter @linkyo/ui test       # icons (mirroring, strokes, registry), kit components
pnpm --filter @linkyo/config test   # lint rules, the lucide alias ban
```
