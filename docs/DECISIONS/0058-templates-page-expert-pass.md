# 0058 — Templates page: an expert pass, better photos, and agent skills

**Context.** The founder asked to improve the whole templates page (`/templates`) to an Apple-grade
level on phone and desktop. They also asked for the best possible photos on the template cards
("Arjun Mehta has a bad photo"), and for as many agents as possible plus more skills from GitHub.

**How it was done.**

- **Photo audit.** Two reviewers scored all 87 cards; 49 scored 6 or less. Pages of real people and
  logo cards were left alone.
- **Photo search.** One agent per weak card searched for a better Unsplash photo: free license only
  (never Unsplash+), adults, no brand logos, no celebrities, not already used.
- **Photo judging.** An independent judge compared each proposal with the old card, checked the
  crops, and found the photo page and photographer. It also checked that the uploader is plausibly
  the rights holder, using the CDN's embedded metadata.
  - 16 cards got a new photo (15 replaced in place, plus Sami, who no longer shares Nina's travel
    picture). Judges rejected more than half of the proposals:
    - visible brand logos (Columbia, Nike, a gym-equipment brand);
    - a retoucher re-uploading a client shoot, and two photos uploaded by the subject or the
      client rather than the photographer;
    - a removed account, and a photo removed from Unsplash although its file still loads;
    - a real professional from a documentary photo series, which would have shown her as a
      fictional political candidate;
    - faces hidden by a VR headset or by hair;
    - stock poses;
    - pictures that turned flat under a duotone.
  - Pages that play a moving hero clip (Mara, Lina, Timo, Clara) keep their photos, because the clip
    shows the same person.
- **Page reviews.** Eight expert reviews ran against the live production build, with screenshots,
  measurements, axe and keyboard walks in de, en and ar: desktop, iPhone, conversion, motion,
  performance, accessibility and RTL, visual design, and copy and IA.

**Decision.**

- **Photos.**
  - Each accepted photo replaces the example's file in place, so `media.ts` keys stay as they are.
  - The focal point in the catalog is updated.
  - A tall photo is cut to 4:5 around the face, because posters and other crops are centered.
  - CREDITS.md names the photographer and the photo page.
  - Gallery cards now honor the focal point (`MediaImage` takes `focal`), so no face is cut.
- **Words.**
  - Each card is a "Vorlage / template / قالب" everywhere, matching the nav and "Use this template".
  - Counts are real, not "70+". Arabic counts use full ICU plurals.
  - The lead says what you get: the design, with your own photo and links. That line now also shows
    on phones under the button.
  - Sign-up from a template confirms the choice.
  - Category names no longer overlap: "Online verkaufen", "Unternehmen", "Politik & Vereine",
    "Prominente".
- **Order and search.**
  - The gallery opens with its most vivid pages.
  - The visitor's own language comes every other card, so Arabic visitors no longer meet two
    foreign-language pages first.
  - People pages are ordered by relevance to creators.
  - Search matches professions in all three languages ("lawyer" finds the German lawyer).
  - Typing settles for a moment, and the results come in as one wave.
- **Hero.**
  - The headline is the homepage's hero size, with no fade on the headline, so the first cards
    show on a laptop screen.
  - The wall is as tall as the intro and is rendered on the server (no script).
  - Its first rows load first, and on phones it skips the rows the band never shows.
- **Filter band.**
  - Search, language (DE/EN/AR codes, the visitor's language first) and categories share one sticky
    band.
  - The selected chip uses the brand teal.
  - Chips that would find nothing step back.
  - On very short screens the band scrolls away.
- **Cards.**
  - Chips sit on the page's opaque surface for contrast, aligned with the name.
  - The tagline takes one line; on phones it shows only its first part.
  - There is no tilt. Lift and zoom happen as one move on the spring.
  - The focus ring rises with the card.
  - The pages' own typefaces load after the first screen.
- **Preview.**
  - **Shape:** on phones and tablets it is a real sheet (grabber, filled surface, pulled down by its
    top bar or its panel). On desktop a click beside it closes it.
  - **Moving between pages:**
    - the next page comes in from the side it was asked for, in its own background color;
    - the spinner only shows after 400 ms;
    - the pages either side are fetched ahead.
  - **Self-scrolling:** it eases in and out and stops on any key or tap in the preview. A pause button
    starts it again (WCAG 2.2.2).
  - **Keyboard:**
    - "Use this template" is one Tab away;
    - the scroll keys scroll the page;
    - Escape and the arrows work even inside the page;
    - focus returns to the card of the page last shown.
  - **Screen readers:** prev and next are announced, and the preview describes itself.
  - **Reduced motion:** a short crossfade instead of a cut.
- **Everywhere.**
  - Radix components follow the page's direction (Arabic menus, toggles and tooltips run right to
    left).
  - The notification landmark is named in the page's language.
  - "/" jumps to search only while focus is in the gallery (WCAG 2.1.4).
- **Tokens.** New motion tokens:
  - `motion.delay.glide` (1200 ms) and `motion.delay.spinner` (400 ms);
  - `--animate-scrim-in`, `--animate-page-in` and `--animate-spinner-in`;
  - `mk-settle`, an entrance without a fade.
- **Skills.** 17 more open-source skills were vendored. Each was read in full twice, and every
  change is marked. See `.claude/skills/README.md`.

**Left for later** (measured, with reasons):

- **Translations.** Every page ships all translations: the provider passes no `messages`. Trimming
  them helps every route, needs a per-route provider, and gets its own change.
- **Preview script.** The preview dialog's script could load on first touch, and card pictures could
  resolve on the server.
- **Photos.** Some cards found no clearly better free photo (Lena Vogt, Halawiyat al-Sham, Zwei Kaffee,
  Julia Brandt, Maya Lin and others); they keep their photos. For Maya Lin, a still-published frame
  from the same shoot (Joel Mott, `kvxohKMEWbE`) is a candidate that has not been judged yet.

**Status.** Applied.
