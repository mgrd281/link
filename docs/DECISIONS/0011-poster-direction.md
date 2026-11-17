# 0011 — Direction D "Poster" (from the founder's references)

**Context.** After Phase 0 the founder answered the direction question with seven phone screenshots of two public
creator pages on another link-in-bio product (one light, one dark) and "like this". The master prompt also says the
product must be original: no code, text, images, logos or trademarks from competitors. Page *structure* (a hero, titled
sections, list cards) is a convention shared by the whole category; the expression is ours.

**What we took (structure, the founder's request).**
- A full-bleed portrait that fades into the page, with the name set very large in a condensed face and centered.
- Bio and a monochrome row of platform icons under the name.
- Content grouped under bold section titles.
- Flat cards in one neutral surface tone: artwork on the start side, title + subtitle beside it.
- A two-up product grid, a swipeable video row, a live-stream row with status, plain text links.
- The same layout in light and dark.

**What is ours (expression + product decisions).**
- Linkyo tokens only (lint-enforced), our pairings (Anton + Inter by default, IBM Plex Sans Arabic for RTL), Lucide +
  Simple Icons, our own sample creators, copy and artwork.
- Sections need no containers: a "header" block opens a section; titled list blocks (tour, shorts, gallery) open their
  own; consecutive videos become a row and consecutive products a grid (`poster/sections.ts`, unit-tested).
- Releases open in place (`<details>`) to show where to listen — works without JavaScript, keyboard included.
- Plain links show where they lead (domain or email) under the title.
- Cards follow the creator's button style; a new `creator.card.shape` token caps the radius so a "pill" theme never
  turns big cards into stadiums.
- Monochrome accents flip with the mode (black buttons on light, white on dark) instead of settling on mid-grey.
- The page opens in the mode that matches the portrait (prototype: a sample map; Phase 1: `extractSeed` at upload).
- Deliberately **not** copied: the sticky "register free" bar (covers creator content; see REFERENCE_ANALYSIS §5.7)
  and the "cookie settings" footer link (Linkyo creator pages set no cookies, so the link was removed everywhere).

**Dashboard.** The page as an outline: section titles are rows of their own (rename in place, toggle, reorder), the
blocks under them are indented exactly as they group on the page, "Add section" is one click, light/dark is one switch,
and the live preview uses the real renderer.

**Status.** Proposed — waiting for the founder to confirm. On confirmation, Phase 1 deletes the Gallery, Stage and
Mosaic directions and Poster becomes the production renderer (ADR 0008 still applies).
