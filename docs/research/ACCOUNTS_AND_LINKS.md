# Linkyo — accounts, keys & links per service

Researched 2026-11-17. Companion to `docs/COSTS.md` (prices live there). Console paths are as documented today; providers
rename menus often. "Verified" = checked with a live request on 2026-11-17. ⚠ = not fully verified.

General rules: create every account on a company-owned shared mailbox (not a personal address), enable 2FA, store keys
only in Vercel/Supabase/GitHub secret stores, sign/download each DPA (AVV) and keep it with the Verzeichnis von
Verarbeitungstätigkeiten. Don't look up the domain name on third-party registrar/WHOIS sites before buying it.

---

## Vercel — hosting (Next.js, ISR, fra1 functions, wildcard + custom domains)

| | |
| --- | --- |
| Signup | https://vercel.com/signup → create a **team** → Settings → Billing → upgrade to **Pro** |
| Keys / console | Access tokens: Account Settings → Tokens — https://vercel.com/account/settings/tokens (scope the token to the team; used by the Domains API, e.g. `POST /v10/projects/{idOrName}/domains`). Env vars: Project → Settings → Environment Variables. Function region: Project → Settings → Functions → `fra1` (or `"regions": ["fra1"]` in `vercel.json`). Flat Rate CDN tier: Team → Settings → Billing → Flat Rate CDN. Spend alerts: Team → Settings → Billing → Spend Management. |
| EU region | Functions and the durable ISR cache run in `fra1` (Frankfurt); the CDN is global. Vercel Inc. is a US processor. |
| DPA / AVV | https://vercel.com/legal/dpa (incorporated into the terms) |
| Free tier | Hobby: 100 GB data transfer, 1 M CDN requests, 1 M invocations, 4 CPU-h, 360 GB-h memory, 5 k image transformations per month — **personal / non-commercial use only**. |
| Gotchas | Hobby is non-commercial (Terms §4) → Pro from day one. Pro = $20/month fee incl. $20 usage credit, no per-function allowance; builds billed per CPU-minute ($0.0035). **New Pro teams get Flat Rate CDN by default with only 1 M requests + 1 TB included** (vercel.com/pricing still says 10 M — conflict); tiers $20 / $100 / $300 for 10 M / 50 M / 150 M requests, tier changes apply next cycle; media-heavy bandwidth is out of scope for the flat rate. **Wildcard `*.linkyo.app` needs Vercel nameservers, or an `_acme-challenge` NS delegation to Vercel if DNS stays elsewhere.** Pro: unlimited domains per project (soft limit 100 k). Free first-year domain with Pro is not available during the Pro trial. Each extra deploying member = +$20/month. |
| Pricing | https://vercel.com/pricing · https://vercel.com/docs/pricing/regional-pricing/fra1 · https://vercel.com/docs/pricing/flat-rate-cdn |

## Supabase — Postgres + RLS, Auth, Storage, Edge Functions, Realtime, pg_cron / Queues

| | |
| --- | --- |
| Signup | https://supabase.com/dashboard/sign-up → new organisation (Pro) → new project in **Central EU (Frankfurt) `eu-central-1`** — the region can't be changed later |
| Keys / console | API keys: Project Settings → API Keys — https://supabase.com/dashboard/project/_/settings/api-keys → use the new `sb_publishable_…` (client) and `sb_secret_…` (server) keys; legacy `anon` / `service_role` keys are being deprecated by end of 2026. Personal access token (CLI, Management API): https://supabase.com/dashboard/account/tokens. Auth providers: Authentication → Sign In / Providers. Custom SMTP: Authentication → Emails → SMTP Settings. Passkeys: Authentication → Passkeys (set the WebAuthn relying-party ID + up to 5 origins). Spend Cap: Organization → Billing → Cost Control. |
| EU region | `eu-central-1` Frankfurt (other EU regions exist: Ireland, London, Paris, Zurich, Stockholm). Supabase Inc. is a US company. |
| DPA / AVV | https://supabase.com/legal/dpa (redirects to the Data Processing Addendum) |
| Free tier | 2 active projects; 500 MB database, 1 GB Storage, 5 GB + 5 GB egress, 50 k MAU, 500 k Edge Function invocations, 200 Realtime connections; no image transformations; **paused after 1 week of inactivity**. |
| Gotchas | Pro's $10 compute credit covers **one** Micro → staging project is +$10/month. **Built-in SMTP: 2 emails/hour and only to project team addresses — configure Scaleway TEM before inviting anyone.** **Passkeys: beta since 2026-05-28, explicit opt-in, API may change; web SDK first, Swift support experimental.** Sign in with Apple via web OAuth needs a new client secret every 6 months (native iOS `signInWithIdToken` is exempt). Spend Cap blocks over-quota usage until the next cycle — decide deliberately for production. PITR replaces daily backups; Storage objects are not in DB backups. Image transformations are billed per distinct origin image ($5 / 1,000). Custom domain ($10/month) avoids `*.supabase.co` on OAuth consent screens. |
| Pricing | https://supabase.com/pricing · https://supabase.com/docs/guides/platform/manage-your-usage/compute |

