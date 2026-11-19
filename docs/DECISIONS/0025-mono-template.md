# 0025 — Mono: a sixth template in black and white

**Context.** The founder sent a screen recording of a music artist's page on another platform and
asked for "a template like this" in Linkyo. What makes that page work:

- a studio portrait in black and white that melts into a white page;
- a very tall condensed name over the fade;
- quiet grey cards;
- section titles in capitals ("New", "Latest release", "Collab", "Playlist", merch, "More");
- bare social icons instead of round tiles.

Our blocks already cover every part of that page. The missing parts were the look and two layout
details.

**Decision.**

- **A new template, Mono** (`creator.template.mono` in `tokens.json`). It is our own composition of
  existing tokens, and no code, text or picture of the other page was copied:
  - white page, near-black accent, the Stage pairing (Anton name), soft grey cards with rounded
    corners;
  - section titles in capitals (`headings: "sans-upper"`).
- **Hero treatment `mono`.** This is the portrait treatment in black and white:
  - the photo, the moving picture and the wide-screen ambient backdrop are shown in greyscale;
  - creators can upload a color photo and the template does the rest;
  - it differs from duotone, which tones the photo into the page color.
- **Layout option `socials`.** Social profiles show as `tiles` (round, the default) or `plain`
  (bare glyphs at icon size lg, each with a full 44 px touch target). Mono uses plain.
- **Six templates everywhere:**
  - the template picker (two rows of three on wide screens, so each preview stays legible);
  - the welcome flow and the marketing page (a phone capture of Mono in German and Arabic);
  - the copy ("Six templates" in de/en/ar).
- **Example page:** Nela Voss (fictional singer, German). It has:
  - an album announcement card first;
  - "Neu", "Letzter Release", "Collab" and "Playlist" sections with their own covers;
  - tour dates;
  - the "Studio Nacht" merch line as a two-up grid;
  - a newsletter, and the label, shop, website and booking links.

  The release covers are original Linkyo designs set on Unsplash photos with OFL typefaces, listed in
  `assets/examples/CREDITS.md`.

**Consequences.**

- Templates stay starting looks. A creator on Mono can still pick an accent, a pairing, a button
  style or a mode, and every resolved palette passes the AA audit (tested). The layout options
  (headings, hero, socials) come with the template.
- The template lives in `tokens.json`, so the iOS app can adopt it when its creator pages get templates (the Swift tokens do not carry templates yet).
