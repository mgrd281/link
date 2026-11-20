# 0052 — The playground shows the real page on a real phone

**Context.** About the playground of 0051, the founder said: "I meant a real simulation." They want the first
experience to be very easy and very modern. The preview in 0051 was a sketch: initials, a name and a button for
each link. A visitor could not see what their page would actually look like.

**Decision.**

- **The real page.** The phone in the playground (`features/marketing/try-phone.tsx`) runs the same renderer as
  creator pages, the dashboard and the welcome flow: `PosterRenderer`, with the same templates, hero, sections and
  blocks. A new account starts from the same profile and blocks.
  - Pasted links go through the real detector and become the real blocks (`blockFromLink`).
  - Songs and videos the visitor pastes get their real title, artist and cover from our server
    (`/api/link-metadata`, as in the app; platform pictures are re-served by our image optimizer, ADR 0026). Visitors
    never contact a platform.
- **A real phone.**
  - The page is laid out at a phone's real width (390 px, layout token `preview`) and scaled to fit the frame.
  - Status bar with the island, the browser's address bar with `linkyo.app/<address>`, and the home indicator.
  - It scrolls inside (wheel, touch, or the arrow keys once the screen has focus). It cannot be clicked: links and
    players are inert in a preview, and the page is not read out a second time, because the controls already say
    what is on it.
  - After a change it scrolls by itself: to the newest block, or back to the top for the name and the photo. The
    page's photo softens as it scrolls away, so the top is where it shows best.
- **Profile, Links, Look.**
  - The first tab is now **Profile**: a photo and the name.
  - The photo is resized in the browser (`prepareImage`, as in the app) and appears at once in the page's own hero:
    a portrait, toned in Pulse, black and white in Mono.
  - The example links (Spotify, YouTube, Twitch, Shop) are **samples**: a release with its cover, a live video, a
    live channel and a record in the shop, all with Linkyo's own sample pictures. The release carries the typed name
    as its artist. Examples are never looked up and never carried into an account.