## Cloudflare — R2 (EU media bucket), Stream (video alternative), DNS, Registrar

| | |
| --- | --- |
| Signup | https://dash.cloudflare.com/sign-up |
| Keys / console | R2 S3 credentials: R2 Object Storage → Account Details → API Tokens → **Manage** → create an *Object Read & Write* token scoped to the bucket (Access Key ID + Secret shown **once**). Account API tokens (Stream, DNS, Registrar): https://dash.cloudflare.com/profile/api-tokens (e.g. `Stream:Edit`, `Zone:DNS:Edit`). EU bucket: R2 → Create bucket → Location → **Specify jurisdiction → EU**; S3 endpoint `https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com`. Registrar: Domain Registration → Register Domains. |
| EU region | R2 jurisdictional restriction "EU" guarantees objects stay in the EU. Stream: no EU storage pinning (Data Localization Suite "Regional Services" is not supported for Stream; customer-metadata boundary only with caveats). |
| DPA / AVV | https://www.cloudflare.com/cloudflare-customer-dpa/ |
| Free tier | R2: 10 GB-month, 1 M Class A, 10 M Class B operations/month, egress always free. DNS: free plan. Stream: none (storage prepaid in $5 blocks of 1,000 min). |
| Gotchas | R2 custom domains require the domain as a **zone in the same account**; a partial (CNAME) setup is Business/Enterprise-only — so either put `linkyo.app` DNS on Cloudflare or use a separate media domain. `r2.dev` URLs are rate-limited and dev-only (no caching). A bucket's jurisdiction is immutable; Logpush doesn't work with jurisdiction buckets. **Cloudflare Registrar forces Cloudflare nameservers** → combine with Vercel via `_acme-challenge` NS delegation and DNS-only (grey-cloud) `*` CNAME. Stream uploads stop when the prepaid storage block is full. |
| Pricing | https://developers.cloudflare.com/r2/pricing/ · https://developers.cloudflare.com/stream/pricing/ |

## Mux — video (priced in the totals)

| | |
| --- | --- |
| Signup | https://dashboard.mux.com/signup (no credit card needed to start) |
| Keys / console | Settings → Access Tokens — https://dashboard.mux.com/settings/access-tokens (token ID + secret per environment); Settings → Webhooks; Settings → Signing Keys (signed playback URLs). |
| EU region | No EU video-storage region published; Mux Data offers an EU ingest location via sales. US processor → SCCs. |
| DPA / AVV | https://www.mux.com/dpa · privacy guide https://www.mux.com/docs/guides/ensure-data-privacy-compliance |
| Free tier | Pay-as-you-go includes a **$20 monthly usage credit**; first 100 k delivered minutes/month free; basic-quality encoding free. |
| Gotchas | Basic quality: 1-month minimum storage charge per asset, on-demand only (live needs Plus). Delivery priced by resolution tier (cap at 720p to save ~20 %). Automatic cold storage: −40 % after 30 days unplayed, −60 % after 90. Document the US transfer in the privacy policy. |
| Pricing | https://www.mux.com/docs/pricing/video |

## Bunny Stream — optional EU-native video alternative ⚠

| | |
| --- | --- |
| Signup | https://dash.bunny.net/auth/register |
| Keys / console | Account API key: dashboard → Account → API; per-library Stream API key: Stream → (library) → API. ⚠ menu names not verified |
| EU region | EU company (BunnyWay d.o.o., Slovenia); storage regions selectable (up to 8). |
| DPA / AVV | Available from bunny.net legal pages ⚠ (not verified) |
| Free tier | None; $1/month minimum. |
| Gotchas | Bandwidth- and GB-priced (from $0.005/GB delivery, $0.01/GB storage, free transcoding) — not per minute, so compare with real bitrates. |
| Pricing | https://bunny.net/pricing/stream/ |

