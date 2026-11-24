# draft — Design system v2: Arabic companion faces, one icon set, a shared UI kit

**Status.** Proposed (Stage 2, WP2.3, 2026-11-24). The integrator numbers it. The choice of faces is a
lead decision, cheap to reverse: every face is one token and one `localFont` call.

**Context.** Three findings of the November audit (plan.md §2.5, §2.7, §2.4):

- **C-03:** on Arabic pages `resolveCreatorTheme` forced the Arabic pairing (`theme.ts`, `pairingId =
  "arabic"`), so all 14 templates set their names in one face: Nocturne, Marquee and Daylight looked
  alike in Arabic, and Latin names on Arabic pages lost the template's face too.
- **S-01, S-03, S-04, S-06, S-05:** 229 lucide names with alias pairs (AlertTriangle/TriangleAlert,
  MoreHorizontal/Ellipsis, BarChart3/ChartColumn), three "analytics" glyphs; play and pause mixing
  fill and outline; directional glyphs (sign out, send, undo, lists) that did not mirror in Arabic
  next to 105 hand-written `rtl:-scale-x-100`; a fixed 1.75 stroke that shrank to 1.17 px at 16 px;
  a selected tab marked by colour alone.
- **A-12, A-19:** the team console used unstyled native `<select>` and `<details>` with triangle
  markers, and its KPI tiles, lists and chart tables differed from the dashboard's.

**Decision.**

1. **An Arabic companion per pairing (tokens).** `creator.pairing.<id>.$extensions["app.linkyo"].arabic`
   holds a display and a body face (family, face id, weight). A template may override it
   (`creator.template.<id>…arabic`): Nocturne has its own display face, and Laufbahn keeps the Arabic
   pairing exactly as it was (`{ "pairing": "arabic" }`). The token build emits each face with its
   stack. On Arabic pages the theme sets `--creator-font-display` to `<companion>, <the template's Latin
   stack>`, the weight to the companion's (a template's `arabicDisplayWeight` still wins: Werkbogen 400,
   Laufbahn 700), letter spacing to 0 (spacing pulls joined letters apart) and keeps the Latin
   pairing's capitals for Latin names. `theme.pairing` stays the Arabic pairing, because name fitting,
   link cards and share pictures read it; they are unchanged.

   | Pairing (Latin display) | Arabic display | Arabic body | Why |
   |---|---|---|---|
   | classic (Inter 700) | IBM Plex Sans Arabic 700 | Plex 400 | The neutral look keeps the neutral Arabic face Linkyo already serves; Plex Arabic was drawn to sit with a grotesque like Inter. No new bytes. Marquee. |
   | stage (Anton 400) | Lalezar 400 | Plex 400 | A heavy, compact poster face whose only weight matches Anton's single 400, so neither face is synthesised bold. Daylight, Mono, Studio. |
   | Nocturne (template override) | Rakkas 400 | Plex 400 | The black stage gets the more dramatic, high-contrast display face, also a single heavy 400; it keeps Nocturne apart from Daylight, which shares its pairing. |
   | editorial (Instrument Serif 400) | Amiri 400 | Plex 400 | A classical Naskh with the calm contrast of a book serif; regular, like Instrument Serif, and Werkbogen's light Arabic name. Atelier, Aura, Werkbogen. |
   | elegant (Playfair 700) | Amiri 700 | Plex 400 | Playfair's high contrast in Naskh form; the same family as editorial, second of its two weights. |
   | modern (Space Grotesk 700) | Readex Pro 700 | Readex Pro 400 | A geometric Arabic for a geometric grotesk; Space Grotesk's body has no Arabic, so Readex is the body too. Folio. |
   | bold (Bricolage 700/800) | Changa 700 | Plex 400 | A wide, punchy Kufi-like display for a chunky grotesque. 700 keeps the existing "Tiefdruck is heavy (700) in Arabic" check true. Pulse, Bloom, Tiefdruck. |
   | tech (Geist 700) | IBM Plex Sans Arabic 700 | Plex 400 | Plex is an engineered, technical family, the nearest Arabic voice to Geist and Geist Mono. Signal. |
   | arabic | itself | itself | — |
   | Laufbahn (template override) | the Arabic pairing as before | as before | Its rendering must not change. |

   In /ar the h1 of Nocturne, Marquee and Daylight now has three different computed font families
   (e2e `design-system-v2-app.spec.ts`, which also reads the fonts Chrome actually draws).

