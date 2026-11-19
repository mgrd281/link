# 0046 — The faces under the deck carry a timer ring, like stories

**Context.** The founder looked at the row of faces of 0045 and asked: "I want the circle of the profile at the bottom
like with a timer, like on Instagram." (0042 had removed the moving line under the old tabs at the founder's request;
this brings a timer back in a new place and shape.)

**Decision.**

- **Every face sits in a ring.** A quiet hairline track around each of the nine faces makes the row read as a row of
  stories. On hover the track gets one step stronger.
- **The ring of the page in front is the timer.** It fills clockwise from the top while that page's time runs, then
  the next face takes over.
  - It runs on the same clock as the page's own scroll (`mk-deck-scroll`, 9 s): both animations start in the same
    frame and use `--duration-carousel`. The scroll still ends the turn; the ring only shows it.
  - It holds with the page: under the mouse, while keyboard focus is inside the deck, and once the deck has stopped.
  - Once someone has chosen a page, after the one round, and for reduced motion, the chosen face simply has a full
    ring.
- **Original, not borrowed.** One flat ring in Linkyo's link color (9.9 : 1 on the row in light mode, 7.8 : 1 in
  dark). No gradient, no shadow.
- **How.** An SVG circle with `pathLength="1"` whose `stroke-dashoffset` goes from 1 to 0 (`mk-deck-ring`). It works
  in every browser, unlike an animated conic gradient, and it is drawn inside the 44 px touch target, so nothing
  moves when it appears.

**Status.** Applied. Tests:
- the face of the page in front has a running ring, the others none;
- ring and page scroll share one clock (same `currentTime`) and pause together;
- after a choice the ring is full and still.
