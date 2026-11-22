# Linkyo — Architecture

> Status: Phase 0 (foundations) plus v7 phase 1 (AI builder, selling flows and going live, all in test mode).
> Sections marked **(Phase n)**, "planned" or "later" describe the plan, not shipped code.
> Decisions with trade-offs live in [`DECISIONS/`](DECISIONS/).

## 1. System overview

```
             Visitors (public pages)                     Creators (dashboard · iOS app)
                      │                                              │
      username.linkyo.app · custom domains             linkyo.app/app  ·  Linkyo for iOS
                      │                                              │
┌─────────────────────▼──────────────────────────────────────────────▼──────────────────────┐
│ Vercel (Next.js 16, functions in fra1)                                                      │
│  • proxy.ts: locale routing; /<username> → app/u/[username] (own root layout, ISR 60 s)     │
│  • Public creator pages: static/ISR HTML, zero-runtime renderer, tiny islands (ADR 0008)    │
│  • Dashboard + marketing: App Router, Server Components, Server Actions, next-intl          │
│  • AI builder (ADR 0065): /api/ai/runs (Node, SSE) → safe fetcher → Claude API (one call)   │
│  • Payments (ADR 0066): /checkout/* (Stripe elements), /api/stripe/webhook, /widerruf,      │
│    /kuendigen; e-mail through one EmailSender (Scaleway TEM; capture file in tests)         │
│  • /api/maintenance/storage-purge: deletes queued Storage files (ADR 0067)                  │
│  • /api/beacon: cookie-free analytics ingest → Supabase                                     │
└──────────────┬───────────────────────────────────────────────────────────┬─────────────────┘
               │ supabase-js (RLS)                                          │ supabase-swift
┌──────────────▼────────────────────────────────────────────────────────────▼────────────────┐
│ Supabase · eu-central-1 (Frankfurt)                                                          │
│  Postgres + RLS · Auth (6-digit e-mail code) · Storage (media, briefing, deliverables)       │
│  AI limits and run log (ai_settings, ai_runs, ai_usage) · orders, entitlements, contracts    │
│  pg_cron (6 jobs: sign-ins, unconfirmed, referrals, form limits, service, AI cleanup)        │
│  Later: Edge Functions (image variants, feeds) · Realtime (live preview) · Vault (OAuth)      │
└──────────────┬──────────────────────────────────────────────────────────────────────────────┘
               │
   Anthropic Claude API (AI builder, USA: text only, no photos, contacts redacted; server only)
   Stripe (Payment Element on /checkout/* only, webhook) · Scaleway TEM (email, Paris)
   Mux (video, HLS) · App Store Server API · APNs
   Platform APIs: YouTube Data API, Twitch EventSub, RSS, Apple MusicKit, oEmbed (keyless)
```

Phase 1 of v7 runs all of this in **test mode**: the AI and Stripe calls go only to local mocks, no
e-mail leaves the machine, and the live demo deployment has no Supabase keys, so none of the boxes
above the database is switched on there ([ADR 0065](DECISIONS/0065-ai-page-builder.md),
[ADR 0066](DECISIONS/0066-selling-in-germany.md), [ADR 0067](DECISIONS/0067-going-live.md)).

Data stays in the EU wherever a provider offers it (Supabase, Vercel functions, Sentry, PostHog, Scaleway).
US processors (Vercel CDN edge, Mux, Stripe, Apple) are covered by DPAs + SCCs/DPF and listed in the privacy policy
([ADR 0010](DECISIONS/0010-hosting-and-data-residency.md)).

## 2. Monorepo (final structure)

