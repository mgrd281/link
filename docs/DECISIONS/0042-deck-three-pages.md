# 0042 — The hero deck: no moving line, three different pages, cleaner cards

**Context.** The founder looked at the hero deck and asked for four things:
1. remove the line that moves under the chosen tab;
2. improve the design further, the cards too;
3. three varied pictures in attractive colors, "for example black, a beautiful red and another color";
4. one a girl, one a man, one something else.

Until now all three pages showed women, and two of them were dark blue-green.

**Decision.**

- **Three different pages.**
  - A woman in red: Lou Ferreira, fashion.
  - A man in black: Noah Sarkis, author.
  - A shop in orange: Nordlicht Sneaker.
  - The tabs read Mode · Autor · Shop.
- **No moving line.**
  - The deck still changes by itself for two rounds, then rests (0036). An unseen clock (`mk-deck-timer`) drives it.
  - It still holds under the mouse or keyboard focus, stops when someone chooses a page, and does not run for
    reduced motion.
- **Tabs in the header's language.** One soft track with equally wide tabs. A teal highlight glides to the chosen tab
  (`mk-deck-tabs`), like the log in / sign up switch. The chosen tab is white on teal.
- **Cards.**
  - A white frame with a hairline replaces the black bezel. Where pages overlap, the frame keeps them apart
    without a shadow (0037).
  - The pages beside the front one keep their full color (no dimming) and sit a touch closer and larger.
- **Pictures retaken.**
  - All 29 phone pictures of example pages were retaken with a new script,
    `apps/web/scripts/capture-example-shots.mjs`, so they show the new logo (0040) in Linkyo's chip.
  - Fix: the chip on example pages put the new symbol (a teal tile) inside a teal circle, so the y could not be
    seen. The chip and two dashboard badges now show the y alone (`LogoGlyph`).

**Status.** Applied. Tests:
- the tabs read Fashion · Author · Shop;
- the clock is unseen and still brings the next page forward;
- choosing a page stops it;
- Arabic mirrors;
- axe.
