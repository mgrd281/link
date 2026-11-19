---
name: linkyo-design-tokens
description: Linkyo's design-token rules. Use before writing or changing any UI in apps/web or packages/ui (colors, spacing, sizes, fonts, z-index, radii, shadows, motion), when adding a creator accent color or theme, or when ESLint reports linkyo/no-raw-design-values or an unknown Tailwind class.
---

# Linkyo design tokens

Every visual value comes from `packages/tokens/tokens.json`. App code never contains a raw value.
The build fails otherwise: ESLint runs the rule `linkyo/no-raw-design-values` and better-tailwindcss
reports unknown classes.

## Rules

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
- **Opacity:** `opacity-hover`, `opacity-pressed`, `opacity-secondary` (overlays use `bg-current`
  with these).
- **Radii and shadows:** `rounded-creator-button`, `rounded-creator-card`, `rounded-xl`; `shadow-e1…e3`.


## When a general design or motion skill says otherwise

The vendored skills (`ui-ux-pro-max`, `web-design-guidelines`, `motion`, `motion-design`,
`gsap-*`, `accessibility`, `performance`, …) give general advice. In this repository these rules win:

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

## Checks

```bash
cd apps/web && npx eslint src e2e && npx tsc --noEmit -p .
pnpm --filter @linkyo/tokens test   # palette guard, AA checks
```
