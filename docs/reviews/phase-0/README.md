# Phase 0 — Foundations · review report

Date: 2026-11-17 · Branch: `claude/linkyo-brand-identity-mkz3tk`

## 1. What was built

| Deliverable | Where | State |
|---|---|---|
| Brand identity (verbatim) | `docs/BRAND_IDENTITY.md` | ✅ |
| Monorepo (pnpm 10, Turborepo 2, TS 6 strict, ESLint 9, Stylelint, Prettier, commitlint + lefthook, CI) | root, `packages/config`, `.github/workflows` | ✅ |
| Tokens → CSS, Tailwind v4 theme, TS, Swift, Asset Catalog (light/dark/Increase Contrast) | `packages/tokens` | ✅ 27 tests |
| Token guard (ESLint rule, Stylelint, SwiftLint rules + Linux CLI, lint-coverage check) | `packages/config` | ✅ 62 tests |
| Logo: "the Loop" symbol, wordmark, lockups, app icons (light/dark/tinted), favicon, native SwiftUI symbol | `packages/tokens/brand` | ✅ generated from geometry |
| Creator theme engine (OKLCH, WCAG AA guard, 12 presets, 8 pairings, 6 styles × 3 shapes, photo seed extraction) | `packages/tokens/src/creator` | ✅ 4,000-seed property test |
| Component library (Button, IconButton+Tooltip, TextField, Switch, Segmented, Badge, Card, Kbd, Avatar, Skeleton, Spinner, Toast w/ Undo, ConfirmDialog, Menu, Logo) | `packages/ui` | ✅ |
| Block schemas (15 types) + smart link detection (YouTube, Spotify, Apple Music, SoundCloud, TikTok, Instagram, Twitch, Eventim, Shopify, email, phone, WhatsApp, PDF, image…) + bulk paste | `packages/blocks` | ✅ 27 tests |
| Living design system page | `/de/design` · `/en/design` · `/ar/design` | ✅ |
| **3 directions** (creator page + dashboard each, shared editor core: paste-to-add, drag/keyboard reorder, undo/redo, ⌘K, file drop, live preview) | `/directions` | ✅ waiting for your pick |
| Competitive research | `docs/REFERENCE_ANALYSIS.md` | ✅ (Playwright/Lighthouse/axe — REA blocked, see §5) |
| Accounts + env vars, cost model | `docs/SETUP_ACCOUNTS.md`, `.env.example`, `docs/COSTS.md` | ✅ |
| Architecture + 10 ADRs | `docs/ARCHITECTURE.md`, `docs/DECISIONS/` | ✅ |
| iOS scaffold (XcodeGen, app + Share Extension + Widgets, design-system package, debug Design Gallery, privacy manifest) | `apps/ios` | ⚠ parse-checked only (no Xcode here) |

## 2. Evidence

- **Screenshots** (73): `creator/` (3 directions × de/ar × 375/768/1440 + dark presets), `dashboard/` (× light/dark),
  `design/`, `overview-*` — this folder.
- **Tests:** 123 unit (Vitest) + 122 E2E (Playwright) — all passing.
  - axe (WCAG 2.0/2.1/2.2 A+AA): **0 violations** on 10 routes × de/en/ar × light/dark × desktop + mobile.
  - Editor: one paste → correct block + preview update (all 3 dashboards); delete → Undo from toast; ⌘K palette;
    visibility toggle + ⌘Z; ⌥↓ keyboard reorder.
  - Privacy: creator pages make **0 third-party requests and set 0 cookies** (asserted).
- **Lighthouse** (mobile, simulated 4G + 4× CPU; `lighthouse-summary.json`):

| Creator page | Perf | A11y | Best practices | SEO* | LCP | CLS | JS |
|---|---|---|---|---|---|---|---|
| Gallery | 99 | 100 | 100 | 63 | 0.9 s | 0.001 | 205 KB |
| Stage | 93 | 100 | 100 | 63 | 2.7 s | 0.028 | 205 KB |
| Mosaic | 90 | 100 | 100 | 63 | 3.2 s | 0 | 205 KB |

\* SEO is 63 only because prototype pages are deliberately `noindex`. JS is the App Router baseline — ADR 0008 plans the
zero-runtime renderer for production pages.

## 3. Rubric (honest, Phase 0 scope)

