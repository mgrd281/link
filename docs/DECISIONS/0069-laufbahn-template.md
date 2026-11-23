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
| `headings` | `signpost` | Every titled section is announced by a square signpost with a bold letter in the display face, like the signs over a warehouse's aisles (A, B, C …; Arabic pages in the abjad order أ ب ج د ه و ز ح ط ي). The same signposts form the page's section index: a sticky row of chips on phones, chips that wrap in the reading column on tablets, a sticky list in the first three columns on the wide canvas; each marks the section being read (see "Round 2"). Without an index (one titled section or none) the sections take the first eight columns, under the hero's words. |

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
  must never take ("Schlager", "Kugellager", "Versicherung", "Gutschein", an English "lager",
  "إفريقيا"). A page reads its own language's patterns and English. Neutral icon where nothing fits: a
  check (skills) or a light bulb (notes).
- **Skills, a bento.** Two columns on phones, three from tablets on; the first skill leads as a wide
  tile from five skills on, and the last row is always closed (the last tile widens), order never
  changes. A tile has its icon in a soft accent square (`lb-soft`: the accent at the pressed opacity
  over the surface) and the label at body size, semibold; a tile alone in its row lies flat, a pair
  stands (icon above, label at the foot), rows at equal height. No automatic hyphenation
  (`hyphens: manual`, `text-wrap: balance`): long German compounds get soft hyphens at their joints
  only ("Flurförder|zeug|schein", "Versand|dokumente", "Kommissio|nierung"), and a label whose widest
  piece would still not fit half a 360 px phone's row takes the whole row; `break-words` stays as the
  last resort. No numbers. Measured on Sevag's twelve skills at 390 px: the grid is about 680 px (it was
  about 900). A two-column layout with the icon beside the label would be about 500 px, but at that
  width four of his compounds and three labels break into stubs of two or three lines; the standing
  tiles break two words, both at a joint, and read calmer, so they won.
- **Hero buttons.** The page's first action, filled: the contact block's primary action; without one,
  "Anschreiben lesen / Read the letter / اقرأ الخطاب" when the page has a cover letter (a long text
  under a title that names a letter, or one that opens with a salutation and closes with a greeting),
  else "Weiterlesen / Read on" to the first section. Beside it "Teilen / Share / مشاركة", outlined: the
  native share sheet, otherwise the address is copied, the label reads "Kopiert" for a moment and a
  polite live region says "Link kopiert." (the existing share hook, no third-party code). 48 px, the
  template's button radius, scale on press, the focus ring; side by side when both fit (they do at
  360 px), else stacked at full width. With a contact block its status line stands above and its CV
  link below.
- **Section index on phones.** Sticky flush under the compact bar once the hero has passed, on the
  page's solid ground, one row of 44 px chips (52 px with its band), a hairline under it only while it
  is stuck (a scroll-state query). Where scroll-driven animations are missing, the bar never shows, so
  the index sticks to the top edge instead. A tiny client component marks the section being read with
  `aria-current` (an IntersectionObserver on a thin band at 35 % of the screen, the last section once
  the end of the content is on screen), keeps that chip and a chip reached with Tab whole in the row
  (scrolling the row only) and fades the row's edges only while more chips lie beyond them. Without the
  script the chips are plain anchors. The same marking replaces the wide canvas's scroll-driven spy.
  The document's scroll padding grows by the index on phones, so a heading jumped to or focused stops
  below it (2.4.11). Anchor jumps glide unless reduced motion is asked for.
- **About.** The lead at the title size on phones (18 px, about six lines for Sevag), h3 from tablets,
  h2 on the wide canvas; the rest as body; the facts as a two-by-two sheet of cells between hairlines
  (a value that cannot fit half the sheet takes the row).
- **Text sections by length.** Under 320 characters: a callout (surface tile, hairline, an icon in a
  soft accent square chosen from the section's title by the same map: "Neu für mich: das Tönen" gets a
  paint bucket). Over 900 characters: a reading tile with its reading time; on phones and tablets the
  first two paragraphs, then a native `<details>` whose button follows the text it opens ("Ganzes
  Anschreiben lesen", "Weiterlesen" when it is not a letter, "Weniger anzeigen" once open), keyboard and
  screen readers included, no script; the opened text unfolds briefly unless reduced motion is asked
  for. On the wide canvas the disclosure's content is always shown (`::details-content`) and its button
  is not.
- **Timeline.** A 32 px icon node per step: a briefcase, or the licence or certificate the role names
  (via the map); filled while the step is still going on; the years level with the node's centre.
- **Rhythm.** On phones 48 between sections, 32 under a section's hairline, 24 between a title and
  its content and between the parts of a content, 16 between paragraphs, 8 between tiles. Signposts
  are 40 px on phones, 48 from tablets on; titles h2 (h1 on the wide canvas).

**Status.** Accepted.
