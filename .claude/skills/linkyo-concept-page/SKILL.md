---
name: linkyo-concept-page
description: Create or update a concept page for a real, well-known person in Linkyo (apps/web/src/features/previews/stars*). Use when asked for a celebrity, athlete, artist, politician or creator page, or to update one's facts, photos, videos, colors or sections.
---

# Linkyo concept pages (well-known people)

These are unofficial pages showing how a real person's Linkyo page could look. They are labelled
"Concept · {name}", never verified, `noindex`, and listed under "Well-known people" in /templates.
Read ADR 0020 first. Personality rights in Germany (KUG § 22) make accuracy and labelling
non-negotiable.

## Files

| What | Where |
|---|---|
| Model and page builder | `features/previews/stars.ts`, `Star` and `starPage(star, locale)` |
| Data (all people) | `features/previews/stars-data.ts`, `STARS` |
| Look and kind (browser-safe) | `features/previews/stars-looks.ts`, `STAR_LOOKS` |
| Photos | `src/assets/stars/*.jpg`, `features/previews/stars-media.ts`, `src/assets/stars/CREDITS.md` |
| Registration | `features/previews/registry.ts` (spreads `STARS`) |
| Tests | `features/previews/stars.test.ts`, `e2e/stars.spec.ts` |

## Facts and sources

- **Facts:**
  - Every fact needs a current, reputable source (Wikipedia, the official site, major outlets).
    Note the date: facts age.
  - Politicians: neutral, official facts only.
- **Social links:** official accounts only, confirmed by the official site, Wikidata or Wikipedia.
  When in doubt, leave the link out.
- **Videos:**
  - official uploads or the rights holder's highlights only;
  - check each ID with `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<id>&format=json`,
    which must show the expected channel as `author_name`;
  - `videoPlayback: "preview"` gives "30 s here, then YouTube".
- **Photos:**
  - Wikimedia Commons with a free license (CC BY, CC BY-SA, public domain);
  - read the file page and credit the author and license on the page (`credit`) and in `CREDITS.md`;
  - crop around the face (`images[].crop`);
  - a video thumbnail from the person's official upload is allowed for story cards.

## One language per page

- Every caption is `{ de, en, ar }`.
- Articles appear only on the page in their own `language`. A test fails on Arabic text in de/en
  pages and on foreign articles.

## Sections

The available sections, in page order:

1. `highlights` (one primary button with a subtitle);
2. `website`;
3. `spotlight` (a featured story, a video, stories);
4. `videos`;
5. `career`;
6. `linkGroups` (companies or projects with icon and subtitle);
7. `gallery`;
8. `works`;
9. press (`articles`).

Pick colors from the person's identity and add a swatch if needed (see `linkyo-design-tokens`).

## Done when

```bash
cd apps/web && npx vitest run src/features/previews && npx eslint src && npx tsc --noEmit -p .
pkill -f next-server; npx next build
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test e2e/stars.spec.ts --project desktop --project mobile --trace off
```

Screenshot the page in de, en and ar at 390 px and check the colors, crops and that each page uses
only its own language.

## If the page is in the hero deck

Nine concept pages take turns on the homepage (`CONCEPT_SHOTS` in `src/features/marketing/examples.ts`,
ADR 0045). The deck shows pictures of them, not the live pages. After any change to one of these pages
(look, photo, name, top sections), retake its three pictures against the running production build:

```bash
cd apps/web && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/capture-example-shots.mjs concept:<slug>
```

- A new page in the deck also needs its line in `CONCEPT_SHOTS` (the order there is the deck's order;
  keep neighbours different) and a 192 × 192 face crop in `src/assets/marketing/concepts/faces/`.
- Then rebuild and run `e2e/home.spec.ts`.
