# 0047 — People search

**Context.** The founder asked for "a new, very professional feature: search for people", modern, smooth and easy,
10 of 10 in every respect.

**Decision.**

- **Where.** A magnifier in the marketing header on every size (with "Search" and the shortcut where there is room),
  and Ctrl/⌘ K from anywhere. It opens a dialog: full screen on phones, a panel under the header from tablets up.
- **What it finds.** Exactly the pages the gallery lists (`LOOKS` and `PEOPLE_LOOKS`): fictional example pages,
  unofficial concept pages of well-known people, prepared previews. Nothing else.
  - Every result says what it is ("Example", "Concept", "Preview"), and a note in the dialog repeats that example
    pages are fictional and concept pages unofficial. The advice of 0043 applies here as well.
  - **Real accounts are not in it.** Public pages of real people do not exist yet. When they do, a person appears in
    the search only after switching it on themselves (privacy by default, GDPR Art. 25). That needs a setting, a
    database column and a search function on the server, and its own decision record.
- **How it searches** (`features/search/search.ts`, pure and unit-tested).
  - By name, by address, and by what the page is about: its line under the name, kind, category and place, in the
    visitor's language and in English.
  - Accents, case and Arabic vowel marks do not matter; each Arabic letter is read one way; a well-known person is
    found in Latin and Arabic script from every language.
  - Best fit first: the start of a name, then the start of a word in it, then inside it, then what the page is about.
  - Typing mistakes are forgiven ("ronldo") only when nothing fits as typed, so a near miss never crowds out a hit.
  - Nothing typed: six suggestions, the people from the homepage first. A chip narrows to one field.
- **Privacy.**
  - The list of people is one static file per language (`/api/people/<locale>`, about 6 kB compressed), fetched once
    when someone reaches for the search. Searching happens in the browser: nothing typed is sent anywhere.
  - No cookies, no storage (so no "recent searches"), nothing from third parties. A picture that lives on a server we
    do not re-serve is left out; the result then shows initials.
- **Feel.**
  - One soft teal highlight glides to the chosen row as the arrow keys or the pointer move (the same language as the
    header's log in / sign up switch). What was typed is marked in the name and line like a text marker.
  - Enter opens the chosen page; a small spinner shows that it is on its way.
  - The dialog and its code load on first use, and already on hover, focus or touch of the button, so it opens ready.
- **Accessibility.** WAI-ARIA combobox with a list: the field keeps the focus, `aria-activedescendant` names the
  chosen result, the count of results is announced, Escape closes and the focus returns to the button. Keyboard hints
  show only where there is a keyboard. Mirrored in Arabic; still for reduced motion.
- **Shared.** The chip row that scrolls sideways with fading edges and arrows is now one component
  (`components/scroll-row.tsx`), used by the gallery and the search.

**Found on the way: the language cookie.** Checking the live site showed a `NEXT_LOCALE` session cookie on any page
read with a browser in another language (a German creator page in an English browser). That broke "creator pages set
no cookies". The cookie is now off (`localeCookie: false` in `i18n/routing.ts`): every address carries its language,
and "/" follows the browser's language on each visit. A test opens German and Arabic pages with an English browser
and expects no cookie.

**To undo.** Remove `<PeopleSearch />` from `features/marketing/header.tsx`; delete `features/search` and
`app/api/people`.

**Status.** Applied. Tests: 18 unit tests (matching, ranking, mistakes, scripts, index); e2e for opening by button and
shortcut, typing, arrow keys, chips, no results, phones, Arabic, "nothing typed leaves the browser", and axe on the
open dialog in three languages, light and dark.
