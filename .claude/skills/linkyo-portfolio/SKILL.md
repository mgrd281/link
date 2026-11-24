---
name: linkyo-portfolio
description: How Linkyo's portfolios work and how to extend them safely - the project block and its page, the wide and full canvas, the portfolio templates (Werkbogen, Tiefdruck, Leuchttisch, Grundriss, Logbuch) and their example people, the viewer and rail contracts, the portfolio welcome flow, and the checklists for adding a project field, a layout value, a section block, a portfolio template or an example person. Use when touching the project block, project pages, a portfolio template or layout value, Arbeiten, the portfolio welcome steps, /portfolio, or the gallery's Portfolio category.
---

# Linkyo portfolios

A portfolio is a creator page whose blocks are mostly `project`s, on a template with `use: ["portfolio"]`, read
by people who judge work, mostly on a laptop. The decisions are in the three Portfolio v1 ADRs (0070 project
block, 0071 wide canvas, 0072 Werkbogen and Tiefdruck), ADR 0075 (the Portfolio section of the website), 0078
(the portfolio welcome), 0079 (Arbeiten and template previews in the dashboard) and 0080 (the three Stage 3
templates: Leuchttisch, Grundriss, Logbuch).

## Map

| What | Where |
|---|---|
| Project block schema, page rules (24 projects, unique slugs, one contact) | `packages/blocks/src/schema.ts`, `rules.ts` (`MAX_PROJECTS`, `RESERVED_PROJECT_SLUGS`, `isProjectSlug`) |
| Project logic: cover, detail, target, layouts, figures, code tint, years | `packages/blocks/src/project.ts` (`coverImage`, `coverMode`, `shownPictures`, `hasDetail`, `projectTarget`, `chooseProjectsLayout`, `bentoRows`, `plateRows`, `nearestRatio`, `formatYears`, `tintCode`, `sectionOrder`) |
| Layout values and their fallbacks | `packages/tokens/src/creator/theme.ts` (`HeroStyle`, `TemplateProjectsStyle`, `GalleryStyle`, `BackdropStyle`, `CanvasStyle`, `LAYOUT_FALLBACK`, `DrawnLayout`, `suggestedTemplates()`, `templatesFor()`) |
| Templates | `packages/tokens/tokens.json` → `creator.template.<id>` (`use`, `suggestFor`, `leadFor`, layout keys); labels and descriptions also in `templates.<id>.*` messages |
| Renderers | `features/directions/poster/`: `hero.tsx`, `projects.tsx` (runs of projects, rail), `portfolio-sections.tsx` (about, clients, quotes, tools, timeline, contact), `project-page.tsx` (the page of a project), `renderer.tsx`, `styles.ts`; container variants `@work:` / `@wall:` in `src/app/globals.css` |
| Viewer and rail | `features/directions/shared/picture-viewer.tsx` (island), `picture-viewer-dialog.tsx`, `rail-buttons.tsx` |
| Routes | public `app/u/[username]/[project]`, examples `app/[locale]/p/[slug]/[project]`, each with `opengraph-image.tsx` (`features/share/og-card.tsx`) |
| Dashboard | Arbeiten (`/app/work`), the project sheet, the template picker with real previews (`poster/template-previews.ts`, WebP in `src/assets/templates/`) — see linkyo-creator-dashboard |
| Welcome | `features/app/kinds.ts` (`PORTFOLIO_KINDS`, `welcomeSteps`, `lookOrder`), `welcome-portfolio.tsx` — see linkyo-page-kind |
| Website | `features/marketing/portfolio/` (`/portfolio`, the homepage band), read from the gallery's `portfolio` category |
| Examples | `features/examples/catalog-h.ts` (Werkbogen, Tiefdruck), `catalog-i.ts` (Stage 3), `looks.ts`, `media.ts`, `name-check.md`, `src/assets/examples/CREDITS.md` — see linkyo-example-page |
| AI | `packages/blocks/src/ai-plan.ts` (`TEMPLATE_IDS`, `TEMPLATES_NOT_OFFERED`, `PAGE_PLAN_VERSION`), `features/ai/server/prompts.ts` (catalogue lines, `PROMPT_VERSION`) — see linkyo-ai-builder |

## Contracts that must not break

- **A project has a page only when there is more to read** (`hasDetail`): story, figure, code, install command,
  more than one shown picture, or a quote about it. A card never links to an empty page; without detail it opens
  its first link, then the repository, else nothing (`projectTarget`).
