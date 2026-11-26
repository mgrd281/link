# 0069 — Laufbahn: a template for applications, CVs and personal profiles

**Context.** The founder wants Sevag Ghazarian's application page (a prepared preview, ADR 0067's
`/de/p/<slug>`) to look world-class on phones and on desktops. It ran on Werkbogen, a portfolio
template whose hero opens with a piece of work; an application page has no work to open with, but a
role, a few numbers, skills, a path and a cover letter. Other people applying for jobs, students and
anyone with a CV need the same, so the answer is a template every user can pick, not a one-off page.

**Decision.** A fourteenth Poster template, **Laufbahn**, built from two new layout values and a few
small renderer branches keyed on them. Every other template renders exactly as before (the portfolio
baseline review stays byte-equal).

| Key | Value | What it does |
|---|---|---|
| `hero` | `bleed` | Phones and tablets: the picture from edge to edge, about three quarters of the small viewport tall (`clamp(24rem, 72svh, 160cqi)`, so a phone preview in the dashboard keeps a phone's proportions), a veil of ink at the secondary opacity tied to the words (not to the picture's height, so they keep AA on a landscape phone or at 200 % zoom), the role line as a quiet dark-glass chip with the portrait or the initials, the name in white set as large as its longest word allows and never taller than 12svh. When the picture is the portrait itself, it rides high in a square on phones and fades into an ink ground, so the words stand below the face. Below it on the page: the sentence, the numbers in a row between hairlines (tabular figures), then two buttons (see "Round 2"): the page's first action, filled, and "Teilen", outlined. Without any picture an accent field carries the initials. The wide canvas: one twelve-column composition, the words on the first five columns (a two-word name on two lines), the picture as a tall rounded plate on the last six. |
| `headings` | `signpost` | Every titled section is announced by a square signpost with a bold letter in the display face, like the signs over a warehouse's aisles (A, B, C …; Arabic pages in the abjad order أ ب ج د ه و ز ح ط ي). The same signposts form the page's section index: a sticky row of chips on phones, chips that wrap in the reading column on tablets, a sticky list in the first three columns on the wide canvas; each marks the section being read (see "Round 2"). Without an index (one titled section or none) the sections take the first eight columns, under the hero's words. Round 3 removed the letters and the phone index (see below). |