## Scaleway Transactional Email (TEM) — recommended EU email (magic links, notifications)

| | |
| --- | --- |
| Signup | https://console.scaleway.com/register |
| Keys / console | IAM → API keys — https://console.scaleway.com/iam/api-keys (give the IAM application a TEM permission set). SMTP: `smtp.tem.scaleway.com`, ports 25/587/2587 (no implicit TLS) or 465/2465 (TLS), **username = Project ID, password = API secret key** → paste into Supabase SMTP settings. Domains: Transactional Email → Domains (SPF, DKIM, MX, DMARC records). Plan: Transactional Email → Plans. |
| EU region | `fr-par` (Paris); French provider. |
| DPA / AVV | https://www.scaleway.com/en/contracts/ (Data Processing Agreement) |
| Free tier | Essential plan: 300 emails/month free, then €0.25 per 1,000. |
| Gotchas | Scale plan (€80/month, 100 k incl., dedicated IP, unlimited webhooks) has a 30-day commitment for IP warm-up. Essential: shared IP, 1 webhook per domain. scaleway.com pages are behind a JS challenge (fine in a browser). |
| Pricing | https://www.scaleway.com/en/pricing/managed-services/ · https://www.scaleway.com/en/docs/transactional-email/how-to/manage-tem-plans/ |

## AWS SES (eu-central-1) — email alternative

| | |
| --- | --- |
| Signup | https://portal.aws.amazon.com/billing/signup |
| Keys / console | SES console (region `eu-central-1`) → SMTP settings → **Create SMTP credentials** (creates an IAM user); API: IAM access keys. Leave the sandbox: SES → Account dashboard → Request production access. |
| EU region | `eu-central-1` Frankfurt (US company). |
| DPA / AVV | AWS GDPR DPA (part of the Service Terms): https://d1.awsstatic.com/legal/aws-dpa/aws-dpa.pdf |
| Free tier | New accounts: up to $200 in Free Tier credits (no SES-specific free volume any more). |
| Gotchas | New accounts start in the **sandbox** (verified recipients only, small daily quota) until production access is approved. $0.10 per 1,000 à la carte; attachments $0.12/GB. |
| Pricing | https://aws.amazon.com/ses/pricing/ |

## Resend — email alternative

| | |
| --- | --- |
| Signup | https://resend.com/signup |
| Keys / console | https://resend.com/api-keys; Domains → add domain → choose sending region `eu-west-1` (Ireland). |
| EU region | Sending from Ireland possible, but **account data and logs are stored in the US** (region "does not control where customer data is stored"). |
| DPA / AVV | https://resend.com/legal/dpa |
| Free tier | 3,000 emails/month, max 100/day, 3 domains. |
| Gotchas | Dedicated IP only on Scale ($30/month add-on). 30-day log retention. |
| Pricing | https://resend.com/pricing |

## Postmark — email alternative

| | |
| --- | --- |
| Signup | https://account.postmarkapp.com/sign_up |
| Keys / console | Servers → (server) → API Tokens (server token); Account → API Tokens (account token). |
| EU region | No EU data residency offered. |
| DPA / AVV | https://postmarkapp.com/dpa · https://postmarkapp.com/eu-privacy |
| Free tier | Developer plan: 100 emails/month, no overage. |
| Gotchas | New accounts need approval before sending to arbitrary recipients ⚠ (verify). |
| Pricing | https://postmarkapp.com/pricing |

## Stripe — Payments, Billing (Pro subscriptions), Tax, Connect (creator sales)

| | |
| --- | --- |
| Signup | https://dashboard.stripe.com/register (country: Germany) |
| Keys / console | API keys: https://dashboard.stripe.com/apikeys (prefer **restricted keys**; test keys under `/test/apikeys`). Webhooks + signing secrets: https://dashboard.stripe.com/webhooks. Connect: https://dashboard.stripe.com/connect (platform profile; choose "Stripe handles pricing" to avoid per-account fees). Tax: https://dashboard.stripe.com/tax. Customer portal: Settings → Billing → Customer portal. |
| EU region | EEA merchants contract with Stripe's European entity; data may also be processed in the US (DPA covers transfers). |
| DPA / AVV | https://stripe.com/legal/dpa |
| Free tier | No monthly fee; per transaction: EEA standard cards 1.5 % + €0.25, Billing 0.7 %. |
| Gotchas | Billing's 0.7 % comes on top of card fees. EU OSS VAT for B2C digital services → Stripe Tax (0.5 %) or own logic. Connect "you handle pricing" = €2 per monthly active account + 0.25 % + €0.10 per payout and platform-side loss liability; instant payouts 1 %. Non-EUR cards +2 % conversion. Disputes €20 each. |
| Pricing | https://stripe.com/de/pricing · https://stripe.com/de/connect/pricing |

