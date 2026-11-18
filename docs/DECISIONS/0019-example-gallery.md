# 0019 — Example gallery (/templates): 40 fictional pages, each in its own look

**Context.** The founder wants templates that customers can browse, open and preview: about 40 examples
covering football stars, business leaders, politicians, well-known singers and actors, YouTubers, lawyers,
engineers, logistics, a bank, shops and more. Each should be different. The founder suggested real
celebrities (Messi, Ronaldo, Musk, Trump, al-Shami, Taim Hassan).

**Decision.**

- **No real celebrities.** Using a famous person's name or likeness to promote a product without
  consent is unlawful in Germany (KUG § 22, general right of personality; BGH case law on advertising
  with celebrity images) and reads as a fake official page. The gallery uses **fictional people and
  businesses** for every requested role. Real creators get a private, unlisted preview made for them
  (ADR 0015), never a public template.
- **41 examples in 8 categories** (`features/examples`):
  - Creators: YouTuber, food, fitness, beauty, comedy, streamer, travel, photographer, painter,
    writer, journalist.
  - Music & podcasts: Arab singer, international pop star, podcast.
  - Sport: footballer, women's footballer, amateur club.
  - Film & TV: actor, actress.
  - Business: tech founder, investor, bank, real estate.
  - Public life: mayoral candidate, councillor, charity.
  - Local businesses: bakery, Arab sweets shop, trattoria, barber, dentist, car workshop, yoga studio,
    care service, wedding planner, jewellery store.
  - Careers: lawyer, engineer, warehouse & logistics, student, tutor.

  Each page is in its own language (German, English or Arabic) and its own look: one of 5 templates,
  an accent from a named token palette (`creator.swatch`, no raw colors in app code), light, dark or
  vivid mode, one of 8 font pairings, and a button style and shape. A unit test checks that no two
  looks are the same.
- **Honest by construction.** Every link goes to example.com. Phone links use an undiallable number.
  Every page carries the "Example · {category}" label and noindex. Photos are Unsplash stock (license
  checked per photo, credits in `assets/examples/CREDITS.md`). Logos are original artwork.
- **The gallery** has category filters and themed miniatures in each example's real colors and fonts.
  A preview opens in a phone frame (the real page in an iframe) next to "Use this template", which
  opens `/signup?kind=…&look=…`. The new account starts with that exact look and kind, and the welcome
  flow asks the questions for that kind. The site menu, footer and home page link to it.

**Status.** Applied.
