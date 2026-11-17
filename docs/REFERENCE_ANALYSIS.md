# Reference Analysis: Public Link-in-Bio Pages

**Linkyo competitive research, measured on 2026-11-17. Only public pages were analyzed.**

> **Summary**
>
> 1. **Nobody ships a clean page.** Before the visitor did anything, every competitor page we could measure contacted 4–10 third-party domains and set 1–23 cookies. Not one was at zero.
> 2. **The market leaders are heavy.** Linktree sends 1.5–1.7 MB of JavaScript (4.8–5.6 MB once decompressed) to show a list of links. Stan sends 1.1 MB and Snipfeed/Planoly 0.8 MB. Linkyo's 70 KB budget is 11–25× smaller. bio.link stays around 40 KB, which shows the budget is realistic.
> 3. **They are not slow to first paint; they are slow to respond, and they fail strict tests.** All of them render on the server, and in our "Fast 4G" lab every LCP came in at or under 1.4 s. What they lose on is main-thread work: total blocking time (TBT) was 1.2–4.0 s at 4× CPU slowdown for Linktree, Stan and Planoly. Under Lighthouse's default mobile profile their LCP is 3.3–8.6 s and their Performance scores are 36–90. None reaches 95.
> 4. **Ad pixels on creator pages are normal.** These all fired on page load without any consent prompt, as seen from a US connection:
>    - Meta and TikTok pixels on Linktree's own profile.
>    - A different Meta pixel on the LA Clippers page, most likely the brand's own.
>    - Meta, TikTok, Microsoft Clarity and Google Analytics 4 on Stan's own store page.
> 5. **Fonts and libraries load from Google, Adobe or public CDNs on all 5 measured products.** Four of the five use Google Fonts, which is a known legal risk in Germany.
> 6. **Basic accessibility is missing everywhere.** No page has a `<main>` landmark. Linktree and bio.link disable pinch-zoom. Planoly has unnamed buttons. All five products have secondary tap targets well under 44 px: social icons of 16–32 px, or footer links 18 px tall.
> 7. **Embeds are click-to-load at best, but nobody makes that privacy-safe.** On the best example, Linktree, one click loaded the standard YouTube player. YouTube then set 4 cookies and the browser contacted Google ad domains. There was no notice before the click and no privacy-enhanced domain.
> 8. **SEO is uneven.** Only Linktree ships structured data (JSON-LD) together with generated social-preview images. Three of the five products have no JSON-LD at all.
> 9. **Desktop is an afterthought.** Column widths range from 566 to 859 px, or the page switches to a two-column storefront. Two products pin a "start your free trial" bar over the creator's content, and one of those bars has no close button.
> 10. **Linkyo's opportunity:** be the only product that is measurably fast on low-end phones, makes zero third-party requests and sets zero cookies, so it needs no cookie banner, is accessible, and is built for German law. LCP alone will not set us apart, because competitors already pass 1.5 s on Fast 4G in the lab.

---

## 1. Purpose, date, method and ethics

### Purpose
This document measures how today's link-in-bio products actually deliver a public creator page: page weight, speed, privacy behavior, accessibility, structure and SEO. The goal is to set Linkyo's quality bar against measured reality rather than assumptions. It is written for founder-level decisions, and the commitments in section 6 are meant to become release gates.

### Date
All measurements were taken on **2026-11-17** within a single session. Treat them as a snapshot. Pages and A/B tests change.

### Method (short version; full details in section 7)
- **Tooling.** The REA tool could not be installed in this environment because the session's permission policy blocked it. We used **Playwright 1.63** driving **Chromium (Chrome for Testing 153)**, the **Chrome DevTools Protocol (CDP)**, **axe-core 4.10.2**, and **Lighthouse 12.8.2** installed locally in a scratch folder.
- **Viewports.**
  - Mobile: 390×844 CSS px, DPR 3, touch, with the user agent from Playwright's iPhone device descriptor.
  - Desktop: 1440×900, DPR 1.
  - Both used locale `de-DE` and time zone `Europe/Berlin`, so we see what a German-language visitor's browser gets.
- **Runs.** Each page was loaded **9 times**, every time in a fresh browser with a cold cache and no cookies:
  - 3× mobile, unthrottled
  - 3× mobile "Fast 4G": the CDP equivalent of DevTools' preset (9 Mbps ×0.9 down, 1.5 Mbps ×0.9 up, 165 ms latency) **plus 4× CPU slowdown**
  - 3× desktop
  
  We report medians.
- **Metrics.**
  - In-page PerformanceObserver for LCP, CLS (session windows), FCP and long tasks.
  - Navigation Timing for TTFB, DOMContentLoaded and load.
  - CDP for transfer sizes per request and CPU time.
  - "TBT≈" is the sum of long-task time beyond 50 ms after FCP. It approximates Lighthouse's TBT.
- **Privacy snapshot.** After the network was quiet (2 s with no requests, capped at 15 s or 30 s throttled) and before any interaction, we recorded:
  - all cookies, by name, domain and lifetime (no values)
  - localStorage, sessionStorage and IndexedDB key names (no values)
  - every request with its timing
  - whether a consent banner was visible
- **Accessibility and structure.** The page was then scrolled once, with no clicks, to trigger lazy content. We ran axe-core (WCAG 2.0, 2.1 and 2.2 A/AA plus best-practice rules, with `target-size` enabled, iframes excluded) and a DOM audit of tap targets, images, fonts, iframes, sticky elements and layout.
- **Raw HTML.** We analyzed the HTML as the server delivered it, to check server-side rendering, framework fingerprints and SEO tags.
- **One deliberate interaction.** We made a single click on one video tile, on one Linktree brand page, to check click-to-load behavior.

### Ethics statement
- **Public pages only.** No logins, no accounts, no form submissions, no consent clicks, and no private or internal APIs. Everything measured is what any visitor's browser receives.
- **No protections bypassed.** We chose one fixed browser profile per viewport before any probing and never changed the user agent or anything else in response to a block. A page that showed a challenge was recorded as **"not analyzable (bot protection)"** and was not retried.
- **No private individuals.** We used each product's **own official profile**, or a **large brand's page that the product itself showcases** on its homepage.
- **Nothing copied.** No competitor code, text, images, logos or screenshots are in this repository. Patterns are described in our own words. Product names appear only to identify what we measured.
- **Raw evidence stays outside the repo.** Scripts, JSON metrics, screenshots and Lighthouse summaries were kept in a scratch workspace outside the repository and are not committed.

### Limitations: read before quoting numbers
1. **Network path.**
   - The lab was a cloud VM in the US (Ohio). All traffic passed through a TLS-terminating egress proxy.
   - Through that proxy, Chromium negotiated **HTTP/1.1 only**, in all 63 measured loads. There was no HTTP/2 or HTTP/3 multiplexing.
   - A curl baseline showed roughly **0.1–0.35 s of extra setup per new connection**.
   - As a result, absolute timings are pessimistic, especially for pages that make many requests (for example, Linktree fetches 80 files from one asset host). Compare products with each other. Do not quote these timings as real-user field data.
