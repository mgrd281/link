# 0070 — Projects: one block type, a page of its own when there is more to read

**Status.** Accepted (Portfolio v1, release A; written up in Stage 3, WP3.3). One of the three Portfolio v1
decisions reserved as 0070–0072, with [0071](0071-wide-canvas.md) and [0072](0072-werkbogen-tiefdruck.md).

**Context.** Linkyo started as a link-in-bio product: links, cards, media, products. Photographers, designers,
architects, developers and makers need to show work, and work is more than a link: a picture series, a client,
a year, a few figures, a story, code. Bolting this onto `card` would have made a card that is sometimes a page
and sometimes not, with fields nobody could find. The audit (P-06) found the decision built but never written
down; this records it as built, so the next template, example or AI hand-off does not have to reverse-engineer it.

**Decision.**

1. **One block type, `project`** (`packages/blocks/src/schema.ts`). A title (60) and one sentence (`summary`, 140)
   are required; everything else is filled when the owner has it: `client` or `confidential` (then no client is
   stored: page JSON is world-readable), `role`, `year` (`{ from, to? }`, `to: "now"` for running work), up to
   five `tags`, a `cover`, up to three `results` in the owner's words (`"1.240 m²"`, `"9 → 3"`), a `story`
   (about, problem, solution, result; 600 each), up to 20 `pictures` with alt text and an optional caption, two
   `links`, repository facts (`source`) and a short `code` sample (30 lines). A page holds at most 24 projects
   (`MAX_PROJECTS`).
2. **A page of its own only when there is more to read** (`hasDetail`): a story part, a figure, code, an install
   command, more than one shown picture, or a quote about the project. Otherwise the card leads to the first
   link, then the repository, else nowhere (`projectTarget`). A card never promises a page that would be empty.
3. **Addresses are made by code and never move.** `slugFor()` builds the address part from the title, unique on
   the page, never one of `RESERVED_PROJECT_SLUGS`; a renamed project keeps its old address in `was` (up to
   three) and the route redirects there. Public pages: `/<username>/<slug>` (`app/u/[username]/[project]`, ISR
   60 s); example pages: `/<locale>/p/<slug>/<project>` (static). Each has its own link preview
   (`opengraph-image.tsx` beside the route: cover, figure or title in the page's template).
4. **Every card has a cover, never a placeholder** (`coverMode`): the picture (`cover`, else the first picture);
   else the first figure set large; else the title set large. Covers are cropped around the stored focal point;
   pictures on the project page are laid out by their ratio (`plateRows`) and are never cropped there.
5. **Pictures open in a viewer, and still work without it.** Each picture on a project page is a link to its
   large file (our own origin, shown inline) marked `data-viewer="<n>"` and `data-total`; a press loads the
   viewer island on demand (`shared/picture-viewer.tsx`), which pushes one history entry so Back closes it, and
   mirrors the arrow keys in right-to-left pages (`arrowStep`). Without script, the link opens the file.
6. **Layouts are chosen from the content** (`chooseProjectsLayout`): a template or owner may fix `bento`, `list` or
   `rail`; `auto` picks a rail for a later run of 2–6 picture projects, a grid for three or more with at least
   60 % pictures, else the numbered list. A fixed choice the content cannot fill falls back to the list. The
   rail has previous/next buttons (`RailButtons`), mirrored in Arabic and disabled at the ends.
7. **Proof is honest.** A quote needs a role and the owner's confirmation that it may be published
   (`consent: true`) and can name the project it is about; the console and the AI never invent clients, figures
   or quotes, and AI-written project text is marked (`isAiProject`, `ai-generated`).

**Consequences.** One editor sheet, one renderer and one AI plan field serve every profession; templates differ in
how they lay projects out, not in what a project is. Adding a field means the schema, `hasDetail`, the editor
sheet, the project page, the AI plan and the iOS model in one change (the linkyo-portfolio skill lists the places).
