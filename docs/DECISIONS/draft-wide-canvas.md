# Draft — The wide canvas: portfolio pages use the laptop's width, link-in-bio pages keep their column

**Status.** Accepted in practice (Portfolio v1, release A, extended in Stage 3); written up in Stage 3, WP3.3. One
of the three Portfolio v1 decisions reserved as 0070–0072; the integrator gives it its number.

**Context.** Every creator page used one 560 px column (`layout.creator`) at every width. For a link-in-bio page
that is right: it is read on a phone, and on a laptop the column keeps it calm. A portfolio is different: a
photographer's series, an architect's drawing or a developer's code sample shown 560 px wide on a 1440 px screen
looks like a phone page left on a desk, and visitors who judge work (art directors, clients, recruiters) mostly
open it on a laptop.

**Decision.**

1. **A layout option, `canvas`** (`CreatorLayout.canvas` in `packages/tokens/src/creator/theme.ts`):
   - `column` (default): the creator column, as before;
   - `wide`: from desktop widths the page uses `layout.work` (1120 px, its own token, the same value as the
     dashboard's content width) and lays sections out on a 12-column grid; every project page uses it too;
   - `full` (Stage 3, Leuchttisch): pictures run as wide as `layout.wall` (1680 px) from large screens on, while
     text stays in the creator column (`max-w-creator`) so lines never grow too long.
   Templates set it (Werkbogen, Tiefdruck, Folio and the Stage 3 templates `wide` or `full`); owners do not.
2. **Container queries, not viewport queries.** The renderer reads its own width: `@work:` (and `@wall:` for the
   full canvas) are container variants keyed to the tokens, so the dashboard's live preview, a phone frame on the
   marketing site and the real page all show the layout that fits the box they are in.
3. **Phone first stays.** Below `layout.work` every wide template is the phone layout: one column, the same order,
   the same touch targets. The wide canvas adds columns; it never hides content or changes the reading order.
4. **Text keeps a measure.** On the wide canvas, running text is capped at the prose width; headings, pictures,
   figures and project grids use the columns. Arabic pages mirror the grid (logical properties only).
5. **Values without a renderer fall back.** A new value lands in the type union first and is mapped to an existing
   one in `LAYOUT_FALLBACK` until its renderer exists, so tokens, picker and examples can ship in parallel; the
   resolved theme's layout type (`DrawnLayout`) lists only values the renderers draw, so deleting a fallback line
   makes the compiler name every place that must draw it.

**Consequences.** A portfolio looks like a portfolio on a laptop without a separate "desktop site". Wide-canvas
regressions show only at laptop widths, so every template change is captured at 390 and 1440 px (de and ar) and
compared byte for byte with the stored baseline (linkyo-qa-release, "Picture baselines").
