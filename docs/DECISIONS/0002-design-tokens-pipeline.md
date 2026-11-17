# 0002 — Design tokens pipeline

**Context.** Brand §2: tokens are the single source of truth for web and iOS; no hard-coded values in app code.

**Decision.** `packages/tokens/tokens.json` in W3C DTCG format. Modes (dark, Increase Contrast) live in
`$extensions["app.linkyo"]`. Style Dictionary 5 with custom formats generates:
- `dist/css/tokens.css` (framework-agnostic custom properties) and `dist/tailwind/theme.css` (Tailwind v4 `@theme static`
  with `--*: initial` — Tailwind's default palette/spacing are removed, so `bg-red-500` or `p-7` simply don't exist);
  dark/high-contrast overrides apply to `:root` *or any subtree* with `data-theme`;
- `src/generated/tokens.ts` (typed values for OG images, charts, the theme engine);
- iOS: `DesignTokens.swift`, `Colors.xcassets` (light/dark/high-contrast appearances), the app's `AccentColor`, and
  `LoopSymbol.swift` (from the logo generator). iOS outputs are **committed** so Xcode never needs Node;
  `pnpm check:tokens-drift` fails CI if they are stale.
Spacing keys follow the 4 px multiplier (`0_5` = 2 px → `p-0.5`); sizes/layout live in their own namespaces
(`h-control-xl`, `max-w-creator`, `w-sidebar`). Creator roles use `@theme inline` so per-page CSS variables resolve at the
element (a `:root` indirection would resolve too early).

**Consequences.** Adding a value = editing `tokens.json` + `pnpm tokens`. Brand changes propagate to both platforms.
