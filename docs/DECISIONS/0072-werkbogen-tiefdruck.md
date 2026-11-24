# 0072 — Werkbogen and Tiefdruck: two portfolio templates, and how a portfolio template is made

**Status.** Accepted (Portfolio v1, release A); written up in Stage 3, WP3.3 together with the rules the Stage 3
batch (Leuchttisch, Grundriss, Logbuch, [ADR 0080](0080-portfolio-templates.md)) followed. One of the three
Portfolio v1 decisions reserved as 0070–0072.

**Context.** The twelve templates before Portfolio v1 were link-in-bio looks: a portrait or logo hero, buttons,
media rails. None opened with the work, none used the laptop's width (see [ADR 0071](0071-wide-canvas.md)), and none had
a place for figures, clients or a story. Two opposite characters were needed first: a quiet one for people whose
work is pictures, and a loud one for people whose work is code, products or numbers.

**Decision.**

1. **Werkbogen** (photographers, designers, freelancers): light, `neutral #DDE3EA`, one red accent `#C2361B` (OKLCH
   hue 33°: red, not orange), the editorial pairing, `hero: "plate"` (the first project's cover as a large plate
   under a quiet name), `headings: "marker"` (a small numbered caption), minimal square buttons, plain social
   glyphs, calm motion, `projects: "auto"`, `canvas: "wide"`. Example: Ronja Feldkamp (de), Naya Al-Dabbas (ar,
   in oxblood and without a single work picture: figures and titles are the covers).
2. **Tiefdruck** (developers, engineers, designers): dark (`neutral #2A211A`), one electric blue `#3D5AFE`, the bold
   pairing, `hero: "statement"` (the name as large as the screen allows), `headings: "headline"`, filled pills,
   `motion: "reveal"`, `projects: "list"` (a numbered list), `canvas: "wide"`. Examples: Tobin Achterberg (en, code
   sample, repository facts, figures), Jorinde Ahlfeld (de, brass accent, the owner's choice of a grid).
3. **A portfolio template is tokens, not code.** `creator.template.<id>` in `tokens.json` with `use: ["portfolio"]`,
   `suggestFor` (the page kinds whose welcome flow lists it, in token order) and optionally `leadFor` (kinds for
   which it comes first among the suggestions). The picker, the gallery card, `/portfolio`, the welcome flow's
   look step and the AI catalogue read it from there.
4. **The batch checklist** (P-15), followed again by Stage 3: tokens and the regenerated iOS file; a palette test
   per look (AA in light and dark where offered, no accent with an OKLCH hue in 40°–75°); a layout-difference
   test (each new look differs from every existing one in at least three layout keys); the AI catalogue line and
   the next plan and prompt versions; counts only through placeholders (`SITE_COUNTS`); the picker's real preview
   capture; the e2e routes; one ADR for the batch; a byte-equal baseline for every existing template; one
   fictional example person per template, web-checked and credited.

**Consequences.** Starters for the portfolio kinds point at Werkbogen and Tiefdruck (ADR 0078); a new portfolio
template is a token entry, a renderer for any new layout value, and an example page. Stage 3 added Leuchttisch
(photographers: uncropped series, the full canvas), Grundriss (architects and designers: a title block and drawing
sheets) and Logbuch (developers and makers: a README and a build log), each with its example person (Merle
Kastorf, Rana Al-Khatib, Ines Vasconcelos; `features/examples/catalog-i.ts`).
