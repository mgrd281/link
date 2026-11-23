# 0012 — Poster templates, vivid mode and the new Poster blocks

**Context.** The founder sent five screen recordings of creator pages built from one layout with different templates
(a black rapper page, a light comedian page, a crew page with a logo, a fully red creator page, a light musician page)
and asked for the same, but better — 10/10 on modernity, UX and icons. As in ADR 0011 we take the structure and build
our own expression; no code, text, images or marks are copied.

**Decision.**

1. **Templates are tokens.** `creator.template.*` in `tokens.json` (shared with iOS later): colors, pairing, button
   style/shape plus two layout options — `headings` (display face · sans title case · sans caps) and `hero`
   (portrait · logo · duotone). Resolution order: the creator's explicit choices > template > preset, so a template is
   a starting look, never a lock. Five originals:

   | Template | Look | Hero |
   |---|---|---|
   | Nocturne | black, white condensed name | portrait fading into black |
   | Daylight | white, dark condensed name | portrait fading into white |
   | Marquee | dark, soft blur | creator logo over a blurred photo |
   | Pulse | the whole page in the creator's color | photo toned into the color (duotone) |
   | Atelier | warm paper, serif name, square corners, titles in caps | portrait |
   | Mono (added later, ADR 0025) | white, black-and-white portrait, condensed name, titles in caps, bare social icons | portrait in greyscale |
   | Studio (ADR 0054) | near-black, red accent, condensed caps, numbered sections | a full-height still, the name set low over it |
   | Aura (ADR 0054) | violet light, drifting colour fields, serif name, frosted pills | round portrait in a turning halo |
   | Folio (ADR 0054) | warm paper, ruled titles, rows with hairlines, work in a grid | framed picture, name at the reading start |
   | Signal (ADR 0054) | night blue, lime, a fine grid, monospace details | square picture in corner marks |
   | Bloom (ADR 0054) | cream and rose, round bold type, filled pills | portrait in an arch with an outline arch behind |
   | Laufbahn (ADR 0069) | a very light canvas, cobalt, Inter, plain section titles, a contents sheet in the app bar, lists with icons | the picture from edge to edge with the name on it; a tall rounded plate beside the words on wide screens |

2. **Vivid mode** in the palette engine: the background is the seed hue at the lightest lightness where white text
   still reaches 7:1 on every surface; buttons become near-white with a dark label in the same hue. Property-tested
   with 2,000 random seeds (plus light/dark: 6,000 palettes), all WCAG AA.
3. **Duotone without new assets:** grayscale + `screen` blend for dark photos (black becomes the page color) or
   `multiply` for light ones. The photo's tone is measured at upload (`image.tone`), which also picks the starting
   template (dark photo → Nocturne, light → Daylight).
4. **New layouts, still no containers for creators:** 4+ consecutive media rows become a two-row swipe rail;
   dates get month tabs (ARIA tabs, "All" first so nothing is hidden without JavaScript); a `brands` block shows
   partner tiles (2 columns with role, 3 with names); `affiliate` on link/card/product renders an "Anzeige/Ad" label
   (DE: UWG § 5a, MStV § 22 — not legal advice); events gain `name` and `time`; profiles gain `logo` and `tagline`.
5. **Scroll experience in CSS only:** the hero names a view timeline; the photo softens and fades as it leaves, and
   a compact glass bar (avatar, name, native share sheet / copy link) slides in after it. Reduced motion: opacity
   only. Browsers without scroll-driven animations keep the static page.

**Better than the references, on purpose:** contrast guaranteed in every template and color; zero cookies (no cookie
link needed); videos load only after a tap; ads labelled; month tabs and rails keyboard-accessible; no sticky sign-up
bar over the creator's content; share button built in; Arabic/RTL in every template.

**Status.** Proposed with ADR 0011 — confirm together.
