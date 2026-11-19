# 0034 — Hero deck: the example pages as a real carousel

**Context.** The hero's three example pages turned on a pure CSS loop. The founder asked for this card to be redesigned
to a 10/10 standard: design, user experience, layout, buttons and motion, in Arabic as well.

What was wrong with the loop:
- you could not open a page or choose one;
- the page captures were cropped through their social icons;
- the caption and the pause button floated apart from the cards;
- the side cards read as cut-off text.

**Decision.** A WAI-ARIA tabbed carousel (`features/marketing/hero-deck.tsx`).

- **Cards.** Phone frames (new `aspect-phone` token, 390 × 844) on a soft teal disc and a thin ring.
  - The page in front is a link to the real example page, with a "View page" button on its bottom edge.
  - Its address sits above it, and one number from the page sits beside it (hidden on phones).
  - The pages beside it are dimmed, smaller and tilted; a click brings one to the front.
- **Controls.** A pause button and three tabs (Comedy, Sport, Music, each with an icon).
  - The line under the chosen tab fills while its page is in front. When it is full, the next page comes forward.
  - The CSS animation is the timer (`mk-progress`, new `duration-carousel` token, 6 s).
- **Motion.** Cards glide between slots with the new `ease-emphasized` curve and `duration-move` token (560 ms).
  - The address and the number arrive just after the card.
  - The front card lifts on hover.
- **Pausing (WCAG 2.2.2).**
  - The timer holds while the mouse is over the deck or keyboard focus is inside it, and stops with the pause button.
  - With reduced motion it never moves on its own and cards change places without moving.
- **Accessibility.**
  - Tabs follow the APG keyboard pattern (arrows, Home, End). The slides are tab panels; the hidden ones are
    `aria-hidden`.
  - The live region is polite only while the deck is stopped.
  - The link's name starts with its visible label (WCAG 2.5.3).
- **Right to left.** The next page waits on the reading side, and ArrowLeft moves forward in Arabic.

**Status.** Applied. Tests: `e2e/home.spec.ts` (choose, timer, keyboard, side click, pause, Arabic direction) and axe on
every home locale.
