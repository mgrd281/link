# 0008 — Public creator page rendering (Phase 1 spike)

**Context.** Spec: JS < 70 KB, LCP < 1.5 s on 4G, CLS 0, Lighthouse ≥ 95. Phase 0 prototypes render through the App
Router with client islands: Lighthouse mobile 90–99, CLS ≤ 0.03, but **205 KB JS** (React + Next runtime + islands).
The reference analysis shows competitors at 39 KB–1.7 MB.

**Proposal.** Render public pages with the same React renderer components to **static HTML on the server**
(`react-dom/server` in a Route Handler or build step, cached as ISR with tag revalidation), inline critical CSS
(Tailwind compiled per renderer), and ship ~3 KB of vanilla islands: click-to-load embeds, newsletter form, analytics
beacon (`sendBeacon`). Fonts: only the active pairing, preloaded, `size-adjust` fallbacks. The dashboard preview keeps
using the React components directly → still "the real renderer".

**Spike exit criteria.** JS ≤ 10 KB, Lighthouse 100/100/100/100 on the three direction pages, identical HTML output in
dashboard preview and public page (snapshot test).

## Revision (Stage 4, WP4.3, 2026-11-25): the budget restated as page code

**What changed.** The spike's separate static renderer was never built: creator pages render through the App Router
with the same React components as the dashboard preview. The 10 KB and 70 KB figures counted all script, the
framework included (React, React DOM and Next's router, about 136 KB gzip that every route loads and the browser
caches), so they could not be met by any App Router page. The audit (E-01 to E-04, E-07) measured 157.6 KB of page
code on `/u/<name>` and 180.9 KB on `/<locale>/p/<slug>`, a 605 KB first load on `/app` with Supabase's library in a
demo build, 119 KB of HTML on `/de` and link preview cards of up to 995 KB, and nothing stopped them from growing. The
budgets are now stated as page code and checked on every build.

**Page code** is the gzip size of the JavaScript a route's HTML loads (the client entry chunks of its layouts, page
and boundaries) minus the framework (`rootMainFiles` in Next's build manifest and Next's own client entries).

**Decision.**

1. **Budgets** (gzip at zlib's default level; 1 KB = 1,000 bytes):
   - creator pages (`/u/<name>`, `/u/<name>/<project>`, `/<locale>/p/<slug>`, `/<locale>/p/<slug>/<project>`): page
     code at most 35 KB;
   - the dashboard (`/<locale>/app`): first load (framework and page code) at most 350 KB, and a demo build ships no
     Supabase code to any `/app` route;
   - the home page (`/de`): its HTML at most 60 KB;
   - every prerendered link preview card: at most 300 KB.
2. **Creator pages are server components with small islands.** Only the parts that need the browser ship script: the
   picture viewer (on its first press), the rail buttons, the privacy notice, the players, share, copy, the live
   badge and events, the motion toggle, the Linkyo bar, and `Unblur` (next/image's after-load clean-up). Islands join
   class names with `cx`, not `cn` (tailwind-merge and the token object stay on the server); pictures are next/image's
   attributes without its client component (`PlainImage`); Laufbahn's client parts load with Laufbahn's pages only.
   In Turbopack a `next/dynamic` in a server component does not split client code off: a lazily loaded part needs a
   client module that imports it.
3. **Words per route group.** A layout passes its client components only the namespaces they read
   (`CLIENT_NAMESPACES` in `src/i18n/client-messages.ts`, one constant to extend; e2e/portfolio-perf-app.spec.ts fails on
   a missing message).
4. **The dashboard** loads the Supabase store and client only with real accounts, the QR code, the story picture, the
   profile form and the sheets when they open, and keeps Zod out of its first load.
5. **Link preview cards** with photos are JPEG at quality 80 (`features/share/jpeg.ts`; next/og writes PNG only).
6. **Gates.** `apps/web/scripts/check-route-budgets.mjs` reads the build and fails on any budget above; CI runs it after
   the demo build and after the build with real accounts. `lighthouserc.json` measures `/de/p/ronja-feldkamp`,
   `/de/p/ronja-feldkamp/hafenlicht` and `/ar/p/elena-novak` on the mobile preset with performance at least 0.9 as an
   error, and `/de` and `/de/templates` as warnings. e2e/portfolio-perf-app.spec.ts measures what a creator page really
   loads (the same page code, from the browser) and that its islands still work.

**Measured** (demo build; before restated with the final counting, see the script's header):

| | before | after | budget |
|---|---|---|---|
| page code `/u/<name>` | 157.6 KB | 29.9 KB | 35 KB |
| page code `/u/<name>/<project>` | 102.9 KB | 23.0 KB | 35 KB |
| page code `/<locale>/p/<slug>` | 180.9 KB | 31.7 KB | 35 KB |
| page code `/<locale>/p/<slug>/<project>` | 127.6 KB | 26.1 KB | 35 KB |
| first load `/<locale>/app` | 605.3 KB | 319.6 KB | 350 KB |
| `/app` routes with Supabase code (demo) | 16 | 0 | 0 |
| HTML `/de` | 119.2 KB | 67.4 KB | 60 KB |
| largest link preview card | 994.8 KB | 233.1 KB | 300 KB |

**Consequences.**

- A change that makes a creator page, the dashboard or the home page heavier fails CI; the budget is raised only by
  a decision here.
- `/de` is over its budget at this revision: what remains is the home page's own content (inline SVG paths, blur
  placeholders and responsive image lists, the hero deck's props). The gate fails until it is smaller.
- A new island on creator pages counts against 35 KB; a client component that starts reading a namespace adds it to
  its route group's list.

**Status.** Revised (Stage 4, WP4.3); the spike's proposal above is superseded by this revision.
