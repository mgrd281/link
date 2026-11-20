---
name: linkyo-example-page
description: Add or improve a fictional example page in the /templates gallery of Linkyo (apps/web/src/features/examples). Use when asked for a new template, example, demo page or gallery category, or to change an example's look, photos, buttons or moving picture.
---

# Linkyo example pages (template gallery)

Example pages are **fictional** people and businesses. Each has its own look and language, is
labelled "Example · {category}" and is `noindex`. See ADR 0019, 0021, 0022 and 0024.

## Files

| What | Where |
|---|---|
| Look, kind, category, language | `features/examples/looks.ts`, `LOOKS` (every theme JSON must be unique) |
| Page content | `features/examples/catalog-a.ts`, `-b.ts`, `-c.ts`, using `examplePage(slug, locale, persona, h => [...])` |
| Helpers | `features/examples/build.ts`: `h.link`, `h.card`, `h.product`, `h.video`, `h.music`, `h.events`, `h.gallery`, `h.newsletter`, `h.mail`, `h.call`, `h.socials`, `h.app` (icon, rating, pricing, stores, code), `h.repo` (a skill or repository with stars, language, license) |
| Pictures | `src/assets/examples/ex*-name.jpg`, listed in `features/examples/media.ts` (`"sample:<file>"` → static import) |
| Moving pictures | `public/media/motion/<name>.mp4`; persona `motion: "<name>"`, photo = the clip's first frame |
| Credits | `src/assets/examples/CREDITS.md` (one row per photo or clip) |
| Categories | `CATEGORIES` in `looks.ts` plus `examples.categories.*` in `src/messages/{de,en,ar}.json` |
| Category icon | `CATEGORY_ICONS` in `features/examples/gallery-card.tsx` (one lucide icon per category; TypeScript fails without it) |
| Gallery UI | `gallery.tsx` (search, chips, grid, preview), `gallery-card.tsx` (card face, tilt), `gallery-showcase.tsx` (moving wall: `pickShowcase` takes one page per category in turn, never real people). See ADR 0029 |

## Rules

- **Fictional only.** Links go to `https://example.com/<slug>/<path>` (enforced by
  `catalog.test.ts`). Phone `tel:+49300000000`, mail `<box>@example.com`. Store links and install
  commands too (`h.app`, `h.repo` do it): a demo must never install a real stranger's code.
- **Apps with a partner code** are advertising: `affiliate: true` shows the label under the name.
- **One language per page.** All texts in the page's locale. Arabic pages are RTL; avoid a dash
  between Arabic text and numbers (bidi), use «،» instead.
- **Buttons** (ADR 0022):
  - exactly one `highlight: true` primary action;
  - give links an `icon` (curated `LINK_ICONS`) and a short `subtitle` such as "20 Min. · kostenlos"
    (the example.com address says nothing);
  - keep titles to two lines and subtitles to one.
- **Advertising.** Affiliate links and products need `affiliate: true`, which shows the
  "Anzeige"/"Ad" label (UWG § 5a).
- **Photos:**
  - Unsplash License only, checked on each photo's own page (reject Unsplash+);
  - download from `images.unsplash.com` (never the internal `unsplash.com/napi`);
  - no brand logos as the subject, adults only, no celebrities;
  - resize to 1200 px and add the credit row.
- **Clips:**
  - Mixkit "Stock Video Free License" only, checked per clip page (reject "Restricted");
  - cut with ffmpeg from the 1080p source: crop 4:5 around a face, scale to 720 × 900, a 5–7 s loop
    whose end crossfades into its start, `-an`, H.264 `-movflags +faststart`, under 1 MB;
  - the poster is the first frame.
- **Order on the page:** primary action, then contact, offers or products, proof (case studies,
  stats), content (videos, articles), newsletter, transparency note.

## Done when

```bash
cd apps/web && npx vitest run src/features/examples && npx eslint src && npx tsc --noEmit -p .
pkill -f next-server; npx next build
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test e2e/templates.spec.ts --project desktop --project mobile --trace off
```

Then look at the page at 390 px wide (Playwright screenshot) in its language before calling it done.
