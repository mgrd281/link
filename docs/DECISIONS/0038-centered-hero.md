# 0038 — A centred hero: the promise on two lines, real pages beside it

**Context.** The founder looked at the home page on a laptop. The verdict: the design is not modern, the
sentences run over three lines, and it is not a 10/10 in experience, modernity and elegance.

What was wrong:
- **Headline.** The split layout gave the headline half the width, so "Alles, was / du erschaffst." broke
  into three lines.
- **Lead.** The paragraph under it also ran over three lines.
- **Deck.** The tabbed deck with its rings and timer looked busy next to it.

**Decision.**

- **One centred column.** From top to bottom:
  - a short news link ("Neu · Link-Seite in einer Minute umziehen →", to sign-up and the import);
  - the promise on **two lines** at every size, phones included ("Ein Link." / "Alles, was du erschaffst.");
  - **one** sentence: "Musik, Videos, Termine und Shop auf einer Seite. In fünf Minuten fertig.";
  - the address field;
  - the three promises.
- **Type sizes.**
  - phones: `h2` size with display tracking, so the second line fits on a 390 px screen;
  - from tablets: `display`;
  - from 1536 px: `display-xl`.
- **Real example pages frame the text.**
  - **Wide screens (≥ 1280 px):** on each side, one page in front, lower and larger, and one behind it,
    higher and further out, all gently tilted.
    - Their size comes from the screen height and width (`min(27 % of the first screen, 14vw)`), so they
      stay whole inside the first screen.
    - They never cover the headline (checked at 1280 × 720, 1440 × 900 and 1920 × 1080).
  - **Phones and tablets:** the pages fan out under the address field, the middle one in front. Phones show
    three pages, tablets five.
  - Every page links to its example page. Hover or keyboard focus straightens it, lifts it and shows its
    address ("linkyo.app/name ↗").
  - Mirrored in Arabic.
- **Nothing moves on its own.** The pages rise in once when the page loads, and stay still with reduced
  motion.
  - No carousel, tabs, timer or rings, and no JavaScript: the hero is a server component.
- **Flat.** No shadows (0037): pages stand apart with a hairline border.

**Supersedes** the hero deck of 0034 and its motion rules in 0036. Removed: `hero-deck.tsx`, the `mk-deck-*`,
`mk-progress` and `mk-phone-in` utilities, and the deck and kind texts.

**Status.** Applied. Tests:
- desktop: four pages beside a two-line headline, whole on the first screen and never over the text; hover
  shows the address; no tabs;
- phone: two lines, three pages fanned under the address field, the middle one in front;
- Arabic: mirrored;
- axe on every locale.
