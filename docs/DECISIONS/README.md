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
| [0017](0017-brand-violet.md) | Brand color: Linkyo Violet #9500E9 replaces Linkyo Blue (contrast-checked, status colors stay distinct) | Superseded by [0032](0032-brand-teal.md) |
| [0018](0018-page-kinds.md) | Welcome flow asks what the page is for (TikTok, shop, writer …) → fitting template and questions | **Applied** |
| [0019](0019-example-gallery.md) | Template gallery with 41 fictional example pages (no real celebrities), each in its own look; "Use this template" starts with that look | **Applied** |
| [0020](0020-concept-pages.md) | Concept pages for 12 well-known people: noindex, labelled "Concept", official links and free-licensed photos only; listed in the gallery under "Well-known people" at the founder's request | **Applied** |
| [0021](0021-more-page-kinds.md) | Seven more page kinds (affiliate, marketing, developer, designer, coach, streamer, podcast), GitHub platform, two gallery categories, 11 examples | **Applied** |
| [0022](0022-link-buttons.md) | Link buttons: icon tile (chosen or from the address), optional second line, one primary action in the accent; LinkedIn glyph | **Applied** |
| [0023](0023-video-playback.md) | Video playback after the tap: whole video here (default), 30-second preview then "Keep watching on YouTube", or open the platform | **Applied** |
| [0024](0024-moving-picture.md) | Moving picture: a short silent loop over the hero photo (poster = photo), plays only on screen, never for reduced motion or data saver; self-hosted | **Applied** |
| [0025](0025-mono-template.md) | Mono, a sixth template: black-and-white portrait melting into white, tall condensed name, titles in capitals, bare social icons; example page Nela Voss | **Applied** |
| [0026](0026-link-metadata.md) | Pasted songs and videos get their real title and picture (oEmbed via our server, pictures re-served by our optimizer); link buttons keep icons; mobile editor and look-step clean-up | **Applied** |
| [0027](0027-share-kit.md) | Share kit: link preview cards for every page and the site (template colors, labelled examples/concepts, Arabic-safe), plus story and post pictures in the dashboard | **Applied** |
| [0028](0028-admin-console.md) | Team console: customers, subscriptions, security (IP, device, sign-in log for account holders only, 30 days) and analytics; eight new permissions, owners can do everything | **Applied** |
| [0029](0029-gallery-redesign.md) | Template gallery redesign: moving wall of pages (pausable, still for reduced motion), sticky search + one row of icon category chips, language filter, photo-led cards that lean and rise in, preview with previous/next | **Applied** |
| [0030](0030-supabase-accounts.md) | Real accounts on Supabase (Frankfurt), on by configuration: server-side sign-in with security log, email confirmation, background saves, team console through permission-checked database functions | **Applied** |
| [0031](0031-light-home.md) | Light marketing home in the reference's design language with our own content: rotating page stack, growing example strip, four tinted feature panels, black actions, Linkyo Violet accent (actions and accent now Linkyo Teal, 0032) | **Applied** |
| [0032](0032-brand-teal.md) | Brand color Linkyo Teal (#00454C, lighter band #00565F, white text and icons) replaces Linkyo Violet in every brand role: actions, links, focus, logo, app icons; final home section as a teal card with its band | **Applied** |
| [0033](0033-white-and-teal.md) | White backgrounds with Linkyo Teal: white page and cards, teal 50 soft fills, teal 100 panels on the home instead of rose/lavender/mint/lime | **Applied** |
| [0034](0034-hero-deck.md) | Hero deck: example pages as a tabbed carousel (open the page in front, click a side page, tabs with a timer line, pause, keyboard, mirrored in Arabic) | **Applied** |
| [0035](0035-sign-in-by-code.md) | No passwords: sign-up and sign-in by 6-digit email code (and one-click link), new split sign-up screen with a drifting wall of example pages, import from Linktree & co. in the welcome flow | **Applied** |
| [0036](0036-motion-without-pause-buttons.md) | Motion without pause buttons (deck: two rounds, stops on choice, holds on hover/focus; strip: moves with scrolling or swipes; walls: one pass, hold on hover/keyboard), hero sized to the screen, phone-first first screen | **Applied** |
| [0037](0037-no-shadows.md) | No shadows anywhere (Linkyo is flat: borders and fill steps separate surfaces, lint rejects shadows; creator "Shadow" links become "Card"); the gallery's filter row sticks flush under the header on a solid band | **Applied** |
| [0038](0038-hero-two-lines.md) | Hero: the promise on two lines at every size (new `display-sm` 40 px beside the phones, `h2` size on phones) and one shorter sentence under it; the deck design stays (a centred hero was tried and dropped) | **Applied** |
