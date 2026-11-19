# 0045 — Nine pages in the hero deck, chosen by face

**Context.** The founder looked at the deck of 0044 (three pages) and asked: "Make about nine templates! Very
distinctive and very modern, 10 of 10, the best possible level, user experience 10."

**Decision.**

- **Nine pages, three in view.**
  - The deck holds nine pages. The one in front and its two neighbours are in view, as before.
  - The other six wait out of sight behind the neighbours (`data-slot="after"` and `"before"`: further out, smaller,
    fully transparent, not clickable). A page glides in from there and out to there, so the deck never jumps.
- **Nine different looks.** The order keeps neighbours different (dark beside light, one color beside another):

  | # | Page | Look |
  |---|---|---|
  | 1 | Taylor Swift | Atelier, dark, mauve |
  | 2 | Cristiano Ronaldo | Nocturne, vivid ruby |
  | 3 | Nadine Njeim | Daylight, rose, elegant |
  | 4 | MrBeast | Nocturne, vivid cyan, pill buttons (new: `mode: "vivid"`) |
  | 5 | Al Shami | Nocturne, saffron, glass buttons |
  | 6 | Jeff Bezos | Daylight, tangerine |
  | 7 | Mohamed Salah | Pulse, wine |
  | 8 | Elon Musk | Mono, black and white (new: was Nocturne aqua) |
  | 9 | Lionel Messi | Daylight, sky blue tint |

  All nine are unofficial concept pages of well-known people, labelled as in 0043. The advice recorded there
  (personality rights, KUG § 22) applies to all nine.
- **A row of faces instead of name tabs.**
  - Nine names do not fit a phone. Under the pages sits a row of nine round faces, one per page, like stories.
  - Each face is a tab (touch-target size, the person's name as its accessible name). The chosen one carries a ring in
    the link color (9.9 : 1 on the row in light mode, 7.8 : 1 in dark; `primary` only reached 2.3 : 1 in dark); the
    others get a quiet ring on hover. All faces stay in full color.
  - From tablets up the row is as wide as the deck and the faces spread evenly. On phones it scrolls sideways and
    keeps the chosen face in the middle. Only the row moves, never the page.
  - The name of the page in front is on the chip above it ("Concept · name").
- **One round.**
  - The deck goes through all nine pages once on its own (9 s each, the page scroll of 0044 is still the clock), then
    rests on the first. With nine pages, two rounds would keep the hero moving for almost three minutes.
  - The other rules of 0036 hold: it holds under the mouse or keyboard focus, stops for good when someone chooses a
    page, and never moves for reduced motion.
- **Pictures.**
  - 27 tall captures (nine pages in German, English and Arabic) and nine face crops (192 × 192) from the pages' own
    photos.
  - With the hero, five of nine pictures load: the page in front (preloaded), its two neighbours and the two about to
    come into view.
  - As soon as the first picture is there, the other four are fetched at low priority. A tap on any face then shows
    its page at once, never a blurred placeholder. When the browser asks to save data (`saveData`), a picture only
    loads when its page comes near.
  - Pages out of sight are `visibility: hidden` once they have faded, so the browser neither paints nor decodes them.

**To undo.** `CONCEPT_SHOTS` in `apps/web/src/features/marketing/examples.ts` is the list and the order: remove a line
(and its pictures) and the deck shrinks. Nothing else depends on the number nine except the screen-reader sentence
`marketing.hero.deck.auto`.

**Status.** Applied. Tests:
- nine face tabs, three pages in view, six waiting and hidden, all nine pictures fetched;
- the front picture scrolls and then the next page comes forward;
- a face brings its page forward and stops the deck;
- arrow keys, Home and End walk the faces and wrap;
- Arabic mirrors;
- axe.
