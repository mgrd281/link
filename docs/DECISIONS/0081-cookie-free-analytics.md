# 0081 — Cookie-free page statistics, off in production behind a server switch

**Status.** Accepted (Stage 3, WP3.1, 2026-11-25); on in production since 2026-11-25 (`LINKYO_ANALYTICS=on`, after F0; the founder went ahead without F2, see "Update" below). It **supersedes the
analytics-beacon note of [ADR 0008](0008-public-page-rendering.md)** ("~3 KB of vanilla islands: … analytics beacon
(`sendBeacon`)") and, for creator pages, the PostHog line of [ADR 0010](0010-hosting-and-data-residency.md): creator
pages get no third-party analytics at all, only this first-party counter.

**Context.** Real accounts had no statistics (D-02): `statsSource()` answered "none" outside the demo, so Stats and
Home said "coming soon", and the team console showed views as "not measured" with the funnel's Pro step computed
without them (A-08, interim since Stage 1). Creators want to know whether their page works; the product promises
counting "without cookies and without a consent banner". Production is real mode and every push reaches real users,
while the hosted database has only the migrations up to `20261123100300_ai.sql`, and the privacy policy may change
only after the lawyer's review (F2).

**Decision.**

1. **What is counted.** Per creator page and Berlin day: views (a page opened from outside: one per full page
   load, not per step inside the page), different visitors, and taps on blocks (a link or button inside an element
   with `data-block`, the renderer's block marks from S3.0). Views are split by referrer group (instagram, tiktok,
   youtube, facebook, x, linkedin, search, qr, direct, other; a step inside the page, from the page or one of
   its project pages, adds none, and any other page on Linkyo's host counts as other), country
   (the host's own geolocation header, `x-vercel-ip-country`, two letters only) and device class (mobile, tablet,
   desktop). Nothing else.
2. **The island.** A few lines of inline script (`features/analytics/beacon-script.ts`) that the creator layout
   writes into the page only while the switch is on. Inline, not a client component: Turbopack put a client
   component into the same chunk as the page's other islands, so it would have shipped with the switch off too;
   inline, an off page carries not one byte of it and an on page loads no extra file. It sends to `/api/collect`
   on the page's own origin with `fetch`, `keepalive` and no credentials (never `navigator.sendBeacon`, which
   always sends the site's cookies, a signed-in owner's session included): one view
   once the page is really seen (not while prerendered, not in a background tab), and one tap per click on a link
   or button in a block (a double tap within a second is one). A view carries the page's name, the kind and the
   referring site's host name, never its path or query; `?src=qr` marks a QR code. It reads and writes nothing on
   the device (no cookie, no storage, no fingerprint) and sends nothing when the browser sends Global Privacy
   Control or Do Not Track; `beacon.test.ts` runs it in a fake browser and holds its text to these rules. Size:
   under 1 KB gzip (unit test), at most 2 KB asserted on the real page (e2e).
3. **The server.** `POST /api/collect` always answers 204 with no body, so a script learns nothing. It counts only
   when the switch is on, real accounts are configured, the request is same-origin (`Sec-Fetch-Site`, `Origin`),
   is no prefetch (`Sec-Purpose`), carries no `Sec-GPC: 1` or `DNT: 1`, and its user agent is a person's browser
   (crawlers, link previews, monitors, headless browsers and HTTP libraries are filtered; in-app browsers of
   Instagram, Facebook, LinkedIn and TikTok are not). `page_stats_record` (service only) counts only public pages
   (as `public_page()` decides) and only blocks visitors see now, and caps one visitor at 30 views and 60 taps a
   day per page.
4. **Different visitors without storing anyone.** The server hashes (page name, network address, browser string)
   with HMAC-SHA-256 under the day's salt. The salt is 32 random bytes made by the database on first use
   (`page_stats_salt()`), kept in its own service-only table, never next to the counts. The database receives only
   the 64-character hash. Hashes and salts of a finished day are deleted every hour (`page_stats_purge`, pg_cron
   `linkyo-purge-page-stats`), so a day cannot be linked to the next one or to a person, not even by us. A visitor
   counts once per day; the Stats screen says that visitors over a range are the sum of each day's.
5. **Storage and access** (`supabase/migrations/20261125100000_page_stats.sql`, additive). `page_stats`: daily
   counts per page, dimension and key; owners read their own rows (RLS), nobody writes them but the record function;
   no column for an IP address, a browser string or a cookie (pgTAP checks the schema). `my_page_stats(from, to)`
   answers the owner's range, the period before and the first counted day (`since`); `admin_page_stats(days)`
   answers the team (`analytics.view`) totals only: per day and per page, no referrers, countries, devices or hashes.
   Deleting an account deletes its counts.
6. **The switch.** `LINKYO_ANALYTICS=on` (server variable, `lib/flags.ts`, S3.0). Unset, as in production: the
   creator layout renders no island (no counting code on `/u` at all), `/api/collect` stores nothing, the owner's
   `GET /api/collect` answers `{ counting: false }` and Stats keep today's "coming soon"; the console keeps "not
   measured" because nothing was ever counted (`since` is null). Tests and local runs set it on.
7. **A database without the statistics** (the hosted one today): a missing function or table (`PGRST202`,
   `PGRST205`, `42883`, `42P01`) means "not counting": the dashboard keeps "coming soon", the console "not
   measured", `/api/collect` answers 204. Never an error screen, never zeros.
8. **The dashboard.** Stats uses the UI kit's `KpiTile` (views, visitors, clicks, click rate; the change against
   the period before as arrow, signed text and words, shown only when that period was counted from its first day)
   and `ChartTable` instead of `<details>`, a 7/30/90-day range and a CSV of the visible days. Days before counting
   began are gaps and empty cells, never 0. A page nobody has visited yet says so. Home's week card reads the same
   numbers and, on laptops, names the most tapped blocks and the sources. The block editor shows a block's taps of
   the last 30 days (or since counting began). The demo keeps its sample numbers, labelled "Beispieldaten", the CSV
   of samples included (its file name says so).

