# 0036 — Motion without pause buttons; a hero that fits the screen

**Context.** The founder asked for the home page to be a 10/10 on design, user experience, phones, buttons and icons.
Three things to fix:
1. **Cards cut off.** On a laptop screen (about 760 px of browser height) the hero's front card was cut off at the top
   (under the sticky header) and the tabs at the bottom.
2. **Pause icons.** The pause icons on the hero deck and the example strip were unclear: "remove the pause icon".
3. **Overlays.** The deck's "view page" button and number chip covered the example page itself (her face, its own
   button).

Pause buttons existed for WCAG 2.2.2 (Pause, Stop, Hide). Removing them is only acceptable if the motion itself meets
the criterion.

**Decision.**

- **Hero deck.**
  - The front phone is shown whole: a sizing box of the phone's shape, all three phones absolutely inside it.
  - On wide screens the phone is never taller than the screen allows (`mk-deck-fit`: 100svh minus header, address,
    tabs and air), and the hero fills the first screen (`mk-hero-fit`).
  - Nothing lies on the page any more. The address above the phone is the link ("linkyo.app/name ↗"), and the
    number chip is gone.
  - No pause button. The deck changes by itself for two rounds only, then rests on the first page.
  - It holds while the mouse is over it or keyboard focus is inside, and stops for good as soon as someone chooses a
    page (tab, side phone, arrow keys).
  - It never moves on its own with reduced motion.
  - Screen readers hear "changes every 6 seconds, twice round, until you choose a page".
- **Example strip.** No motion of its own, so 2.2.2 does not apply:
  - wide screens: the row slides along as the page scrolls (`mk-drift`, a CSS view timeline);
  - phones: a row to swipe, card by card (scroll snap);
  - reduced motion: still.
- **The walls beside sign-up and atop the gallery.**
  - Decorative, no pause button. They make one slow pass (about a minute) and rest.
  - They hold under the mouse and whenever the keyboard moves through the page (`:focus-visible` anywhere).
  - Reduced motion keeps them still.
  - The gallery's phone strip becomes a row to swipe.
  - The video pause on creator pages with a moving picture stays: that one is content, not decoration.
- **First screen on phones.**
  - Header: the logo, a short "Registrieren" button and the menu.
  - Under the address field: the three promises with icons (gift, shield, pin), instead of three pills above the lead.
  - The address rules appear only while the field is in use (screen readers always hear them).
  - The first phone comes into view right under the field.
  - The three promise cards are compact rows on phones.
  - The features fan uses larger phones.
  - The paste demo's button becomes a round "enter" arrow on phones.
- **Buttons.**
  - The gallery's actions match the home page: teal glow, slight lift and a moving arrow on the primary, and an arrow
    that nods down on "browse".
  - The deck's tabs show their icons on phones too.

**Status.** Applied. Tests:
- home: the strip is scroll-driven, no pause buttons, and the deck stops when a page is chosen;
- gallery: the wall makes one pass, holds on hover and is still for reduced motion;
- Arabic: the deck follows the reading direction;
- axe on every locale.