## Apple — Developer Program, App Store Connect, StoreKit, Sign in with Apple, MusicKit, Xcode Cloud

| | |
| --- | --- |
| Signup | https://developer.apple.com/programs/enroll/ ($99/year; company enrolment needs a free D-U-N-S number — https://developer.apple.com/help/account/membership/D-U-N-S) |
| Keys / console | Keys (.p8, download **once**): https://developer.apple.com/account/resources/authkeys/list — *Sign in with Apple* key; *MusicKit / Media Services* key (first register a **Media ID** under Identifiers, Account Holder/Admin role needed; guide: https://developer.apple.com/help/account/capabilities/create-a-media-identifier-and-private-key/); APNs key. Identifiers (App ID, **Services ID** for web Sign in with Apple, Media ID): https://developer.apple.com/account/resources/identifiers/list. App Store Connect API keys (CI/fastlane): https://appstoreconnect.apple.com/access/integrations/api (Users and Access → Integrations); In-App Purchase key: same page → In-App Purchase. Small Business Program: https://developer.apple.com/app-store/small-business-program/enroll/. Xcode Cloud: App Store Connect → app → Xcode Cloud. |
| EU region | n/a — Apple is merchant of record for IAP. |
| DPA / AVV | n/a for IAP (Apple acts as independent controller); Apple Developer Program License Agreement applies. |
| Free tier | Xcode Cloud: 25 compute hours/month included with membership. |
| Gotchas | **EU DSA trader status** must be provided in App Store Connect, or the app is removed from EU storefronts (enforced since 2025-02-17). **New EU terms effective 2026-10-01**: IAP 26 % standard / 15 % Small Business Program; alternative in-app payments 20 % / 10 %; link-out 15 % / 10 % on sales within 7 days of the tap; 5 % Core Technology Commission outside the App Store. The Small Business Program must be applied for. Web Sign in with Apple secret expires every 6 months; MusicKit developer tokens are ES256 JWTs (max 6 months). If the app offers Google sign-in, App Review expects an equivalent privacy-focused login (Sign in with Apple). |
| Pricing | https://developer.apple.com/app-store/small-business-program/ · https://developer.apple.com/support/dma-and-apps-in-the-eu/ · https://developer.apple.com/xcode-cloud/ |

## Google Cloud — Sign in with Google (OAuth) + YouTube Data API v3

| | |
| --- | --- |
| Signup | https://console.cloud.google.com/ → create a project (organisation account recommended) |
| Keys / console | OAuth clients (web for Supabase, iOS client for native): Google Auth Platform → Clients — https://console.cloud.google.com/auth/clients; consent-screen branding: https://console.cloud.google.com/auth/branding. YouTube: enable https://console.cloud.google.com/apis/library/youtube.googleapis.com → APIs & Services → Credentials https://console.cloud.google.com/apis/credentials → API key (restrict to YouTube Data API v3). Quotas: https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas. Extension request (audit): https://support.google.com/youtube/contact/yt_api_form |
| EU region | n/a (global APIs). |
| DPA / AVV | Google sign-in: Google's terms; YouTube: YouTube API Services Terms https://developers.google.com/youtube/terms/api-services-terms-of-service and Developer Policies https://developers.google.com/youtube/terms/developer-policies |
| Free tier | YouTube: 10,000 units/day for most methods (list calls = 1 unit) plus separate buckets of 100 `search.list` and 100 `videos.insert` calls/day; free. |
| Gotchas | At 10k creators, 6-hourly API polling ≈ 24 k units/day → apply for an extension (requires an API compliance audit, use-case bound) **or read channel RSS feeds (no quota)**. Developer Policies: stored API data must be refreshed or deleted after 30 days; statistics may not be kept > 30 days. Brand verification is needed for app name/logo on the Google consent screen. |
| Pricing | https://developers.google.com/youtube/v3/determine_quota_cost |