**Consequences.**

- Owners who look at their own page are counted like anyone else (excluding them would need a cookie or storage).
- Taps are counted on links and buttons inside blocks; a player's own controls inside an embedded frame are not.
- The section panel of Stats stays hidden for real accounts (`nav.tsx` still decides by `statsSource()`); the
  integrator may switch it to the live state once counting is on.
- Lawyer track (F2): the paragraph below goes to the lawyer. Nothing on a page changes before that, and the
  switch stays off in production until the founder has applied the migration (F0) and the lawyer has approved.
  The EDPB's Guidelines 2/2023 on the technical scope of Art. 5(3) ePrivacy read some cookieless techniques as
  "access to terminal equipment"; the lawyer should confirm that a server-side hash of the address and the browser
  string, kept for one day and never sent back to the device, needs no consent under § 25 TDDDG.

**Proposed Datenschutz paragraph (for the lawyer, not published).**

> **Reichweitenmessung auf Creator-Seiten (ohne Cookies).** Wenn Sie eine Creator-Seite auf Linkyo aufrufen, zählen
> wir den Aufruf und Ihre Klicks auf Elemente der Seite, damit die Person, der die Seite gehört, sieht, wie oft ihre
> Seite besucht wird. Dafür setzen wir keine Cookies und speichern nichts auf Ihrem Gerät. Ihr Browser sendet an
> unseren eigenen Server den Namen der Seite, die Art des Ereignisses (Aufruf oder Klick, bei einem Klick das
> angeklickte Element) und bei einem Aufruf den Namen der Website, von der Sie kamen, ohne die genaue Adresse. Aus
> Ihrer IP-Adresse und der Kennung Ihres Browsers (User-Agent) bildet unser Server mit einem täglich neuen
> Zufallswert einen Hashwert, damit mehrere Aufrufe am selben Tag als ein Besucher zählen. IP-Adresse und User-Agent
> werden dabei nicht gespeichert; Hashwert und Zufallswert löschen wir, sobald der Tag vorbei ist. Gespeichert
> bleiben nur Summen pro Tag: Aufrufe, Besucher, Klicks je Element, die Herkunft als Gruppe (etwa „Instagram“ oder
> „Suchmaschinen“), das Land (aus der IP-Adresse abgeleitet, ohne sie zu speichern) und die Geräteart (Smartphone,
> Tablet, Computer). Ein Rückschluss auf Sie ist daraus nicht möglich. Sendet Ihr Browser das Signal „Global Privacy
> Control“ oder „Do Not Track“, zählen wir Ihren Besuch nicht. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; unser
> berechtigtes Interesse und das der Seiteninhaber ist eine datensparsame Reichweitenmessung. Die Summen speichern
> wir in unserer Datenbank in Frankfurt am Main, solange das Konto der Seite besteht.

**Turning it on (in this order).** (1) The founder applies `20261125100000_page_stats.sql` to the hosted project
after the four migrations waiting before it (F0). (2) The lawyer approves the paragraph; it goes into
`features/legal/texts.ts` in de, en and ar (F2). (3) Set `LINKYO_ANALYTICS=on` for production on Vercel (a server
variable, never `NEXT_PUBLIC_`) and redeploy, since a deployment keeps the variables it was made with; cached
creator pages pick the island up within their minute.

**Update 2026-11-25 (the founder has no lawyer and told us to go ahead).** Of the four migrations the plan thought
were waiting, only `reserved_portfolio` and `admin_money` were (`review_fixes` and `team_fixes` were already live);
the founder said to apply them, they are applied and checked, and `page_stats` follows the same way. The statistics
paragraph is not left to a lawyer: it is in `features/legal/texts.ts` (German only, like every legal text), worded
from what the code does (the facts above) and marked `[vom Anwalt zu prüfen]`. It appears on the page only while
`LINKYO_ANALYTICS=on` (`datenschutz({ statistics })`, the page passes `analyticsEnabled()`); with the switch off the
page still says that no visits are counted, so the text never says more or less than happens. The launch guard
(`legalDocs()` in `live-guard.ts`) reads the fullest form, so a `LAUNCH=1` build still fails while that marker
stays: the founder's decision turns the counting on, not the legal drafts into final texts. The open question above
(§ 25 TDDDG and the referrer the script reads) is not settled by anyone with the training to settle it; the founder
carries that risk and can turn the counting off by removing `LINKYO_ANALYTICS` and redeploying. Today's exposure is
small: examples are code, not database pages, so they are not counted, and the hosted project holds one account.
The "in Arbeit" wording of the pricing page and the FAQ (real accounts) is changed in a follow-up once the counting
runs, with its stub and real-account specs.