The rest of the template is tokens: Inter for both faces (`classic`), a cobalt accent (#1E50C8) on a
very light cool canvas (#F5F6F7), soft rounded buttons, `motion: "reveal"`, the wide canvas, the
gallery grid, plain social icons, 700 for Arabic names.

- **Why Inter (`classic`).** One neo-grotesk for the name and the text keeps the hierarchy to size
  and weight alone (the restraint of Apple's and Linear's pages), reads well in a long letter,
  covers German fully and has true tabular figures for years and numbers. The other pairings were
  weighed: Bricolage is too playful for an application, Space Grotesk's quirks tire in a long letter,
  Geist's partner is a monospace body.
- **Section frame.** A hairline across, the signpost and the title (h2), then the content. Untitled
  runs (before the first title, the contact band) have no signpost. On the wide canvas the content
  takes eight columns beside the sticky index. One sticky column instead of a sticky title per
  section and a separate index: the index *is* the title column, so titles are not repeated beside
  each other and there is one navigation landmark.
- **Own renderers for four blocks; the rest reused.** About, skills (`tools`), experience
  (`timeline`) and text, as described under "Round 2" below. Links, music, videos, products, projects
  (with their layouts and pages), quotes, clients, the contact band and everything else keep the
  renderer they have in every template.
- **Motion, CSS only.** The hero's lines rise in once (`poster-rise`); the title rows, contents,
  tiles and steps rise within the first 8 rem of entering the screen (`lb-reveal`, a view timeline,
  movement only: nothing rests faded at the fold of a large screen; a section that rises as a whole
  does not let its tiles rise again); the picture eases in a little as the hero scrolls away (`lb-zoom`);
  the timeline's rail fills with the accent as its steps scroll by (`lb-fill`). All of it is
  behind `@supports (animation-timeline: view())`, and everything that moves is off with
  `prefers-reduced-motion`: the rail is then drawn in full and every section is simply there. No
  scroll hijacking and no new dependency; the only scripts are the section index (below) and the
  share button.
- **Accessibility.** One h1, one h2 per section (the letters are decoration), the index a `<nav>` of
  plain anchor links. A Laufbahn page gives the document a scroll padding for its fixed chrome (the
  compact bar, a dock), so anything focused or jumped to stops below the bar (WCAG 2.4.11); it is
  scoped with `:root:has(.lb-section)`, so other templates scroll as before. "Read on" names its
  destination for screen readers, white text only over the veil (at least about 6 : 1 on any picture)
  or the chip's dark glass, figures such as "40+" isolated left to right on Arabic pages. Arabic pages are mirrored by
  logical properties only and never tracked or set in capitals.
- **Picture sizes.** The hero picture covers its plate, so `sizes` asks for the width it is really
  drawn at (a 4 : 3 photo in the phone plate is about twice the screen wide), from the picture's
  stored size when there is one. Sharper on phones and Retina screens, at the cost of more bytes for
  the LCP picture (the stored file caps it).
- **Sevag's page** now uses Laufbahn in `navy`, the blue of the pallet racks in his picture. Every
  fact of the page stays and none is added. It has no contact block (no phone number or e-mail is
  known yet); the hero's first action is then "Anschreiben lesen", beside "Teilen". The case with a
  contact block is covered by a test fixture, not on his page.
- **Everywhere templates are counted or listed:** tokens (and the generated files), the picker card
  (the picture from edge to edge with the name in white at its foot, and a lettered signpost), `templates.laufbahn.description` and every "thirteen templates"
  sentence (now fourteen) in de/en/ar, the AI catalogue (`core-v3`, `plan-v3`: one more template and
  nothing else), the team console's count. No example page was added: no test or screen requires one
  per template.

## Round 2: phone first (the founder's review)

On a 390 px phone the first version had twelve identical tall skill tiles numbered 01 to 12 with
words hyphenated by the browser ("Kommissionie-rung"), one lone button, an index that was cut at
the edge and not sticky, a lead of eight large lines, short sections that read like leftovers, a
1,700-character letter as one long scroll and almost no icons. Everything below is template-level:
every Laufbahn page gets it, and every other template renders exactly as before.

- **Icons from the owner's words** (`laufbahn-content.ts`, unit-tested in de/en/ar with positive
  and negative cases). A curated map of about forty rules, most specific first, one lucide set at one
  stroke: German compounds are read by their head (a "Seitenschubstapler" is a forklift, a
  "Staplerschein" a licence), English by whole words and their usual forms, Arabic after its
  proclitics and short vowels are set aside ("والفريق" is the team). Each rule lists the look-alikes it
  must never take ("Schlager", "Kugellager", "Versicherung", "Gutschein", "Bewerbung" for advertising,
  "gefahren" for hazards, "Photovoltaik" for cameras, "Fahrzeugpflege" for nursing, "Jahresabschluss"
  for degrees, "Absprachen" for languages, "Hochstapler" for forklifts, an English "lager",
  "إفريقيا"). A language named by its name ("Englisch", "Arabic", "عربي") counts only when the text
  says nothing else but a level ("Englisch (C1)", "Arabic (native)", "اللغة العربية"), so "Italian
  cooking" or "طبخ عربي" is cooking. "القيادة" alone is leadership, not driving; "ورشة" alone is a
  garage, only "ورش العمل" are workshops. A page reads its own language's patterns and English. Neutral
  icon where nothing fits: a check (skills) or a light bulb (notes).
- **Skills, a bento of flat tiles.** Two columns on phones, three from tablets on; the first skill
  leads across from five skills on. Every tile lies flat: the icon in a soft accent square (`lb-soft`:
  the accent at the pressed opacity over the surface) beside the label (body size, semibold), both
  centred in a row of one height (56 px; 60 px for a label of two lines). No automatic hyphenation
  (`hyphens: manual`, `text-wrap: balance`): long German compounds get soft hyphens at their joints only
  ("Flurförder|zeug|schein", "Versand|dokumente", "Kommissio|nierung"). A label shares a phone's row
  only when it fits beside its icon in at most two lines on a 390 px phone and no piece of it is wider
  than the room beside the icon on a 360 px phone (`fitsBeside`); otherwise it takes the whole row,
  where it is one line. So that half tiles still pair up, the next half tile may move up past at most
  two such rows (`pairUp`; the first tile never moves, no tile moves more than two places, and the DOM
  follows the same order, so a screen reader reads what the eye scans). On a screen narrower than
  360 px a label whose piece does not fit beside its icon wraps under it rather than break a word
  (flex-wrap on a `min-content` basis). From tablets on, a last row of one tile after a row of three
  is set as one and two, then two and one. `break-words` stays as the last resort. No numbers.
  Measured on Sevag's twelve skills at 390 × 844 (and the same at 360 × 780): the grid is 518 px, the
  section 615 px, against 678 px and 783 px in round 1. (Round 2's first draft gave 681 px and 723 px at
  360; the "about 900 px" once quoted for round 1 was wrong.) The brief's "well under 600 px" holds for
  the grid, not for the section with its title: twelve labels of up to 25 characters at body size take
  eight rows of two columns, and the only ways under that (smaller labels, 8 px around a two-line label,
  no lead tile) were judged worse.
- **Hero buttons.** The page's first action, filled: the contact block's primary action; without one,
  "Anschreiben lesen / Read the letter / اقرأ الخطاب" when the page has a cover letter (a long text
  under a title that names a letter in the page's language — an English "brief" is not one — or one
  that opens with a salutation and closes with a greeting), else "Weiterlesen / Read on" to the first
  section. Beside it "Teilen / Share / مشاركة", outlined: the native share sheet; where there is none, or
  the browser refuses it, the address is copied, the icon turns into a check for as long as every copy
  button's confirmation and a polite live region says "Link kopiert." (or that it could not be copied).
  A visitor who closes the share sheet has decided: nothing is copied, nothing is said. The label stays
  "Teilen", which is also the button's name (WCAG 2.5.3). 48 px, the template's button radius, scale on
  press, the focus ring; side by side when both fit (they do at 360 px), else stacked at full width.
  They stand before the numbers, so on a phone they are on the first screen (390 × 844: 739–787 px;
  360 × 780: 693–741 px). With a contact block its status line stands above and its CV link below.
- **Section index on phones.** Sticky flush under the compact bar once the hero has passed, one row of
  44 px chips (52 px with its band), a hairline under it only while it is stuck (a scroll-state query).
  The bar above it is solid on Laufbahn pages too (the page's ground, no glass), so nothing shows
  through the top of the screen. Where scroll-driven animations are missing, the bar never shows, so
  the index sticks to the top edge instead. On short screens (`short`, as every sticky bar) it stands
  in the flow. A tiny client component marks the section being read with `aria-current` (an
  IntersectionObserver on a thin band at 35 % of the screen, the last section once the end of the
  content is on screen; nothing is marked before it runs, so without the script no chip claims to be
  current), keeps that chip and a chip reached with Tab whole in the row (scrolling the row only) and
  fades the row's edges, as wide as its padding, only while more chips lie beyond them (no mask
  otherwise, so no focus ring is clipped). The same marking replaces the wide canvas's scroll-driven
  spy. The content under the index has a scroll margin of the index's band (`lb-under-index`, keyed to
  the same container width as the index's stickiness), so a heading jumped to or focused stops below it
  (2.4.11). The stuck chips themselves sit inside the band the document keeps clear for the bar; a
  negative scroll margin as deep as that band exempts them, so moving along them with Tab or Shift+Tab
  scrolls the row, never the page. Anchor jumps glide unless reduced motion is asked for.
- **About.** The lead at the title size on phones (18 px at the body's line height), h3 from tablets,
  h2 on the wide canvas. A first paragraph longer than 180 characters leads with its first full
  sentence (`splitLead`: never after an abbreviation, a single letter or an ordinal), and the rest of
  it opens the body: four lines at 390 px, five at 360 px for Sevag. The facts as a two-by-two sheet of
  cells between hairlines (a value that cannot fit half the sheet takes the row; each cell's column
  can shrink, so with WCAG 1.4.12 text spacing at 320 px a value breaks inside its cell).
- **Text sections by length.** Under 320 characters: a callout (surface tile, hairline, an icon in a
  soft accent square chosen from the section's title by the same map: "Neu für mich: das Tönen" gets a
  paint bucket). Over 900 characters: a reading tile with its reading time; on phones and tablets the
  first two paragraphs, then a native `<details>` ("Ganzes Anschreiben lesen", "Weiterlesen" when it is
  not a letter, "Weniger anzeigen" once open) whose button stays where it was pressed while the rest
  unfolds below it, keyboard and screen readers included, no script; the opened text unfolds briefly
  unless reduced motion is asked for. On the wide canvas, and whenever the visitor arrives at the
  section by its address (the hero's "Anschreiben lesen", the index: `.lb-section:target`), the
  disclosure's content is shown (`::details-content`) and its button is not. Both rules sit inside
  `@supports selector(::details-content)`: a browser without it keeps the button everywhere, so the
  text is never hidden without a way to it.
- **Timeline.** A 32 px icon node per step: a briefcase, or the licence or certificate the role names
  (via the map); filled while the step is still going on; the years level with the node's centre.
- **Rhythm.** On phones 48 between sections, 32 under a section's hairline, 24 between a title and
  its content and between the parts of a content, 16 between paragraphs, 8 between tiles. Signposts
  are 40 px on phones, 48 from tablets on; titles h2 (h1 on the wide canvas). No gap under the last
  section (the end-of-content marker is out of the grid's flow).
- **Not done.** On phones the compact bar and the stuck index together keep 108 px at the top; folding
  the index into the bar would give back 52 px, but the bar carries the contact action on pages that
  have one, so it stays. The icon map ships in the shared renderer chunk (about 12 KB gzip on pages
  that preview creator pages in the browser); loading the signposted renderers lazily there is left for
  a later change.

## Round 3: an app, not a document (the founder's screen recording)

The founder scrolled Sevag's page on an iPhone and asked for four things: a different clip on every
refresh, no "A und B" while scrolling, no words broken in the middle of the skills, and a page that
feels like a real app. Everything is template-level again, and every other template renders as before.

- **No letters.** The letters (A, B, C …; أ ب ج …) are gone from the titles, the index and the picker
  card: on a phone they read as a code nobody needs. A titled section keeps its hairline and its h2 in
  the display face. The layout value keeps its name (`headings: "signpost"`), so stored themes stay
  valid. The template's description in de/en/ar and the AI catalogue follow (`core-v4`: that
  description, nothing else).
- **The app bar is the index on phones.** The sticky row of chips is gone. Once the hero has passed,
  the solid bar's title is the owner's name with the section being read under it and a chevron, as in
  a native app. Pressed, it opens the contents as a sheet from the bottom edge: a native modal
  `<dialog>` (focus moves in and stays, Escape, a tap on the veil and a close button close it, focus
  returns to the title, the page behind is inert and does not scroll). Every section is a row of 56 px,
  the one being read carries a check. Choosing one closes the sheet and lets the link do its own work,
  so the address, `:target` (a letter reached this way opens whole), the back button and the glide all
  keep working. From tablets on the sheet is a centred card. The stuck chrome on phones is now the bar
  alone, 56 px instead of 108 px (Round 2's "not done"). The section being read is the last one whose
  top has passed a line at 35 % of the screen. The observer's band now ends at that line, so it reports
  the very moment a top passes it; Round 2's band began there and reported the entry a hair too early,
  so a page scrolled by hand named a section only once the next one came (now an e2e test that drags
  4 px a frame, both ways). Tablets keep the chips in the reading column
  and the wide canvas its sticky list, both as words only. The bar's own controls have a negative
  scroll margin as deep as the band the document keeps clear for it, so focusing them never scrolls
  the page.
- **The bar slides in, opaque.** It used to fade in, so the text under it showed through for a moment
  (visible in the recording). It now slides down fully opaque (`lb-bar-enter`, translate only), or
  simply appears for reduced motion. A 2 px reading line in the accent along its foot fills as the
  page scrolls (`lb-progress`, `scroll(root)`, from the right on Arabic pages; absent for reduced
  motion and where scroll-driven animations are missing).
- **Lists, not tiles: every word whole.** Skills are a grouped list, as in a phone's settings: rows of
  at least 52 px between hairlines in one rounded card, the icon in the accent before the label, one
  column on phones and two from tablets on. One column gives each label the whole width, so
  "Flurförderzeugschein", "Versanddokumente" and "Seitenschubstapler" stay whole. The soft hyphens at
  compound joints, the width estimates and the tile pairing (`softJoints`, `fitsBeside`, `pairUp`,
  `packSpans`, `factSpans`) went with the tiles that needed them. The facts are the same kind of list,
  the label small and quiet above its value. `break-words` stays as the last resort for a word wider
  than the phone.
- **A different clip on every refresh (prepared previews).** A preview may name a rotation of library
  clips (`motionRotation`). Sevag's takes turns with the four warehouse clips: Palette packen (his own,
  shown on a first visit and in every link preview), Barcode scannen, Lagerarbeit and Ware scannen.
  Once the page has loaded it names the next clip in its own address (`?clip=<key>`, replacing the
  history entry, the hash kept), and the server shows the clip the address names, so a refresh brings
  exactly the next one, in order, whichever server copy answers. Only the address changes: no cookie,
  no storage, nothing about the visitor is read, and the share button shares the address without it.
  Only that page reads the address, so it alone renders per visit; the other prepared previews stay
  prerendered. Each clip brings its own first frame as the still and its own description in the
  page's language. Everything outside the page itself (the dashboard, a claimed page) keeps the page's
  own clip, the one its owner picks in the motion picker. A first version kept the count in the
  server's memory instead: on Vercel, where several copies answer, 7 of 19 refreshes in a row showed
  the clip before again.
- **Not done.** The sheet closes by tap, Escape or its button, not by dragging it down: a drag would
  need a gesture script for little gain. With a native modal dialog, Tab may step from its last row
  to the browser's own controls (the page behind stays inert).

## Round 4: drawn clips only, one line, modern buttons, calm scrolling (the founder's review of round 3)

The founder looked at round 3 on his phone and asked for four things: no clip that looks like real
video, no line repeated over and over while scrolling, modern buttons, and scroll motion that is
modern and fitting. Template-level again (Sevag's clips aside); every other template renders as before
(the portfolio baseline review: 51 of 51 byte-equal).

- **Drawn clips only on Sevag's page.** The founder does not want real footage on it ("no real video").
  A first take of this round misread his message and put real clips in; they were removed again the
  same day. His page takes turns with the library's three drawn warehouse clips only: "Palette packen"
  (his own: a first visit, the link preview), "Lagerarbeit" and "Scannen von Waren"; the real clip
  "Barcode scannen" stays in the library for other pages but is not in his rotation. A unit test holds
  every clip of his rotation to `kind: "illustration"`.
- **One line where there were many.** No hairline above each section: space and the title separate
  them, as on an app's screen. The facts, the skills, the hero's numbers, the note and the letter stand
  on soft sheets (a step in the fill, rounded) without a frame and without rules between their rows.
  The app bar keeps one hairline at its foot; the reading line is gone. Only the contents sheet keeps
  separators, between the rows of its menu.
- **Modern buttons.** The template's buttons are pills now (`buttonShape: "pill"`; its cards round off
  at 20 px): the first action filled with its icon, "Teilen" a soft grey pill instead of an outlined
  one, the bar's action a compact pill and its share button a soft round one. 44 to 48 px, a scale on
  press, the focus ring.
- **Calm, app-like scrolling.** Nothing in the content moves with the scroll any more: no section, list
  or step rises in, and the picture no longer zooms. The app bar no longer slides in with the scroll:
  it stays away while the large name is on screen and fades in over a short, fixed time once the name
  has passed under it, as an app's large title hands over to its bar (BarReveal: an
  IntersectionObserver on the name sets `data-lb-shown`), so it is never caught half there; with
  reduced motion it simply appears, and without the script it stays away. The header's picture or clip
  drifts a little slower than the words over it (lb-parallax: at most a quarter of its height over the
  hero's exit, so its edge never shows; phones and tablets only). The timeline's rail still fills as it
  is read, so the template's description stays true. All of it is off with reduced motion.
- **Whole words in the numbers too.** The hero's numbers still had automatic hyphenation:
  "Staplerschein" broke as "Stapler-schein" at 360 px. The three now share one sheet (more room for
  each) and wrap between words only; at 320 px a single long word may still break, without a hyphen,
  rather than run off the screen.
- **Measured** on the local production build at 390 px (iPhone 13): the bar 56 px and opaque; the skills
  sheet 592 px with all twelve labels on one line; the facts sheet 260 px with every value on one line;
  each number and its label on one line at 390 and 360 px.

## Round 5: a portrait beside the facts (the founder's screenshot of Werkbogen's "About")

- **With a portrait, "About" is set as Werkbogen's:** the lead, then the portrait on two of five
  columns at the start and the facts on the other three beside it, side by side at every width from
  320 px (in Arabic the portrait stands on the right), then the rest of the text. Beside a portrait
  the facts are a list with a hairline above each row (the label quiet over its value in bold), not
  the soft sheet: the portrait is the step that sets the row apart. Without a portrait nothing
  changes: the facts keep their soft sheet (a unit test holds that markup to the one before).
- **No section numbers.** Werkbogen puts a small "02" before its titles; Laufbahn's titles stay words
  only, as its index and its contents sheet do (round 2: no numbers), so none is added for one section.
- **Sevag's placeholder** is the drawn still of "Scannen von Waren" until his own photo. On the visit
  whose header plays that clip, the portrait takes the header's own still instead
  (`withRotationClip`), so no visit shows one picture twice.
- **Measured** on the demo build with the fictional portfolio sample, reduced motion: 390 px the portrait
  130 × 163 beside facts 204 px wide; 320 px 102 × 128 beside 162 px, every value wrapping between
  words; 1440 px 281 × 351 beside 434 px; no horizontal scroll, no shadow; Arabic mirrored.

**Status.** Accepted.