## Spotify for Developers — Web API

| | |
| --- | --- |
| Signup | https://developer.spotify.com/dashboard (log in with a Spotify account — **the app owner needs Spotify Premium**) |
| Keys / console | Dashboard → Create app → Settings → Client ID / View client secret |
| EU region | n/a |
| DPA / AVV | n/a — Spotify Developer Terms https://developer.spotify.com/terms |
| Free tier | Development mode: up to **5** allow-listed users, quota shared across the account's apps (numbers not published, 429 `QUOTA_EXCEEDED`), up to 25 Client IDs per account. |
| Gotchas | Since 2026-02-11 (new apps) / 2026-03-09 (existing apps): Premium-only owners, 5 users, and in dev mode removed endpoints incl. artist top tracks, browse / new releases, batch `GET /tracks`, `/albums`, `/artists`, user playlists; search `limit` max 10. **Extended quota only for registered organisations with ≥ 250 k MAU.** Plan the integration around the keyless oEmbed endpoint `https://open.spotify.com/oembed` (verified working) + iframe embeds + Odesli. |
| Docs | https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide · https://developer.spotify.com/documentation/web-api/concepts/quota-modes |

## Twitch — Helix API (live status, latest VODs)

| | |
| --- | --- |
| Signup | https://dev.twitch.tv/console (Twitch account with verified email **and 2FA enabled**) |
| Keys / console | Console → Applications → Register Your Application → Manage → Client ID + **New Secret** (a new secret invalidates the old one); app access token via client-credentials flow. |
| EU region | n/a |
| DPA / AVV | n/a — Developer Agreement https://legal.twitch.com/legal/developer-agreement/ |
| Free tier | Free; token-bucket rate limit per app (example header `Ratelimit-Limit: 800` per minute ⚠). |
| Gotchas | Use EventSub webhooks for `stream.online/offline` instead of polling. |
| Docs | https://dev.twitch.tv/docs/authentication/register-app/ |

## Odesli / song.link — cross-platform music links

| | |
| --- | --- |
| Signup | E-mail `developers@song.link` to request an API key |
| Keys / console | Key passed as the `key` query parameter |
| EU region | n/a |
| DPA / AVV | n/a |
| Free tier | Free with key; limits not published. |
| Gotchas | **Keyless access is gone** — verified 2026-11-17: `api.song.link/v1-alpha.1/links` returns 401 `PUBLIC_API_ACCESS_DEPRECATED` without a key. **Odesli belongs to Linktree (acquired 2021), a direct competitor** → cache results, keep a fallback (per-platform links / Apple + Spotify search), don't make it a hard dependency. API is still `v1-alpha.1`. |
| Docs | https://linktree.notion.site/API-d0ebe08a5e304a55928405eb682f6741 |

## TikTok — embeds

| | |
| --- | --- |
| Signup | None for oEmbed; developer portal https://developers.tiktok.com/ only for Display API / Login Kit |
| Keys / console | None: `GET https://www.tiktok.com/oembed?url=<video URL>` (verified working without auth); returns an Embed Player iframe |
| EU region | n/a |
| DPA / AVV | n/a (TikTok developer terms) |
| Free tier | Free |
| Gotchas | TikTok marks "Embed Videos" as "will be deprecated soon" → build on the Embed Player (`https://www.tiktok.com/player/v1/<id>`). Pulling a creator's own videos needs a Display API app + review + user OAuth. Third-party iframes set cookies → load only after consent (click-to-load). |
| Docs | https://developers.tiktok.com/doc/embed-videos/ |

## Meta — Instagram / Facebook / Threads oEmbed

| | |
| --- | --- |
| Signup | None for tokenless oEmbed; token route: https://developers.facebook.com/apps |
| Keys / console | **Tokenless since 2026-06-15**: `GET https://graph.facebook.com/<version>/instagram_oembed?url=<post URL>` (verified: no auth error). Token route (higher limits): app → add *Meta oEmbed Read* → App Review + business verification → app access token. |
| EU region | n/a |
| DPA / AVV | n/a — Meta Platform Terms https://developers.facebook.com/terms/ |
| Free tier | Free; token route up to 1,000 requests/hour; tokenless limits "may differ". |
| Gotchas | Public, non-age-restricted posts only; use only for front-end embedding. Pulling a creator's latest posts is a different product (Instagram API with Instagram Login) that needs App Review. Embeds load Meta scripts/cookies → consent-gated click-to-load. |
| Docs | https://developers.facebook.com/blog/post/2026/06/15/tokenless-access-to-meta-oembed-apis/ · https://developers.facebook.com/docs/instagram-platform/oembed |

