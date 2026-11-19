# 0029 — Template gallery redesign: moving wall, search, icon filters, cards

**Context.** The founder found the /templates page weak. In their words it needed:

- a very modern design and a 10/10 experience;
- cards that are not static;
- clear icons;
- order and cleanliness.

The old page had several problems:

- three fanned miniatures next to the intro;
- two rows of text-only filter chips;
- miniature cards with cut-off button labels ("Kick for …");
- a caption under every card that repeated the card.

**Decision.**

- **Hero.** The intro now has:
  - an eyebrow with an icon;
  - two actions, "Start free" and "Browse examples" (which jumps to the gallery);
  - three figures with icons (examples, designs, languages).

  Beside it is a **moving wall**:
  - Large screens show three columns of pages drifting past each other; the middle one drifts the
    other way and slower.
  - Phones show one sideways strip.
  - Pages come from every category in turn. Pages of real people are left out, so no famous faces
    advertise the product.
- **Motion rules (WCAG 2.2.2).**
  - The wall pauses on hover and has a pause button.
  - It is still for reduced motion.
  - It is decorative: hidden from screen readers and out of the tab order. The same pages are
    named buttons in the gallery below. A mouse click still opens the preview.
- **Toolbar.** Sticky under the site header, it holds:
  - **search** across name, line, category, language and button titles. Accents and Arabic vowel
    marks are ignored. "/" focuses it.
  - **one row of category chips**, each with an icon (`CATEGORY_ICONS`) and a live count of what
    the other filters leave. The row scrolls sideways, with arrows on larger screens and edge
    fades.

  On phones the search sits above the sticky chips, so the sticky part stays one row. A
  **language** switch (All / German / English / Arabic) sits next to the title, with the
  number of results read out politely. When nothing matches, a reset button appears. After a
  filter change deep in the grid, the top of the results scrolls back into view.
- **Cards.** Each card is a picture of the page in its own colors and fonts:
  - the photo full-bleed;
  - the name and line on the page's background;
  - a category chip with its icon, and the page language;
  - an arrow that takes the accent on hover.

  The labels follow the site's direction; the page's words keep their own. The cards are
  "alive": they lift, the photo zooms, and the card leans slightly towards the mouse (`mk-tilt`,
  mouse only). After a filter change, cards rise in one after another (`mk-card-in`, capped).
  The cut-off button pills and the repeated caption are gone.
- **Preview.**
  - Flip through the results with buttons or the arrow keys (direction-aware), with
    "3 of 12".
  - The dialog takes focus itself. Before, focus went into the page frame, so Escape and the
    keys never arrived.
  - A spinner shows until the page has loaded.
- **Fixed alongside.** The toaster's server snapshot was a new array on every call. React warned
  about it ("getServerSnapshot should be cached") on every marketing page.

**Consequences.**

- A new gallery category needs an icon in `CATEGORY_ICONS`; TypeScript enforces this.
- Tests cover search, the language filter, the empty state and reset, flipping in the preview
  with keys, Escape, pausing, reduced motion, and that nothing overflows sideways.
