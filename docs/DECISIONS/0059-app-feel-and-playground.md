# 0059 — An app's feel: tinted buttons, calm focus, and the playground on one phone screen

**Context.** The founder checked the website on an iPhone and a Mac and found it still felt like a
website in places:
- the two stacked buttons on /templates had different widths, and the second was a white outline;
- "12 weitere zeigen" looked dated;
- tapping the search drew a thick dark line, and closing it left a thick ring on the magnifier;
- the "Probier's aus" playground needed a full redesign.

They asked for a full pass to the standard of native apps, with Apple's principles (clarity,
deference, depth, consistency, fluidity) and without fabricated scores.

**How it was done.**
- **Baseline.** Screenshots on an iPhone 15 Pro and at 1440 px came first.
- **Playground design.**
  - Three designers wrote independent specs, each with a different lens: iOS-native, editorial, and
    conversion.
  - A design director scored them against ten criteria: iOS 66, editorial 66, conversion 70.
  - The director then merged them: the conversion geometry, with the best ideas of the other two.
- **Audit.** A fourth agent audited the whole site on a phone for what still felt like a website
  (15 findings).
- **Review.** Independent reviewers checked the change afterwards, and a skeptic re-checked each
  finding.

**Decision.**

- **Tinted buttons.**
  - New tokens `tinted`, `tinted-hover` and `tinted-fg`: a soft teal fill. The text contrast is
    8.7:1 to 10.5:1 in light mode and at least 6.2:1 in dark mode.
  - `Button` and `IconButton` get `variant="tinted"`. It replaces white outlined secondary buttons:
    the second hero button, "show more", the preview sheet's controls, and the row arrows.
  - The Google button keeps a neutral fill, because Google's mark stays on a neutral button.
- **One primary shape.**
  - `size="cta"` is a 56 px pill in semibold, for sign-up, "Keep this page" and "See all
    templates". It is used on the home page, /templates, the phone menu and the sign-up, sign-in and
    code screens.
  - On phones, pairs are equal and full width.
- **Calm focus on fields.**
  - Every field in the app (and on creator pages) used to add a 1 px border plus a 2 px ring at a
    2 px offset, which read as a thick double line on every tap. Text fields always match
    `:focus-visible`, even when tapped.
  - Now fields use `focus-field`: the same 2 px teal drawn inside the field's edge. It stays visible
    (well over 3:1) without a frame around the frame, and nothing moves.
  - Buttons and links keep `focus-ring`.
- **Search.**
  - The people search shows focus with a neutral hairline and a teal magnifier instead of a dark
    border.
  - After a tap or a click closes it, focus still returns to the magnifier (for keyboards and screen
    readers), but without a ring until the next key.
  - On desktop the search trigger is a filled pill like its neighbours. Matches are highlighted in
    brand teal instead of lime.
  - The /templates search is a filled field.
- **The playground.**
  - **Phones and tablets:** a short stage with the phone rising from its lower edge, a segmented
    control with a gliding thumb, one fixed-height panel and "Keep this page". All of it fits one
    phone screen under the header (588 of 595 px on an iPhone 15 Pro), so the demo plays in full
    view and the button sits under the thumb.
  - **Desktop:** the split stays as it was.
  - **Profile:** the photo sits beside one grouped pair of fields with inset labels; the big empty
    photo box is gone.
  - **Links:** the examples and the field's message share one slot. The "+" is tinted until a link is
    recognised, then primary. On phones, added links are tinted tokens in a row; on desktop they are
    a plain list.
  - **Looks:** on phones they are a row that scrolls sideways, Mono and Nocturne first.
  - **The demo:**
    - A finger scrolling past no longer stops it; a tap still does.
    - One corner button watches, stops (WCAG 2.2.2) or watches again.
    - It starts when three quarters of the card are in view.
    - It ends with "Fertig. Jetzt du!": nothing is online yet.
    - On touch screens it shows a fingertip, not a mouse arrow.
  - **Fixes:** the phone's placeholder now has the phone's size, so nothing jumps while it loads, and
    the stage's focus ring is teal-50 so it stays visible on dark teal.
- **Phone fixes from the audit.**
  - **Hero deck:** the deck turns with a swipe (at least a finger's width; mirrored in Arabic), and a
    swipe never opens the page in front.
  - **Header:**
    - a hairline appears once content scrolls under it (scroll-state queries; not on /templates,
      whose band draws its own);
    - its controls have 44 px tap areas.
  - **Lists:**
    - the Pro features are one grouped list, and the trust points are one list on phones;
    - the trust icons are tinted, so they no longer look like buttons.
  - **Pressed states:** added on the FAQ rows, the template strip, and the faces.
  - **Footer:** links are 44 px rows on phones, and the theme switch is larger.
  - **Layout:** sections follow one rhythm on phones (48 px each), and section titles are
    start-aligned on phones, centred from tablets.
  - **Auth:** "Anmelden" and "Registrieren" links are 44 px tap targets.
- **Shadows stay forbidden** (ADR 0037). The design brief's "light and shadow" and "glassmorphism" are
  met with depth from fills, hairlines and backdrop blur.

**Left for later.**
- On the home page, template cards still open the full page instead of the preview sheet. Changing
  that changes navigation, so it gets its own change.
- Chips in the gallery band (40 px) and in the search (32 px) still differ in height.

**Status.** Applied.
