# Accounts, API keys & environment variables

> Checklist for the founder. Researched 2026-11-17 — full per-service details (console paths, DPA/AVV links,
> free tiers, gotchas) in [`research/ACCOUNTS_AND_LINKS.md`](research/ACCOUNTS_AND_LINKS.md); prices in [`COSTS.md`](COSTS.md).
> Rules: company mailbox for every account · 2FA everywhere · keys only in Vercel/Supabase/GitHub secret stores ·
> download each DPA (AVV) for the Verzeichnis von Verarbeitungstätigkeiten.

## 1. Needed before Phase 1 starts

| # | Account | Create here | What to create | Env vars (see `.env.example`) | Cost |
|---|---|---|---|---|---|
| 1 | **GitHub** organisation | https://github.com/organizations/plan | Move `link` repo into the org; Actions secrets for CI | — (CI secrets) | Free |
| 2 | **Domain** `linkyo.app` | https://vercel.com/domains (free year 1 with Pro) or Cloudflare Registrar | Buy on the company; `.app` is HTTPS-only (HSTS preload) | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CREATOR_DOMAIN` | ≈ $15/yr |
| 3 | **Vercel** (Pro team) | https://vercel.com/signup → team → Billing → Pro | Project from the repo, Functions region `fra1`, wildcard `*.linkyo.app`; team token for the Domains API | `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (CI) | $20/mo |
| 4 | **Supabase** (Pro org) | https://supabase.com/dashboard/sign-up | Project in **Central EU (Frankfurt) `eu-central-1`** (immutable!) + a staging project | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_DB_URL` | $25/mo + compute |
| 5 | **Transactional email** (Scaleway TEM, Paris) | https://console.scaleway.com/register | Domain with SPF/DKIM/DMARC; SMTP creds → Supabase Auth SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | free → €0.25/1k |
| 6 | **Google Cloud** project | https://console.cloud.google.com/ | OAuth client (web) for Sign in with Google; YouTube Data API v3 key | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `YOUTUBE_API_KEY` | Free |
| 7 | **Apple Developer Program** (company) | https://developer.apple.com/programs/enroll/ (needs D-U-N-S) | Team ID; Sign in with Apple **Services ID + key**; App ID `app.linkyo.ios`; App Group `group.app.linkyo`; MusicKit key; APNs key | `APPLE_TEAM_ID`, `APPLE_SERVICES_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY_P8`, `APPLE_MUSIC_*`, `APNS_*` | $99/yr |
| 8 | **Sentry** (EU data region) | https://sentry.io/signup/ → Data Storage Location **EU** (immutable) | Projects `web`, `ios`; org token for source maps | `SENTRY_DSN`, `SENTRY_AUTH_TOKEN` | Free → $29/mo |
| 9 | **PostHog EU Cloud** | https://eu.posthog.com/signup | Project (dashboard analytics only — never on creator pages) | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Free tier |
| 10 | **Twitch** developer app | https://dev.twitch.tv/console (2FA required) | App for live status (EventSub) | `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | Free |

## 2. Needed in later phases

| Phase | Account | Create here | Env vars |
|---|---|---|---|
| 1 | **Mux** (video) — or Cloudflare Stream / Bunny Stream (EU) | https://dashboard.mux.com/signup | `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_WEBHOOK_SECRET` |
| 1 | **Cloudflare R2** (EU-jurisdiction media bucket, optional until scale) | https://dash.cloudflare.com/sign-up | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` |
| 2 | **App Store Connect** API key, TestFlight, Xcode Cloud (25 h/month included) | https://appstoreconnect.apple.com/access/integrations/api | `APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_PRIVATE_KEY_P8` |
| 3 | **Spotify** for Developers (optional — 2026 rules: Premium owner, 5 users in dev mode) | https://developer.spotify.com/dashboard | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` |
| 4 | **Stripe** (Payments, Billing, Tax, Connect "Stripe handles pricing") | https://dashboard.stripe.com/register | `STRIPE_SECRET_KEY` (restricted key), `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_CONNECT_CLIENT_ID` |
| 4 | **Apple**: Small Business Program + **EU DSA trader status** in App Store Connect | https://developer.apple.com/app-store/small-business-program/ | — |
| any | **UptimeRobot** (status page) | https://uptimerobot.com/signUp | — |
| any | **Trademark** "Linkyo": DPMA (€290, 3 classes) or EUIPO (€850+) — search first | https://www.dpma.de/marken/anmeldung/index.html | — |

**Not needed:** Odesli/song.link (keyless access ended, and Odesli belongs to Linktree — see [ADR 0009](DECISIONS/0009-music-smart-links.md)) ·
Meta app (Instagram/Threads oEmbed is tokenless since 2026-06-15) · TikTok app (oEmbed/Embed Player are keyless).

## 3. Where each secret lives

| Store | Holds |
|---|---|
| **Vercel** → Project → Settings → Environment Variables (Production / Preview separately) | Everything in `.env.example` used by `apps/web` |
| **Supabase** → Edge Functions → Secrets | Platform API keys used by Edge Functions (`YOUTUBE_API_KEY`, `TWITCH_*`, `MUX_*`, `STRIPE_*`, `APNS_*`) |
| **Supabase** → Authentication → Providers / SMTP | Google + Apple OAuth credentials, SMTP |
| **GitHub** → Settings → Secrets and variables → Actions | `VERCEL_*`, `SENTRY_AUTH_TOKEN`, `SUPABASE_DB_URL` (migrations), `LHCI_GITHUB_APP_TOKEN` |
| **Xcode Cloud** / fastlane match | Signing certificates, `APP_STORE_CONNECT_*` |

`NEXT_PUBLIC_*` variables are visible to browsers by design — never put a secret behind that prefix.
