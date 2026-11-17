# Linkyo — estimated monthly running costs

> **Status: estimate.** Researched 2026-11-17 against the providers' official pricing pages (linked in every row).
> Prices exclude VAT. Each line is in the currency the provider bills in (**$** = USD, **€** = EUR); totals are
> converted at **1 € = 1.16 $** (FX assumption — adjust). **(usage)** marks usage-based lines; everything else is a
> fixed plan, seat, tier or add-on fee. ⚠ = could not be fully verified, see [§6](#6-unverified-or-conflicting-data-).
> Account/signup/key/DPA details per service: see the separate accounts & links sheet.

## 1. Assumptions

### Usage model (from the brief — no input changed)

| Input                                                                  | 0 users (pre-launch/staging) | 1,000 creators                       | 10,000 creators                    |
| ---------------------------------------------------------------------- | ---------------------------- | ------------------------------------ | ---------------------------------- |
| Registered creators (= Auth MAU)                                       | 0                            | 1,000                                | 10,000                             |
| Public page views (avg 2,000 per creator/month, heavy-tailed)          | 0                            | 2 M                                  | 20 M                               |
| Transfer per view 120 KB, split (my assumption): 50 KB HTML/CSS/JS/font from Vercel + 70 KB images from the media CDN | 0 | 100 GB + 140 GB          | 1 TB + 1.4 TB                      |
| Stored images (60 MB per creator)                                      | 0                            | 60 GB                                | 600 GB                             |
| Video: 8 % of creators × 10 min stored; every stored minute played 50×/month | 0                      | 80 creators, 800 min stored, 40 k min delivered | 800 creators, 8,000 min stored, 400 k min delivered |
| Transactional email (6 per creator/month)                              | 0                            | 6 k                                  | 60 k                               |
| Feed connections (1.5 per creator, refreshed every 6 h)                | 0                            | 1.5 k → 180 k fetches/month          | 15 k → 1.8 M fetches/month         |
| Dashboard product-analytics events (400 per creator/month)             | 0                            | 400 k                                | 4 M                                |
| Pro: 5 % conversion × €8/month (gross, incl. 19 % VAT)                 | —                            | 50 subscribers = €400 MRR            | 500 subscribers = €4,000 MRR       |

No source contradicted the brief's inputs. Two inputs dominate the result and deserve a sanity check once real data
exists: **CDN requests per public view** (not in the brief; I assume 6.5) and **"50 plays per stored video minute"**
(realistic only with autoplay — click-to-play would cut the video line several-fold).

### Modelling assumptions (mine)

- **Architecture priced in the totals:** Next.js on Vercel Pro (Fluid functions + ISR cache in `fra1`), Supabase Pro in
  `eu-central-1` (prod + staging project), images in Supabase Storage with **variants pre-generated at upload** and served
  by the Supabase Smart CDN (90 % cache hit), video on Mux, email via Scaleway Transactional Email (Paris).
- **Vercel:** 1 deploying seat; a new Pro team, so Flat Rate CDN is on by default. 6.5 CDN requests per public view
  (document, CSS, 2 JS chunks, font, view beacon + 0.5 click beacon) → 13 M / 130 M requests per month. Beacons hit a
  `fra1` function: 1.5 invocations per view, 5 ms CPU, 1 GB, ~40 ms alive. Dashboard: 600 function requests per creator
  per month (30 ms CPU). ~1 ISR regeneration per creator per day (on-demand revalidation only when content changed, 5 write
  units each); 15 % of views miss the regional CDN cache and read the ISR cache (5 read units). ~200 builds/month × 3 min ×
  4 vCPU.
- **Supabase:** prod compute Micro (pre-launch) → Small (1k) → Medium (10k); staging always Micro. Raw analytics events in a
  day-partitioned Postgres table with 30-day retention plus daily rollups via `pg_cron` (≈18 GB disk provisioned at 10k).
  Uncached egress (API, Auth, Edge Functions, image cache misses) stays below the 250 GB quota.
- **Monitoring:** ~20 k errors/month at 1k, ~100 k at 10k (Sentry). PostHog events sent **without person profiles**.
- **Payments:** EEA standard consumer cards, all Pro subscriptions bought on the web via Stripe. Apple's commission is
  computed on the VAT-net price (€8 / 1.19 = €6.72).

## 2. Monthly cost table

| Service | Plan | 0 users | 1k | 10k | Notes / source |
| --- | --- | ---: | ---: | ---: | --- |
| **Vercel** — platform fee | Pro, 1 deploying seat | $20 | $20 | $20 | Fee includes a $20/month usage credit; +$20 per extra deploying seat. Hobby is "personal or non-commercial use" only, so Pro is required. [Pro plan](https://vercel.com/docs/plans/pro-plan) · [Terms §4](https://vercel.com/legal/terms) |
| **Vercel** — CDN requests + Fast Data Transfer **(usage / tier)** | Flat Rate CDN (default) or on-demand | $0 | $48.80 | $300.00 | Included tier: 1 M requests + 1 TB. 1k: 13 M requests exceed the $20 tier (10 M) → opt out to on-demand: 13 M × $2.60/M + 100 GB × $0.15 (`fra1`) = $48.80 (cheaper than the $100 tier). 10k: 130 M requests → $300 tier (150 M requests / 50 TB); on-demand would be ≈ $488. ⚠ allowance conflict, see §6. [Flat Rate CDN](https://vercel.com/docs/pricing/flat-rate-cdn) · [fra1 rates](https://vercel.com/docs/pricing/regional-pricing/fra1) |
| **Vercel** — Fluid functions, ISR, Fast Origin Transfer **(usage)** | `fra1` | ≈ $0 | $8.75 | $87.53 | Beacons 3 M / 30 M invocations ($0.60/M, Active CPU $0.184/h, memory $0.0152/GB-h) ≈ $3 / $31; dashboard ≈ $2 / $20; ISR writes $5.20/M + reads $0.52/M (8 KB units) ≈ $1.56 / $15.60; Fast Origin Transfer 30 / 300 GB × $0.06. Pro has no per-function allowance. [Functions](https://vercel.com/docs/functions/usage-and-pricing) · [ISR](https://vercel.com/docs/incremental-static-regeneration/limits-and-pricing) |
| **Vercel** — builds **(usage)** | Elastic build machines | ≈ $10 | ≈ $10 | ≈ $10 | $0.0035 per CPU-minute: 200 builds × 3 min × 4 vCPU ≈ $8.40. [Builds](https://vercel.com/docs/builds/managing-builds) |
| **Vercel** — monthly usage credit | — | −$10 | −$20 | −$20 | The $20 credit offsets on-demand usage and expires at month end. |
| **Vercel** — Image Optimization | not used | $0 | $0 | $0 | Images bypass Vercel (variants pre-generated). Cost if enabled: §3. [Image pricing](https://vercel.com/docs/image-optimization/limits-and-pricing) |
| **Supabase** — organisation plan | Pro | $25 | $25 | $25 | Includes 100 k MAU, 8 GB disk per project, 100 GB Storage, 250 GB uncached + 250 GB cached egress, 2 M Edge Function invocations, 500 Realtime peak connections / 5 M messages, 7-day daily backups; never pauses. [Pricing](https://supabase.com/pricing) |
| **Supabase** — compute, net of $10 credit | prod Micro → Small → Medium, staging Micro | $10 | $15 | $60 | Micro $10, Small $15, Medium $60, Large $110 per month (billed hourly); the credit covers one Micro only. Use Large (+$50) if raw analytics inserts are not batched. [Compute](https://supabase.com/docs/guides/platform/manage-your-usage/compute) |
| **Supabase** — custom domain | add-on | $0 | $10 | $10 | e.g. `api.linkyo.app`, so Google/Apple sign-in shows your domain instead of `*.supabase.co`. [Custom domain](https://supabase.com/docs/guides/platform/manage-your-usage/custom-domains) |
| **Supabase** — point-in-time recovery | 7-day add-on (optional) | $0 | $0 | $100 | $100 / $200 / $400 for 7 / 14 / 28 days; replaces daily backups; Storage objects are never in DB backups. [PITR](https://supabase.com/docs/guides/platform/manage-your-usage/point-in-time-recovery) · [Backups](https://supabase.com/docs/guides/platform/backups) |
| **Supabase** — usage over quota **(usage)** | Pro overages | $0 | $0 | $42.20 | 10k: Storage 500 GB over × $0.0213 = $10.65; cached egress (images) 1,260 GB − 250 = 1,010 GB × $0.03 = $30.30; disk 10 GB over × $0.125 = $1.25. At 1k every quota holds. [Egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress) |
| **Supabase** — Auth: magic link, Google, Apple, passkeys | included | $0 | $0 | $0 | $0.00325 per MAU above 100 k. **Passkeys are a beta (2026-05-28), explicit opt-in, API may change.** Built-in SMTP is test-only (2 mails/hour, team addresses only), so custom SMTP is mandatory. [MAU](https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users) · [Passkeys beta](https://supabase.com/changelog/46458-passkeys-for-supabase-auth-beta) · [SMTP](https://supabase.com/docs/guides/auth/auth-smtp) |
| **Supabase** — Storage image transformations | not used | $0 | $0 | $0 | $5 per 1,000 distinct origin images (100 included); on-the-fly transforms would add ≈ $105 / $1,050 (§3). [Transformations](https://supabase.com/docs/guides/platform/manage-your-usage/storage-image-transformations) |
| **Supabase** — Edge Functions, `pg_cron`, Queues, Realtime | included | $0 | $0 | $0 | 180 k / 1.8 M feed fetches per month; batching ~50 connections per invocation stays far below 2 M invocations ($2/M above). `pg_cron` / Queues run inside Postgres (compute line). [Edge Functions](https://supabase.com/docs/guides/functions/pricing) |
| **Analytics storage** — Postgres raw events + daily rollups | inside Supabase | $0 | $0 | $0 | ≈ 3 M / 30 M raw events per month in 30-day partitions; the cost sits in the compute and disk lines. Columnar alternatives: §3. |
| **Video** — Mux **(usage)** | pay-as-you-go | $0 | $0 | $304.00 | Basic-quality encoding free; storage $0.003/min/month (1080p); delivery $0.001/min after 100 k free minutes/month; PAYG includes a $20 monthly usage credit. 1k ≈ $2.40 → covered. 10k: $24 + 300 k × $0.001 − $20. No EU storage option published. [Mux video pricing](https://www.mux.com/docs/pricing/video) · [Plans](https://www.mux.com/pricing) |
| **Email** — Scaleway Transactional Email **(usage)** | Essential, `fr-par` | €0 | €1.43 | €14.93 | 300 free emails/month, then €0.25 per 1,000 (€0.00025/email); Scale plan €80/month incl. 100 k (+€0.20/1,000) with dedicated IP. EU provider (Paris). ⚠ [Pricing](https://www.scaleway.com/en/pricing/managed-services/) · [Plans](https://www.scaleway.com/en/docs/transactional-email/how-to/manage-tem-plans/) |
| **Sentry** (EU data region) | Developer → Team | $0 | $29 | $29 | Developer: 1 user, 5 k errors. Team: $29/month billed monthly ($26 annual), 50 k errors, 5 M spans. [Pricing](https://sentry.io/pricing/) |
| **Sentry** — extra errors **(usage)** | Team pay-as-you-go | $0 | $0 | $18.13 | 100 k errors: 50 k × $0.0003625. [Pricing docs](https://docs.sentry.io/pricing/) |
| **PostHog EU Cloud** **(usage)** | free → pay-as-you-go | $0 | $0 | $118.60 | 1 M events/month free; $0.00005 (1–2 M), $0.0000343 (2–15 M). Identified events (person profiles) would add $337.40 at 10k. [Pricing](https://posthog.com/docs/product-analytics/pricing) |
| **Uptime + status page** — UptimeRobot | Free → Solo | $0 | $0 | $13 | Free: 50 monitors, 5-min checks, 1 status page, commercial use allowed. Solo ($13 monthly / $12 annual) adds custom-domain status pages. [Pricing](https://uptimerobot.com/pricing/) |
| **GitHub** (private repos, Actions) | Free organisation | $0 | $0 | $0 | Actions are billed per runner-minute out of an included $12/month (Free) / $18 (Team): Linux $0.006/min (≈ 2,000 min), macOS $0.062/min (~10×). Team ($4/user/month) is needed for branch rules on private repos. [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) · [Runner prices](https://docs.github.com/en/billing/reference/actions-runner-pricing) |
| **Xcode Cloud** | included with Apple Developer Program | $0 | $0 | $0 | 25 compute hours/month included; 100 h = $49.99/month. [Xcode Cloud](https://developer.apple.com/xcode-cloud/) |
| **fastlane** | open source | $0 | $0 | $0 | [Docs](https://docs.fastlane.tools/) |
| **Lighthouse CI** | temporary public storage | $0 | $0 | $0 | Reports are public and kept 3 days–5 weeks (operated by Eris Ventures LLC, not Google); runs on Actions minutes. [Disclaimer](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/services-disclaimer.md) |
| **Domain `linkyo.app` + DNS** | annual | — | — | — | See §4. DNS hosting is free on Vercel or Cloudflare. |
| **Platform APIs**: YouTube Data API, Spotify Web API, Twitch, Odesli, Apple MusicKit, TikTok + Meta oEmbed | free | $0 | $0 | $0 | Cost is access and quota, not money (details in the accounts sheet). YouTube's default 10 k units/day is exceeded at ≈ 4,200 creators with API polling every 6 h → use channel RSS feeds or apply for an extension. [YouTube quota](https://developers.google.com/youtube/v3/determine_quota_cost) |
| **Stripe** — Payments + Billing **(usage)** | standard pricing, Billing pay-as-you-go | €0 | €21.30 | €213.00 | Per €8 charge: 1.5 % + €0.25 (EEA standard card) + 0.7 % Billing = **€0.43 ≈ 5.3 %**. Premium EEA cards 2.8 %, UK 2.5 %, international 3.15 % (+2 % currency conversion). Disputes €20. [Stripe DE pricing](https://stripe.com/de/pricing) |
| **Stripe Connect** (creators selling products) | "Stripe handles pricing" | €0 | €0 | €0 | Connected accounts pay Stripe directly. "You handle pricing" costs €2 per monthly active account + 0.25 % + €0.10 per payout (§3). [Connect pricing](https://stripe.com/de/connect/pricing) |
| **Apple StoreKit commission** | only if Pro is sold in-app | — | — | — | Small Business Program **15 %**; standard **30 %**, **26 % in EU storefronts since 2026-10-01**; auto-renew subscriptions 15 % after year one. Per €8 subscription (VAT-net €6.72): €1.01 at 15 % (= 12.6 % of gross). Scenario: §3. [SBP](https://developer.apple.com/app-store/small-business-program/) · [EU terms](https://developer.apple.com/support/dma-and-apps-in-the-eu/) |
| **Fixed subtotal** (plans, seats, CDN tier, add-ons) | | **$55** | **$99** | **$557** | Vercel $20 (+ $300 tier at 10k), Supabase plan + compute + domain + PITR, Sentry, UptimeRobot. |
| **Usage subtotal** (metered, net of credits; € converted) | | **$0** | **$49** | **$578** | |
| **Infrastructure total (fixed + usage)** | | **$55 ≈ €47** | **$148 ≈ €128** | **$1,135 ≈ €978** | ≈ $0.15 / $0.11 per creator at 1k / 10k. |
| Payment fees (Stripe, all Pro via web) | | €0 | €21 | €213 | 5.3 % of €400 / €4,000 MRR. |
| **Grand total incl. payment fees** | | **$55 ≈ €47** | **$173 ≈ €149** | **$1,382 ≈ €1,191** | vs. €400 / €4,000 MRR. |

Biggest lines at 10k: Vercel ≈ $398 (of which $300 Flat Rate CDN tier), Mux ≈ $304, Supabase ≈ $237 (incl. the optional
$100 PITR), PostHog ≈ $119.

## 3. Priced alternatives (not in the totals)

| Option | Replaces | 0 users | 1k | 10k | Notes / source |
| --- | --- | ---: | ---: | ---: | --- |
| Cloudflare Stream | Mux | $5 | $45 | $440 | $5 per 1,000 min stored (prepaid blocks) + $1 per 1,000 min delivered; ingest and encoding free. Stream storage cannot be pinned to the EU (Data Localization Suite: Regional Services not supported for Stream). [Stream pricing](https://developers.cloudflare.com/stream/pricing/) · [DLS compatibility](https://developers.cloudflare.com/data-localization/compatibility/) |
| Bunny Stream (EU company, Slovenia) ⚠ | Mux | ≈ $1 | ≈ $5–10 | ≈ $50–95 | Bandwidth-priced: storage from $0.01/GB, delivery from $0.005/GB, no transcoding fee, $1/month minimum. Assumes ~22 MB per delivered 720p minute. [Bunny Stream pricing](https://bunny.net/pricing/stream/) |
| Cloudflare R2 in the EU jurisdiction | Supabase Storage for images | $0 | ≈ $0.75 | ≈ $8.85 | $0.015/GB-month (10 GB free), Class A $4.50/M (1 M free), Class B $0.36/M (10 M free), **egress $0** → removes ≈ $41/month of Supabase storage + cached egress at 10k. A custom media hostname needs the domain as a Cloudflare zone. [R2 pricing](https://developers.cloudflare.com/r2/pricing/) · [Jurisdictions](https://developers.cloudflare.com/r2/reference/data-location/) |
| Supabase on-the-fly image transformations | pre-generated variants | $0 | ≈ $105 | ≈ $1,050 | ~21 distinct origin images transformed per creator per month × $5/1,000 (billed in packages of 1,000). |
| Vercel Image Optimization + images through the Vercel CDN | Supabase Storage CDN | $0 | ≈ +$60 | ≈ +$700 | +5 requests and +70 KB per view (10k → 230 M requests, above the 150 M tier → on-demand ≈ $958) + transformations $0.0601/1k and cache writes $5.20/M (`fra1`). |
| AWS SES `eu-central-1` | Scaleway TEM | $0 | $0.60 | $6.00 | $0.10 per 1,000 (à la carte); new accounts start in the sandbox; the free tier for new accounts is now credit-based. [SES pricing](https://aws.amazon.com/ses/pricing/) |
| Resend | Scaleway TEM | $0 | $20 | $29 | Free 3,000/month (100/day); Pro $20 = 50 k, +$0.90/1,000. EU sending region (Ireland), but account data and logs are stored in the US. [Pricing](https://resend.com/pricing) · [Regions](https://resend.com/docs/dashboard/domains/regions) |
| Postmark | Scaleway TEM | $0 | $15 | $81.50 | Basic $15 / 10 k; Pro $16.50 / 10 k + $1.30 per 1,000. No EU data residency offered. [Pricing](https://postmarkapp.com/pricing) |
| Tinybird (Frankfurt: GCP `europe-west3` or AWS `eu-central-1`) ⚠ | Postgres rollups | $0 | $0 | ≈ $49–100 | Free: 10 GB, 1 k API requests/day. Developer "starting at $25/month" (the page also shows $49 for 0.5 vCPU / 25 GB) + vCPU overage $0.0002/s, storage $0.058/GB. [Pricing](https://www.tinybird.co/pricing) · [Regions](https://www.tinybird.co/docs/api-reference) |
| ClickHouse Cloud Basic (AWS `eu-central-1`) | Postgres rollups | $0 | ≈ $20–60 | ≈ $100–190 | $0.2625 per compute-unit-hour (2 vCPU / 8 GiB; 24/7 ≈ $192), storage $26.95/TB-month, internet egress $0.115/GB; scales to zero when idle (batch the inserts). [Pricing](https://clickhouse.com/pricing) |
| PostHog with person profiles | anonymous events | $0 | $0 | +$337.40 | Identified-events add-on $0.000198 (1–2 M), $0.0000697 (2–15 M) per event, from PostHog's public billing catalogue (`billing.posthog.com/api/products-v2`). |
| Apple IAP for **all** Pro subscriptions (Small Business Program) | Stripe web checkout | €0 | €50.42 | €504.20 | €1.01 per subscriber-month. EU standard rate 26 % → €87 / €874; non-EU standard 30 % → €101 / €1,008. EU link-out to web checkout: 10 % store-services commission for SBP members on sales within 7 days of the tap. |
| Stripe Tax (optional) | — | €0 | €2 | €20 | 0.5 % per transaction (no-code integration). |
| Stripe Connect "you handle pricing" | "Stripe handles pricing" | €0 | ≈ €63 | ≈ €630 | Example: 2 % of creators sell, €300 GMV each, 4 payouts/month: €2 per active account + 0.25 % + €0.10 per payout. |
| GitHub-hosted macOS builds | Xcode Cloud | $0 | ≈ $37 | ≈ $37 | e.g. 600 macOS minutes × $0.062. |

## 4. One-time and annual costs (not in the monthly totals)

| Item | Cost | Notes / source |
| --- | --- | --- |
| Apple Developer Program | $99 per year (local-currency price at checkout; €99 in Germany ⚠) | Company enrolment needs a free D-U-N-S number (up to 5 business days at D&B + up to 2 for Apple). [Program](https://developer.apple.com/programs/) · [D-U-N-S](https://developer.apple.com/help/account/membership/D-U-N-S) |
| Domain `linkyo.app` via Vercel | $0 in year 1 with a paid Pro team (list $9.99), then $15/year | `.app` is on the "free domain with Pro" list (not during a trial). Prices from Vercel's public registrar API (`/v1/registrar/tlds/app/price`). [Free domain with Pro](https://vercel.com/docs/domains/free-domain-with-pro) |
| … or via Cloudflare Registrar | ≈ $8.20 first year, ≈ $14.20/year renewal ⚠ | At cost, no markup; the figure comes from a third-party tracker of Cloudflare's price list. Requires Cloudflare nameservers. [Registrar FAQ](https://developers.cloudflare.com/registrar/faq/) · [Tracker](https://cfdomainpricing.com/) |
| DNS | $0 | Vercel DNS or Cloudflare Free. `.app` is HSTS-preloaded: HTTPS only, everywhere. [.app registry](https://www.registry.google/domains/app/) |
| Trademark Germany (DPMA) | €290 online filing incl. up to 3 classes; +€100 per further class; renewal €750 after 10 years | e.g. classes 9, 35, 42; accelerated examination +€200. [DPMA fees](https://www.dpma.de/service/gebuehren/marken/index.html) |
| Trademark EU (EUIPO) | €850 (1st class) + €50 (2nd) + €150 per further class → €1,050 for 3 classes | Covers Germany too, so DPMA + EUIPO is only needed for an earlier/cheaper national right. ⚠ EUIPO's fee page blocked automated access; fees from Annex I of [Regulation (EU) 2017/1001](https://eur-lex.europa.eu/eli/reg/2017/1001/oj). [Apply](https://www.euipo.europa.eu/en/trade-marks/apply-for-a-trade-mark) |
| Lawyer / clearance search | not included | Optional but advisable before filing. |
| Amortised | ≈ $9.50/month | Apple Developer Program + domain renewal. |

## 5. Cost levers

**What gets expensive first** (with the assumptions above):

| Threshold | Reached at ≈ | Consequence |
| --- | --- | --- |
| Vercel included CDN tier (1 M requests) | 80 creators | $20 tier up to ≈ 770 creators, $100 tier up to ≈ 3,850, $300 tier up to ≈ 11,500 (at 6.5 requests/view); beyond that on-demand or Enterprise. |
| Supabase Storage 100 GB | 1,700 creators | $0.0213/GB-month |
| Supabase cached egress 250 GB | 2,000 creators | $0.03/GB |
| Mux free delivery (100 k min/month) | 2,500 creators | $0.001/min at 1080p |
| PostHog free events (1 M/month) | 2,500 creators | $0.00005/event, falling with volume |
| YouTube default quota (10 k units/day) | 4,200 creators | compliance audit for an extension, or switch to RSS |
| Sentry Developer (1 user, 5 k errors) | launch | Team $29/month |

**Levers:**

1. **Keep media off Vercel and never transform per request.** Generate WebP/AVIF variants (e.g. 3 widths) with `sharp` at
   upload (CPU cost ≈ $0.26/month at 1k on Vercel), store them in Supabase Storage or R2 and serve them through the CDN.
   This avoids ≈ $1,050/month of Supabase transformations or ≈ $700/month of Vercel image + CDN costs at 10k.
2. **Request budget for public pages.** Every extra asset per view is 20 M requests/month at 10k. Static HTML with inlined
   critical CSS, little or no hydration, and one combined beacon (view + clicks via `sendBeacon` on `pagehide`) gets to
   ≈ 2.5 requests/view, which fits 10k creators into the $100 Flat Rate tier (−$200/month); ≤ 5 requests/view keeps 1k on
   the $20 tier.
3. **R2 for media egress** once Supabase cached egress dominates (≈ −$32/month net at 10k, growing linearly with views):
   zero egress fees and an EU jurisdiction bucket.
4. **Video is the largest usage line at 10k.** Click-to-play instead of autoplay, a 720p cap ($0.0008/min tier), Mux's
   automatic cold-storage discount for unplayed assets, video as a Pro-only feature, or an EU bandwidth-priced provider
   (Bunny, ≈ −$200/month).
5. **Analytics: rollups, not raw scans.** Day-partitioned raw table (drop partitions after 30 days), daily `pg_cron`
   rollups per creator and link, dashboards read rollups only, inserts batched. Move raw events to Tinybird or ClickHouse
   only beyond ~100 M rows/month.
6. **ISR:** revalidate on demand only when data changed and keep the output deterministic (no `Date.now()` or random
   values) — an unchanged revalidation costs no write units.
7. **PostHog:** no person profiles, no autocapture on noisy elements, ~100 curated events per creator → stays inside the
   1 M free events up to 10k creators (−$119/month).
8. **Supabase:** right-size compute; buy PITR only when the business needs < 24 h RPO; keep staging on Micro (or a Free
   org, accepting the 7-day inactivity pause).
9. **Payments:** web checkout through Stripe (≈ 5.3 %) instead of Apple IAP (15 % of net ≈ 12.6 % of gross on the Small
   Business Program); where Apple's rules allow, steer purchases to the web (EU link-out: 10 % for SBP members).
10. **Feeds:** YouTube channel RSS (no quota), conditional requests (ETag / If-Modified-Since), refresh only connections
    whose source changed, batch many connections per Edge Function invocation.

## 6. Unverified or conflicting data (⚠)

- **Vercel CDN allowance conflict.** vercel.com/pricing still lists Pro with "10M CDN requests / 1 TB included", while the
  docs and the 2026-09-08 changelog say new Pro teams default to Flat Rate CDN with 1 M requests + 1 TB included. I used
  the docs (conservative). If the 10 M allowance applied to on-demand billing, the 1k CDN line would drop from $48.80 to
  ≈ $7.80.
- **Scaleway** pricing pages sit behind a JavaScript challenge; TEM prices come from Scaleway's own public product
  catalogue API (`api.scaleway.com/product-catalog/v2alpha1/public-catalog/products`), the 300 free emails from Scaleway's
  documentation.
- **EUIPO** fee page blocked; fees from Annex I of the EU Trade Mark Regulation via secondary sources.
- **Cloudflare `.app` price** from a third-party tracker; confirm in the Cloudflare dashboard.
- **Tinybird** Developer plan: $25 and $49 both appear on the pricing page.
- **Mux and Cloudflare Stream** publish no EU-only video storage (Mux offers an EU ingest location for Mux Data via sales).
- **Bunny Stream** "from" prices not verified per region.
- **Apple Developer Program** price in EUR not shown on the page I could fetch.
- **Spotify** development-mode quota numbers are not published.
- **FX rate** (1 € = 1.16 $) is an assumption; all numbers are estimates.
