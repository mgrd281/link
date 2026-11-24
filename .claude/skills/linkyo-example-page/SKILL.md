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
| Page content | `features/examples/catalog-a.ts` … `catalog-i.ts` (registered in `catalog.ts`), using `examplePage(slug, locale, persona, h => [...])` |
| Name checks | `features/examples/name-check.md` (queries, results, decisions) |
| Helpers | `features/examples/build.ts`: `h.link`, `h.card`, `h.product`, `h.video`, `h.music`, `h.events`, `h.gallery`, `h.newsletter`, `h.mail`, `h.call`, `h.socials`, `h.app` (icon, rating, pricing, stores, code), `h.repo` (a skill or repository with stars, language, license) |
| Pictures | `src/assets/examples/ex*-name.jpg`, listed in `features/examples/media.ts` (`"sample:<file>"` → static import) |
| Moving pictures | `public/media/motion/<name>.mp4`; persona `motion: "<name>"`, photo = the clip's first frame |
| Credits | `src/assets/examples/CREDITS.md` (one row per photo or clip) |
| Categories | `CATEGORIES` in `looks.ts` plus `examples.categories.*` in `src/messages/{de,en,ar}.json` |
| Category icon | `CATEGORY_ICONS` in `features/examples/gallery-card.tsx` (one lucide icon per category; TypeScript fails without it) |
| Gallery UI | `gallery.tsx` (search, chips, grid, preview: a pull-to-close sheet on phones), `gallery-card.tsx` (card face, tilt). The hero shows `marketing/page-wall.tsx`, the sign-in screen's tilted wall of page captures, standing still (ADR 0057; the pages are `WALL` in `marketing/examples.ts`). See ADR 0029 |

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
- **Names are web-checked** before use: the full name with the city and the profession, then the name
  alone; repository and package names on GitHub and npm too. Record queries, results and the decision
  in `features/examples/name-check.md`. A real public person with that name and profession means
  another name.

## Portfolio examples (people who show work)

The gallery's `portfolio` category (it feeds `/portfolio` and the homepage band) holds one fictional
person per portfolio template: Ronja, Tobin, Naya, Jorinde (`catalog-h.ts`, Werkbogen and Tiefdruck),
Jonas and Arjun (Folio), Merle Kastorf, Rana Al-Khatib and Ines Vasconcelos (`catalog-i.ts`:
Leuchttisch, Grundriss, Logbuch). The full checklist is in `linkyo-portfolio` ("Add an example
person"); the essentials:

- **Helpers:** `h.project(title, sentence, { slug, client | confidential, role, year, tags, cover,
  results, story, pictures, links, source, code })`, `h.about`, `h.clients` (names, never logos),
  `h.quotes` (consented, optionally tied to a project), `h.tools`, `h.timeline`, `h.contact` (the page's
  one primary action), `h.repo`. Persona `portraitOnly: true`: a portfolio opens with the work.
- **Pictures** are `ex-pf-<name>-NN.jpg`, listed in `media.ts` twice: `exampleMedia` and
  `portfolioMedia` (size and focal point, which `h.picture` reads). `media_index.py` rebuilds the file
  without `portfolioMedia`; put the table back (or add the lines by hand).
- **One photographer (or one kind of drawing) per project**, every file in CREDITS.md, and every
  photographer named in the look's `credit` ("… (Unsplash)"): the page's "Example" note shows it.
  `catalog.test.ts` enforces all three.
- **The look is the template as it comes** (`theme: { template: "<id>" }`), so "Start with <template>"
  on `/portfolio` starts from it; put new people in `GALLERY_LEAD`.
- Kinds: photographers `photographer`, architects and designers `designer` (there is no architect
  kind), developers `developer`, firmware and hardware makers `engineer`.

## Done when

```bash
cd apps/web && npx vitest run src/features/examples && npx eslint src && npx tsc --noEmit -p .
pkill -f next-server; npx next build
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test e2e/templates.spec.ts --project desktop --project mobile --trace off
# portfolio examples also:
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test e2e/portfolio-examples.spec.ts e2e/portfolio-a11y.spec.ts --project desktop --project mobile --trace off
```

(Stop your own server by port, never with `pkill`; see linkyo-qa-release.)

Then look at the page at 390 px wide (Playwright screenshot) in its language before calling it done.