| # | Criterion | Score | Evidence | To reach 10 |
|---|---|---|---|---|
| 1 | Modernity | 9 | screenshots, `/directions` | Your pick + scroll-reveal/page-transition polish in Phase 1 |
| 2 | Visual design | 9 | tokens everywhere (lint-enforced), brand followed | Tablet (768) dashboard density pass; Mosaic editor tiles need richer previews |
| 3 | User experience | 8 | E2E editor flows | Onboarding (Phase 1), inline editing beyond titles, empty-page first run |
| 4 | Buttons | 10 | `/design#buttons`: 5 variants × 4 sizes × 6 states, 44 pt hit areas | — |
| 5 | Colors | 10 | 4,000-seed AA test, dark/light/high-contrast tokens, ADR 0007 | Sign-off on ADR 0007 |
| 6 | Order / arrangement | 9 | creator pages put release/live first (Stage), consistent dashboard regions | Validate block order with 3–5 creators |
| 7 | Cleanliness | 9 | max 2 font families per page, hairline borders | Trim prototype toolbar from screenshots (done with `?chrome=0`) |
| 8 | Structure (code & IA) | 9 | typed end-to-end, shared schemas, ADRs, 0 lint errors | Generate `api-client` (Phase 1); delete the 2 unchosen directions |
| 9 | Ease of use | 8 | add = 1 paste, undo everywhere in editor | Autosave + version history need the backend (Phase 1) |
| 10 | Layout | 9 | 375/768/1440, de + ar RTL, 0 horizontal overflow (measured) | 320 px and 2560 px passes, iPad |
| 11 | Icons | 10 | Lucide only (stroke 1.75), Simple Icons for platforms, SF Symbols on iOS | — |
| 12 | Ease of adding content | 7 | paste/bulk paste/drop (images) in prototype | Metadata fetch, uploads, share sheet, pickers (Phases 1–2) |
| 13 | iOS app quality | 5 | design-system package, Design Gallery, targets, icons, privacy manifest | Phase 2 — first macOS build via `ios.yml` |
| 14 | Performance | 8 | Lighthouse 90–99, CLS ≤ 0.03 | JS 205 → < 70 KB (ADR 0008), LCP < 1.5 s on all directions |
| 15 | Accessibility | 10 | axe 0 violations (122 runs), keyboard reorder, labels, reduced motion | Manual VoiceOver/TalkBack pass in Phase 1 |
| 16 | Privacy & security | 9 | 0 third-party requests/cookies, self-hosted fonts, security headers | RLS + pgTAP, CSP nonces, OWASP review (Phase 1) |

Lines below 10 are either outside Phase 0's scope (backend, iOS build, onboarding) or listed as Phase 1 fixes.
Per the master prompt, Phase 0 is not marked done until you choose a direction.

## 4. Open issues / decisions for you

1. **Pick a direction** (Gallery, Stage, Mosaic — or a mix, e.g. Stage creator page + Gallery dashboard).
2. **Sign off ADR 0007** (dark-mode blue roles, status colors as fills, input borders at 3:1).
3. **Music links:** approve dropping Odesli (owned by Linktree) for our own resolver (ADR 0009).
4. **Video provider:** Mux (priced) vs. Bunny Stream (EU company) — ADR 0010.
5. **Logo:** "the Loop" interprets the "y in negative space" as two interlocking links that draw the y — confirm or ask
   for a variant.
6. Lighthouse SEO will be 100 once pages are indexable (production only).

## 5. REA audit summary

REA (`rea-agents`) was reviewed (official npm package, MIT, links to github.com/morluto/rea), but its global install was
**blocked by this session's permission policy**, so it was not installed or run. Equivalent public-page analysis and our
own audit were done with Playwright (HAR/network capture), Chrome DevTools Protocol throttling, Lighthouse 13 and axe-core:
our creator pages make 33 same-origin requests, 0 third-party requests, set 0 cookies, and ship 205 KB JS (target 70 KB).

## 6. Costs incurred

None. No accounts were created and no paid services were used. Running cost estimates: `docs/COSTS.md`
(≈ $55/mo pre-launch, ≈ $148 at 1k creators, ≈ $1,135 at 10k).

## 7. Next step

After your pick: Phase 1 — Supabase schema + RLS, auth, username claim, the chosen editor on real data with autosave and
version history, metadata fetch + uploads, zero-runtime public renderer (ADR 0008), onboarding, analytics, legal helper,
marketing site (de/en/ar).
