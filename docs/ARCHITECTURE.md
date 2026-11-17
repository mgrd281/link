# Linkyo — Architecture

> Status: Phase 0 (foundations). Sections marked **(Phase n)** describe the plan, not shipped code.
> Decisions with trade-offs live in [`DECISIONS/`](DECISIONS/).

## 1. System overview

```
             Visitors (public pages)                     Creators (dashboard · iOS app)
                      │                                              │
      username.linkyo.app · custom domains             linkyo.app/app  ·  Linkyo for iOS
                      │                                              │
┌─────────────────────▼──────────────────────────────────────────────▼──────────────────────┐
│ Vercel (Next.js 16, functions in fra1)                                                      │
│  • proxy.ts: locale routing, host → creator rewrite (Phase 1)                               │
│  • Public creator pages: static/ISR HTML, zero-runtime renderer, tiny islands (ADR 0008)    │
│  • Dashboard + marketing: App Router, Server Components, Server Actions, next-intl          │
│  • /api/beacon: cookie-free analytics ingest → Supabase                                     │
└──────────────┬───────────────────────────────────────────────────────────┬─────────────────┘
               │ supabase-js (RLS)                                          │ supabase-swift
┌──────────────▼────────────────────────────────────────────────────────────▼────────────────┐
│ Supabase · eu-central-1 (Frankfurt)                                                          │
│  Postgres + RLS · Auth (magic link, Google, Apple, passkeys) · Storage (media, variants)      │
│  Edge Functions (metadata fetch, image variants, feeds, webhooks) · Realtime (live preview)  │
│  pg_cron + Queues (feed refresh, rollups, cleanup) · Vault (encrypted OAuth tokens)          │
└──────────────┬──────────────────────────────────────────────────────────────────────────────┘
               │
   Mux (video, HLS) · Scaleway TEM (email, Paris) · Stripe · App Store Server API · APNs
   Platform APIs: YouTube RSS/Data API, Twitch EventSub, RSS, Apple MusicKit, oEmbed (keyless)
```

Data stays in the EU wherever a provider offers it (Supabase, Vercel functions, Sentry, PostHog, Scaleway).
US processors (Vercel CDN edge, Mux, Stripe, Apple) are covered by DPAs + SCCs/DPF and listed in the privacy policy
([ADR 0010](DECISIONS/0010-hosting-and-data-residency.md)).

## 2. Monorepo (final structure)

```
link/                                   pnpm workspaces + Turborepo, TypeScript strict, conventional commits
├─ apps/
│  ├─ web/                              Next.js 16 (App Router) — dashboard, marketing, public creator pages
│  │  ├─ src/app/[locale]/              routes: / (marketing home), /design, /directions, /directions/[d], /directions/[d]/dashboard
│  │  ├─ src/features/
│  │  │  ├─ design-system/              the living /design page (tokens, components, states, theme engine)
│  │  │  ├─ creator/                    creator-page primitives shared by all renderers (theme vars, link buttons)
│  │  │  └─ directions/                 Phase 0: Poster (from the founder's references, ADR 0011) + 3 earlier directions + shared editor core
│  │  ├─ src/messages/{de,en,ar}.json   next-intl messages (de default, ar RTL)
│  │  ├─ src/assets/samples/            sample media (credits in CREDITS.md)
│  │  └─ e2e/                           Playwright: axe (WCAG 2.2 AA), editor flows, privacy, review captures
│  └─ ios/                              SwiftUI app — XcodeGen spec, app + Share Extension + Widgets
│     ├─ project.yml                    generates Linkyo.xcodeproj (not committed)
│     ├─ Linkyo/ · LinkyoShareExtension/ · LinkyoWidgets/
│     └─ Packages/LinkyoDesignSystem/   SPM package: generated tokens + colors + LoopSymbol, components, Design Gallery
├─ packages/
│  ├─ tokens/                           tokens.json (single source of truth) → CSS, Tailwind v4, TS, Swift, xcassets
│  │  ├─ src/creator/                   creator theme engine: OKLCH palette + WCAG guard, presets, image seed extraction
│  │  └─ brand/                         logo generator (geometry → SVG/TS/Swift), brand SVGs, app icons
│  ├─ ui/                               React component library (Radix + Tailwind), tokens only
│  ├─ blocks/                           block schemas (Zod) + smart link detection — shared by editor, renderer, API
│  ├─ api-client/                       typed client (OpenAPI-generated in Phase 1) for TS + Swift
│  └─ config/                           ESLint (incl. no-raw-design-values), Stylelint, tsconfig, Prettier, token guard
├─ supabase/                            migrations (+ RLS + pgTAP), Edge Functions, seed (Phase 1)
├─ docs/                                BRAND_IDENTITY, ARCHITECTURE, REFERENCE_ANALYSIS, COSTS, SETUP_ACCOUNTS,
│                                       DECISIONS/ (ADRs), reviews/phase-0/ (screenshots, Lighthouse, report)
└─ .github/workflows/                   ci.yml (lint · typecheck · test · build · e2e+axe · Lighthouse), ios.yml (macOS)
```

