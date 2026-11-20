# 0050 — The lower homepage: four steps to try, then the offer, the questions, the last word

**Context.** The founder pointed at "Eine Seite, die nach dir aussieht" on a phone and asked for everything from there
down to be redone: very modern, the best phone experience, animation, buttons, layout, cleanliness and sequence, all
10 of 10. What was there: four rows of the same pattern (a heading, a paragraph of four lines, a big tinted panel), the
example pages again right after the template strip, a paste demo that looked like a form with an empty box, the Pro
list twice (pricing and the last card), and a long footer with entries that looked like links but were not.

**Decision.**

- **The features are the four steps of using Linkyo, in the order people do them** (`features/marketing/features.tsx`):
  1. **Gestalten** — "Eine Seite, die nach dir aussieht";
  2. **Einfügen** — "Link einfügen. Fertig.";
  3. **Teilen** — "Teilen wie ein Profi";
  4. **Auswerten** — "Analytics ohne Cookies" (keeps `id="analytics"`, the footer links there).
  An eyebrow ("So geht's"), the two-line title and one sentence introduce them. Each step has its number, a title,
  one or two lines and something to try on a soft panel. On wide screens the words stay in view beside a tall step
  (sticky) and the sides alternate.
- **A step bar like the progress bars of stories** (`step-rail.tsx`). Under the header, flush (`top-16`), while the
  tour is on screen: four segments with number and name; each fills while its step is read, the current one is named
  in full (`aria-current="step"`), a tap jumps to a step. It follows the reader's own scrolling (once per frame), so
  nothing moves on its own, and it leaves with the tour. The same visual language as the rings of the hero deck.
- **Step 1 is the theme engine to try** (`look-switcher.tsx`). A small page (Juno Kade, a fictional example) and five
  looks under it: Nocturne with aqua, Daylight with sky blue, Pulse in pink, Atelier, Mono. A tap dresses the page in
  that look at once: colors, type, button shape, photo treatment, exactly as real pages are dressed (the looks are
  resolved on the server). The sixth button takes any color: the engine, loaded on first use, turns it into a whole
  palette that stays readable. It replaces three more pictures of example pages, which the template strip above
  already shows. A WAI-ARIA radio group; the small page is hidden from screen readers, the look's name is announced.
- **Step 2 shows itself once** (`paste-demo.tsx`). The real detector, now app-like: one pill field with a round add
  button, example chips with the platforms' own marks, blocks like page rows. The first time it scrolls into view, a
  Spotify link appears in the field, is recognised and becomes a block, then a YouTube link (about three and a half
  seconds). It stops for good the moment someone touches it, and only the visitor's own additions are announced.
  A link it left in the field stays there, selected on focus: Enter adds it, typing replaces it. (Clearing it on
  focus lost the visitor's own paste when it was the same link: React saw no change.)
- **Step 3 is a chat**: a question, the answer with the page's link preview, the story picture leaning behind; the
  bubbles pop in one after the other.
- **Step 4** keeps the sample analytics, the figures now count up once (the final numbers are in the page for screen
  readers and without motion), and the three privacy points are a short checklist beside it.
- **Pricing**: Free is the offer (price, a checklist in two columns, one button); Pro is quieter, "Bald", a list of
  what it will add with icons, no button. The lead is one line shorter.
- **FAQ**: a calm list with hairlines, a round "+" that turns into a teal "×", answers that open smoothly in place
  (`::details-content`, where supported); the title stays in view beside the questions on wide screens.
- **The last word**: the teal card with the Linkyo y as a large tone-on-tone mark leaning out of its corner, the
  promise and the address field. The Pro list is no longer repeated here.
- **Footer**: the logo and its line, two short groups side by side (Produkt, Ressourcen), then one quiet band with the
  rights, the legal pages (named, not links until the company details exist) and the light/dark switch.
- **Motion**: rises, pops, the bars of the analytics, the step bar and the count-up all follow the reader's scrolling
  or run once; nothing loops. With reduced motion everything is simply there.

**Status.** Applied. Tests: the steps in order; the bar marks the current step and jumps; looks change by tap and by
arrow keys, any color works; the paste tour adds two blocks quietly and stops when the visitor takes over; sample
figures readable; pricing, last card and footer; on phones the bar sits flush under the header and leaves with the
tour; axe on the homepage in three languages, light and dark.
