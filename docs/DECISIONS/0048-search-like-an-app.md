# 0048 — The people search behaves like a screen in an app

**Context.** The founder opened the search of 0047 on a phone and asked for more: "a design like modern apps, real
apps", very smooth, clean, best experience on phone and PC, buttons and icons 10 of 10, and "without this" (the line
of small print at the bottom of the dialog).

**Decision.**

- **No small print.** The line "What you type stays on your device. Example pages are fictional, concept pages
  unofficial." is gone, at the founder's request. What stays, so nobody is misled:
  - every row still says what it is ("Concept", "Example", "Preview"), now as quiet text, not as an outlined chip;
  - every concept and example page carries its own label at the top, as before (0043).
- **Phones: a screen, not a dialog.**
  - One soft pill to type in, with "Cancel" beside it, as in the phone's own apps. The clear button is the small grey
    circle people know.
  - The keyboard is up when the screen appears. Phones only allow that inside the tap itself, so an unseen field
    takes the focus on the tap and hands it on to the real one.
  - The screen is exactly what is visible (`visualViewport`), so it ends above the keyboard, not under it.
  - Dragging the results puts the keyboard away. "Search" on the keyboard does the same; it does not open a row.
  - No row is marked until a finger taps it (a marked first row looked like a selection nobody made). A tapped row
    answers at once with a soft fill.
  - Eight suggestions fill the first screen; room is left for the home indicator.
- **Computers: a panel.** One borderless line to type in with a hairline that turns teal, the highlight that glides
  to the chosen row, arrow keys and Enter, and a slim line of key hints (only with a keyboard). Six suggestions.
- **Both.**
  - Fields are soft filled chips; the chosen one is teal.
  - Every row ends in a quiet chevron: it opens a page. The chosen row's chevron turns teal and moves a step.
  - It arrives with a short rise and a fade and leaves faster than it came; the page behind dims with it.
    Suggestions arrive one after the other; results while typing are simply there. Nothing moves for reduced motion.
- **Back works as in an app** (`features/search/people-history.ts`).
  - Opening the search adds a step to the browser's history. Back (button, swipe, Escape, Cancel) takes that step
    back and so closes it.
  - Opening a person's page and going back returns to the search as it was left: the typed words and the chosen
    field are kept in that history entry. No cookie and no storage are used.

**Status.** Applied. Tests: opening by button and shortcut; typing; Enter with a keyboard, tap on a touch screen;
back returns to the search with what was typed, back again closes it; no marked row on touch; arrow keys; fields;
phones in Arabic; axe in three languages, light and dark.
