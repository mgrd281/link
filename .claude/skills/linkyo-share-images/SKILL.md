---
name: linkyo-share-images
description: Build or change Linkyo's generated pictures, the link preview cards (Open Graph, next/og with Satori) and the story/post pictures drawn on a canvas in the dashboard. Use when a shared link looks wrong in WhatsApp, X, iMessage or LinkedIn, when adding a preview card for a new route, when changing the story picture, or when Arabic text breaks on a card.
---

# Linkyo share images

See ADR 0027. Two renderers, two rule sets.

| Picture | Where | Renderer |
|---|---|---|
| Page preview card 1200 × 630 | `src/app/[locale]/p/[slug]/opengraph-image.tsx` → `features/share/og-card.tsx` | Satori (`next/og`), at build time |
| Site preview card | `src/app/[locale]/opengraph-image.tsx` → `features/share/brand-card.tsx` | Satori, at build time |
| Story 9:16 and post 4:5 | `features/app/share-image.tsx` → `features/share/story-card.ts` | `<canvas>` in the browser |

## Satori rules (learned the hard way)

- **Fonts must be TTF or WOFF**, never WOFF2.
  - Use `geist/dist/fonts/geist-sans/*.ttf`, plus `@fontsource/*/files/*-400-normal.woff` for
    Anton, Instrument Serif and Plex Arabic.
  - Variable fontsource packages only ship WOFF2. Fall back as in `DISPLAY` / `FALLBACK_DISPLAY`.
- **No React fragments** (`<>…</>`) inside the layout. Satori places their children wrongly (a
  headline slid under the photos). Use a real `div` with `display: "flex"`.
- **Every `div` with more than one child needs `display: "flex"`.** Use `<img>` with
  explicit `width`/`height`. There are no CSS filters or variables, so colors come from the
  resolved theme or `tokens`.
- **File reads use literal, scoped paths**, for example
  `readFile(join(process.cwd(), "node_modules/geist/…"))`. A dynamic path makes Turbopack trace
  the whole project into the server bundle (build warning). Truly dynamic reads, such as photos by
  key, get `/*turbopackIgnore: true*/` and are only allowed because the cards are static
  (`generateStaticParams` + `dynamicParams = false`).
- **Arabic:** Satori shapes letters but has only partial bidi. Use `RtlText` from `og-card.tsx`:
  - Plain spaces → words laid out left to right with huge gaps.
  - Words joined by no-break spaces → one run, correct right-to-left order, natural spacing.
  - Neutral signs ("·") inside an Arabic run get misplaced, so they are their own run.
  - Long Arabic runs are over-measured, so keep Arabic lines short (one-line names, short promise).
  - Never judge Arabic word order by eye. Measure it:
    `node .claude/skills/linkyo-share-images/scripts/rtl-probe.mjs "ب الاستقلال"`, then
    `python3 .claude/skills/linkyo-share-images/scripts/rtl-measure.py`. It prints each word's
    x-position and width, so a short word next to a long one tells you the order.
- **Labels:** examples and concept pages must say so on the card too (`sampleBadge`,
  `conceptBadge`).

## Canvas rules

- Read the page's real font stacks from hidden probe elements inside `themeStyle(theme)`, because
  a canvas can't resolve CSS variables. Then call `loadFaces()` before drawing.
- The sheet mounts its content after opening, so keep canvas and probe in state (callback refs) and
  draw when both exist.
- Clip the photo band before drawing (`rect` + `clip`), or the image spills below the fade.
- Share with `navigator.canShare({ files })`, falling back to a download.

## Lint

`opengraph-image.tsx` and `features/share/*-card.{ts,tsx}` are exempt from
`linkyo/no-raw-design-values`: they hold pixels on a fixed canvas. Keep UI code out of those files.

## Verify

```bash
cd apps/web && npx next build   # must print no "Dynamic filesystem access" warning
curl -s localhost:3100/de/p/nela-voss | grep -o '<meta property="og:image[^>]*>'
curl -s -o card.png localhost:3100/ar/p/adam-nour/opengraph-image   # then look at it
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test -g "link previews|picture to post" --project desktop --project mobile --trace off
```

Look at a contact sheet of de, en and ar cards before calling it done. After deploy, fetch the
live `og:image` URL. WhatsApp caches previews, so a fresh message may take a minute.
