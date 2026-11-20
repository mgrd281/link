# 0051 — Try it before signing up: a playground instead of numbered steps

**Context.** The founder looked at the four numbered steps of 0050 on a phone and said: "Steps in order, I don't want
that, it is not modern." And about "Link einfügen. Fertig.": "I want a modern design; maybe something where the
visitor can try how it works before starting. Ease of use."

**Decision.**

- **No more steps.** The step bar, the numbers and the four rows of 0050 are gone (`step-rail.tsx`,
  `look-switcher.tsx` and `paste-demo.tsx` are removed).
- **A playground: "Probier's aus. Deine Seite, live."** (`features/marketing/playground.tsx`, section `#try`, right
  after the template strip).
  - Three tabs, like an editor in an app: **Name**, **Links**, **Look**. All panels share one cell, so switching
    never changes the card's height.
  - Beside the controls (above them on phones, so both fit one screen) the page grows as it is made: the initials in
    the accent color (as new pages start, before a photo), the name, the address that follows the name
    (`linkyo.app/lea-hartmann`), the links as buttons in the look's style, Linkyo's mark at the foot.
  - Links go through the real detector (Spotify, YouTube, Twitch, shops …); four are enough to try it. Looks are the
    real theme engine; the last swatch takes any color.
  - The first time it scrolls into view it fills itself in once (a name typed letter by letter, two links pasted,
    Pulse picked; about six seconds) and stops for good at the first touch. What it typed stays and is selected on
    focus, so typing replaces it. With reduced motion the finished example simply appears. Only the visitor's own
    additions are announced.
- **"Diese Seite sichern" keeps the work.** It opens sign-up with the address, the name and the look in the address
  (`/signup?name=lea-hartmann&display=Lea+Hartmann&template=daylight&accent=ff7a00`); the new page starts with that
  look and name (`start.displayName`, checked on the server like the rest of `start`). The links wait in this tab's
  session storage (`features/account/try-draft.ts`: no cookie, sent nowhere, removed once used) and are already
  filled in at the welcome flow's links step. Picking a kind there no longer replaces a look chosen in the
  playground.
- **Everything else as tiles** (a bento, `#features`): "Teilen wie ein Profi" (wide: the link preview and the story
  picture), "Drei Sprachen, beide Richtungen" (Hallo · Hello · مرحبا), "Jede Farbe lesbar" (four very different
  accents with the text color the engine chose and an AA mark), "Analytics ohne Cookies" (wide: the privacy points
  and the sample card counting up). Wide and narrow, then narrow and wide, on wide screens; one column on phones.
- 0050 stays valid for pricing, FAQ, the last card and the footer.

**Status.** Applied. Tests: links become blocks in the preview, examples, the limit of four; name, address, looks,
any color, tabs and radios with arrow keys; the self-demo fills in name, two links and a look quietly and stops at a
touch; on a phone the preview and the controls share a screen, and "Keep this page" carries name, address, look and
links through sign-up into the welcome flow; axe on the homepage in three languages, light and dark.