2. **Geography.** Many consent tools show banners only to visitors with EU or UK IP addresses. From our US IP, **no product showed a consent banner**. Three of them ship consent tooling that was present but hidden. We could not verify what EU visitors get. Before publishing any privacy comparison, repeat the run from a German IP without a TLS-terminating proxy.
3. **Throttling.**
   - DevTools latency throttling sets a minimum per request. Our real path was already slow, so the 165 ms floor rarely mattered; the bandwidth cap and the 4× CPU slowdown did.
   - Lighthouse's mobile preset is much harsher: it simulates 1.6 Mbps and 150 ms RTT. That is why Lighthouse LCPs are 3–8 s while our Fast-4G LCPs are 0.6–1.4 s.
   - Lighthouse ran once per page and form factor. A repeated Lnk.Bio mobile run scored 68 instead of 71, so expect about ±5 points of noise.
4. **Sample size.** One day, one location, 3 runs per condition. Cold first loads were often slower: Linktree's first mobile run had a 2.7 s TTFB because of a CDN cache miss, so we use medians. Treat differences under about 20% as noise.
5. **Automated accessibility checks** catch only part of the real issues, roughly a third. Zero axe violations is a requirement, not proof of accessibility.

---

## 2. Products and pages analyzed

| # | Product | Page (public URL) | Why this page | Result |
|---|---|---|---|---|
| 1 | **Linktree** | `https://linktr.ee/linktr.ee` | Linktree's own official profile (`/linktree` redirects here) | Analyzed |
| 2 | **Linktree** | `https://linktr.ee/laclippers` | LA Clippers (NBA team), showcased on linktr.ee's homepage. Shows a brand that uses its own tracking pixel. | Analyzed |
| 3 | **Stan** | `https://stan.store/stanforcreators` | Stan's own store (@stanforcreators is Stan's social handle, linked from stan.store) | Analyzed |
| 4 | **bio.link** | `https://bio.link/biodotlink` | bio.link's own profile (linked from the bio.link footer) | Analyzed |
| 5 | **bio.link** | `https://bio.link/acmilan` | AC Milan (football club) podcast page, showcased on bio.link's homepage | Analyzed |
| 6 | **Lnk.Bio** | `https://lnk.bio/lnkbio` | Lnk.Bio's own profile | Analyzed |
| 7 | **Snipfeed (now Planoly Creator Store)** | `https://planoly.store/snipfeed` | Snipfeed's official page (`snipfeed.co/snipfeed` now redirects here) | Analyzed |

**Skipped**

| Product | Tried | Why skipped |
|---|---|---|
| **Beacons** | `https://beacons.ai/beacons` | **Not analyzable (bot protection).** The first measurement load got Cloudflare's "security verification" interstitial (HTTP 403). It was recorded and not retried. An earlier one-off availability check had rendered the page once, and the beacons.ai homepage was challenged in the same session. Under our rules we report no Beacons metrics. |
| Milkshake | `https://msha.ke/milkshake` | 404. We found no official profile at that address and did not search further. |
| Taplink | `https://taplink.cc/taplink` | Redirects to the Taplink marketing site, so there is no profile page to measure. |
| Later Link in Bio | `https://linkin.bio/later` | Redirects to a later.com marketing page, so there is no profile page. |
| Komi | `https://komi.io` | We found no product-owned profile. The showcased pages belong to celebrities, and we kept to product-owned and brand pages. |
| Carrd | (not attempted) | Carrd is a general one-page site builder, not a link-in-bio profile product with an official profile page. |

---

## 3. Metrics

### 3.1 Lab metrics (Playwright + CDP + axe-core)

How to read the table:
- Requests and bytes cover everything loaded from navigation start until the network went quiet, **with no interaction**.
- Transfer means compressed bytes on the wire, including headers. 1 KB = 1,024 bytes.
- LCP and CLS are medians of 3 runs. Fast-4G and TBT apply to mobile only.
- "3P domains" are registrable domains not operated by the platform. Platform-owned asset domains such as stanwith.me, tr.ee and lnk.bi are not counted. Stan's own app assets live on a CloudFront domain, which *is* counted.
- Cookies are classified the way the browser does it: first-party (1P) means the cookie belongs to the visited site.

| Page | View | Requests | Transfer | JS (transfer / decoded) | 3P domains | Cookies after load (1P / 3P) | LCP (lab) | LCP (Fast 4G + 4× CPU) | CLS | TBT≈ (Fast 4G) | axe rules / nodes (critical+serious rules) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Linktree · official | mobile | 154 | 8.16 MB | 1,724 KB / 5,705 KB | 9 | 16 (14 / 2) | 0.85 s | 1.28 s | 0.000 | 4,026 ms | 4 / 67 (3) |
| Linktree · official | desktop | 145 | 5.53 MB | 1,731 KB / 5,731 KB | 9 | 17 (14 / 3) | 0.76 s | – | 0.002 | – | 2 / 63 (1) |
| Linktree · LA Clippers | mobile | 99 | 1.76 MB | 1,501 KB / 4,899 KB | 6 | 10 (10 / 0) | 0.76 s | 1.07 s | 0.001 | 2,457 ms | 3 / 27 (2) |
| Linktree · LA Clippers | desktop | 96 | 1.76 MB | 1,497 KB / 4,899 KB | 6 | 11 (10 / 1) | 0.67 s | – | 0.000 | – | 2 / 23 (1) |
| Beacons · official | both | **not analyzable (bot protection)** | | | | | | | | | |
| Stan · official | mobile | 85 | 1.62 MB | 1,128 KB / 4,197 KB | 10 | 22 (13 / 9) | 1.12 s | 1.26 s | 0.000 | 1,844 ms | 3 / 27 (0) |
| Stan · official | desktop | 83 | 1.61 MB | 1,124 KB / 4,197 KB | 10 | 23 (13 / 10) | 0.82 s | – | **0.147** | – | 3 / 27 (0) |
| bio.link · official | mobile | 17 | 214 KB | **39 KB** / 112 KB | 4 | 2 (1 / 1) | 0.56 s | 0.65 s | 0.000 | 239 ms | 2 / 7 (1) |
| bio.link · official | desktop | 17 | 215 KB | 40 KB / 112 KB | 4 | 2 (1 / 1) | 0.52 s | – | 0.000 | – | 2 / 7 (1) |
| bio.link · AC Milan | mobile | 25 | 285 KB | 40 KB / 111 KB | 4 | 2 (1 / 1) | 0.42 s | 0.66 s | 0.000 | 186 ms | 3 / 12 (1) |
| bio.link · AC Milan | desktop | 25 | 296 KB | 40 KB / 112 KB | 4 | 2 (1 / 1) | 0.41 s | – | 0.000 | – | 3 / 12 (1) |
| Lnk.Bio · official | mobile | 32 | 875 KB | 284 KB / 857 KB | 6 | 1 (1 / 0) | 0.90 s | 1.28 s | 0.000 | 476 ms | 4 / 7 (0) |
| Lnk.Bio · official | desktop | 32 | 876 KB | 284 KB / 859 KB | 6 | 1 (1 / 0) | 0.83 s | – | 0.073 | – | 4 / 7 (0) |
| Snipfeed/Planoly · official | mobile | 83 | 3.43 MB | 807 KB / 2,355 KB | 7 | 4 (4 / 0) | 0.95 s | 1.39 s | 0.010 | 1,157 ms | 6 / 68 (3) |
| Snipfeed/Planoly · official | desktop | 77 | 3.32 MB | 807 KB / 2,357 KB | 7 | 4 (4 / 0) | 0.98 s | – | 0.001 | – | 6 / 68 (3) |

