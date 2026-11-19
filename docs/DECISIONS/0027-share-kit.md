# 0027 — Share kit: link previews and pictures to post

**Context.** The founder asked for "a feature that lifts the site". A link-in-bio page only works
when people open the link, and two moments decide that:

- **The shared link.** Linkyo had no Open Graph images at all, so WhatsApp, iMessage, X or LinkedIn
  showed a bare grey link.
- **The creator's own post.** Creators announce their page in stories and posts, and had to build
  that picture elsewhere.

**Decision.**

- **Link previews (`opengraph-image`).**
  - **Every page:** examples, concept pages and prepared pages get a 1200 × 630 card in their own
    template (page color, display face, accent pill). It carries the photo melting into the page,
    the name, one line and `linkyo.app/<name>`.
  - **Labels:** examples and concept pages carry their label on the card too ("Example ·
    Music", "Concept · Name"), as on the page.
  - **The site itself:** it has a brand card, the promise next to three example pages, in de, en
    and ar.
  - **Build:** the cards are drawn at build time (static params) with Satori from bundled fonts and
    photos. No request leaves the server, and the server bundle needs no assets.
  - **`metadataBase`** comes from `NEXT_PUBLIC_SITE_URL`, else Vercel's production domain, so
    preview URLs are absolute.
- **Arabic on the cards.** Satori shapes Arabic letters but has only partial bidi. We measured it
  on the renderer:
  - an Arabic run joined by no-break spaces is ordered right to left with natural spacing;
  - plain spaces lay words out left to right with oversized gaps.

  `RtlText` therefore breaks lines itself (estimated at 0.62 em per character), splits each line
  into Arabic, Latin and sign runs, and places the runs from the right. Arabic names stay on one
  line.
- **Pictures to post (dashboard, Home → "Image for story & post").**
  - **Formats:** story 9:16 (1080 × 1920) or feed post 4:5 (1080 × 1350).
  - **Drawn in the browser:** a `<canvas>` uses the page's own resolved fonts and colors, with
    native Arabic shaping and right-to-left order, and greyscale for Mono.
  - **Sharing:** the picture goes through the system share sheet when it can carry files (straight
    to Instagram on phones), else it downloads.
  - **Tips:** a link sticker for stories, "link in bio" for posts.
- **Token rule.** Generated pictures are drawn in pixels on a fixed canvas, which cannot read CSS
  variables. `opengraph-image.tsx` and `features/share/*-card.{ts,tsx}` are therefore exempt from
  `linkyo/no-raw-design-values`. Their colors still come from the creator theme or the brand
  tokens.

**Consequences.**

- Build time grows by about 10 s for around 100 cards.
- Creator pages served from the database (Phase 1) will render their card on request and cache it,
  and the same `ogCard` is reused.
- Faces that only ship as WOFF2 (Inter, Space Grotesk, Bricolage, Playfair) fall back to Geist or
  Instrument Serif on cards. The page itself is unchanged.
