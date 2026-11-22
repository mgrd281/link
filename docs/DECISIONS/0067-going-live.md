# 0067 — Going live without demo mode: public pages, Storage, honest copy, legal gates

**Status.** Accepted (v7 phase 1). Everything here works against the local Supabase stack and in CI.
The real Supabase project exists (Central EU, Frankfurt; all eight migrations applied through the
Management API on 2026-11-22) but is **not connected to Vercel yet**: Auth e-mails need custom SMTP,
and custom SMTP needs a domain the founder has not chosen yet (see `docs/SUPABASE_SETUP.md`).

**Context.** Until v7 the product ran in demo mode: accounts and pages lived in the browser, and
`/p/<slug>` served prepared example pages. Real accounts ([ADR 0030](0030-supabase-accounts.md))
existed, but a real creator's page had no public address, pictures were data URLs inside the page
JSON, the dashboard showed sample statistics, and the legal pages did not exist. Going live must not
publish placeholder legal data, must keep creator pages free of cookies and third-party requests, and
must leave the demo deployment exactly as it is until the founder switches it.

**Decision.**

### 1. Public creator page with its own root layout

- `linkyo.app/<username>` is served by `app/u/[username]/` — a **second root layout** beside
  `app/[locale]/layout.tsx`, so `<html lang dir>` is the **page's own language** (its privacy notice,
  footer and 404 speak it). `proxy.ts` passes `/u/*` through without next-intl (no cookie, no locale
  prefix), lower-cases a mixed-case name (308) and rewrites a bare `/<username>` to `/u/<username>`
  when real accounts are on (`lib/creator-path.ts`). The canonical URL stays `/<username>`. Demo
  builds behave as before.
- The page is ISR with `revalidate = 60`; `generateMetadata` gives title, description, canonical
  `pageUrl()`, Open Graph `profile`, and the AI marking ([ADR 0065](0065-ai-page-builder.md)). The
  Open Graph image uses the same card as the dashboard's share kit.
- **Block filter, twice, fail closed:** `public.public_page()` returns only blocks for which
  `block_is_public(block, now())` is true (visible, inside its schedule; any cast error → false), and
  the route parses each block again and drops invalid, inactive and **newsletter** blocks (the form is
  not real yet). Hidden and scheduled blocks are asserted absent from the HTML **and** the RSC payload.
- **Reserved names:** every first-level route is reserved (v7 adds 23, among them `checkout`,
  `service`, `widerruf`, `kuendigen`, `impressum`, `datenschutz`, `agb`, `ai`, `pro`). The SQL list and
  `RESERVED_USERNAMES` are compared by a test that parses the migrations.
- **One page-URL helper:** `lib/page-url.ts` — `pageAddress(name)` for what people read
  (`linkyo.app/mila`), `pageUrl(name)` and `creatorOrigin()` for links, QR codes and sharing;
  `NEXT_PUBLIC_CREATOR_DOMAIN` switches the domain in one place.

### 2. Pictures in Storage

- Three buckets (migration `media`): `media` (public, 5 MB, JPEG/WebP/PNG, `media/<uid>/<yyyy>/<uuid>`),
  `briefing` (private, 10 MB, order photos) and `deliverables` (private, 10 MB, Premium story
  pictures), each with owner-folder policies and team read where needed (`pages.edit`).
- In real mode a prepared picture is uploaded (`uploadToBucket`, `storePreparedImage`); older data
  URLs are migrated on the first save (at most 3 uploads at a time; a failed upload keeps the data URL
  and retries). A page above the size cap stops retrying and says so (`app.save.tooLarge`).
- **Storage pictures go through `/_next/image`** (`isStorageImage` in `remote-images.ts`;
  `images.remotePatterns` from `NEXT_PUBLIC_SUPABASE_URL`; `dangerouslyAllowLocalIP` only for a
  loopback Supabase URL). A visitor's browser never contacts the Storage host, also in Open Graph
  cards.
