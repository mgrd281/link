# 0080 — Three portfolio templates: Leuchttisch, Grundriss, Logbuch (and the wide canvas, finished)

**Status.** Accepted (Stage 3, WP3.2, 2026-11-25). It extends the wide canvas of
[ADR 0071](0071-wide-canvas.md) and follows the batch checklist of [ADR 0072](0072-werkbogen-tiefdruck.md).

**Context.** Portfolio v1 shipped two portfolio templates, Werkbogen (an editorial plate) and Tiefdruck
(a bold list), and Laufbahn for applications. The audit found three kinds of people without a fitting
look (plan §2.6 P-12, P-13, P-14): photographers who need whole series uncropped and wider than the
1,120 px canvas, designers and architects who want facts beside the work, and developers and makers
who want a calm, dated build log. It also found the wide canvas unfinished: text-only heroes leave half
of a laptop screen empty (P-08), About without a portrait uses seven of twelve columns (P-09), and Folio
stays a 560 px column at 1440 (C-06). Plan §4.2 specifies the three looks; S3.0 laid them down as
stand-ins with Werkbogen's look and every new layout value drawn as a fallback.

**Decision.** Three templates, each built from layout values of its own (no template keyed by its id
in the renderer), and the wide-canvas fixes. Every other template renders as before, except where a
fix below is meant to change it (the picture baseline lists each difference).

| | Leuchttisch | Grundriss | Logbuch |
|---|---|---|---|
| For | photographers | designers, architects | developers, makers |
| Tokens | ink #111111 on a warm light-table grey (#E4E2DD, tint 0.12), Inter (`classic`), minimal square buttons, `sans` titles | drafting green (cedar #1F7A6D) on cool drawing paper (#E6E9EA, tint 0.1), Space Grotesk (`modern`), outline square buttons, `numbered` titles | sage (#588157) on a warm off-white document (#ECE8DF, tint 0.15), Geist with Geist Mono (`tech`), outline rounded buttons, `mono` titles |
| `hero` | `strip`: the name and role, small, on one line; the first three to five covers in one row at their own ratios, each its project's link, with a frame number ("01/06") and title under it; phones: a strip to swipe, at most 70svh, each picture whole on the screen | `titleblock`: a ruled title block (name, discipline, place, availability, the action) in columns 1–5 beside the lead project's cover with a drawing label (number, title, client or "Vertraulich", year) in 6–12; phones: the block, then the cover at 3:2 | `readme`: a heading mark and the name, the role line, the sentence, the action, the profiles; beside them a monospace list of facts read from the page (the first four skills, the place, the availability, the repositories) |
| `projects` | `justified`: rows of equal height, every cover uncropped (`justifyRows`), a frame number under each | `sheets`: one drawing sheet per project: the cover in 1–7, the number, title, sentence and a fact table in 8–12 | `log`: grouped by starting year (`logGroups`), latest first; the year sticky at top-16 in columns 1–2, entries in 3–12 with a "läuft"/"fertig" chip (a dot and the word), the facts line and a small cover |
| other | `gallery: justified`, `canvas: full` (pictures to layout.wall, 1680 px; text in the creator column) | `backdrop: columns` (hairlines at the twelve column starts, only on the canvas, off with `prefers-contrast: more`) | — |
| Differs from | Werkbogen in headings, hero, gallery, projects, canvas | Folio in headings, hero, backdrop, motion, projects; Werkbogen in four keys | Tiefdruck in headings, hero, motion, projects; Werkbogen in three |

- **Justified rows.** `justifyRows(ratios, rowAspect)` in `@linkyo/blocks/project` closes a row when the
  next picture would overshoot the target more than the row falls short of it; the last row never
  stretches (a filler of the missing ratio). The page draws one flex list whose items grow by their
  ratio and keep it (`aspect-ratio`), with zero-height breaks where `justifyRows` ends a line for two
  widths: the phone (390 − 2 × 20 over `size.row-photo`, 280 px: 1.25) and the canvas (layout.work over
  280 px: 4). The breaks and fillers are `aria-hidden` list items; the list counts only its pictures.
- **The full canvas.** From layout.work the page grows to layout.wall. Only sections of work or
  pictures run across it; every other section keeps its words in the creator column beside its title,
  so a line never grows past 560 px.
- **The strip** takes the run's first covers with a picture, in a row, five at most; of three or more it
  takes the count whose ratios come closest to a canvas row. The run below starts after them, as it
  starts after Werkbogen's plate.
- **The owner's work layout still wins** (`CreatorThemeConfig.projects`); `justified`, `sheets` and `log`
  are not offered to owners. The editor names a run's layout in the owner's words
  (`chooseProjectsLayout`): justified rows are "Raster", sheets and the log "Liste"; the page draws the
  template's own (`runLayout`).
- **AI catalogue:** plan-v4 and core-v5 list the three templates (`TEMPLATES_NOT_OFFERED` is empty).

**Wide-canvas fixes.**

- **P-08.** Tiefdruck's statement hero on the canvas: the name across it, the role line and sentence in
  columns 1–7, the numbers, the action and the profiles in 8–12. Werkbogen's plate opens with the first
  project also when it has no picture: its result figures (up to two) or its title set large on a fill
  step, at 3:2, with the usual caption. Phones show that plate too (the run goes on with the second
  project, as with a picture), so the page reads the same at every width.
- **P-09.** About without a portrait: the words in columns 1–8, the facts beside them in 9–12.
- **C-06.** Folio moves onto the wide canvas (`canvas: "wide"`): its picture in the last six columns
  beside the name, its sections in the canvas's grid. Below layout.work it keeps the column's spacing
  (the portfolio templates breathe more), so its phone pages do not change; this is the renderer's one
  check of a template's id (`airy` in renderer.tsx), because no layout value says "came onto the canvas
  later". Laufbahn and Folio now share six layout keys; the layout-difference test names that one pair
  (Laufbahn may not change).
- **Social rows** (every hero but Laufbahn's): on a phone of 390 px (and of 320 px) no row ends with a
  single icon; where one would, the list is narrowed to the balanced count (`balancedRow`: six tiles
  are 3 + 3, not 5 + 1).

**Consequences.**

- The picture baseline (`BASELINE_SET=s2`) differs where intended: the tile templates' music sample on
  phones (six tiles, now 3 + 3), Tiefdruck and Folio at 1440. Laufbahn is byte-equal.
- The template previews of the three looks (`assets/templates/*.webp`) are recaptured at integration.
- No new dependency, no new block type, no change to the page schema; the three looks are calm (no
  motion), so reduced motion changes nothing.

**Alternatives.** A CSS-only justified layout (items with a basis of ratio × row height that wrap by
themselves) was rejected: a lone upright picture on a phone line stretched to the full width, two to
three times the row's height. Template ids in the renderer (if Leuchttisch …) were rejected for the
new looks: a layout value can be reused by a later template and tested on its own (Folio's spacing
above is the one exception).
