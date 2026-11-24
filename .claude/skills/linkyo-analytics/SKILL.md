---
name: linkyo-analytics
description: Linkyo's cookie-free page statistics (views, visitors and taps on creator pages, the beacon island, /api/collect, the page_stats tables, the dashboard's Stats, Home week and editor chip, the console's views30). Use when touching features/analytics/**, app/api/collect, app/u/[username]/layout.tsx's island, features/app/{stats.ts,analytics-screen.tsx,home-screen.tsx,block-editor.tsx}, features/admin/live.ts's page stats, the page_stats migration, or when adding a metric or dimension, or when the privacy wording about counting changes.
---

# Linkyo analytics (cookie-free, first-party)

Decision record: `docs/DECISIONS/*cookie-free-analytics*` (supersedes ADR 0008's beacon note). Data layer:
the `linkyo-supabase` skill. Dashboard screens: `linkyo-creator-dashboard`. Console: `linkyo-team-console`.

## The rules (never bend them)

- **No cookie, no device storage, no fingerprint.** The island reads and writes nothing on the visitor's device:
  no `document.cookie`, `localStorage`, `sessionStorage`, IndexedDB, canvas, screen size, language or user agent
  in the browser. `features/analytics/beacon.test.ts` runs the script in a fake browser, reads its text and fails
  otherwise.
- **No IP address or browser string is stored.** The server hashes (page, address, user agent) with the day's
  salt and drops both; the database has no column for either (pgTAP checks the schema).
- **Daily salted hash.** HMAC-SHA-256 under a random 32-byte salt per Berlin day (`page_stats_salt()`, its own
  service-only table, never next to the counts). Salts and visitor hashes of finished days are deleted every hour
  (`page_stats_purge`, cron `linkyo-purge-page-stats`). A visitor counts once a day.
- **Same origin only.** The beacon posts to `/api/collect` on the page's own origin; the route refuses other
  origins (`Sec-Fetch-Site`, `Origin`). No third-party script, pixel or host, ever (CLAUDE.md privacy).
- **GPC and DNT** stop counting twice: the island sends nothing, and the route ignores `Sec-GPC: 1` / `DNT: 1`.
- **At most 2 KB gzip** for the island (under 1 KB today; the unit test and `e2e/analytics-real.spec.ts` measure
  it). It is inline script, not a client component: Turbopack bundles a layout's client components into one chunk,
  so a component would ship with the switch off. Keep it plain ES2015, no imports.
- **Off in production behind `LINKYO_ANALYTICS`** (`lib/flags.ts`, server only, exactly `on`). Off: no island on
  `/u` (zero bytes), `/api/collect` answers 204 and stores nothing, Stats keep "coming soon". Tests set it on
  (`playwright.config.ts`). It goes on only after the founder applied the migration (F0) and the lawyer approved
  the Datenschutz paragraph (F2, the ADR draft holds the proposal).
- **Never fake.** The demo's numbers are samples, labelled "Beispieldaten" (also the CSV's file name). A real
  account sees measured numbers only: days before counting began (`since`) are gaps and empty CSV cells, never 0;
  a change against the period before shows only when that period was counted from its first day; a failure is a
  failure ("Zahlen nicht geladen" with "Noch einmal versuchen"), never zeros.
- **Hosted database without the statistics:** a missing function or table (`missingStats`: `PGRST202`,
  `PGRST205`, `42883`, `42P01`) means "not counting", in the route, the dashboard and the console.

## Map

| What | Where |
|---|---|
| Island (views, taps) | `features/analytics/beacon-script.ts` (`beaconScript(page)`), written as `<script data-beacon>` by `app/u/[username]/layout.tsx` when `found && analyticsEnabled()` |
| Route | `app/api/collect/route.ts` → `features/analytics/server/collect.ts` (`collect` POST, `ownerStats` GET) |
| Filters | `features/analytics/filter.ts` (`isBot`, `optedOut`, `isPrefetch`, `fromOwnPage`) |
| Referrer groups | `features/analytics/referrer.ts` (`REFERRER_GROUPS` mirrors the list in `page_stats_record`; a test compares) |
| Visitor hash, days | `features/analytics/visitor.ts` (server only), `features/analytics/days.ts` (Berlin days) |
| Shapes | `features/analytics/answer.ts` (`parseOwnerStats`, `parseConsoleStats`, `missingStats`) |
| Console data | `features/analytics/console.ts` (`withPageStats`, `measured`, `viewsPerDay`) used by `features/admin/live.ts` (`viewsMeasured`, `pageViews`) |
| Dashboard | `features/app/stats.ts` (`useLiveStats(account, range)`, `fetchLiveStats`, `toLiveStats`, `statsCsv`), `analytics-screen.tsx`, `home-screen.tsx` (week card), `block-editor.tsx` (count chip) |
| Database | `supabase/migrations/20261125100000_page_stats.sql`, `supabase/tests/page_stats.test.sql` |
| Messages | `app.analytics.*`, `app.home.stats.*` |
| Tests | `features/analytics/*.test.ts`, `features/analytics/server/collect.test.ts`, `features/app/stats.test.ts`, `e2e/analytics-real.spec.ts` (`@real`) |

