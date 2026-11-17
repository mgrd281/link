# Linkyo

**One link. Everything you create.** — Ein Link. Alles, was du erschaffst. — رابط واحد. لكل ما تصنعه.

A creator home: link-in-bio page, media kit, content hub and analytics — on web and native iOS. Germany first,
GDPR-native, no cookies on creator pages by default.

> **Phase 0 (foundations)** is in review: brand → tokens → components → the living design system, and three coded
> directions for the creator page and dashboard. Report: [`docs/reviews/phase-0/README.md`](docs/reviews/phase-0/README.md).

## Quick start

```bash
nvm use            # Node 22
corepack enable    # pnpm 10
pnpm install
pnpm dev           # → http://localhost:3000/de
```

| URL | What |
|---|---|
| `/de/design` | Living design system (every token, component, state; creator theme playground) |
| `/de/directions` | The three directions side by side |
| `/de/directions/{gallery,stage,mosaic}` | Creator page (`?preset=ocean` to try any theme, `?chrome=0` hides the prototype bar) |
| `/de/directions/{gallery,stage,mosaic}/dashboard` | Dashboard with live preview — paste a link, press `N`, `⌘K`, drag, `⌘Z` |

Replace `de` with `en` or `ar` (RTL).

## Scripts

| Command | Does |
|---|---|
| `pnpm lint` | ESLint + Stylelint in every package + token guard (incl. Swift) |
| `pnpm typecheck` · `pnpm test` · `pnpm build` | via Turborepo |
| `pnpm tokens` | Rebuild tokens (CSS, Tailwind, TS, Swift, xcassets) from `packages/tokens/tokens.json` |
| `pnpm --filter @linkyo/tokens brand` | Regenerate logo assets |
| `pnpm --filter @linkyo/web e2e` | Playwright E2E + axe (needs `pnpm build` first) |
| `pnpm --filter @linkyo/web review` | Capture design-review screenshots into `docs/reviews/phase-0` |

## Docs

[Brand identity](docs/BRAND_IDENTITY.md) · [Architecture](docs/ARCHITECTURE.md) · [Decisions](docs/DECISIONS/README.md) ·
[Reference analysis](docs/REFERENCE_ANALYSIS.md) · [Costs](docs/COSTS.md) · [Accounts & keys](docs/SETUP_ACCOUNTS.md) ·
[iOS](apps/ios/README.md)