```
link/                                   pnpm workspaces + Turborepo, TypeScript strict, conventional commits
├─ apps/
│  ├─ web/                              Next.js 16 (App Router) — dashboard, marketing, public creator pages
│  │  ├─ src/app/[locale]/              routes: / (marketing home), /signup, /login, /forgot, /app/* (dashboard), /design, /directions/*
│  │  ├─ src/features/
│  │  │  ├─ design-system/              the living /design page (tokens, components, states, theme engine)
│  │  │  ├─ creator/                    creator-page primitives shared by all renderers (theme vars, link buttons)
│  │  │  ├─ account/                    AccountStore contract + demo (browser) implementation, auth pages (ADR 0014)
│  │  │  ├─ app/                        the creator dashboard: shell, welcome, home, editor + sheets, design, analytics, settings
│  │  │  └─ directions/                 Phase 0: Poster (from the founder's references, ADR 0011) + 3 earlier directions + shared editor core
│  │  ├─ src/messages/{de,en,ar}.json   next-intl messages (de default, ar RTL)
│  │  ├─ src/assets/samples/            sample media (credits in CREDITS.md)
│  │  └─ e2e/                           Playwright: axe (WCAG 2.2 AA), editor flows, privacy, review captures
│  └─ ios/                              SwiftUI app — XcodeGen spec, app + Share Extension + Widgets
│     ├─ project.yml                    generates Linkyo.xcodeproj (not committed)
│     ├─ Linkyo/ · LinkyoShareExtension/ · LinkyoWidgets/
│     └─ Packages/LinkyoDesignSystem/   SPM package: generated tokens + colors + LinkyoSymbol, components, Design Gallery
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
| **Public creator page** | **As built (v7, [ADR 0067](DECISIONS/0067-going-live.md)):** `linkyo.app/<username>`; with real accounts on, `proxy.ts` rewrites the one-segment path to `app/u/[username]` (skipping next-intl, so no cookie and no locale prefix; reserved names and locales never match), a second root layout whose `<html lang dir>` is the page's own language. The page is ISR with `revalidate = 60`; `public_page()` and the route both filter blocks (hidden, scheduled, newsletter); canonical `pageUrl()`; AI content marked with `ai-generated` meta and `data-ai-generated`. Pictures from Storage go through `/_next/image`. **Planned:** on-demand revalidation on publish; host-based routing (`username.linkyo.app`, custom domains via the Vercel Domains API). Phase 1 moves the renderer to a **zero-runtime pipeline** (HTML + CSS + ~3 KB vanilla islands for click-to-load embeds, newsletter, beacon) to meet the 70 KB JS budget — measured Phase 0 App Router baseline is 205 KB ([ADR 0008](DECISIONS/0008-public-page-rendering.md)). |
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
| `entitlements` | **As built (v7):** `profile_id`, `product` (`'pro'`), `source` (`stripe` \| `team`; App Store later), `status` (`active`, `past_due`, `canceled`, `refunded`), `starts_at`, `current_period_end`, `cancel_at_period_end`, `cancel_at` (a scheduled end later than the period end), `stripe_customer_id`, `stripe_subscription_id` (unique), `confirmation_sent_at` | Owner selects own rows; team with `billing.view`. Written only by service functions from the Stripe webhook (`upsert_pro_subscription`, one row per subscription from its current state; `refunded` is final), mirrored into `subscriptions`. `has_pro()` = an active Stripe entitlement in its period, a "Pro für immer" reward, or team-set Pro without a Stripe entitlement. |
| `reports`, `audit_log`, `reserved_usernames` | … | DSA notice-and-action, admin audit trail, brand/offensive username blocklist. |

**Added in v7 phase 1** ([ADR 0065](DECISIONS/0065-ai-page-builder.md), [ADR 0066](DECISIONS/0066-selling-in-germany.md),
[ADR 0067](DECISIONS/0067-going-live.md)). Pages still live as one JSON document in `sites.page` (no `blocks` table yet);
blocks carry `origin` and the profile `aiFields`. Every table below has RLS on, and customers and the team cannot
insert, update or delete any of them directly: all writes go through `security definer` functions (service-only for the
webhook, the forms and the AI pipeline; owner and team functions check the caller inside).

| Table | Key columns | Read access (RLS) |
|---|---|---|
| `orders` | `number` (`LNK-YYYY-NNNNNN`), `profile_id`, `customer_email`, `package` (`start` \| `premium`), `status` (paid → awaiting_briefing/queued → in_progress → delivered → revision_requested → completed; refunded, withdrawn), `amount_cents`, `vat_mode`, `early_start` + `early_start_text`, `start_after`, `promised_due_at`, `briefing`, `due_at`, `assignee`, `revisions_allowed`/`_used`, `withdrawal_pending`, `refund_kind`, Stripe ids | owner; team `customers.view` |
| `order_events` | `order_id`, `at`, `actor`, `kind`, `details` | team `customers.view` |
| `site_proposals` | `order_id`, `round`, `status` (draft, delivered, applied, superseded), `page`, `theme`, `message`, `request`, `extras` (Premium kit), `story_paths` | owner once delivered; team `customers.view`. Never written to `sites`: only the customer's Apply changes the page |
| `checkout_intents` | `session_id`, `profile_id`, `product`, early-start consent and the promised dates | none (functions only) |
| `stripe_events` | `id`, `type`, `received_at`, `processed_at` | none (webhook idempotency) |
| `withdrawals`, `cancellations` | the declaration as typed, `received_at`, `matched`, `suspect`, `decision`, `handled_*` | team `billing.view` |
| `form_limits`, `service_settings` | per-IP-hash form counts (1 day); daily capacity | none |
| `invoices` (existing) | adds `subscription`, `payment_intent` (no longer top-level on a Stripe invoice since basil) | unchanged |
| `ai_settings` | the kill switch and every limit (budget, drafts, IP, concurrency, failures) | none |
| `ai_runs` | `profile_id` (the team member for a team run), `order_id`, `route`, `status`, `counted`, tokens and cost, `progress`, `result` (7 days) | owner selects a column list without `ip_hash`, actor, money or tokens |
| `ai_budget_days`, `ai_usage` | daily spend and runs; monthly counted drafts per account (kept after the run log is deleted) | none |
| `storage_purge` | `bucket`, `prefix`, `due_at`, `attempts`, `last_error` | none (service client only; drained through the Storage API) |

Storage buckets: `media` (public), `briefing` and `deliverables` (private), with owner-folder policies on
`storage.objects` and team read (`pages.edit`) where the service needs it.

## 5. Key flows

- **Universal Add (≤ 1 paste):** `detectLink()` (pure, < 1 ms, `@linkyo/blocks`) creates the right block optimistically → `/api/link-metadata` asks the platform's keyless oEmbed (fixed hosts only, never the pasted address; logic in `lib/link-metadata.ts`) → patches the block. Bulk paste = one block per URL.
- **Reading a website (AI builder and importer, v7):** a **Node route, not an Edge Function**. `features/ai/server/safe-fetch.ts`: https on port 443 only, every resolved address public unicast (IPv6 by allow-list), **connect-time pinning** (the socket's `lookup` answers only the validated address, so DNS rebinding cannot swap it), each redirect re-validated (≤ 3), robots.txt honoured per host (agent `LinkyoImport`), body streamed and cut at 1 MB, 3 s connect / 8 s total, no pictures downloaded. `/api/import-links` uses the same fetcher; Linktree is paste-only.
- **AI page builder (v7, [ADR 0065](DECISIONS/0065-ai-page-builder.md)):** `/app/build` → `POST /api/ai/runs` (SSE) → `ai_reserve_run` (once) → read sources → enrich media links → one streamed Claude call with structured output (PagePlan v1) → blocks streamed to the phone as their JSON closes → checks and at most one repair call → `ai_settle_run` → review → the owner's Apply (one undoable step). The team runs the same pipeline for a Start order and saves a proposal.
- **Selling (v7, [ADR 0066](DECISIONS/0066-selling-in-germany.md)):** `/service` → `/checkout/service|pro` (Stripe Payment Element; § 312j summary above "Zahlungspflichtig bestellen"; consent route fixes early start and the due date) → `/api/stripe/webhook` (idempotent by `processed_at`) → order + confirmation e-mail → briefing → team queue → proposal → customer review. `/widerruf` and `/kuendigen` record every declaration; refunds and contract ends are team actions.
- **Music smart links:** own resolver (Apple MusicKit search by ISRC/UPC + Deezer public API + Spotify oEmbed/embeds) instead of Odesli, which is owned by Linktree ([ADR 0009](DECISIONS/0009-music-smart-links.md)).
- **Media:** direct upload to Storage (signed URL) → variants (AVIF/WebP, 3 widths, focal-point crop, thumbhash) → CDN. Video: Mux direct upload, HLS, poster frame, captions prompt.
- **Feeds (later phase):** `pg_cron` enqueues due connections into Supabase Queues; workers batch ~50 per invocation; **YouTube via the Data API** (an API key; the channel RSS is not used), Twitch via EventSub webhooks. In v7 phase 1 the AI builder only links a YouTube channel.
- **Team area (`/admin`):** the Linkyo team prepares pages for top creators in the same editor creators use, with roles → permissions (owner, admin, editor, viewer), invites stored only as SHA-256, a verified badge, Draft → Ready → publish, and an activity log ([ADR 0016](DECISIONS/0016-team-area.md)). Phase 0 keeps team data in the browser and publishes via `scripts/prepare-page.mjs --add`; Phase 1 moves it to Supabase with RLS mirroring the permission table.
- **Realtime:** dashboard ↔ iOS edits sync through Supabase Realtime (postgres changes on `blocks`), last-writer-wins per field with `updated_at` guards; iOS queues offline edits (SwiftData) and replays them.

## 6. Design system pipeline

`packages/tokens/tokens.json` (DTCG) → Style Dictionary 5 → `dist/css/tokens.css`, `dist/tailwind/theme.css` (Tailwind's
default theme is reset: only tokens produce utilities), `src/generated/tokens.ts`, and for iOS `DesignTokens.swift` +
`Colors.xcassets` (light/dark/Increase Contrast) + `LinkyoSymbol.swift` (committed; CI fails on drift).
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
- Strict CSP with nonces on dashboard; creator pages have **no third-party requests and no cookies** by default (E2E-tested); embeds are click-to-load. Pages with players show a privacy notice in the creator's own colors ("No tracking cookies"): allow external content or essential only. The choice is stored locally (strictly necessary, TTDSG § 25 (2)) and can be changed from the footer ("Cookie settings").
- SSRF-safe metadata fetching; rate limits on beacon/forms (Upstash-free: Postgres token buckets); Turnstile-free bot defense (honeypot + rate limits) to avoid third parties on public pages.
- OWASP Top 10 mapping per phase in the review report; secrets never in client bundles (`NEXT_PUBLIC_*` only for public keys).
- Account deletion + data export on web and iOS; Impressum/AGB/Datenschutz; DSA "Report" on every page.

## 9. Quality gates (CI)

| Gate | Tooling | Phase 0 status |
|---|---|---|
| Lint + token guard | ESLint (typed, jsx-a11y strict, better-tailwindcss), Stylelint, token guard (Swift) | ✅ 0 errors |
| Types | TypeScript 6 strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) | ✅ |
| Unit | Vitest — tokens + contrast incl. vivid mode and templates (31), lint rules (62), blocks + detect (29), web incl. Poster sections, samples, account store, blank blocks, validation, sample analytics (30) | ✅ 152 passing |
| E2E + a11y | Playwright + axe (WCAG 2.2 AA) on 18 routes (incl. sign-up/log-in/reset, all 5 Poster templates) × 3 locales × light/dark × desktop/mobile; dashboard screens + sheets (en/ar × light/dark × desktop/mobile); account + dashboard journeys on desktop and phone; editor flows on all 4 directions | ✅ 273 passing, 0 violations |
| Performance | Lighthouse CI on creator pages | ⚠ 78–99, noisy on this machine (target ≥ 95 hard, 100 goal) — fixed by ADR 0008; see Phase 0 report |
| iOS | SwiftLint, Swift Testing, `xcodebuild` on macOS (Xcode Cloud in Phase 2) | ⚠ parse-checked on Linux; full build runs in `ios.yml` |
