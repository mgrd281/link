---
name: linkyo-media-assets
description: Find, license-check, prepare and credit pictures for Linkyo (Unsplash photos, Mixkit clips, Wikimedia Commons for real people) and design original cover art, banners and merch shots with Pillow. Use when a page, example, template or marketing section needs photos, release covers, product shots or a moving picture, or when CREDITS.md or media.ts must be updated.
---

# Linkyo media assets

Every picture is either licensed (and credited) or our own design. Nothing comes from a
competitor's page or a brand's assets.

## Find and check

- **Unsplash** (people, products, textures). Search pages are blocked here (401), so:
  1. `WebSearch` with `allowed_domains: ["unsplash.com"]` (for example "unsplash black and white
     portrait white background studio");
  2. `WebFetch` each photo page: ask for photographer, license and the `photo-…` id. Reject
     "Unsplash+";
  3. download `https://images.unsplash.com/<photo-id>?w=1400&q=90&fm=jpg&fit=max` with curl;
  4. look at a contact sheet of the candidates before choosing (`cover.contact_sheet`).
- **Rules for people photos:** adults, no visible brand logos (check caps and shoes), no
  celebrities on fictional pages, and a face in view after cropping.
- **Mixkit clips** for moving pictures: the "Stock Video Free License" only, checked on each clip
  page. Cutting rules are in `linkyo-example-page`.
- **Real people** (concept pages): Wikimedia Commons free licenses only, credited on the page (see
  `linkyo-concept-page`).

## Prepare

```python
import sys; sys.path.insert(0, ".claude/skills/linkyo-media-assets/scripts")
from cover import cover_crop, lift_backdrop, tint, vignette, spaced, font, contact_sheet
```

- **Portraits that melt into a white page:** `lift_backdrop()` turns a grey studio backdrop white,
  then crop 4:5 around the person (about 1160 × 1450).
- **Product and merch shots:** square, 1000 px. Black and white suits Mono pages.
- **Size:** keep pictures at most about 1200 px wide, JPEG quality 85–88, progressive.

## Original covers and banners

- Design our own:
  - a licensed texture photo (water, smoke, city lights);
  - `tint()` and `vignette()`;
  - typography in the faces from `cover.FACES`: Gloock, Big Shoulders, Work Sans, DM Mono (bundled,
    OFL, licenses in `fonts/`), and Instrument Serif and Anton from the app's fontsource packages.
- Vary the composition per cover: serif title low, a big glyph, stacked condensed caps. Never
  re-create a real release or a reference's layout. Use no platform logos (Spotify, Apple…) on
  covers.
- Release covers are square, 1000 px. Wide announcement banners are 1200 × 675 (shown 16:9 by
  highlighted cards).

## Add to the repo

1. Copy the files to `apps/web/src/assets/examples/ex<N>-<name>.jpg` (the next free series
   number).
2. Run `python3 .claude/skills/linkyo-media-assets/scripts/media_index.py`. It rebuilds
   `features/examples/media.ts`, where each file becomes `sample:ex<N>-<name>`.
3. Add one row per file to the table in `apps/web/src/assets/examples/CREDITS.md`, in file-name
   order: `| file | photographer (and what we changed) | photo page | license |`. Original
   covers say "Linkyo cover design on a photo by …" and name the typefaces.
4. Use the key in a persona (`photo: "ex5-nela-voss"`) or a helper (`h.music(…, { cover: "…" })`,
   `h.product(…, "ex5-hoodie-white")`).
