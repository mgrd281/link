# 0040 — The Linkyo y: a new, calmer and more premium logo

**Context.** The founder asked for a luxurious, very modern logo. The earlier symbol ("the Loop": two interlocking
links drawing a y, ADR in brand §3) worked as an idea but read as a squiggle at small sizes. Its weave of thin bands
broke apart at 16 to 24 px. The wordmark, Geist Bold at −2 %, was heavy.

Ten concepts were drawn and compared at 160, 48, 32 and 16 px, as app icons, and next to the wordmark:
- a fan of pages;
- a thread through a link;
- two rings;
- a medallion;
- an L with a loop;
- a y with a looped arm;
- "lo";
- a spark;
- y variants (straight, hooked, with a link point).

Solid shapes read clearly at every size; thin outlines did not. The rings looked like a car brand, and the L and
"lo" read as "b".

**Decision.**

- **Symbol.** A Linkyo Teal tile (a squircle, like an app icon) with a lowercase y cut out of it.
  - The long stroke ends in a soft hook.
  - The short stroke stops just before it, leaving a hairline of teal: the link point where two paths meet.
  - One color plus the background, so it works on white, on teal (as a white tile), in dark mode and at 16 px.
- **Wordmark.** "linkyo" in Geist SemiBold at +0.5 %: lighter and more refined than Bold.
- **Lockup.** The tile is 1.18 × the word's height, a quarter of the tile apart, centred on the word.
- **Tones.**
  - `brand`: teal tile, `text-primary`, lighter in dark mode.
  - `mono`: the surrounding text color, for teal surfaces, photos and the "made with" badge on creator pages.
- **Where it changed, all generated from the same geometry (`packages/tokens/brand/logo.mjs`).**
  - React: `Logo`, `LogoSymbol`, `LogoWordmark`, and the new `LogoGlyph` (the y alone, for app-icon previews).
  - The favicon.
  - The link preview cards, using a white tile on the teal card (`public/logo-on-teal.svg`).
  - The iOS app icons: light (white y on flat teal, no gradient), dark (teal y on ink) and tinted. They are rendered
    to 1024 px PNGs without an alpha channel by `brand/render-icons.mjs`.
  - The native SwiftUI `LinkyoSymbol`, replacing `LoopSymbol`.
  - The style guide.
- The places that wrapped the old symbol in a teal square now show the tile itself.

**Status.** Applied. Checks: header, sign-up, style guide, link preview card and app icons rendered and looked at;
lint, types, e2e.
