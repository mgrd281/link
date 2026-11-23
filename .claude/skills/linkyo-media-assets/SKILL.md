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
- **Pexels videos** for real footage when Mixkit's free clips have nothing (Mixkit's scanning and most
  warehouse clips are "Restricted"). Pexels License: free to use and to modify, no attribution
  required; not allowed: selling unaltered copies, implying endorsement by people or brands shown,
  redistributing on other stock platforms, using it in a trademark. The site's pages answer 403 here;
  `https://www.pexels.com/download/video/<id>/` redirects to the file (swap the size part for
  `hd_1920_1080`), and the web-fetch agent reads the clip page for creator and license. Credit the
  creator in CREDITS.md anyway. Clips for the motion library show no identifiable face (crop it
  out): a library clip may stand for any creator, and nobody should be taken for someone else.
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

## Original illustrated motion graphics

For a person's work that no licensed clip shows (a forklift driver, a nurse, a cook), draw the scene
ourselves: `scripts/forklift-scene.html` (its black-and-grey variant `forklift-scene-noir.html`, and `reach-truck-scene.html`: a reach truck whose driver scans labels with a handheld scanner while a terminal under the roof confirms each booking, reaches into the rack, then drives to a loading dock and unloads a trailer, with phone-safe framing and a tracking shot; 18 s, about 1 MB) is the model — flat SVG drawn from scratch, a pure
`render(t)` function (camera keyframes, parallax layers, a floor reflection, a seamless loop whose
last frame equals the first), no text. Render every frame with
`node scripts/render-scene.cjs <frames_dir> 30 10 <scene.html>` (run from `apps/web` so Playwright
resolves), then encode as below (`-crf 26` suits flat illustration, about 0.7 MB). Frame 0 is the
hero picture. Never show a real person's face in an illustration of a real customer.

## The motion library: clips every creator can choose

Original loops that fit more than one person go into Linkyo's motion library
(`apps/web/src/features/creator/motion-library.ts`): today "Barcode scannen" (real footage, Tiger Lily
on Pexels: two takes of a hand scanner on a wrapped pallet, cropped 4:5 without the face, joined with
dissolves where no scanner is in frame, 5.7 s), "Lagerarbeit" (`reach-truck-scene.html`),
"Palette packen" (`pallet-scene.html`: the worker raises a pistol-grip scanner (silver body, rubber
grip, trigger, a screen at the back) and scans each carton's label; a card beside his head types out
the EAN-13 it read and confirms it (in-store numbers, prefix 20, valid check digits; DM Mono at 24 px
so phones can read it), the pick list ticks it off; he carries it to the pallet, then two laps of
stretch film and a pallet jack that swaps the pallet; 22.2 s, starting on the wrapped pallet).
`render-scene.cjs` waits for fonts before the first frame and "Scannen von Waren" (`scan-conveyor-scene.html`). The
dashboard's profile sheet ("Bewegtes
Kopfbild") shows them as tiles: still, name, length, and a button that plays the clip in its tile.
Choosing one sets `profile.motion` to `sample:motion-<key>` and the header picture to the clip's
first frame. These are the only clips a live creator page plays: `withoutThirdParties` drops every
other address (an own MP4 link shows in the editor's preview only). To add a clip:

1. Render and encode it as above. Put `<key>.mp4` in `apps/web/public/media/motion/` and frame 0, as
   `ex-motion-<key>.jpg` (1080 × 1350), in `apps/web/src/assets/examples/`.
2. Register the still in `features/examples/media.ts` by hand (an import plus an `exampleMedia`
   entry), and add a credits row ("Linkyo original illustration").
3. Add an entry to `MOTION_LIBRARY`: key, poster, `w`/`h`, seconds, topic, `kind` (`film` or
   `illustration`: the tile says which) and `alt` in de, en and ar.
4. Add the tile name to `app.profile.motionClips.<key>` in `src/messages/{de,en,ar}.json`.
5. `motion-library.test.ts` checks the file, the still, its size and the lookups;
   `e2e/motion-picker-app.spec.ts` covers the picker.

## Original motion graphics from a photo

When no licensed clip fits (most Mixkit warehouse and logistics clips are "Restricted", personal use
only), make our own loop from a licensed photo: `scripts/scan_loop.py <photo> <out_dir>` renders a 7 s
4:5 loop (grade, a periodic camera move so the loop has no seam, a scan beam, corner marks that lock
onto measured boxes). Adapt `CROP`, `SIGNS` and the timings per photo, keep frame 0 free of
overlays (it is the still), no text in the video. Encode:
`ffmpeg -framerate 30 -i frames/%04d.png -vf scale=864:1080:flags=lanczos -c:v libx264 -preset veryslow -crf 31 -pix_fmt yuv420p -movflags +faststart -an <name>.mp4`
(about 0.8 MB), put it in `public/media/motion/` and use `motion: { src: "sample:motion-<name>" }`
with frame 0 as the hero picture (no focal point: the clip is centred).

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
