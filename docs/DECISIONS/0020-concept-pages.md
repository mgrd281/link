# 0020 — Concept pages for well-known people (unlisted, labelled, sourced)

**Context.** The founder asked again for pages for real celebrities: footballers, business leaders,
politicians, singers, actors and a YouTuber. They want them as showcases of what Linkyo can do.
ADR 0019 keeps them out of the public template gallery, because using a famous person's name or
likeness to advertise a product without consent is unlawful in Germany (KUG § 22, general right of
personality).

**Decision.**

- **Concept previews, not templates.** Each person gets a page at `/p/{slug}` built from the same
  `PREVIEWS` registry as prepared creator previews (ADR 0015). The pages are unlisted, `noindex`, not in
  the gallery, the sitemap or any menu, and only reached by a direct link.
- **Labelled on the page.** Every page shows a "Concept · {name}" badge. Its info sheet says the page is
  not the person's official page and that Linkyo is not affiliated with them. The page is never
  marked verified. The call to action is a plain "Create your own page".
- **Facts only from checked sources.**
  - Taglines, bios and stats are taken from Wikipedia, official sites and recent reporting (as of
    November 2026).
  - Social links go only to official accounts confirmed by an official site, Wikipedia or the
    platform. Any link that could not be confirmed is left out.
  - Videos are official uploads, each checked with YouTube oEmbed. They play only after a tap, in
    YouTube's privacy mode (youtube-nocookie.com).
  - Articles go to Wikipedia, the person's own site or reputable outlets, with the page's language
    first.
  - Politicians get neutral, official facts only.
- **Photos.**
  - **Free-licensed:** portraits from Wikimedia Commons (CC BY, CC BY-SA, public domain). They are
    resized and kept in `assets/stars`, credited on the page and listed in `assets/stars/CREDITS.md`.
  - **No free photo:** the person's own official video thumbnail is used instead (Al Shami).
  - **Neither:** a typographic monogram (Taim Hassan).
- **Generated data.** `features/previews/stars-data.ts` and `stars-media.ts` are generated from the
  research notes. `stars.test.ts` checks every page in de/en/ar:
  - the page is valid and never verified;
  - links are https and never example.com;
  - video IDs are well-formed;
  - every page carries the concept flag and a credit.
- **People (12):** Lionel Messi, Cristiano Ronaldo, Mohamed Salah, Elon Musk, Jeff Bezos, Donald J.
  Trump, Friedrich Merz, MrBeast, Taylor Swift, Al Shami, Taim Hassan, Nadine Nassib Njeim.

**Consequences.** A label and a credit lower the risk but do not remove it. Copyright licences do not
cover personality rights, and some Commons pages carry personality-rights warnings. Before any concept
page is shared beyond a demo, the founder should get legal advice or, better, contact the person's team
and turn the page into a prepared invite (ADR 0015). Facts age: stats and club names need a check
whenever a page is shown again.

**Status.** Applied.