- **A persona introduces it.** The founder asked for "a character, very elegant, with colors and arrangement: this
  is marketing, it must be the best it can be". The self-demo is now **Juno Kade**, the fictional DJ from the
  template gallery (`try-samples.ts`, `PERSONA`). Their portrait appears, the name and the line "DJ · Producer · House &
  Disco" are typed, Instagram (an icon under the name), the single "Afterglow" with its cover and a rooftop live set
  are pasted, and their own look is picked: Nocturne, pink on night blue, stage type, filled pill buttons. It takes
  about ten seconds, starts on Daylight so the change of look shows, and runs once. The persona's name, line, photo
  and links stay on the homepage.
  - The five looks are complete looks from the gallery, one per template: Juno Kade's Nocturne, a vivid sky Daylight,
    an amethyst Pulse, a wine Atelier with the elegant type, and Mono.
  - The Profile tab has a third field, **one line about you** (the page's tagline).
  - Pasted profiles (Instagram, TikTok, X, Threads, LinkedIn, Facebook, GitHub, WhatsApp, Discord) become icons under
    the name, as in the welcome flow; up to six links.
  - The visitor's line and the whole look (page color, type, buttons, not only template and accent) go to sign-up in
    the draft. Sign-up starts the page with that look, and the welcome flow applies it again for sign-ups that skip
    the email form.
- **A guided demo shows how a page is made, completely.** The founder asked to "show the customer how to build a
  page professionally, completely: the best simulation". The persona's page is now built by a visible cursor in the
  real controls, like a screen recording but live.
  - The cursor moves to each control and taps it, with a ring opening from its tip:
    - the photo button (the portrait appears);
    - the name and the line, each focused and typed;
    - the Links tab, then three links, each pasted into the field ("Recognised: …") and added with +;
    - the Look tab, Pulse first, then the persona's own look;
    - the phone says "Your page is live", and "Keep this page" lights up.
  - Above the tabs, a thin bar of five segments and the step's name: Add a photo, Your name and a line, Paste your
    links, Pick a look, Live. It takes about twenty seconds.
  - Afterwards, or as soon as the visitor touches anything, the bar says "Your turn – just start" and offers
    **Watch again** (from an empty page) and **Start empty** (photo, name, line, links and look cleared). Before it
    has played, it offers **Watch**.
  - With reduced motion there is no cursor: the finished page appears, and the same buttons are there.
  - The demo's fields are only shown as focused; real focus never moves, so the page does not scroll by itself and
    nothing is announced.
- **One card, like an app window.**
  - Computers: the controls on the reading side and the stage with the whole phone on the other.
  - Phones: the stage first, showing the upper part of the phone (it scrolls to each change), then the tabs and
    "Keep this page".
- **What goes to sign-up is only the visitor's own work.**
  - Their name, address and photo; the photo waits in session storage like the links (`try-draft.ts`, checked as a
    resized JPEG/WebP data picture) and becomes the page's photo in the welcome flow.
  - Their pasted links.
  - The look on screen, now always with its accent, so the new page looks exactly like the one in the phone.
  - The self-demo's name and the examples stay on the homepage.

**Update: a luxury persona and a quieter demo.** The founder found the step bar and the Watch again / Start empty
buttons too busy and asked for "a more modern design" and "a very luxurious persona: this is the example, it must
be the best level possible".
- **Lou Ferreira** replaces Juno Kade: the fictional silk, jewellery and fragrance designer from the template
  gallery (`PERSONA` in `try-samples.ts`). Line: "Silk · Jewellery · Fragrance". Her links: Instagram (an icon under
  the name) and two pieces from her shop, side by side with picture and price: the "Soleil" gold necklace and the
  "Ambre" eau de parfum. The other examples are YouTube (a gala look) and TikTok. All are samples, as before.
- **Her look is Nocturne in black and gold:** the `gold-leaf` accent, the elegant serif and outlined pill buttons.
  The demo starts on Mono (black and white), so the change to gold is the last thing it shows. The "Your page is
  live" note in the phone takes the page's accent: gold.
- **No step bar and no buttons under the tabs.** One round icon button sits in the corner of the stage: Watch
  (play) before the demo and Watch again (replay) after it. It steps aside while the demo plays. A touch still stops
  the demo where it is. To clear the page, a visitor removes rows in "On your page".
- **The stage is deep teal** (`teal-900`) with two quiet rings behind the phone (hairline and a step in the fill,
  no shadows), so the black-and-gold page reads as the object on display.
- Shop rows in "On your page" show a bag, whichever shop system the link runs on.

**Update: the phone no longer catches the scroll, and the card fits the screen.** The founder, on a laptop:
"when scrolling down, it must not go down", and "a bigger improvement, the best user experience possible".
- **No scroll trap.** The phone's screen was a scroll area that kept the scroll (`overscroll-contain`): with
  the pointer over the phone, scrolling moved Lou's page inside the phone and the website stood still. Now
  the wheel, a trackpad and a finger over the phone scroll the website, as anywhere else. The page in the phone
  scrolls by itself to each change, can be dragged with a mouse like a phone (a grab cursor), and scrolls with
  the keys once it has focus.
- **Nothing moves by itself.** On wide screens the card has a fixed height: as tall as the screen allows under
  the header, 40 to 50 rem (`mk-play`). The controls, the whole phone and "Keep this page" are in view at once.
  The phone is sized from that height (`mk-play-phone`), so it is as large as possible. The three tabs share one
  cell, and the demo's links fit without making it taller, also on phones (the example chips stay on one
  row there and scroll sideways). The website never scrolls or shifts while the demo plays.
- **Panels that fill, no filler.** The "Your editor" header and the separate page outline are gone. Each tab is
  one full panel:
  - Profile: the photo large on a quiet stage, with the note that it stays in the browser until sign-up;
    then the name, the line and the address.
  - Links: the paste field and examples; below, "On your page · 3 of 6", each link with its picture or icon,
    its title and a detail (the price, the @handle, the video's length, the artist or the site).
  - Look: every look as a little page in its own colors, type and buttons, with the visitor's photo and first
    name, and any color as a sixth card.

**Status.** Applied. Tests:
- a pasted song shows its real title and artist (metadata stubbed in the test);
- an example shows its sample;
- the limit of four;
- the phone lays the page out 390 px wide and scales it down, scrolls to the newest block and back with the
  keyboard, and holds no link that can be followed;
- the wheel over the phone scrolls the website and leaves the phone's page where it is; a mouse drag scrolls it;
- while the demo plays, the website does not scroll and the card keeps its height;
- each link's row shows its real title, a shop piece its price, and the count "6 of 6";
- a photo goes onto the page and comes off again;
- the guided demo: photo, name, line, Instagram icon, the two shop pieces, Nocturne, "live", then only Watch again
  (no Start empty, no Clear);
- Watch, which steps aside while it plays, and a touch that stops it;
- on a phone, name, photo, own link and look reach the welcome flow and an example does not;
- axe on the homepage in three languages, light and dark.
