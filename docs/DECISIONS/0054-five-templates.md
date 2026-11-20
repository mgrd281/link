# 0054 — Five more templates: Studio, Aura, Folio, Signal and Bloom

**Context.** The founder pointed at a music artist's page on another platform ("can another person be
added like this?") and asked for "about five different templates, very professional: marketing,
modern, layout, animation, UX and UI, everything 10 of 10".

The page they pointed at is close to our Mono template (ADR 0025): a black-and-white portrait, a
condensed name in capitals, a featured release, release cards, a playlist, two merch lines and label
links. It also shows a cookie banner, which our pages do not need.

Until now, templates changed colours, type, buttons, the hero's treatment and the section titles. The
layout itself stayed the same.

**Decision.** Five new templates, each with its own composition and its own motion, built as new
layout options of the theme engine (`creator.template.<id>` in `tokens.json`; `CreatorLayout` in
`packages/tokens/src/creator/theme.ts`). No text, picture, name or code of the other page was copied.

| Template | For | Look | Hero (`hero`) | Titles (`headings`) | Motion |
|---|---|---|---|---|---|
| Studio | musicians | near-black, a recording-light red, condensed caps, outlined square buttons | `cinema`: a full-height still, the name set low and large at the reading start, over the photo | `numbered`: "01" in the accent, then the title in caps | the still settles like a slow camera move; the name and lines rise in |
| Aura | coaching, wellness, beauty | violet light, a serif name, frosted glass pills | `halo`: a round portrait in a ring of the page's colours | `display` | `backdrop: "aurora"`: three soft colour fields drift along the page; the ring turns slowly |
| Folio | photographers, architects, designers | warm paper, Space Grotesk, rows with hairlines | `inset`: a framed picture that uncovers itself, the name smaller and at the reading start | `rule`: the title, then a hairline to the end of the line | `gallery: "grid"`: work in two columns, tall and square pictures alternating |
| Signal | streamers, developers | night blue, lime, Geist and Geist Mono, outlined rounded buttons | `frame`: a square picture in four corner marks that lock on; a blinking cursor after the line | `mono`: "//" in the accent, then the title in caps | `backdrop: "grid"`: a fine grid fading down the first screen, panning very slowly |
| Bloom | cafés, bakeries, small brands | cream and rose, Bricolage, filled pills | `arch`: the portrait in an arch with an outline arch offset behind it | `display` | the arch rises in |

- **Motion is a layout option too** (`motion: "reveal"`). On the newer templates, sections rise in once
  as they scroll into view. This is CSS scroll-driven animation, with no JavaScript. The hero's lines
  arrive one after the other.
- **Accessibility and compatibility:**
  - With `prefers-reduced-motion` nothing moves.
  - Browsers without scroll-driven animations show every section as it is.
  - Every resolved palette passes the AA audit (tested for all eleven templates).
  - The aurora uses the palette's two hue-shifted neighbours of the page colour, which are safe under
    text. They are exposed as `--creator-glow-1` and `--creator-glow-2`.
- **No shadows anywhere:**
  - corner marks, the outline arch and the halo are borders and gradients;
  - the light trail and the grid in the new covers are part of the pictures.
- **Where they show:**
  - the dashboard picker shows each template in its own shape (a still, a halo, a frame, corner marks,
    an arch, the grid);
  - the homepage playground offers Studio, Aura and Bloom next to Nocturne and Mono, each card in its
    shape;
  - the gallery lists the five new examples first and counts "11 designs";
  - every "six templates" sentence now says eleven (de/en/ar).
- **Five new example people** (`catalog-f.ts`), one per template:
  - Lenz (de, Studio): the requested artist like the reference, with our own content. A single
    announcement with a red light trail, "Neu", "Collab", "Playlist", tour dates, a two-piece capsule
    collection, and label, studio, website and booking links.
  - Mira Sol (en, Aura): breathwork teacher.
  - Jonas Ek (de, Folio): architecture photographer.
  - Rina Vex (en, Signal): streamer and indie game developer; setup products carry the ad label.
  - Dana Issa (ar, Bloom): a bakery in Berlin-Neukölln.

  The covers, the course and journal covers and the game's title card are original Linkyo designs
  with OFL typefaces.
- **Photos.** Unsplash's photo pages now refuse automated visits, so the licence is shown by the
  source: free photos are served from `images.unsplash.com/photo-…`, Unsplash+ photos only from
  `plus.unsplash.com/premium_photo-…`. Every photo was looked at: adults only, no celebrities, no
  logos as the subject, and no face already used in the gallery. The credits list each photo's CDN id.
- **Cleanup.** The marketing phone captures (`phone-<id>-{de,ar}.jpg`, `page-{de,ar}.jpg`) were no
  longer shown anywhere, so the code and pictures are gone. The template skill now points at the live
  renderer instead.

**Consequences.**
- Templates are still starting looks: a creator on any of them can change accent, type, buttons or
  mode; the layout options come with the template.
- New layout options cost little: a token entry plus a treatment in `hero.tsx` or `renderer.tsx` and
  a utility in `globals.css`.
- The iOS app does not carry templates yet (ADR 0025).