## Sentry — error monitoring (EU)

| | |
| --- | --- |
| Signup | https://sentry.io/signup/ → choose **Data Storage Location: EU (Frankfurt)** when creating the organisation |
| Keys / console | DSN: Project → Settings → Client Keys (DSN). Source-map upload token: Settings → Developer Settings → Organization Tokens (`SENTRY_AUTH_TOKEN`). |
| EU region | Event data (errors, spans, replays, logs) in Frankfurt; user accounts, org settings, audit logs, DSN keys and usage data are always stored in the US. |
| DPA / AVV | https://sentry.io/legal/dpa/ |
| Free tier | Developer: 1 user, 5 k errors, 5 M spans, 50 replays, 30-day retention. |
| Gotchas | **Storage location can't be changed later** (new org, no data migration). Replays and spans bill separately — set sampling and spike protection. Scrub PII (IP, emails) in SDK `beforeSend`. |
| Pricing | https://sentry.io/pricing/ · https://docs.sentry.io/pricing/ |

## PostHog EU Cloud — product analytics (dashboard only)

| | |
| --- | --- |
| Signup | https://eu.posthog.com/signup (EU Cloud, Frankfurt) |
| Keys / console | Project API key (`phc_…`, public): Settings → Project → General; personal API keys: https://eu.posthog.com/settings/user-api-keys. Ingestion host `https://eu.i.posthog.com`. |
| EU region | Frankfurt |
| DPA / AVV | https://posthog.com/dpa |
| Free tier | 1 M events, 5 k session recordings, 1 M feature-flag requests per month; 1-year data retention. |
| Gotchas | Events with person profiles cost ~5× anonymous events — set `person_profiles` deliberately. Keep it off the public creator pages (cookie-free promise); use consent in the dashboard. EU and US are separate instances — pick EU at signup. |
| Pricing | https://posthog.com/docs/product-analytics/pricing |

## GitHub — repos + Actions

| | |
| --- | --- |
| Signup | https://github.com/signup → create an organisation |
| Keys / console | Repo → Settings → Secrets and variables → Actions; fine-grained PATs: https://github.com/settings/personal-access-tokens; spending: Organisation → Settings → Billing & licensing → Budgets and alerts. |
| EU region | US; EU data residency only with GitHub Enterprise Cloud (data residency). |
| DPA / AVV | GitHub Data Protection Agreement via https://github.com/customer-terms |
| Free tier | Free org: $12/month included Actions compute (≈ 2,000 Linux minutes), 500 MB artifacts; standard runners free for public repos. |
| Gotchas | Per-SKU minute pricing since Jan 2026: Linux $0.006, macOS $0.062/min (~10×) → build iOS on Xcode Cloud. Required reviewers / rulesets on private repos need Team ($4/user/month). The announced $0.002/min self-hosted-runner fee was postponed ⚠ (status from third-party reports). |
| Pricing | https://docs.github.com/en/billing/reference/actions-runner-pricing |

## fastlane — iOS automation (optional)

| | |
| --- | --- |
| Signup | None (open source; `bundle add fastlane`) |
| Keys / console | Uses the App Store Connect API key (.p8) from the Apple section; `match` needs a private git repo or bucket for certificates. |
| EU region / DPA | n/a |
| Free tier | Free |
| Gotchas | Prefer the ASC API key over Apple-ID login + 2FA in CI. |
| Docs | https://docs.fastlane.tools/ |

## Lighthouse CI

| | |
| --- | --- |
| Signup | None |
| Keys / console | Optional GitHub App token (`LHCI_GITHUB_APP_TOKEN`) for status checks |
| EU region / DPA | n/a — temporary public storage is run by Eris Ventures LLC (not Google) |
| Free tier | `temporary-public-storage` is free |
| Gotchas | Reports are **public to anyone with the URL** and retained 3 days–5 weeks; never audit pages containing personal data; self-host the LHCI server if history is needed. |
| Docs | https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/services-disclaimer.md |

## Domain `linkyo.app` + DNS