- **Addresses never move.** Slugs are made by code (`slugFor`), unique, never reserved; renaming keeps the old
  slug in `was` and the route redirects. Example projects choose their slug by hand (`h.project(..., { slug })`).
- **Every card has a cover, never a placeholder** (`coverMode`: picture, else first figure, else title). A title
  cover is a project with no cover, no pictures and no results.
- **Confidential means no stored client name** (schema refuses `confidential` with a `client`).
- **Viewer:** every picture on a project page is `<a href="<large file>" data-viewer="<n>" data-total="<count>">`
  inside `[data-project-page]`. The island loads the dialog on the first press; the dialog pushes one history
  entry (Back closes it), returns focus to the opener, and maps arrow keys through `arrowStep(key, rtl)` so
  ArrowLeft means "next" in Arabic. Without script the link opens the file (same origin, inline).
- **Rail:** a sideways run has `RailButtons` (previous/next as round icon buttons, mirrored by `Icon`, disabled at
  the ends, `behavior: "auto"` under reduced motion) and a peeking last card. Never add `rtl:-scale-x-100`.
- **Block marks:** each block's wrapper carries `data-block="<block id>"` (analytics counts clicks per block);
  a new renderer for a project run keeps the mark on each project's own element.
- **Latin figures in Arabic** stay Latin digits and sit in `<bdi>` where they meet Arabic text.

## Add a project field

1. Schema in `packages/blocks/src/schema.ts` (limits!) and, if it is "more to read", `hasDetail`.
2. The editor's project sheet and Arbeiten (`features/app/`), the card and `project-page.tsx`.
3. The silent places: `mapSources` (`features/account/media-migrate.ts`) for any picture field, the AI plan
   (`ai-plan.ts` field + the next `PAGE_PLAN_VERSION`, `prompts.ts` + the next `PROMPT_VERSION`, the snapshot
   tests), the console's prepared pages (they reuse the editor), iOS when the field is shown there.
4. Messages for any label under `creator.portfolio.*` / `app.portfolio.*` in de, en and ar.
5. Tests: schema, `hasDetail`, the renderer, and an example that uses the field.

## Add a layout value (hero, projects, gallery, backdrop, canvas)

1. Add it to the type union in `theme.ts` and map it in `LAYOUT_FALLBACK` to the nearest existing value, so tokens,
   picker and examples can ship before the renderer.
2. Draw it (`hero.tsx`, `projects.tsx`, `renderer.tsx`; token classes only, no shadow, no underline, logical
   properties, a `motion-reduce:` variant for anything that moves). Then delete its line in `LAYOUT_FALLBACK`:
   `DrawnLayout` now contains it, and the compiler names every renderer that must handle it.
3. If it is a projects value, widen `chooseProjectsLayout` / `WorkLayout` in `packages/blocks/src/project.ts`
   (`features/app/project-runs.ts` derives its type from it). Owner-settable values go into `PROJECTS_STYLES`.
4. Table tests for any arithmetic (justified rows, year groups), the picker card (`template-picker.tsx`) and the
   gallery card face (`examples/gallery-card.tsx`, which receives `theme.layout.hero`).

## Add a section block (a new kind of portfolio section)

`schema.ts` type, a renderer in `portfolio-sections.tsx`, its `SectionKind` and order (`sectionOrder` in
`project.ts`), the editor's sheet, and the silent places every new block type needs: `blockIcon`
(`features/directions/editor/ui.tsx`, TypeScript fails without it), `blockTitle` (`editor/use-editor.ts`),
`mapSources`, the Add sheet's group and search words, the AI plan and catalogue, the catalog test's address
collector (`examples/catalog.test.ts`, `urls()`: it fails on an address it does not know).

## Add a portfolio template (the batch checklist, P-15)

