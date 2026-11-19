# 0049 — Phones: first what Linkyo is, then sign-up; a menu like an app

**Context.** The founder looked at the homepage on a phone and said, as a marketing and UX brief:
- "When visitors arrive, the order is very bad."
- "A customer or visitor must know what the site is. After that, something like 'sign up' appears."
- "Login does not appear, only sign-up."
- "The menu card design is bad."

**Decision.**

- **The order of the hero on phones and tablets** (`features/marketing/hero.tsx`):
  1. **What it is.** A line that names the product, with the three bios it lives in (Instagram, TikTok, YouTube icons):
     "Deine Seite für den Link in der Bio" / "Your page for the link in your bio" / "صفحتك لرابط البايو". Then the
     promise (headline, two lines) and one sentence (two lines at most).
  2. **The proof.** The deck of real pages. On a phone the first screen ends inside it: words and pages, nothing
     asked for yet.
  3. **Then the action.** Claim an address, "Kostenlos registrieren".
  - Wide screens keep the two columns (words and action on one side, pages on the other) and the hero still fills
    the first screen. The eyebrow line is new there too.
- **Sign-up in the header waits** (`header-signup.tsx`). On the homepage the phone header shows only the logo, search
  and menu. Once the hero's sign-up has gone up under the header, "Registrieren" slides in beside the search, so
  sign-up stays in reach while reading on; scrolling back up makes it leave again. Other pages show it from the
  start. Desktop is unchanged: the one "log in / sign up" switch of 0039.
- **Only sign-up in that flow.** Logging in is not on the phone's first screen. It lives in the menu as one quiet line
  under the sign-up button ("Schon ein Konto? Anmelden"), where people who have an account look for it.
- **No repetition.** The three promises under the button ("Dauerhaft kostenlos · Ohne Cookies · Daten in Frankfurt")
  show on wide screens only. On phones and tablets the same three points follow right after the hero as cards, and
  the button already says "kostenlos".
- **The menu, like an app's** (`mobile-menu.tsx`).
  - A full screen (native popover), with the logo and a round close button where the header and its menu button
    are.
  - The four places, each with an icon in a soft teal circle, its name and one line that says what is there
    ("Ansehen und mit einer loslegen"), and a chevron.
  - The language, written out (Deutsch · English · العربية): phones had no language switch before.
  - At the bottom, in reach of the thumb: one primary button, sign-up; under it the quiet login line.
  - It fades in and settles from slightly above; its rows follow one after the other; nothing moves for reduced
    motion.
- **Measured on scroll.** Whether the hero's sign-up has been passed is measured once per frame while scrolling, not
  with an IntersectionObserver: that stays silent when the page jumps from below the block to above it in one go
  (a tap on the iPhone's status bar).

**Status.** Applied. Tests: on a phone the words come before the pages and the pages before the action; the header
sign-up is hidden on the first screen and while the hero's is in view, appears after it and leaves again at the top;
the menu covers the screen, says what each place is, has the language written out, one sign-up and the login line,
and closes on a choice or with its button.