| | |
| --- | --- |
| Options | **Vercel Domains** https://vercel.com/domains — $0 in year 1 with a paid Pro team (list $9.99), renewal $15/year; or **Cloudflare Registrar** (dashboard → Domain Registration) — at cost ≈ $8.20 / ≈ $14.20 renewal ⚠ |
| Keys / console | Vercel team token + Domains API; Cloudflare API token with `Zone:DNS:Edit` |
| EU region | n/a (`.app` registry: Google Registry) |
| DPA / AVV | covered by the Vercel / Cloudflare DPA |
| Gotchas | `.app` is **HSTS-preloaded** — HTTPS only, including staging and preview hostnames. Pick the DNS host before launch: wildcard certs on Vercel need Vercel NS or `_acme-challenge` delegation; R2 custom domains need a Cloudflare zone; Cloudflare Registrar forces Cloudflare NS. Register on the company, not a person. |
| Docs | https://vercel.com/docs/domains/free-domain-with-pro · https://developers.cloudflare.com/registrar/faq/ · https://www.registry.google/domains/app/ |

## Tinybird / ClickHouse Cloud — optional columnar analytics

| | |
| --- | --- |
| Signup | Tinybird https://www.tinybird.co/signup · ClickHouse Cloud https://console.clickhouse.cloud/signUp |
| Keys / console | Tinybird: Workspace → Tokens (create a scoped append token for ingestion and read tokens per endpoint). ClickHouse Cloud: Organization → API Keys; service credentials shown at service creation. |
| EU region | Tinybird: Frankfurt on GCP `europe-west3` (`api.tinybird.co`) or AWS `eu-central-1`; ClickHouse Cloud: AWS `eu-central-1` (and other EU regions). |
| DPA / AVV | https://www.tinybird.co/dpa · https://clickhouse.com/legal/agreements/data-processing-addendum |
| Free tier | Tinybird: 10 GB storage, 1 k API requests/day, 0.25 vCPU. ClickHouse Cloud: trial credit only, then usage-based (scale-to-zero). |
| Gotchas | Workspace/service region is fixed at creation. ClickHouse internet egress $0.115/GB; continuous trickle inserts keep the service awake (batch them). Tinybird pricing page shows both $25 and $49 as Developer entry prices ⚠. |
| Pricing | https://www.tinybird.co/pricing · https://clickhouse.com/pricing |

## UptimeRobot (or Better Stack) — uptime monitoring + status page

| | |
| --- | --- |
| Signup | UptimeRobot https://uptimerobot.com/signUp · Better Stack https://betterstack.com |
| Keys / console | UptimeRobot: dashboard → Integrations & API → API keys |
| EU region | Probes run from multiple locations; little personal data involved. |
| DPA / AVV | https://uptimerobot.com/dpa/ · https://betterstack.com/dpa |
| Free tier | UptimeRobot Free: 50 monitors, 5-min interval, 1 status page, commercial use allowed. Better Stack free: 10 monitors + 1 status page, labelled "for personal projects". |
| Gotchas | Custom-domain status page needs UptimeRobot Solo ($12–13/month) or Better Stack paid ($12+/month per extra status page). Host the status page on a domain/provider independent of Vercel. |
| Pricing | https://uptimerobot.com/pricing/ · https://betterstack.com/pricing |

## Trademark "Linkyo" — DPMA (DE) and EUIPO (EU)

| | |
| --- | --- |
| Filing | DPMA online filing: https://www.dpma.de/marken/anmeldung/index.html · EUIPO (User Area account): https://www.euipo.europa.eu/en/trade-marks/apply-for-a-trade-mark |
| Clearance search | DPMAregister https://register.dpma.de/DPMAregister/marke/einsteiger · TMview (EU-wide) https://www.tmdn.org/tmview/ |
| Fees | DPMA: €290 online incl. up to 3 classes, +€100 per further class, accelerated examination +€200, renewal €750 after 10 years. EUIPO: €850 + €50 (2nd class) + €150 per further class ⚠ (fee page blocked; from Regulation (EU) 2017/1001 Annex I). |
| Gotchas | DPMA fee must be paid within 3 months or the application counts as withdrawn. An EU mark already covers Germany. "link…" marks are crowded in classes 9/35/42 → search before filing; consider a lawyer for the class/specification wording. |
| Sources | https://www.dpma.de/service/gebuehren/marken/index.html · https://eur-lex.europa.eu/eli/reg/2017/1001/oj |
