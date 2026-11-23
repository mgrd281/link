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
| `hero` | `bleed` | Phones and tablets: the picture from edge to edge, about three quarters of the small viewport tall (`clamp(24rem, 72svh, 160cqi)`, so a phone preview in the dashboard keeps a phone's proportions), a veil of ink at the secondary opacity tied to the words (not to the picture's height, so they keep AA on a landscape phone or at 200 % zoom), the role line as a quiet dark-glass chip with the portrait or the initials, the name in white set as large as its longest word allows and never taller than 12svh. When the picture is the portrait itself, it rides high in a square on phones and fades into an ink ground, so the words stand below the face. Below it on the page: the sentence, the numbers in a row between hairlines (tabular figures), then the actions: the contact block's primary action when there is one, with "Weiterlesen" as a quiet text action beside its CV link (one filled button in the hero); alone, "Weiterlesen" is an outlined button. It leads to the first section, or to the start of the content when the page opens with untitled blocks. Without any picture an accent field carries the initials. The wide canvas: one twelve-column composition, the words on the first five columns (a two-word name on two lines), the picture as a tall rounded plate on the last six. |
| `headings` | `signpost` | Every titled section is announced by a square signpost with a bold letter in the display face, like the signs over a warehouse's aisles (A, B, C …; Arabic pages in the abjad order أ ب ج د ه و ز ح ط ي). The same signposts form the page's section index: a row of chips to swipe under the hero on phones (a chip reached with Tab scrolls fully into the row), chips that wrap in the reading column on tablets, a sticky list in the first three columns on the wide canvas that marks the section being read (the first one at the top of the page). Without an index (one titled section or none) the sections take the first eight columns, under the hero's words. |

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
- **Own renderers for four blocks; the rest reused.** About: the first paragraph as a large lead,
  the facts as a definition grid, the rest in a reading measure. Skills (`tools`): flat tiles in two
  columns (three on the canvas) with their place in the list; hover gives a stronger hairline and a
  fill step. Experience (`timeline`): a vertical rail with a node per step, years in tabular figures
  and "heute / now / حتى الآن" for a step still going on. Text: paragraphs split at blank lines;
  a long text (three paragraphs or 600 characters) such as a cover letter is set on a flat tile with
  a hairline, under a quiet label with its reading time. Links, music, videos, products, projects
  (with their layouts and pages), quotes, clients, the contact band and everything else keep the
  renderer they have in every template.
- **Motion, CSS only.** The hero's lines rise in once (`poster-rise`); the title rows, contents,
  tiles and steps rise within the first 8 rem of entering the screen (`lb-reveal`, a view timeline,
  movement only: nothing rests faded at the fold of a large screen; a section that rises as a whole
  does not let its tiles rise again); the picture eases in a little as the hero scrolls away (`lb-zoom`);
  the timeline's rail fills with the accent as its steps scroll by (`lb-fill`); the index marks the
  section being read through named view timelines (`lb-spy`, a registered `--lb-here`). All of it is
  behind `@supports (animation-timeline: view())`, and everything that moves is off with
  `prefers-reduced-motion`: the rail is then drawn in full and every section is simply there. No
  scroll hijacking and no new dependency; the only script is the index row's focus handler.
- **Accessibility.** One h1, one h2 per section (the letters are decoration), the index a `<nav>` of
  plain anchor links. A Laufbahn page gives the document a scroll padding for its fixed chrome (the
  compact bar, a dock), so anything focused or jumped to stops below the bar (WCAG 2.4.11); it is
  scoped with `:root:has(.lb-section)`, so other templates scroll as before. "Weiterlesen" names its
  destination for screen readers, white text only over the veil (at least about 6 : 1 on any picture)
  or the chip's dark glass, figures such as "40+" isolated left to right on Arabic pages. Arabic pages are mirrored by
  logical properties only and never tracked or set in capitals.
- **Picture sizes.** The hero picture covers its plate, so `sizes` asks for the width it is really
  drawn at (a 4 : 3 photo in the phone plate is about twice the screen wide), from the picture's
  stored size when there is one. Sharper on phones and Retina screens, at the cost of more bytes for
  the LCP picture (the stored file caps it).
- **Sevag's page** now uses Laufbahn in `navy`, the blue of the pallet racks in his picture. Every
  fact of the page stays and none is added. It has no contact block (no phone number or e-mail is
  known yet); the hero's one action is then the outlined "Weiterlesen". The case with a contact block is covered
  by a test fixture, not on his page.
- **Everywhere templates are counted or listed:** tokens (and the generated files), the picker card
  (the picture from edge to edge with the name in white at its foot, and a lettered signpost), `templates.laufbahn.description` and every "thirteen templates"
  sentence (now fourteen) in de/en/ar, the AI catalogue (`core-v3`, `plan-v3`: one more template and
  nothing else), the team console's count. No example page was added: no test or screen requires one
  per template.

**Status.** Accepted.
