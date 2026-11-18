# Architecture Decision Records

| # | Decision | Status |
|---|---|---|
| [0001](0001-monorepo-tooling.md) | pnpm + Turborepo; TypeScript 6 and ESLint 9 (not 7/10 yet) | Accepted |
| [0002](0002-design-tokens-pipeline.md) | DTCG tokens → Style Dictionary 5 → CSS/Tailwind/TS/Swift/xcassets | Accepted |
| [0003](0003-token-guard.md) | Build fails on raw design values outside `@linkyo/tokens` | Accepted |
| [0004](0004-ios-project.md) | XcodeGen + local SPM design-system package | Accepted |
| [0005](0005-creator-theme-engine.md) | OKLCH palette generator with a WCAG AA guarantee | Accepted |
| [0006](0006-i18n.md) | next-intl, German default, RTL via logical properties | Accepted |
| [0007](0007-brand-accessibility-adjustments.md) | Brand color roles adjusted for WCAG 2.2 AA | **Needs founder sign-off** |
| [0008](0008-public-page-rendering.md) | Zero-runtime renderer for public pages (70 KB budget) | Proposed (Phase 1 spike) |
| [0009](0009-music-smart-links.md) | Own music-link resolver instead of Odesli | Proposed |
| [0010](0010-hosting-and-data-residency.md) | Vercel (fra1) + Supabase Frankfurt; EU processors first | Proposed |
| [0011](0011-poster-direction.md) | Direction D "Poster", built from the founder's references | **Proposed — confirm** |
| [0012](0012-poster-templates.md) | Poster templates (5), vivid palette mode, rails, month tabs, partner tiles, ad labels | **Proposed — confirm** |
| [0013](0013-marketing-home.md) | Marketing home at `/`, dark studio hero, CSS scroll-driven motion system | **Proposed — review** |
| [0014](0014-accounts-and-dashboard.md) | Sign-up/log-in and the full creator dashboard, demo store behind an `AccountStore` contract | **Proposed — review** |
| [0015](0015-prepared-pages.md) | Prepared pages for top creators: the team builds the page, the creator's email unlocks it | **Proposed — review** |
| [0016](0016-team-area.md) | Team area `/admin`: team code, roles → permissions, prepared pages edited in the real editor, activity log | **Proposed — review** |
| [0017](0017-brand-violet.md) | Brand color: Linkyo Violet #9500E9 replaces Linkyo Blue (contrast-checked, status colors stay distinct) | **Applied** |
| [0018](0018-page-kinds.md) | Welcome flow asks what the page is for (TikTok, shop, writer …) → fitting template and questions | **Applied** |
| [0019](0019-example-gallery.md) | Template gallery with 41 fictional example pages (no real celebrities), each in its own look; "Use this template" starts with that look | **Applied** |
| [0020](0020-concept-pages.md) | Concept pages for 12 well-known people: unlisted, noindex, labelled "Concept", official links and free-licensed photos only; not in the gallery | **Applied** |
| [0021](0021-more-page-kinds.md) | Seven more page kinds (affiliate, marketing, developer, designer, coach, streamer, podcast), GitHub platform, two gallery categories, 11 examples | **Applied** |
| [0022](0022-link-buttons.md) | Link buttons: icon tile (chosen or from the address), optional second line, one primary action in the accent; LinkedIn glyph | **Applied** |