## 3. Rendering

| Surface | Strategy |
|---|---|
| **Public creator page** | Pre-rendered HTML per creator (ISR, on-demand revalidation on publish), served from the CDN; host-based routing (`username.linkyo.app`, custom domains via the Vercel Domains API). Phase 1 moves the renderer to a **zero-runtime pipeline** (HTML + CSS + ~3 KB vanilla islands for click-to-load embeds, newsletter, beacon) to meet the 70 KB JS budget — measured Phase 0 App Router baseline is 205 KB ([ADR 0008](DECISIONS/0008-public-page-rendering.md)). |
| **Live preview** | The *same* renderer components rendered inside the dashboard at 390 px. Container queries (`@container`) make layout respond to the preview width, not the viewport; React state makes updates synchronous (< 50 ms, no network). iOS uses a WKWebView of the real renderer for the preview sheet (Phase 2). |
| **Dashboard / marketing** | Next.js App Router, Server Components by default; client islands for the editor. |
| **SEO** | Server-rendered HTML, per-page/article OG images (`next/og`), JSON-LD (Person / MusicGroup / Organization), sitemap per creator. Phase 0 pages are `noindex` on purpose. |

## 4. Data model (refined from master prompt §9)

All tables: `id uuid pk`, `created_at`, `updated_at`; **RLS enabled in the same migration** with a pgTAP test.