1. **Tokens:** `creator.template.<id>` with `label`, `description` (English, the AI catalogue's source),
   `accent`, `neutral`, `tint`, `mode`, `pairing`, button style and shape, every layout key, `use: ["portfolio"]`,
   `suggestFor` (the kinds whose look step lists it) and optionally `leadFor` (kinds for which it comes first).
   `pnpm --filter @linkyo/tokens build`, commit the regenerated Swift (`pnpm check:tokens-drift` must pass).
2. **Palette and difference tests** (`packages/tokens/test/palette.test.ts`): AA in light and dark where offered,
   no accent with an OKLCH hue in 40°–75° (orange), at least three layout keys different from every template.
3. **Messages:** `templates.<id>.label` and `.description` in de, en, ar. Counts use placeholders
   (`SITE_COUNTS`), so no sentence names a number.
4. **Picker preview:** `node scripts/capture-example-shots.mjs template:<id>` (a WebP in `src/assets/templates/`,
   registered in `template-previews.ts`; `template-previews.test.ts` fails without it).
5. **AI catalogue:** one line per template in `prompts.ts`, the template in `TEMPLATE_IDS` (empty
   `TEMPLATES_NOT_OFFERED` for it), the next plan and prompt versions with their snapshots. No real AI call.
6. **Routes:** `e2e/routes.ts` gets `/directions/poster?chrome=0&template=<id>` and `&page=portfolio`.
7. **One ADR for the batch** (`docs/DECISIONS/draft-<slug>.md`) and a row in ADR 0012's table.
8. **Baseline:** every existing template stays byte-equal (`BASELINE_SET=s2` or newer, see linkyo-qa-release);
   name every intended difference.
9. **An example person** per template (below), in the gallery's `portfolio` category.

## Add an example person (portfolio)

1. Pick a fictional name and **web-check it** with the city and the profession, then alone; do the same for every
   repository and package name (`gh api search/repositories`, the npm registry). Record queries and results in
   `features/examples/name-check.md`. A real public person with that name and profession means another name.
2. Pictures: Unsplash License only, checked on each photo's own page (never Unsplash+), adults, no brand
   lettering (retouch it), **one photographer per project** (the catalog test enforces it), or original drawings
   made with Pillow (boards, screens, plans; one kind of maker per project too). Series that Leuchttisch shows
   wide: 2,240 px on the long side; others 1,600 px; portraits 1,200 px square. See linkyo-media-assets.
3. Files `src/assets/examples/ex-pf-<name>-NN.jpg`; add imports, `exampleMedia` and **`portfolioMedia`** (size and
   focal point) to `media.ts` by hand: `media_index.py` drops the `portfolioMedia` table.
4. CREDITS.md: a summary row per project and one row per file in file-name order (`| file | maker | page |
   license |`); drawings say "Original Linkyo drawing (…)".
5. `catalog-*.ts` with `examplePage(slug, locale, persona, h => [...])`: `portraitOnly: true` (a portfolio opens
   with the work), `h.project` with a hand-chosen slug, alt text and a caption for every picture, clients as a
   kind of client, `h.contact` with the page's one primary action. Links only to example.com, repository owners
   ending in `.example`, one mailbox per page.
6. `looks.ts`: `{ kind, category: "portfolio", locale, theme: { template: "<id>" }, credit: "<photographers> (Unsplash)" }`
   (the template as it comes, so "Start with <template>" on /portfolio starts from it); add it to `GALLERY_LEAD`.
7. Tests in `catalog.test.ts` (what the page is in the gallery for), the e2e `portfolio-examples.spec.ts` (200,
   axe 0, no cross-origin request, the link preview) and the portfolio a11y routes.

## Portfolio kinds in the welcome flow

`PORTFOLIO_KINDS` (designer, photographer, developer, engineer, freelancer) get Typ · Du · Look · Arbeit ·
Kontakt · Fertig: three proof rows become projects, the action becomes the contact block (developers and engineers
also get a CV link). The look step lists `lookOrder(kind)`: the starter, then `suggestedTemplates(kind)` (`leadFor`
first). Starters change only by decision (ADR 0078).

## Acceptance for any portfolio change

- Unit: `npx vitest run src/features/examples src/features/marketing/portfolio src/features/directions/poster`,
  `pnpm --filter @linkyo/blocks test`, `pnpm --filter @linkyo/tokens test`.
- e2e (desktop and mobile): `portfolio-examples.spec.ts`, `portfolio-a11y.spec.ts`, `portfolio-page-app`,
  `portfolio-project-app`, `portfolio-viewer-app`, `portfolio-landing-app`, `templates.spec.ts`.
- Captures at 390 × 844 and 1440 × 900, de and ar (Arabic mirrored, Latin figures isolated), LOOKED at; the
  byte-equal baseline for every template you did not mean to change.