Notes:
- The request and byte columns come from the full unthrottled run.
- The Fast-4G runs recorded slightly fewer requests: Linktree official, for example, had 139–145 instead of 154. The likely reason is that some late, timer-driven requests fell outside the observation window.
- Linktree official is heavier on mobile than on desktop. On mobile its Instagram-feed photos load straight away as full 1440 px JPEGs, about 2.6 MB in total.
- Stan's desktop CLS comes from one layout shift of about 0.146 when the two-column storefront rearranges, around 0.7–1.3 s into the load. Lighthouse measured 0.20.
- Lnk.Bio's desktop CLS comes from its main container and footer moving during load.

### 3.2 Lighthouse 12.8.2 (default presets, one run per page and form factor)

Each cell lists the four scores (Performance / Accessibility / Best Practices / SEO), then LCP · TBT · CLS.

| Page | Mobile scores | Mobile LCP · TBT · CLS | Desktop scores | Desktop LCP · TBT · CLS |
|---|---|---|---|---|
| Linktree · official | **36** / 86 / 61 / 92 | 8.6 s · 2,227 ms · 0 | 62 / 94 / 59 / 92 | 2.1 s · 597 ms · 0 |
| Linktree · LA Clippers | **40** / 90 / 61 / 92 | 6.8 s · 2,806 ms · 0.001 | 68 / 94 / 59 / 92 | 1.9 s · 430 ms · 0 |
| Stan · official | **40** / 98 / 75 / 92 | 6.4 s · 1,324 ms · 0 | 66 / 98 / 74 / 92 | 2.2 s · 91 ms · 0.20 |
| bio.link · official | **90** / 93 / 61 / 100 | 3.3 s · 51 ms · 0 | 93 / 93 / 59 / 100 | 1.5 s · 0 ms · 0 |
| bio.link · AC Milan | **87** / 88 / 61 / 100 | 3.5 s · 32 ms · 0 | 97 / 88 / 59 / 100 | 1.0 s · 0 ms · 0.001 |
| Lnk.Bio · official | **71** / 99 / 82 / 100 | 4.9 s · 360 ms · 0 | 86 / 99 / 81 / 100 | 1.8 s · 0 ms · 0.15 |
| Snipfeed/Planoly · official | **54** / 86 / 82 / 100 | 5.8 s · 434 ms · 0 | 71 / 86 / 81 / 100 | 3.3 s · 26 ms · 0.002 |

**No page reaches Linkyo's mobile target of ≥ 95.** The best is bio.link at 87–90.

Repeated Lighthouse findings:
- Linktree: 4.2–5.9 s of JavaScript boot-up on mobile, about 0.5 MB of unused JS, and failing audits for third-party cookies, back/forward cache, `label-content-name-mismatch` and zoom disabled.
- Stan: console errors and layout shifts.
- Planoly and Stan: oversized images.
- Lnk.Bio: flagged for HTTP/1.1. That is our proxy, not their server.

### 3.3 What a visitor's browser does before any interaction (privacy)