| Table | Key columns | Notes / RLS |
|---|---|---|
| `profiles` | `owner_id → auth.users`, `username citext unique`, `display_name`, `bio`, `locale`, `theme jsonb` (`CreatorThemeConfig`), `hero_media_id`, `plan`, `custom_domain`, `verified` | Owner read/write. Public reads only through `public_page(username)` (security-definer, returns visible + scheduled-active blocks). `username` checked against `reserved_usernames`. |
| `blocks` | `profile_id`, `type`, `rank text` (fractional index → reorder = 1 row update), `visible`, `schedule tstzrange`, `highlight`, `config jsonb`, `style jsonb` | `config` validated by JSON Schema generated from `@linkyo/blocks` Zod (`pg_jsonschema` CHECK). **Sections are `header` blocks** (simpler editor + renderer than a separate `sections` table). |
| `versions` | `profile_id`, `snapshot jsonb`, `reason` | Undo/history: trigger keeps the last 30 per profile. |
| `posts` | `profile_id`, `slug`, `content jsonb` (TipTap), `seo jsonb`, `published_at` | URL `username.linkyo.app/<slug>`. |
| `media_assets` | `profile_id`, `storage_key`, `kind`, `width`, `height`, `focal`, `thumbhash`, `variants jsonb`, `mux_asset_id`, `alt` | Variants generated **once at upload** (cost: [COSTS.md §5](COSTS.md#5-cost-levers)). |
| `connections` | `profile_id`, `provider`, `vault_secret_id`, `scopes`, `refreshed_at` | Tokens encrypted in Supabase Vault; least-privilege scopes. Never readable by clients. |
| `feed_items` | `connection_id`, `external_id`, `kind`, `payload jsonb`, `published_at` | Filled by queue workers (YouTube RSS, Twitch EventSub, RSS). |
| `products`, `subscribers`, `form_messages` | … | Subscribers: double opt-in, export + delete per creator. Inbox for forms/bookings. |
| `page_views`, `block_clicks` | `profile_id`, `day`, `visitor_hash`, `referrer_host`, `country`, `device` | **Cookie-free**: hash = SHA-256(daily salt ‖ IP ‖ UA ‖ profile), salt rotated and discarded daily (no persistent ID). Raw rows 30 days (partitioned), then daily rollups. Insert only via the beacon function. |
| `media_kits`, `legal_docs` | … | Generated Impressum/Datenschutz from the legal wizard. |
| `entitlements` | `profile_id`, `source` (stripe/app_store), `product`, `status`, `expires_at` | Single entitlement table fed by Stripe webhooks and App Store Server Notifications v2. |
| `reports`, `audit_log`, `reserved_usernames` | … | DSA notice-and-action, admin audit trail, brand/offensive username blocklist. |

## 5. Key flows

- **Universal Add (≤ 1 paste):** `detectLink()` (pure, < 1 ms, `@linkyo/blocks`) creates the right block optimistically → Edge Function `link-metadata` fetches OpenGraph/oEmbed (SSRF-safe: https only, public IPs only after DNS resolution, 3 s timeout, 1 MB cap) → patches the block. Bulk paste = one block per URL.
- **Music smart links:** own resolver (Apple MusicKit search by ISRC/UPC + Deezer public API + Spotify oEmbed/embeds) instead of Odesli, which is owned by Linktree ([ADR 0009](DECISIONS/0009-music-smart-links.md)).
- **Media:** direct upload to Storage (signed URL) → variants (AVIF/WebP, 3 widths, focal-point crop, thumbhash) → CDN. Video: Mux direct upload, HLS, poster frame, captions prompt.
- **Feeds:** `pg_cron` enqueues due connections into Supabase Queues; Edge workers batch ~50 per invocation; YouTube via channel RSS (no quota), Twitch via EventSub webhooks.
- **Realtime:** dashboard ↔ iOS edits sync through Supabase Realtime (postgres changes on `blocks`), last-writer-wins per field with `updated_at` guards; iOS queues offline edits (SwiftData) and replays them.

## 6. Design system pipeline

`packages/tokens/tokens.json` (DTCG) → Style Dictionary 5 → `dist/css/tokens.css`, `dist/tailwind/theme.css` (Tailwind's
default theme is reset: only tokens produce utilities), `src/generated/tokens.ts`, and for iOS `DesignTokens.swift` +
`Colors.xcassets` (light/dark/Increase Contrast) + `LoopSymbol.swift` (committed; CI fails on drift).
The **token guard** fails the build on raw hex/px/fonts/motion values outside the tokens package: ESLint rule
`linkyo/no-raw-design-values`, Stylelint config, SwiftLint custom rules (mirrored on Linux CI), and a lint-coverage check
([ADR 0002](DECISIONS/0002-design-tokens-pipeline.md), [ADR 0003](DECISIONS/0003-token-guard.md)).
Creator pages use the **theme engine** (`packages/tokens/src/creator`): seed → OKLCH palette with a WCAG AA guarantee
([ADR 0005](DECISIONS/0005-creator-theme-engine.md)).

## 7. iOS

SwiftUI (iOS 17+, Swift 6 strict concurrency), Observation, SwiftData offline cache + edit queue, `supabase-swift`,
PhotosUI, AVKit, WidgetKit, App Intents, Share Extension (App Group `group.app.linkyo`), StoreKit 2, APNs, Sign in with Apple.
Zero third-party UI libraries. The design system is a local SPM package generated from the same tokens; the project is
generated by XcodeGen ([ADR 0004](DECISIONS/0004-ios-project.md)). Debug builds include the **Design Gallery**.

## 8. Security & privacy

- RLS on every table + pgTAP tests in CI; service-role key only in Edge Functions/server.
- Strict CSP with nonces on dashboard; creator pages have **no third-party requests and no cookies** by default (E2E-tested); embeds are click-to-load; a consent banner appears only if a creator enables auto-play embeds.
- SSRF-safe metadata fetching; rate limits on beacon/forms (Upstash-free: Postgres token buckets); Turnstile-free bot defense (honeypot + rate limits) to avoid third parties on public pages.
- OWASP Top 10 mapping per phase in the review report; secrets never in client bundles (`NEXT_PUBLIC_*` only for public keys).
- Account deletion + data export on web and iOS; Impressum/AGB/Datenschutz; DSA "Report" on every page.

## 9. Quality gates (CI)

| Gate | Tooling | Phase 0 status |
|---|---|---|
| Lint + token guard | ESLint (typed, jsx-a11y strict, better-tailwindcss), Stylelint, token guard (Swift) | ✅ 0 errors |
| Types | TypeScript 6 strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) | ✅ |
| Unit | Vitest — tokens + contrast incl. vivid mode and templates (31), lint rules (62), blocks + detect (29), web incl. Poster sections + samples (16) | ✅ 138 passing |
| E2E + a11y | Playwright + axe (WCAG 2.2 AA) on 15 routes (all 5 Poster templates) × 3 locales × light/dark × desktop/mobile, editor flows on all 4 dashboards, Poster flows (month tabs, rails, templates) | ✅ 213 passing (incl. marketing home), 0 violations |
| Performance | Lighthouse CI on creator pages | ⚠ 78–99, noisy on this machine (target ≥ 95 hard, 100 goal) — fixed by ADR 0008; see Phase 0 report |
| iOS | SwiftLint, Swift Testing, `xcodebuild` on macOS (Xcode Cloud in Phase 2) | ⚠ parse-checked on Linux; full build runs in `ios.yml` |