- **Files are deleted only through the Storage API**, never with SQL. SQL queues work in
  `public.storage_purge`; `POST /api/maintenance/storage-purge` (404 unless `MAINTENANCE_SECRET` is
  set, bearer token compared timing-safe) drains it. Deleting an account (`/api/account/delete`, and
  the team's `/api/admin/customers/[id]/delete`) removes the account's three folders at once and
  queues anything that failed. `pnpm db:start` now runs `storage-api` locally.

### 3. Retention

Briefing photos and texts 30 days after an order ends (`service_maintenance`, daily, queues the
folder); withdrawal and cancellation records 3 years; order and invoice fields 10 years (§ 147 AO);
AI drafts 7 days and the run log 30 days ([ADR 0065](0065-ai-page-builder.md)); `form_limits` 1 day.
Deleting a profile clears its orders' briefing text.

### 4. Honest real mode

- Real accounts have no analytics yet: the dashboard shows an empty state instead of sample
  statistics (`statsSource()`), the website's analytics section carries an "In Arbeit" badge, and the
  meta description and FAQ make no analytics claim.
- The newsletter block is not offered in real mode and never rendered publicly.
- Demo-only notes (reserved address, sample billing) show only in demo mode.
- **The team code fails closed:** with real accounts on, the demo code never works; an unset or
  malformed `LINKYO_ADMIN_CODE_SHA256` rejects every code and token.

### 5. Legal pages and the live gate

- `/impressum`, `/datenschutz`, `/agb` exist in every build, `/widerrufsbelehrung` only with payments.
  They render the German text in every locale (`lang="de"`) under a localized title, a "draft,
  reviewed by a lawyer before launch" banner and, in en/ar, a note that contracts are made in German;
  all are `noindex`.
- The provider is the founder as a registered sole trader in Hamburg, VAT 19 %; the data lives only in
  `features/legal/company.ts`. `legalReady` is true once no value there is a `[placeholder]`;
  `legalLinksVisible = legalReady || paymentsMode === "test"` decides whether footers and Settings
  link the pages (otherwise they show the plain names). With the founder's data in place the links
  are on.
- The privacy policy draft covers hosting (Vercel fra1, Supabase Frankfurt), e-mail, Stripe on
  `/checkout/*` only, creator pages without cookies (`#creator-pages`), the AI provider (Anthropic,
  USA; no photos; contacts removed; the transfer basis marked for the lawyer) and the retention
  periods above. The DSA "report" link on creator pages points at the Impressum's `#melden` section.
- **The live build gate:** `next.config.ts` calls `assertLiveReady()`; `NEXT_PUBLIC_PAYMENTS=live`
  fails the build unless the company data is complete **and** `LEGAL_REVIEWED=1`.

### 6. CI

Two jobs after `quality`: **database** (`db:start`, `db:reset`, pgTAP, plpgsql_check, generated
types unchanged) and **real-e2e** (a build with the local keys and `NEXT_PUBLIC_PAYMENTS=test`, then
three Playwright invocations: `supabase.spec.ts` with AI off; `--grep @real --grep-invert @global` on
desktop and mobile with the AI and Stripe mocks; `--grep @global --workers=1` for tests that change
global state such as the AI switch). Real-mode specs use `e2e/real.ts` (a per-test `x-forwarded-for`
and mock tag, accounts made with the service key, sign-in without an e-mail round trip). The local
stack raises the Auth rate limits (`sign_in_sign_ups`, `token_verifications` = 1000) for these
suites only.

**Consequences.**

- Phase 1 has **no scheduler** for the storage purge on Vercel: rows wait safely until a daily
  Vercel Cron calls the route with `MAINTENANCE_SECRET` (a go-live item).
- The hosted project differs from the local stack in ways tests cannot show (`pg_cron` schema,
  definer deletes); a staging check comes before real sign-ups.
- Turning the demo deployment into the real one is a configuration change (the Supabase keys, SMTP,
  the domain), not a code change.