| Page | Third-party domains contacted on load (category) | Cookies and storage after load | Consent banner? |
|---|---|---|---|
| Linktree · official | facebook.net + facebook.com (**Meta Pixel**); tiktok.com + tiktokw.us (**TikTok Pixel**, including "identify" and IPv6-enrichment calls); datagrail.io (consent management); featureassets.org (Statsig experiments, SDK served from jsDelivr); snapkit.com (Snap SDK); odesli.co (song.link music lookups from the visitor's browser). First-party subdomains add a **script on a subdomain named `browser-fp`** (which suggests device fingerprinting), its own analytics beacons, and an events endpoint on Linktree's short domain `tr.ee`. | **16 cookies**: visitor and session IDs (lifetimes up to 400 days), Datadog RUM session, Meta `_fbp`, TikTok `_ttp`/`ttcsid`, consent bookkeeping including a geo-consent cookie. Third-party: `_ttp` on tiktok.com, plus one on capi.tr.ee. **12 localStorage + 10 sessionStorage keys** (experiment IDs, visit counters, referrer, TikTok and Datadog session data). | Not shown (US IP). A geo-consent script and a cookie-preferences button in the footer exist. |
| Linktree · LA Clippers | facebook.net/.com (**Meta Pixel** with a different pixel ID from Linktree's own page, most likely the brand's); datagrail.io; gstatic.com (**Google Fonts**, theme font); snapkit.com; odesli.co | **10 cookies** including `_fbp`. On desktop, also `fr` on facebook.com. 8 localStorage + 7 sessionStorage keys. | Not shown (US IP) |
| Stan · official | googletagmanager.com + google-analytics.com (**GA4**, Consent Mode default *granted*); clarity.ms (**Microsoft Clarity session replay**) + bing.com (cookie sync); facebook.net/.com (**Meta Pixel**); tiktok.com/tiktokw.us (**TikTok Pixel**); typekit.net (**Adobe Fonts**); cloudfront.net (Stan's own app assets) | **22–23 cookies**, 9–10 of them third-party (Clarity, Bing `MUID`, TikTok, Meta `fr`). Session storage holds TikTok, Clarity and a Sentry session-replay key. | Not shown. A **hidden** banner with Manage / Reject / Accept is present in the DOM. |
| bio.link (both pages) | pinterest.com (**Pinterest widget script on every page**, even with no Pinterest content, plus a logging call); fonts.googleapis.com + fonts.gstatic.com (**Google Fonts**); plausible.io (cookieless analytics); its own stats endpoint | **2 cookies**: Cloudflare bot-management `cf_clearance` (1 year, set by an invisible check script) and Pinterest `tst` (third-party). No web storage. | None found |
| Lnk.Bio · official | jsdelivr.net (CSS framework, scripts, **313 KB of icon fonts**); code.jquery.com; fonts.gstatic.com (**Google Fonts**); googletagmanager.com + google-analytics.com (**GA4 in Consent Mode, default "denied"**, which still sends a cookieless ping to Google); cloudflareinsights.com (Cloudflare Web Analytics) | **1 cookie** (`cf_clearance`, 1 year) and 1 localStorage key (an "anonymous id") | Not shown. A **hidden German-language cookie notice** mentioning analytics and ad personalization is present in the DOM. |
| Snipfeed/Planoly · official | googletagmanager.com, analytics.google.com, stats.g.doubleclick.net (**GA4** with Google signals, no consent-mode signal); cloudflareinsights.com; typekit.net (**Adobe Fonts**); fonts.googleapis.com + fonts.gstatic.com (**Google Fonts**) | **4 cookies**: `_ga` and `_ga_*` (400 days), session id, `cf_clearance`. 1 localStorage key (cart). | None found |

Under German law (§ 25 TDDDG) the consent question covers *any* storage on or reading from the device. That includes localStorage and fingerprinting, not just cookies. The cookie counts above therefore understate the footprint that needs consent.

### 3.4 Loading details

| Page | Rendering (content in the first HTML) | HTML (transfer / decoded) | Images | Fonts | Embeds | HTML caching and security headers |
|---|---|---|---|---|---|---|
| Linktree | Server-rendered with Next.js (Pages Router). 125 of 126 link labels are in the raw HTML. Hydration data is embedded in the HTML: **256 KB** on the official page, 63 KB on Clippers. 60+ external script tags. | 85 KB / 623 KB (official); 63 KB / 305 KB (Clippers) | AVIF for most thumbnails, but **one 2.8 MB animated GIF** and Instagram JPEGs of up to 0.83 MB each (1440×1800 shown at 109×136 px). No `srcset` anywhere. 21 of 62 images lazy-loaded. | Own font preloaded from its own host (69 KB). Theme fonts come from Google Fonts. Preconnects to Google Fonts on every page. | Video tiles are **click-to-expand**: no YouTube request before the click (see 4.2). | Fastly/Varnish CDN. **HSTS max-age 300 s** (weak). No CSP. A link header advertises an `llms.txt` for AI agents. |
| Stan | Server-rendered with Next.js (App Router). 9 of 14 link names are in the raw HTML; social icons are named only client-side. | 27 KB / 116 KB | Every image has dimensions and `decoding=async`. All except the LCP image lazy-load, and the LCP image has `fetchpriority=high`. Images are resized per slot through an image CDN (served to us as JPEG). **Best image hygiene in the set.** | Inter self-hosted through the framework, but **5 files, 289 KB**, plus an Adobe Fonts stylesheet. | None | HTML is **`private, no-store`**, so every view hits the origin server. CSP is report-only. HSTS 1 year. |
| bio.link | Server-rendered HTML with inline CSS and JS (138 KB inline script). 5 of 7 labels in the raw HTML. | 61 KB / 228 KB | PNG avatar (300 px shown at 96 px). No lazy loading, no `srcset`, no dimensions. | Google Fonts (Inter and DM Sans stylesheets, one 48 KB file) | Pinterest widget only | **HTML edge-cached at Cloudflare** (HIT). **Enforced CSP.** HSTS 1 year. |
| Lnk.Bio | Classic server-rendered HTML with jQuery and Bootstrap. 6 of 6 labels in the raw HTML. | 15 KB / 71 KB | 512 px PNG avatar (118 KB) shown at 90 px. Thumbnails lazy-loaded by a script. | Roboto from Google Fonts, plus **two Font Awesome icon fonts (313 KB) from jsDelivr** | None | Not edge-cached (Cloudflare DYNAMIC). HSTS with preload. |
| Snipfeed/Planoly | Server-rendered with Next.js (Pages Router). 29 of 29 labels in the raw HTML. | 17 KB / 94 KB | `srcset` and lazy loading on 26 of 27 images (WebP), but **one 1.9 MB GIF** | Adobe Fonts + Google Fonts | None. An email/phone capture **form** sits on the page. | Vercel cache behind Cloudflare. HSTS 2 years. No CSP. |

---

## 4. Patterns observed

### 4.1 Page structure and block types
**The shared anatomy, top to bottom:**
1. Avatar: round, 90–180 px.
2. Name or handle, often with a verified badge.
3. A one-line bio.
4. A row of social icons.
5. A stack of full-width link buttons.
6. A footer that brands the platform.

Every product uses this skeleton. They differ in the extra blocks:

- **Linktree:**
  - A fixed top bar with the platform logo, an email "Subscribe" button and a share button.
  - Optional Home/Shop tabs.
  - Section headings with horizontally scrolling card carousels.
  - An embedded Instagram feed grid. Its images are served through Linktree's own CDN, so no requests go to Instagram.
  - Per-link "⋮" share menus.
  - Music links enriched through the song.link API.
  - Video items that expand in place.
  - Footer: cookie preferences, report and privacy links, plus a "get your own" call to action on the official page.
- **Stan** (a storefront): section headers styled as pills, product cards (image, title, short description, a full-width CTA button) that lead to on-platform product pages, compact link cards, a privacy link and a language switch.
- **bio.link** (minimal): a share button, section labels, pill buttons and a small logo footer. The AC Milan page is effectively a podcast directory of plain links to Apple Podcasts, Amazon Music and Spotify, with no embeds.
- **Lnk.Bio** (minimal): pill buttons with round thumbnails over an illustrated, full-bleed theme background, and a floating "get your page" pill.
- **Snipfeed/Planoly** (editorial): stacked colored panels. Each has a vertical type label (Profile, Link, Featured, Digital product, Contact), a close control, card carousels and an inline **email/phone capture form**.

**Visual hierarchy.** The name is usually the largest text. Buttons are full-width with centered labels and optional left-hand thumbnails (48–50 px). Commerce shows up as cards with a strong CTA color (Stan) or as a separate tab (Linktree).

**Platform self-promotion competes with the creator:**
- Stan pins a bottom "try free" bar, 44 px tall, on every viewport.
- Planoly pins a 54 px bottom upsell bar (it can be dismissed).
- Lnk.Bio floats a "get your page" pill.
- Linktree adds a platform logo button to the top bar and, on desktop, a "view on mobile" QR code.

### 4.2 Loading strategy
- **Server-side rendering is universal.** Everything visible is in the first HTML response, which is why LCP looks good even on throttled connections. The LCP element is the avatar or hero image on 6 of 7 pages and a product image on Stan.
- **What follows the first paint differs a lot:**
  - Linktree hydrates a large React app: 76–83 JS files, about 1.5–1.7 MB compressed, with up to 256 KB of JSON embedded in the HTML. That produced a 4.0 s TBT at 4× CPU and a single long task of 1.2 s.
  - Stan (1.1 MB) and Planoly (0.8 MB) follow the same model.
  - bio.link and Lnk.Bio ship comparatively little JS. bio.link's main-thread work under 4× CPU was about 0.4 s.
- **Images are the biggest weight lever.** Modern formats are partly adopted (AVIF on Linktree, WebP on Planoly and Stan), but oversized sources and animated GIFs dominate transfer: 2.8 MB and 1.9 MB single GIFs, and 1440 px photos in 109 px tiles. Only Planoly uses `srcset` throughout.
- **Fonts:** on 4 of 5 products at least one font comes from Google's CDN, and Stan and Planoly also use Adobe Fonts. Self-hosting exists (Linktree's brand font, Stan's Inter) but is not consistent.
- **Embeds are already lazy.** No page loaded a provider iframe at first paint. Linktree is the best example: a video tile turns into an inline YouTube player only after a click. Even there:
  - the player comes from the standard youtube.com domain, with autoplay;
  - after the click, YouTube set 4 cookies and the browser contacted Google ad domains;
  - the click itself was reported to the Meta pixel;
  - there is no notice before loading.
  
  Linktree also calls the song.link API from the visitor's browser for music links. bio.link loads Pinterest's widget on every page, whether or not it is needed.
- **Edge caching is inconsistent.** bio.link and Planoly serve HTML from the edge cache. Linktree revalidates through its CDN. Lnk.Bio renders dynamically. Stan forbids caching entirely (`no-store`).

### 4.3 Privacy behavior
- **Tracking by default is the norm.** Every page tracked visitors or made third-party requests during load. Ad pixels (Meta, TikTok, Microsoft/Bing) appear on Linktree and Stan. Each Linktree profile loaded a different Meta pixel ID, and the TikTok pixel appeared only on Linktree's own profile. That points to pixels configured per profile. On the LA Clippers page, the brand's pixel fired during page load, about 2.3 s in. In other words, profile owners can add pixels that fire without a consent prompt, at least for US visitors.
- **Consent tooling exists but is geo-gated.** Linktree (a commercial consent manager plus a geo-consent script), Stan (a hidden banner) and Lnk.Bio (a hidden German-language notice) all ship consent UI. None of it appeared for our US IP. Lnk.Bio is the only one that defaults Google's consent signals to "denied", but Google still receives a cookieless ping.
- **Bot protection leaves traces.** bio.link, Lnk.Bio and Planoly run an invisible Cloudflare check that sets a **1-year `cf_clearance` cookie** on ordinary visitors. Linktree loads a script from a subdomain named for browser fingerprinting.
- **Visitor IP addresses leak to third parties through infrastructure, not just trackers:** Google Fonts, Adobe Fonts, jsDelivr, code.jquery.com, Pinterest and the song.link API.
- **Legal footer gaps.** A privacy-policy link was visible on Linktree and Stan profiles only, not on bio.link, Lnk.Bio or Planoly. No page offered an Impressum (legal notice) block. The products are US-centric, and German creators who earn money from their page need one.

### 4.4 Mobile UX
**Primary link buttons are comfortable everywhere:**

| Product | Button height | Gap between buttons | Side gutter |
|---|---|---|---|
| Linktree | 54 px (64 px with a thumbnail) | 14 px | 14 px |
| bio.link | 60 px | 16 px | 20 px |
| Lnk.Bio | 68 px | 7 px | 10 px |
| Stan | 52 px CTAs inside cards | 16–34 px between cards | 17 px |

**Secondary targets are where they fail:**
- Planoly's social icons are 16×18 px, below even the WCAG 2.2 minimum of 24 px.
- Lnk.Bio's icon is 29×16 px, bio.link's are 28×33 px and Stan's are 32×32 px.
- Linktree's footer links are 18 px tall (axe `target-size`) and its per-link share buttons are 24×24 px.
- Linktree's 48×48 social icons are the positive exception. However, they are `<button>` elements that navigate by script rather than real links.

**Sticky elements:** Linktree has a fixed 68 px top bar (logo, subscribe, share). Stan and Planoly have fixed bottom upsell bars of 44 and 54 px. Those cover about 5% and 6% of a 390×844 screen for the whole visit.

**Zoom:** Linktree and bio.link set `maximum-scale=1` / `user-scalable=no`, so visitors cannot pinch to zoom.

### 4.5 Desktop treatment

| Product | What a desktop visitor sees |
|---|---|
| Linktree | A centered card about 580 px wide (buttons about 524 px) floating on a darker tint of the theme color, with a fixed "view on mobile" QR code in the bottom-right corner |
| Planoly | A centered column about 566 px wide over a full-height gradient backdrop |
| bio.link | 680 px buttons on a flat page background; no ambient treatment |
| Lnk.Bio | Very wide 859 px buttons over the illustrated full-bleed background. The lines are too long to scan comfortably. |
| Stan | Switches to a two-column storefront: a sticky profile column on the left and a two-column card grid on the right. This is the cause of its desktop CLS of 0.15–0.20. |

### 4.6 Accessibility (axe-core, automated)
- **On every page:** content sits outside landmarks (axe `region`), and the DOM has **no `<main>` landmark**. axe also reported `landmark-one-main` on Stan, Lnk.Bio and Planoly.
- **Critical:** pinch-zoom disabled through the viewport meta tag on Linktree (both pages) and bio.link (both pages). This affects WCAG 1.4.4.
- **Critical and serious on Planoly:** 7 buttons without names, 1 link without a name, and a phone-country selector without a name inside the capture form.
- **Serious on Linktree:**
  - a tab label with 3.75:1 contrast, where 4.5:1 is required;
  - 5 targets under 24 px.
- **Moderate:** heading levels that skip (Stan), no `h1` at all (Lnk.Bio), 10 `h1`s on one page (Planoly). Several pages repeat a link's text in its image's alt text (minor).
- **Lighthouse accessibility scores** range from 86 to 99. Even 99 (Lnk.Bio) still had no `main` landmark and no `h1`, which shows how little a high score proves.

### 4.7 SEO and sharing
- **Everyone has the basics:** a title, a meta description, `og:image`, a canonical URL, and content and links in the first HTML response.
- **Structured data:** only Linktree ships rich JSON-LD (`ProfilePage`, `BreadcrumbList`, `ImageObject`). Planoly has a bare `WebPage`. Stan, bio.link and Lnk.Bio have none.
- **Social previews:** Linktree generates a dedicated OG image per profile. The others reuse the square avatar, which crops badly in wide link previews.
- **Weak spots:**
  - Stan's description is a generic platform string.
  - Lnk.Bio switches its `lang` attribute to the visitor's browser language (`de` for us) even though the profile content is English.
  - Linktree's social icons are buttons rather than `<a href>`, so they are not crawlable links.
  - Two products mark every creator link `nofollow`.
- **Emerging:** Linktree advertises an `llms.txt` document to AI crawlers.

---

## 5. Weaknesses and opportunities

1. **JavaScript is the real performance problem, not first paint.** The leaders spend 1.1–1.7 MB of JS and 1.8–4.0 s of blocked main thread (TBT≈ at 4× CPU) to render a link list. Lighthouse's mobile Performance scores are 36–54 for Linktree, Stan and Planoly. *Opportunity: a page that is fully usable with zero JavaScript and has TBT≈0. That is easy to demonstrate side by side.*
2. **Privacy by default does not exist in this market.** Every page set cookies or contacted third parties before the visitor had a choice. Two products run ad pixels on their own showcase pages. *Opportunity: "no cookie banner needed because there is nothing to consent to" as a visible, verifiable promise for German creators and their audiences.*
3. **Legal risk from Germany's point of view:**
   - Google Fonts loaded on 4 of 5 products (LG München I, 20 Jan 2022, 3 O 17493/20).
   - Pixels and session replay that fire without a visible banner (at least outside the EU).
   - 1-year bot-management cookies.
   - Missing privacy and Impressum links.
   
   *Opportunity: provide Impressum and privacy blocks out of the box, so creators can comply with DDG § 5 and GDPR Art. 13.* (This is not legal advice. Confirm with counsel.)
4. **Accessibility is neglected.** Zoom is blocked, there are no landmarks, buttons have no names, contrast fails, and secondary targets are tiny. The European Accessibility Act, implemented in Germany as the BFSG since 28 June 2025, raises the stakes once pages sell to consumers. *Opportunity: zero axe violations on every theme, enforced by the theme engine itself.*
5. **Image over-delivery** is common: multi-megabyte GIFs, 1440 px photos in 100 px slots, 512 px PNG avatars shown at 90 px, and little `srcset`. *Opportunity: an automatic image pipeline (AVIF/WebP, correct sizes, video or animated AVIF instead of GIF) with no creator effort.*
6. **Embeds are lazy but not privacy-safe.** There is no notice before loading, no privacy-enhanced domain, and the click is reported to ad pixels. *Opportunity: the German "two-click" pattern, done beautifully.*
7. **Platform upsell overlays cover the creator's content.** Stan's bar is always visible, Planoly's stays until the visitor dismisses it, and Lnk.Bio's pill floats over the page. *Opportunity: a premium product never sells itself on the creator's page beyond a discreet footer credit.*
8. **Desktop is unresolved.** Columns are too wide (680–859 px), layouts jump (Stan's CLS of 0.15), and bolt-ons like QR codes appear. *Opportunity: one elegant 560 px column with an ambient background that comes from the theme.*
9. **Social previews and structured data are underused** outside Linktree. *Opportunity: generated 1200×630 OG images and full JSON-LD for every page, from day one.*
10. **Caching and security hygiene vary:** `no-store` HTML (Stan), a 5-minute HSTS (Linktree), and no enforced CSP except on bio.link. *Opportunity: edge-cached HTML in the EU, purged when the creator publishes, plus a strict CSP that technically enforces the zero-third-party promise.*

**What competitors do well (worth matching):**
- Linktree: rich JSON-LD and per-profile OG images; direct outbound links without redirect hops; click-to-expand video; 48 px social icons; social-feed images proxied through its own CDN.
- bio.link: a tiny, edge-cached page with an enforced CSP.
- Stan: excellent image hygiene and support for `prefers-reduced-motion`.
- Planoly: `srcset` on nearly every image.
- Lnk.Bio: Google consent signals default to "denied" and HSTS is preloaded.

---

## 6. How Linkyo does it better

### 6.1 Commitments at a glance

| Linkyo target | Best competitor measured | Worst competitor measured | Linkyo commitment (release gate) |
|---|---|---|---|
| **LCP < 1.5 s on 4G** | Fast-4G lab: 0.65 s (bio.link); Lighthouse mobile: 3.3 s (bio.link) | Fast-4G lab: 1.39 s (Planoly); Lighthouse mobile: 8.6 s (Linktree) | **≤ 1.5 s under Lighthouse's default mobile simulation**, the strict test that nobody passes today. ≤ 1.0 s in our Fast-4G CDP lab. p75 ≤ 1.5 s in German mobile field data. |
| **CLS 0** | 0.000 (several, mobile) | 0.147 lab / 0.20 Lighthouse (Stan desktop) | **0.000** at 390 px and 1440 px on every theme and block type |
| **JS < 70 KB (basic page)** | 39 KB (bio.link) | 1,731 KB (Linktree) | **≤ 70 KB compressed in total**, with **0 KB required**: a basic page works fully with JS disabled. TBT ≤ 50 ms at 4× CPU. |
| **Lighthouse ≥ 95 (target 100)** | 90 mobile / 97 desktop (bio.link) | 36 mobile (Linktree) | **≥ 95 in all four categories, mobile and desktop**, for every theme. **100/100/100/100** for the default theme's basic page. |
| **Zero cookies, zero third-party requests by default** | 1 cookie and 6 third-party domains (Lnk.Bio); 2 cookies and 4 domains (bio.link) | 23 cookies and 10 domains (Stan) | **0 cookies, 0 web-storage keys, 0 requests to non-Linkyo hosts** until the visitor takes an explicit action |
| **Click-to-load embeds with clean placeholders** | Click-to-expand video with no pre-click requests (Linktree) | Pinterest widget on every page (bio.link) | **0 provider requests before the click.** The placeholder shows a poster served by Linkyo, a provider label and a data notice. Privacy-enhanced provider endpoints are used after the click. CLS 0. |
| **Self-hosted fonts** | Own brand font (Linktree), Inter via the framework (Stan) | Google + Adobe Fonts (Planoly); 313 KB of icon fonts from jsDelivr (Lnk.Bio) | **All fonts from the Linkyo origin.** Subset WOFF2, ≤ 2 files and ≤ 60 KB for the default theme, icons as inline SVG |
| **Server-rendered with JSON-LD and OG images** | SSR, ProfilePage JSON-LD and generated OG images (Linktree) | No JSON-LD, generic description (Stan) | **100% of content and links in the first HTML.** `ProfilePage` JSON-LD with `sameAs`. A 1200×630 OG image generated on publish. Correct `lang`. |
| **44 pt tap targets** | 48×48 social icons (Linktree) | 16×18 social icons (Planoly) | **Every interactive element ≥ 44×44 CSS px** with ≥ 8 px spacing. Primary buttons ≥ 56 px tall. |
| **WCAG 2.2 AA** | Lighthouse accessibility 99 (Lnk.Bio), but no main landmark and no h1 | Zoom disabled (Linktree, bio.link); 7 unnamed buttons (Planoly) | **0 axe violations** (A/AA including 2.2, plus best-practice) on all themes, plus a manual screen-reader pass for each release |
| **Single column, max 560 px** | About 566–580 px (Planoly, Linktree) | 859 px (Lnk.Bio); two-column switch (Stan) | **One column, max-width 560 px, centered at every width.** The ambient desktop background is derived from the theme and needs 0 extra requests. |
| **Per-creator OKLCH themes with contrast guard** | Not observable: editor behavior cannot be seen on public pages | Linktree's own page fails contrast at 3.75:1 | Themes stored as **OKLCH tokens**. Contrast is checked when a theme is saved: 4.5:1 for text, 3:1 for large text, UI and focus. A failing theme cannot be published. |

### 6.2 Commitments in detail

**1. LCP < 1.5 s on 4G, measured with the strict yardstick**
- *Why the strict yardstick:* in a Fast-4G lab every competitor already passes 1.5 s, so that version of the target does not set us apart. Under Lighthouse's mobile simulation (1.6 Mbps, 150 ms RTT, 4× CPU) they take 3.3–8.6 s. We commit to ≤ 1.5 s there.
- *How:*
  - The LCP element is server-rendered text or the avatar.
  - The avatar comes from the page origin, so no extra connection is needed. It is ≤ 20 KB AVIF at 2× its displayed size, preloaded with `fetchpriority="high"`.
  - Critical CSS is inlined, and HTML plus CSS fit in about 14 KB, the first round trip.
  - HTML is cached at an EU edge and purged on publish, with TTFB ≤ 200 ms in Germany.
- *Proof:* Lighthouse CI as the median of 3 runs on fixture pages. A Playwright Fast-4G budget test. Cookieless, aggregate real-user monitoring (p75 by country and device class).

**2. CLS = 0**
- *How:*
  - Every image, embed placeholder and avatar has explicit dimensions or an `aspect-ratio`.
  - Self-hosted fonts use metric-matched fallbacks (`size-adjust`, `ascent-override`).
  - Nothing is injected late: no banners (none are needed), no upsell bars, no layout switch at hydration.
- *Proof:* a CI assertion that the list of layout-shift entries is empty at both viewports.

**3. JS < 70 KB on a basic page**
- *How:*
  - Links, social icons and the footer are plain `<a href>` elements.
  - Sharing uses the Web Share API with a no-JS fallback URL.
  - Interactive blocks (embed activation, checkout, forms) ship as small islands that load when needed.
  - No hydration of static content and no JSON hydration data in the HTML. Linktree ships 256 KB of it on its own profile.
  - Click counting uses a first-party beacon (`navigator.sendBeacon` or `<a ping>`, under 1 KB) with no identifiers. Links stay direct, with no redirect hop.
- *Proof:* a bundle-size budget in CI plus a Playwright assertion on total JS transfer, both third-party and first-party.

**4. Lighthouse ≥ 95, target 100**
- *How:* a consequence of items 1–3 together with item 10 (accessibility) and item 8 (SEO). Best Practices also requires no third-party cookies, no console errors, no deprecated APIs and back/forward-cache compatibility.
- *Proof:* Lighthouse CI on every pull request, for mobile and desktop, across the theme × block-type fixture matrix.

**5. Zero cookies and zero third-party requests by default**
- *How:*
  - **Analytics:** first-party and server-side, aggregated per day. No cookies and no fingerprinting. IP addresses are discarded at ingest after deriving a coarse country. Referrers are reduced to their domain.
  - **Bot protection:** no client-side challenge scripts or clearance cookies on public pages. Abuse is handled with edge rate limiting.
  - **Infrastructure:** no public CDNs, no Google or Adobe Fonts, no library CDNs.
  - **Creator pixels:** an opt-in feature per creator. Off by default, never fired before a real consent dialog, and the dialog appears only on those pages.
  - **Enforcement:** a strict Content-Security-Policy (`default-src 'self'` plus Linkyo's own media host) makes a leak a broken build rather than a silent regression.
  - **Outcome:** a default Linkyo page needs **no cookie banner** under § 25 TDDDG. That is a visible and verifiable selling point.
- *Proof:* a CI test that loads fixture pages and asserts `cookies.length === 0`, that web storage is empty, and that every request host is on an allowlist. A scheduled production canary does the same.

**6. Click-to-load embeds with clean placeholders (two-click pattern)**
- *How:*
  - At edit time, the server resolves embed metadata: title, poster and duration.
  - The visitor gets a static placeholder: a poster served by Linkyo, the title, a provider label and a one-line notice that loading shares data with the provider. It is a keyboard-accessible button.
  - The provider iframe is created only after the click, using privacy-enhanced endpoints where they exist (for example `youtube-nocookie.com`).
  - Music and link previews never call third-party APIs from the visitor's browser.
- *Proof:* a CI test asserting 0 requests to embed-provider hosts before the click, and CLS 0 when the embed activates.

**7. Self-hosted fonts**
- *How:*
  - WOFF2 served from the Linkyo origin, subset to Latin, Latin-1 Supplement and Latin Extended-A (covering ä, ö, ü, ß, € and typographic quotes).
  - The default theme uses ≤ 2 files and ≤ 60 KB.
  - `font-display: swap` with a metric-matched fallback.
  - A system font stack is offered as a 0 KB option.
  - Icons are inline SVG, never icon fonts.
- *Proof:* covered by the request allowlist in item 5, plus a font-bytes budget.

**8. Server-rendered, with JSON-LD and OG images**
- *How:*
  - All text and links are in the first HTML, so the page works with JavaScript disabled.
  - `ProfilePage` JSON-LD whose `mainEntity` is a `Person` or `Organization` with name, image, description and `sameAs` links to the social profiles, plus `BreadcrumbList`.
  - A 1200×630 OG image (under 100 KB) generated on publish, with `og:*` tags and `summary_large_image`.
  - A canonical URL.
  - `lang` set from the creator's content language, not from the visitor's Accept-Language header.
  - A meaningful description.
  - Optionally, `llms.txt` and sitemap support.
- *Proof:* a raw-HTML test (every link label is present without JS), schema validation, and an OG-image snapshot test.

**9. 44 pt tap targets**
- *How:* social icons have a 44×44 px hit area even when the glyph is 24 px. Footer links are padded to 44 px. Primary buttons are at least 56 px tall with a 12 px rhythm. There are no tiny "⋮" menus; sharing lives in one place.
- *Proof:* a custom Playwright assertion that no visible interactive element is smaller than 44×44, plus axe `target-size`.

**10. WCAG 2.2 AA**
- *How:*
  - Landmarks: `header`, `main`, `footer`.
  - Exactly one `h1` (the creator name) and a logical order for section headings.
  - Icon links get accessible names such as "Instagram: @handle".
  - A visible focus ring with ≥ 3:1 contrast.
  - Animated avatars and backgrounds respect `prefers-reduced-motion`.
  - Zoom is never disabled; content reflows at 320 px width and 400% zoom.
  - Forms have labels and errors linked to their fields.
- *Proof:* 0 axe violations across the theme × block matrix in CI, plus a manual VoiceOver (iOS) and TalkBack pass for each release.

**11. Single column, max 560 px**
- *How:* one centered column, `max-width: 560px`, and the same reading order on every device. On wide screens the theme continues into an ambient background (gradient or blur derived from the theme's OKLCH tokens, with no extra request). There are no QR codes or side panels by default.
- *Proof:* visual regression snapshots at 320, 390, 768 and 1440 px.

**12. Per-creator OKLCH themes with a contrast guard**
- *How:*
  - A theme is a small set of OKLCH tokens: background, surface, text, muted text, accent and focus.
  - On save, the editor computes WCAG 2.x contrast for every text/background and UI/background pair. If a pair fails, it adjusts lightness (L) automatically while keeping hue and chroma, and shows the creator what changed.
  - A failing theme cannot be published.
  - A dark-mode variant is derived automatically. APCA is reported as advisory.
- *Proof:* unit tests for the theme generator (property-based across random palettes), plus axe `color-contrast` on theme fixtures.

**Germany-first extras we did not see on any measured page:**
- Built-in **Impressum** and **privacy** footer blocks with large tap targets.
- German-quality typography (hyphenation, „Anführungszeichen“).
- EU-only hosting and processing.
- A public "what this page loads" transparency note.

### 6.3 Release gates to wire into CI
1. Playwright privacy test: 0 cookies, empty web storage, and every request host on the allowlist (mobile and desktop).
2. Playwright performance test with the Fast-4G profile and 4× CPU: LCP ≤ 1.0 s, CLS = 0, TBT≈ ≤ 50 ms, JS ≤ 70 KB, HTML+CSS critical path ≤ 14 KB.
3. Lighthouse CI as the median of 3 runs: all four categories ≥ 95; 100 for the default theme's basic page.
4. axe-core with 0 violations, plus the 44×44 tap-target assertion, on every theme × block fixture.
5. Raw-HTML SEO test: labels and links present without JS, JSON-LD valid, OG image generated, canonical and `lang` correct.
6. Embed test: 0 provider requests before the click.
7. Theme contrast unit tests.

---

## 7. Appendix: how to reproduce

The scripts and raw evidence were deliberately kept **outside this repository**, in a scratch workspace. The approach below is enough to rebuild them.

**Environment**
- Node 22, Playwright 1.63 (bundled Chromium, Chrome for Testing 153).
- axe-core 4.10.2 and Lighthouse 12.8.2, both installed locally with `npm install` into the scratch folder. Nothing was installed globally.
- Ideally, re-run from a German IP with direct internet access. With no TLS-terminating proxy, HTTP/2 and HTTP/3 work and the EU consent experience is visible.

**Scripts (in the scratch folder)**
1. **probe**
   - Loads each candidate URL once with the fixed desktop profile.
   - Records status, final URL, title and visible text, and detects bot challenges: a "Just a moment / security verification" title or text, challenge markup, or a `cf-mitigated: challenge` header.
   - Challenged URLs are only recorded, never retried.
2. **measure** (the harness). For each page and each of the 9 passes:
   - Launch a fresh browser and create a new context with the viewport profile and the `de-DE` / `Europe/Berlin` locale.
   - `addInitScript` registers PerformanceObservers for LCP, layout shifts (session-window CLS), paint and long tasks.
   - A CDP session runs `Network.enable` and `Performance.enable`. Throttled passes also set `Network.emulateNetworkConditions` {latency 165 ms, down 1,012,500 B/s, up 168,750 B/s} and `Emulation.setCPUThrottlingRate` {rate 4}.
   - Context-level `request` / `requestfinished` / `requestfailed` listeners record URL, resource type, timing, status, MIME type and `request.sizes()` (encoded body plus headers). Full passes also record the decoded size of scripts, styles and documents.
   - `page.goto(url, {waitUntil: 'load'})`, then a challenge check: if challenged, take a screenshot and stop that page.
   - Wait for 2 s of network quiet (cap 15 s, or 30 s throttled), then read the vitals and CDP `Performance.getMetrics`.
   - Take the privacy snapshot: cookies (names, domains, lifetimes), web-storage key names and IndexedDB names, with no values.
   - Full passes only:
     - run a consent-banner probe (fixed or sticky overlays with consent wording, including open shadow roots, plus known consent-manager selectors);
     - take an above-the-fold screenshot;
     - analyze the raw HTML (framework fingerprints, link labels present outside `<script>`, inline JSON size, SEO tags);
     - scroll once to the bottom and back;
     - inject axe-core via CDP `Runtime.evaluate` (so the page's CSP is not altered) and run it with `iframes: false` and `target-size` enabled;
     - run the DOM audit (interactive targets with sizes and styles, headings, images, iframes, forms, fixed/sticky elements, background layers, fonts, meta tags, landmarks);
     - take a full-page screenshot.
   - Write one JSON file per page.
3. **analyze**: aggregates everything into one metrics JSON. It takes medians across runs, splits bytes by type, classifies third-party domains with a category table (analytics, ads/pixels, session replay, tag manager, consent management, fonts, embeds, CDN, bot protection, feature flags), separates 1P and 3P cookies, summarizes tap targets and images, and counts axe results by impact.
4. **embed click check**: one load of one Linktree brand page and one click on a video tile. It compares iframes, request hosts and cookies before and after the click.
5. **network baseline**: curl timings (connect, TLS, TTFB) through the same network path, 3 per host. bio.link and lnk.bio answer plain curl with a 403 challenge. For those hosts only the connection and TLS timings were used, never the content.
6. **lighthouse runner**: launches the same Chromium through `chrome-launcher` and runs Lighthouse's Node API with the default mobile and desktop presets for categories performance, accessibility, best-practices and seo. It saves scores, metrics and failing audit IDs.

**Definitions used**
- **Request window:** from navigation start until 2 s without network activity, with no interaction.
- **Third-party domain:** a registrable domain not operated by the platform. Operator-owned asset domains count as first-party for request statistics. Cookies are classified strictly by the visited site.
- **TBT≈:** the sum of (long-task duration − 50 ms) for long tasks that start after FCP, within the window.
- **"Content in the initial HTML":** the share of visible link labels found in the server HTML after removing `<script>` and `<style>`.

**Ethics guardrails built into the scripts**
- One fixed profile per viewport, with no user-agent switching.
- Stop on any challenge, with no retries.
- No form input and no consent clicks. The single click in this study was on a video tile.
- No asset downloads beyond what the page itself loads.
- All output written outside the repo.
