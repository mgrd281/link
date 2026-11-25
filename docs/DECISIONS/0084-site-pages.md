# 0084 — The website's own pages, one pricing comparison, SEO from the route list, laptop type

**Status.** Accepted (Stage 4, WP4.2, 2026-11-25). Amends [ADR 0038](0038-hero-two-lines.md) only in the
promise's size from 1280 px; its two lines stay at every width (see 5).

**Context.** The audit (plan §2) found the website without the pages a complete product site has (W-04: help,
contact, features, about, changelog), without a security page (W-10), with a pricing section that left the page service
as one quiet line and kept "(in Arbeit)" beside analytics that now run in production (W-06), with a sitemap of four
hand-listed paths, no structured data and descriptions copied from the home page (W-05), and with a 40 px headline at
1440 (W-11).

**Decision.**

1. **Six pages, server-rendered** (`app/[locale]/{hilfe,kontakt,funktionen,ueber-uns,changelog,sicherheit}`,
   components in `features/marketing/pages/`). Each has its own title, description and link preview (a text card on
   the site's teal, `features/share/page-card.tsx`, built on `og-card.tsx`'s canvas and `RtlText`; PNG, no photo).
   They say only what the code does today and follow its switches (`siteState()`): the contact page shows the one
   existing contact (the e-mail address read from `COMPANY`, not copied into the messages) and leads to the
   Impressum; the changelog lists dated entries from the git history that reached the live site (payments and the AI
   builder, switched off, have none; the statistics entry shows only while pages are counted); "Über uns" names no
   team, numbers, investors or quotes. Numbers in the copy come from the code that sets them (designs, address
   length, welcome steps, pictures per project, statistics ranges, revision rounds, VAT); an independent fact-check
   of every sentence against the code was applied before merge.
2. **Help articles are data** (`features/help/articles.ts`): a stable slug each (the article's anchor,
   `/de/hilfe#statistik`, and `helpHref()` for the dashboard's help entry in WP4.5), their words in `help.articles.*`
   in de, en and ar. The page renders them on the server and hands them to one island, the search
   (`features/help/help-center.tsx`), which reads only `help.search.*` on the client. The search runs in the browser:
   every word of the query must occur in the title, the short answer or the body, folded like the people search
   (accents, Arabic vowel marks and letter variants, and German umlauts typed out). Nothing typed leaves the page.
3. **Legal promises on informational pages carry the review marker.** A sentence of the security page that is a
   legal promise, or whose counterpart in the privacy policy is still under review (hosting and transfer, what the
   counting script sends, how long check values and sign-ins are kept, what the AI provider gets, what an account
   deletion removes; `LEGAL_PROMISES` in `features/marketing/pages/review.ts`), shows `REVIEW.check` after it, in
   German like the drafts, and `launchMarkers()` in `features/legal/live-guard.ts` counts it, so a `LAUNCH=1` build
   fails until a lawyer has approved it and the key is removed. Help, features, about and pricing carry no markers:
   they describe what the product does and guarantee nothing.
4. **One model for plans, prices and their questions** (`features/marketing/pricing.ts`): Free is there now; Pro
   (ADR 0066: AI drafts; its own domain, selling and the e-mail list planned) and the page service carry their prices
   as "kommt mit dem Start" while payments are off and lead nowhere, and are "jetzt" with their checkout and page once
   payments are on. The cookie-free statistics are a Free line that is "jetzt" wherever pages are counted (the demo's
   sample numbers, or real accounts with `LINKYO_ANALYTICS=on`) and "geplant" where they are not; the FAQ's first
   answer, the third trust card, the analytics tile's badge and the home page's description follow the same switch
   (`siteState()`). The comparison, the questions about paying and cancelling under it, the FAQ and the structured data
   all read this model. Static pages read the switches while they are built (`LINKYO_ANALYTICS` is a build variable
   in turbo.json); the security page re-renders hourly, because it also names the AI switch, which a build may not see.
5. **Laptop type (amends ADR 0038 for the size only).** The promise stays on two lines at every width, as ADR 0038
   decided ("Ein Link." / "Alles, was du erschaffst."); only its size grows on wide laptops. Phones (28 px) and tablets
   (56 px) are as before; from 1024 px it is 40 px (`display-sm`) beside the pages, with ADR 0038's 1.15 : 1. From
   1280 px the hero and the home page's header take `layout.content-wide`, the words get 1.6 of 2.6 parts and the
   promise is 56 px (`display`); from 1536 px it is 72 px (`display-xl`). Each step starts where the longest second
   line, the German one, fits on one line beside the pages (measured: 461 px at 40 px in a 484 px column at 1024;
   646 px at 56 px in 699 px at 1280; 830 px at 72 px in 857 px at 1536; English and Arabic are shorter). The pages
   beside it never grow smaller than at 1024 px (the front card is 175 px wide there, 182 px at 1280, 233 px at 1920),
   and the hero is clipped sideways at every width, so the deck's queued cards never make the page scroll. Section
   titles grow to 40 px on laptops (`md:text-h1 lg:text-display-sm`, `features/marketing/headings.ts`).
6. **SEO from the route list** (`lib/seo.ts`): `PUBLIC_PATHS` (and `/service` only with payments on) feed the sitemap,
   each entry with its language versions and `x-default`; `PAGE_DESCRIPTIONS` names each public page's own
   description, and a unit test fails on a missing or repeated one in any language. Where no page is counted,
   `PAGE_DESCRIPTIONS_UNCOUNTED` gives the home page, `/funktionen`, `/changelog` and `/sicherheit` one without the
   statistics, and the test fails on any other description that names them (the help page's list of answers aside,
   whose statistics answer says when nothing is counted). The home page carries four JSON-LD
   blocks (Organization, WebSite, SoftwareApplication, FAQPage) through `jsonLd()`; the offers name only what can be had
   today (the free plan; Pro only once payments are on), and FAQPage holds exactly the questions the page shows.
7. **The way there.** Header and phone menu: Funktionen leads to `/funktionen`, and Hilfe (`/hilfe`) takes the FAQ's
   place (the FAQ stays on the home page and in the footer). The footer has three groups: Produkt (with Changelog),
   Hilfe & Kontakt, Über Linkyo (Über uns, Sicherheit & Datenschutz). The phone menu's glyphs come from the icon
   registry.

**Consequences.**

- WP4.3 (message namespaces per route group): the site pages are server components; the help page's island needs
  `help.search` on the client, and every marketing page keeps `marketing.nav` (the phone menu) as before.
- WP4.5 links help with `helpHref(locale, slug)`; slugs are never renamed (a unit test lists them).
- WP4.1: the contact page's "report content" card links to the Impressum's `#melden` section today; it can point at
  `/melden` once that page exists.
- A new help article, changelog entry or site page needs its words in three languages (parity test) and, for a page,
  its path in `PUBLIC_PATHS` and `PAGE_DESCRIPTIONS`, `e2e/routes.ts` and the footer.
