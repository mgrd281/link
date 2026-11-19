# 0044 — The hero deck comes alive: pages scroll by themselves; no frame; three well-known people

**Context.** The founder looked at the deck of 0043 and asked for three changes:
1. "The white frame is not modern and not elegant."
2. "Change the Lumen template!"
3. "Maybe the page should not stand still: it moves down, I mean the profile; after that it moves to the second
   page, and so on."

**Decision.**

- **Pages that scroll.**
  - The picture of the page in front is now a tall capture, up to two and a half screens, ending where the page's
    content ends.
  - It scrolls down by itself, as someone reading the page would, rests at the end and returns to the top. Then the
    next page comes forward.
  - The scroll is the deck's clock (`mk-deck-scroll`, 9 s per page, the new `glide` easing). There is no separate
    timer.
  - The rules of 0036 still hold:
    - two rounds only;
    - it holds under the mouse or keyboard focus;
    - it stops for good when someone chooses a page;
    - no motion for reduced motion.
- **No frame.**
  - Cards are the page itself, edge to edge, with rounded corners: no bezel and no white frame.
  - The pages beside the front one show their top.
- **Three well-known people.**
  - Taylor Swift (black), Cristiano Ronaldo (red) and Lionel Messi (sky blue). All three are unofficial concept
    pages, labelled as in 0043.
  - The tabs carry their names.
  - Lumen Atelier leaves the hero. Its example page returns to what it was before 0043.
- **Pictures.**
  - `capture-example-shots.mjs` takes the tall concept pictures in German, English and Arabic.
  - It walks down each page first, so pictures below the first screen are loaded.

**Status.** Applied. Tests:
- the front picture is taller than its screen and runs `mk-deck-scroll`;
- when that ends, the next page comes forward and the highlight glides;
- choosing a page stops everything;
- Arabic mirrors;
- axe.
