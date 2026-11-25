# draft — The home page loads fast on phones

**Status.** Proposed (Stage 4, WP4.3b, 2026-11-25). Completes [ADR 0008](0008-public-page-rendering.md)'s
revision for the home page: its HTML is under the 60 KB budget again, and 0008's consequence "`/de` is over its
budget at this revision" no longer holds.

**Context.** After WP4.3 and WP4.2 (`614fab6`), `/de` was 72.2 KB of HTML (gzip) in the demo build and 73.4 KB
in the build with real accounts, against 60 KB; Lighthouse mobile gave it 0.75 on WP4.3's run (LCP 5.8 s). About
half of the HTML was markup and half the React Server Components payload, and both carried the same heavy parts: a
blurred preview per bundled picture (6.9 KB), `srcset` lists up to 3840 px for pictures 640 px wide, the website's
client words (9.4 KB, with the words of an AI tab that never shows), whole creator themes for small cards, and the
playground's two hidden panels. The first screen's largest picture (its LCP), the hero deck's page in front,
arrived at 81 ms and showed at 920 ms: the deck faded in, and a picture that starts transparent counts only once
it shows. Lighthouse's simulation then counts every request that finished before that moment (35 scripts, six
typefaces, nine deck pictures) as needed for the LCP.

**Decision.**

1. **The home page's pictures carry no blurred preview.** The frame's token colour (`bg-canvas-muted`,
   `bg-surface`) shows until a picture is there. `Picture` (`features/marketing/picture.tsx`) draws next/image's
   own attributes (`getImageProps`) and preload. It is a client module: a server component passes a picture's
   address, size and layout only (`source()` drops the preview), and the `srcset` is written from them.
2. **A `srcset` ends at the picture's own width** (`trimSrcSet`): every width below it and the first at or above
   it. The optimizer never enlarges, so every wider entry was the same picture under a longer address. Nothing
   changes on screen at any density.
3. **The first screen's largest picture paints with the first screen.** The hero deck settles in place without
   fading (`mk-settle`, as the site pages' and the gallery's headlines already do). Reduced motion still shows
   it without an entrance. Its two hidden pages fetch their pictures once the page in front has its own, with the
   other pages out of sight, so nothing hidden competes with it.
4. **What lies below the first screen comes when it comes near.** The playground draws its links and looks panels
   a screen ahead (as its phone) or when their tab is chosen; the panels share one cell of a fixed height. The
   story picture's font probes appear when it is drawn, and it draws once every face they asked for is there
   (`document.fonts.ready`), so it is the same picture every time. The looks' typefaces and Inter no longer load
   with the first screen.
5. **Islands get only what they read.** The website's words (`CLIENT_NAMESPACES.site`) carry the AI run's words
   only when the AI tab can show (`TRY_AI_ANY`), and a portfolio's island words only, as creator pages do
   (`CREATOR_ISLANDS`). The look cards and the story picture get the theme variables they read
   (`features/marketing/theme-vars.ts`, checked against their classes by a test).
6. **The JSON-LD sits right after the FAQ**, whose questions and answers it repeats: compression finds them again.
7. The playground's phone carries out a scroll request once it has measured itself (a request made before its
   code had arrived was lost; seen once in a full-height capture).

**Measured** (gzip, 1 KB = 1,000 bytes; the demo build and the real-account stand-in with payments on, built as
`e2e/stub-app.spec.ts` says; Lighthouse 13.6.0 mobile, before and after interleaved on one machine, median of
three runs each, 1-minute load 1.1 to 2.3):

| | before (`614fab6`) | after | budget |
|---|---|---|---|
| HTML `/de` (demo) | 72.2 KB | 53.5 KB | 60 KB |
| HTML `/en`, `/ar` (demo) | 70.3 KB, 76.4 KB | 52.0 KB, 56.7 KB | |
| HTML `/de` (real accounts) | 73.4 KB | 54.3 KB | 60 KB |
| HTML `/en`, `/ar` (real accounts) | 71.5 KB, 77.6 KB | 52.8 KB, 57.6 KB | |
| typefaces with the first screen of `/de` | 7 (284 KB) | 2 (114 KB) | |
| Lighthouse `/de`: performance, LCP, TBT, CLS | 0.73, 5.7 s, 226 ms, 0 | 0.80, 3.7 s, 265 ms, 0 | |
| Lighthouse `/ar`: performance, LCP, TBT, CLS | 0.59, 8.8 s, 604 ms, 0 | 0.80, 4.0 s, 325 ms, 0 | |

**What stops 0.9.** The LCP picture is now painted with the first frame (observed LCP = FCP, about 0.2 s), but
for an LCP that is a picture Lighthouse's simulation counts every request that had finished by then as needed for
it, at 1.6 Mbit/s: the HTML (54 KB), the stylesheet (37 KB), the site's typeface (Geist, 70 KB), the deck's
pictures on screen and its faces (about 120 KB) and, in runs where they are evaluated before that frame, the page's
scripts (260 KB: 136 KB framework, 124 KB page code). That gives an LCP of 3.4 to 4.6 s from run to run. Under
2.5 s needs a lighter first load: less script (besides the islands themselves the page code holds an icon chunk
of about 24 KB and creator renderer parts of about 21 KB; the playground's own chunk is about 11 KB, so hydrating
it on visibility alone would not get there) or a smaller site typeface, which belongs to the site's fonts, not to
this package.

**Consequences.**

- While a picture loads its frame shows a flat colour instead of a blur; the deck no longer fades in. At rest the
  page is unchanged (full-height captures at 390, 1440 and 1920 px in German and Arabic, compared pixel by pixel).
- A look card's typeface can swap in when the playground is reached very fast (it loads a screen ahead).
- What is left of `/de`'s HTML: the website's client words (7.4 KB), class lists in markup and payload, inline
  SVG paths (the Linkyo wordmark three times, Instagram, TikTok and YouTube twice), the server-rendered sections'
  payload. A new island reading a namespace, or a new section, counts against the 60 KB.
