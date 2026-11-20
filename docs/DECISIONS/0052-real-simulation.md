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

**Status.** Applied. Tests:
- a pasted song shows its real title and artist (metadata stubbed in the test);
- an example shows its sample;
- the limit of four;
- the phone lays the page out 390 px wide and scales it down, scrolls to the newest block and back with the
  keyboard, and holds no link that can be followed;
- a photo goes onto the page and comes off again;
- the persona: photo, name, line, Instagram icon, single, live set, their look;
- on a phone, name, photo, own link and look reach the welcome flow and an example does not;
- axe on the homepage in three languages, light and dark.