## How a view becomes a number

1. The page is seen (visible, not prerendered): `{ p: username, t: "v", r: referrer host, s?: "qr" }`.
2. `collect`: switch on, real accounts, same origin, no GPC/DNT, no prefetch, no bot, a valid body (≤ 1 KB).
3. Salt of the day (cached per process), visitor hash, referrer group, country (`x-vercel-ip-country`), device
   class (`parseUserAgent(ua).type`), then `page_stats_record` (service): public page and visible block only,
   capped at 30 views and 60 taps per visitor and day, upserts into `page_stats`.
4. The owner: `GET /api/collect?days=7|30|90` (bearer) → `my_page_stats(from, to)` as them → `{ counting, from,
   to, since, days, previous, blocks, referrers, countries, devices }`.
5. The team: `admin_page_stats(30)` (`analytics.view`) → totals per day and per page → `views30`/`clicks30`.

## Add a metric or a dimension

1. **Database (new migration, never edit an old one):** a new `dimension` value means altering the
   `page_stats_dimension` check and recording it in `page_stats_record`; a new key list goes into the function,
   with anything outside it dropped or mapped to "other". Keep it an aggregate: no row may name a visitor.
   Return it from `my_page_stats` (and `admin_page_stats` only as a total). Extend `page_stats.test.sql`: owner
   reads own, anon nothing, the schema still has no IP or user-agent column, the console function totals only.
2. **Server:** derive the value in `recordArgs` from what the request already carries; never add a new thing the
   browser must read or send about the device. A new client field needs a reason in the ADR and the lawyer.
3. **Shapes:** `parseOwnerStats` / `parseConsoleStats`, then `toLiveStats` in `stats.ts`.
4. **Stats UI:** a `Panel` with a `BarList` or a `KpiTile`; words in `app.analytics.*` in de, en and ar
   (Latin names and figures in Arabic inside `<bdi>`). Console: WP3.4's screens read `live.ts`.
5. **Privacy text:** update the ADR's proposed Datenschutz paragraph and hand it to the lawyer before the switch
   goes on with the new metric.
6. **Tests:** unit (filter, grouping, parse, stats), pgTAP, and `e2e/analytics-real.spec.ts`.

## Bots

`isBot` drops empty or non-`Mozilla/` user agents and a list of crawlers, link previews (WhatsApp, Discord,
Facebook's fetcher), monitors, headless browsers (`HeadlessChrome`, Lighthouse) and HTTP libraries. Keep in-app
browsers (Instagram, `FBAN`, `LinkedInApp`, `BytedanceWebview`) out of the list; `filter.test.ts` holds both sides.
Playwright's devices send normal browser user agents, so e2e visits count.

## Checks

```bash
cd apps/web && npx vitest run src/features/analytics src/features/app/stats.test.ts
pnpm db:reset && pnpm db:test && pnpm db:lint      # only the WP that owns the database this stage
# real-mode build with the local keys, then (see linkyo-qa-release for the full variable set):
E2E_SUPABASE=1 SUPABASE_SECRET_KEY=… npx playwright test e2e/analytics-real.spec.ts --project desktop
LINKYO_ANALYTICS=off E2E_SUPABASE=1 SUPABASE_SECRET_KEY=… npx playwright test e2e/analytics-real.spec.ts --project desktop
```

The second run starts the server with the switch off and checks that `/u` ships no counting code and nothing is
stored. Screenshots: Stats at 1440 in de and at 390 in ar, Home at 1440 (black and grey, no shadow, no underline).