2. **Companion first, not the Latin face first.** The plan asked for `[Latin face, Arabic companion]`.
   next/font gives every local face a metric fallback (`"<face> Fallback"`, `src: local("Arial")`)
   inside the same CSS variable, and Arial has Arabic glyphs on Windows: with the Latin face first,
   Arabic letters would be drawn in Arial before the browser ever reached the companion. So each
   companion is declared with an **Arabic-letters-only `unicode-range`** and **no metric fallback**
   (`adjustFontFallback: false`) and comes first. Latin letters, digits and spaces are outside its
   range and go on to the template's own Latin face; Arabic letters get the companion. The effect the
   plan wanted (Latin text in the template's face) holds, and it holds on Windows too.

3. **Vendored files, not packages.** `fonts.ts` loads the existing faces from `@fontsource` packages in
   `node_modules`; the new families are not dependencies, and the rule for Stage 2 is no new
   dependency. Each family's Arabic-subset woff2 files and its `OFL.txt` were copied out of
   `npm pack @fontsource/<family>` (nothing from the package was run) into
   `apps/web/src/assets/fonts/<family>/`. At most two weights per family, `preload: false`. Bytes in
   the repository: Lalezar 52,128; Rakkas 26,040; Amiri 208,528 (400: 108,560, 700: 99,968); Readex Pro
   20,136 (400: 9,776, 700: 10,360); Changa 11,320; plus about 4.4 KB of licence per family. A page
   downloads only the faces it sets in Arabic, and only if it has Arabic text: the unicode-range keeps
   German pages free of Arabic fonts (e2e on /de/p/ronja-feldkamp). IBM Plex Sans Arabic gets the same
   unicode-range (rendering is unchanged: its subset file has only Arabic glyphs).

4. **One icon set, `packages/ui/src/icons.ts`.** A registry maps about 80 meanings to one lucide glyph
   each (analytics ChartNoAxesColumn, more Ellipsis, warning TriangleAlert, error CircleAlert, invite
   Gift, verified BadgeCheck, external ArrowUpRight, team UsersRound, creators SquareUser, customers
   Contact, features Blocks, portfolio FolderKanban, …); a unit test keeps one glyph per meaning.
   `ICON_GROUPS` orders them for /design#icons. ESLint (`no-restricted-imports`, shared config) bans
   the duplicate names AlertTriangle, MoreHorizontal, BarChart3, ChartColumn, Music2 and Briefcase,
   as a **warning** until the S2.Z codemod replaces the existing imports, then an error. Laufbahn's
   files are exempt. Lucide stays the only icon library.

5. **`Icon` draws strokes in real pixels and mirrors by itself.**
   - Stroke: `iconStroke(size)` sets the width in the 24-unit grid so that the screen shows
     `icon.stroke-sm` 1.5 px at xs (12 px, new) and sm, `-md` 1.6 px at md, `-lg` 1.75 px at lg. This
     is lucide's `absoluteStrokeWidth` computed in Linkyo's code: that prop is deprecated in lucide
     1.x (`no-deprecated` fails lint) and reads only lucide's own `size` prop, and its successor
     `nonScalingStroke` ignores ancestor transforms, so pages shrunk into a phone frame would get
     full-weight strokes.
   - `strong`: `icon.stroke-strong` (2.25 px) for a selected tab, with a semibold label.
   - `solid`: filled media transport (play, pause, stop, skip); `MEDIA_TRANSPORT` never mirrors.
   - Mirroring: every glyph in `DIRECTIONAL` gets `MIRROR_IN_RTL`, a scale of −1 inside
     `dir="rtl"` unless a `dir="ltr"` island sits in between (a German page previewed in an Arabic
     one keeps its arrows). Not `:dir(rtl)`: the CSS minifier rewrites it into a list of `:lang()`
     selectors, which misses a `dir="rtl"` block on a German page and catches a `dir="ltr"` block on
     an Arabic one. Tailwind's `rtl:` variant also matches inside left-to-right islands. A doubly
     nested island (rtl, ltr, rtl) is not handled. `mirror={false}` opts a glyph out. A flip on the same svg is idempotent (same `scale`
     property), so existing hand-written classes on the icon do no harm until the codemod removes
     them; a flip on a **parent** (an IconButton flipped as a whole) cancels the icon's own flip:
     those places are listed for the codemod.

6. **A shared UI kit in packages/ui** for both shells (adopted by the S2.Z codemod and Stage 3):
   `Select` (the platform's own select, framed like `TextField`: keyboard, screen readers and phone
   pickers work as everywhere, logical sides for RTL), `Segmented` (one line, scrolls sideways,
   counts, focus drawn inside the segment), `FilterSheet` with `FilterGroup`, `FilterChip` and
   `ActiveFilters`, `DataList` (cards on phones, columns on a subgrid from md, every value labelled
   for screen readers), `KpiTile` (change as arrow, signed number and the direction in words; sparkline
   in the palette's primary role, mirrored right to left), `ChartTable` (a toggle button and a real
   table instead of `<details>`) and `CommandPalette` (combobox and listbox, ⌘K hook). They take all
   words as props; shared words live in `ui.*`. None carries `data-console`; a reverse guard test keeps
   it out of the team console and the kit, so the team area stays teal.

7. **Button shapes.** `rounded-md` everywhere; a pill only for the footer of a step-by-step flow and
   the lone website call to action (`size="cta"`). Written into the design-tokens skill and the
   `buttonVariants` docs; WP2.2 and WP2.4 apply it.

**Consequences.**

- Arabic pages of every template but Laufbahn change face (intended); the portfolio baseline review at
  S2.Z lists them. Icon strokes change everywhere, Laufbahn's icons included (S-06 applies to every
  surface; Laufbahn's type does not change).
- Until the codemod: 6 IconButtons flipped as a whole (scroll-row.tsx, examples/gallery.tsx) show their
  chevrons unmirrored in Arabic; the alias rule warns on 15 imports.
- WP2.5's Arabic name-fit test must be re-run on these faces at S2.Z.
- Adding a face: the token, a `localFont` with the Arabic unicode-range and no metric fallback, the
  files and licence copied from `npm pack`, and the companions test.
