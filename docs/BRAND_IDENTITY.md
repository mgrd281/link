# Linkyo — Brand Identity

> Version 1.0 · Source of truth for web app, iOS app, marketing and creator pages.
> Every designer, developer and AI agent working on Linkyo must follow this file.

---

## 1. Brand core

| | |
|---|---|
| **Name** | Linkyo (always written with capital L, never "LinkYo", "LINKYO" only in logo lockups) |
| **One-liner** | One link. Everything you create. |
| **German** | Ein Link. Alles, was du erschaffst. |
| **Arabic** | رابط واحد. لكل ما تصنعه. |
| **What it is** | A creator home: link-in-bio page, media kit, content hub and analytics — on web and native iOS. |
| **For whom** | Creators, musicians, DJs, comedians, streamers, coaches, small brands and the managements behind them. |
| **Promise** | Your page looks premium in 5 minutes and stays up to date on its own. |
| **Proof points** | Free core · Made in Germany · GDPR-native · No cookies on creator pages by default · Real iOS app |

### Mission
Give every creator a home on the internet that looks as good as their best work — without design skills, code or monthly costs.

### Personality (5 traits)
1. **Confident, not loud** — bold type, calm layout.
2. **Crafted** — every pixel and every word has a reason.
3. **Fast** — instant feedback, no waiting, no friction.
4. **Personal** — the creator's identity leads, Linkyo stays in the background.
5. **Trustworthy** — honest about data, privacy and pricing.

### What Linkyo is NOT
Not a template marketplace. Not cluttered. Not "techy". Not neon-gradient AI aesthetics. Not a copy of any competitor.

---

## 2. Voice & tone

- Speak like a smart friend who designs for a living: short, warm, direct.
- Use "du" in German, "you" in English. Never corporate ("Sie", "leverage", "synergy").
- Sentences under 15 words in UI. Verbs first on buttons.
- Celebrate the creator, not the product.
- Errors: say what happened + how to fix it. Never blame the user.

| Situation | ✅ Do | ❌ Don't |
|---|---|---|
| Button | "Add link" / "Link hinzufügen" | "Submit", "OK" |
| Empty state | "Nothing here yet. Paste any link to start." | "No data available." |
| Error | "That link didn't load. Check the URL and try again." | "Error 400: invalid input" |
| Success | "Live! Your page is updated." | "Operation completed successfully." |

---

## 3. Logo

- **Wordmark**: "linkyo" in lowercase, Geist SemiBold, tracking +0.5 % ([ADR 0040](DECISIONS/0040-logo-linkyo-y.md)).
- **Symbol ("the Linkyo y")**: a Linkyo Teal tile (squircle, like an app icon) with a lowercase "y" cut out of it.
  - The long stroke ends in a soft hook. The short stroke stops just before it, leaving a hairline of teal: the link point where two paths meet.
  - Works at 16 px. Generated from geometry: `packages/tokens/brand/logo.mjs`.
- **Tones**: brand (teal tile, the y shows the background) and mono (the tile in the surrounding text color: white on teal or photos, creator pages, and the black-and-grey creator dashboard, §4.4).
- **Lockups**: horizontal (tile a little taller than the word, centred beside it), stacked, symbol only (favicon). App icons show the white y on flat teal; the system draws the tile.
- **Clear space**: a quarter of the tile on all sides.
- **Minimum size**: symbol 16 px, wordmark 64 px wide.
- **Never**: stretch, rotate, add shadows/gradients/outlines, place on busy photos without a scrim, recolor outside the palette.

### App icon (iOS)
Symbol in Paper (#F7F6F2) on Linkyo Teal (#00454C) background, with a subtle gradient to its lighter band (Teal 700 → Teal 600, #00565F, top-left to bottom-right). Provide light, dark and tinted variants (iOS 18+ icon appearances).

---

## 4. Color system

All colors are defined as design tokens (CSS variables + Swift `Color` assets). Use **OKLCH** for generation; hex below is the reference.

### 4.1 Brand colors (Linkyo product UI, marketing)

| Token | Hex | Use |
|---|---|---|
| `ink` | #0A0A0B | Primary text (light mode), dark backgrounds |
| `white` | #FFFFFF | Light background (page and cards), with Linkyo Teal; see [ADR 0033](DECISIONS/0033-white-and-teal.md) |
| `teal-50` | #EFF8F8 | Soft fills on white: fields, chips, quiet cards, sidebar |
| `paper` | #F7F6F2 | Text and marks on dark surfaces (dark mode, app icon symbol) |
| `teal-700` (**Linkyo Teal**) | #00454C | Primary actions, links, logo, brand surfaces (white on it 10.7:1, on white 10.7:1) |
| `teal-600` | #00565F | Hover, the lighter band under a brand surface, focus rings (white on it 8.4:1) |
| `teal-800` | #003A40 | Pressed state |
| `teal-100` | #D9EFF0 | Selected backgrounds, light teal panels (marketing illustrations, Pro card) |
| `lime-400` (**Spark**) | #D4FF3A | Rare accent: "Live", badges, celebration moments. Max 5 % of any screen. |
| `gray-50…950` | neutral scale, slight warm tint | **Website only**: marketing surfaces and illustrations. Never in the dashboard |
| `graphite-50…700` | #F5F5F7 … #47474C, cool neutral at the hue of ink and night (OKLCH 286°, chroma ≤ 0.0083) | The creator dashboard's greys: ground, selected and tinted fills, link hover ([ADR 0062](DECISIONS/0062-black-and-grey-dashboard.md), §4.4) |
| `success` | #12B76A | Success |
| `warning` | #E0A800 (text `warning-700` #735500, 6.9:1 on white) | Warnings. Gold, not orange: Linkyo's own interface uses no orange ([ADR 0053](DECISIONS/0053-audit-nov-2026.md)) |
| `danger` | #F04438 | Destructive, errors |

### 4.2 Dark mode (product UI)
Background `#0A0A0B`, surface `#141416`, elevated `#1C1C1F`, border `rgba(255,255,255,0.08)`, text `#F7F6F2`, secondary text 64 % opacity. Filled buttons use `teal-600` #00565F (one step lighter, so they stand off the dark background) with white labels; links use `teal-350` #5BB3B9 and focus rings `teal-400` #2E949C. Changed from violet in [ADR 0032](DECISIONS/0032-brand-teal.md) (before that from blue in [ADR 0017](DECISIONS/0017-brand-violet.md)).

### 4.3 Creator page theming (every user has their own look)
The creator's page does **not** use Linkyo colors. It uses a generated theme:

1. **Seed color**: chosen by the creator OR auto-extracted from the profile/hero image (dominant + vibrant color).
2. **Generated palette** (OKLCH): `background`, `surface`, `surface-2`, `text`, `text-muted`, `accent`, `accent-contrast`, `border` — for light and dark variants.
3. **Contrast guard**: every text/background pair must pass WCAG AA (4.5:1 body, 3:1 large text & icons). If not, auto-adjust lightness — never show the creator a broken combination.
4. **Theme presets** (starting points, all editable): Midnight, Paper, Studio, Neon Night, Sunset, Forest, Mono, Bold Red, Ocean, Pastel, Concrete, Gold.
5. **Background options**: solid, soft gradient (2–3 stops, generated from seed), image with auto scrim, video loop (muted, poster frame, respects reduced motion).
6. Live preview updates in < 50 ms on every change.

### 4.4 Dashboard palette (the creator dashboard is black and grey)
The creator dashboard (`/app/*`, with its sheets, dialogs, menus, tooltips and toasts) is black and grey ([ADR 0062](DECISIONS/0062-black-and-grey-dashboard.md)). In a neutral room the creator's own colours are the only hue on screen. Teal stays at every door: the website, sign-up and log-in, creator pages, the team area, share pictures, the favicon and the app icons.

The same semantic classes are used everywhere; inside the dashboard 12 roles and `link-hover` resolve to these values (the `console` and `consoleDark` values in `tokens.json`, scoped by `data-console`):

| Role | Light dashboard | Dark dashboard |
|---|---|---|
| `canvas-muted` (the ground) | graphite 50 #F5F5F7 | night 50 #0F0F11 |
| `selected` | graphite 100 #E8E8EB | graphite 50 at 10 % #F5F5F71A |
| `selected-fg` | ink #0A0A0B | paper #F7F6F2 |
| `tinted` | graphite 100 #E8E8EB | graphite 50 at 10 % #F5F5F71A |
| `tinted-hover` | graphite 200 #DCDCDF | graphite 50 at 16 % #F5F5F729 |
| `tinted-fg` | ink | paper |
| `primary` | night 200 #1C1C1F | graphite 50 #F5F5F7 |
| `primary-hover` | night 400 #303035 | graphite 200 #DCDCDF |
| `primary-pressed` | ink #0A0A0B | graphite 300 #CDCDD1 |
| `primary-fg` | white | ink |
| `link` | ink (= body text) | paper (= body text) |
| `link-hover` | graphite 600 #606065 | graphite 400 #A4A4A9 |
| `focus` | ink | graphite 50 #F5F5F7 |

Everything else is unchanged: canvas, surfaces and groups, lines, text alphas, success, warning, danger, Spark (still only for "Live"), scrim and skeleton.

- **Links** in the dashboard are body coloured. A link there is a standalone control: bold, with an icon (chevron, arrow, eye or a status glyph), and it hovers to a lighter grey (`hover:text-link-hover`). There are no links inside running text.
- **Logo**: `tone="mono"` in the dashboard (the sidebar, the loading frame and the welcome flow): tile and wordmark both take the text colour, ink on light and paper on dark. The y cut-out still shows the ground.
- **Switch**: on, the knob takes `primary-fg` (white on the black track, ink on the white track in dark mode).
- **Never** use palette (`teal-*`, `gray-*`, `graphite-*`, `night-*` …) or `tint-*` classes in the dashboard: they would not follow the palette. A unit test enforces it.

---

## 5. Typography

### Product UI (web)
- **UI + body**: Geist Sans (OFL) — self-hosted, no Google Fonts CDN (GDPR).
- **Numbers / code**: Geist Mono.
- **Display (marketing headlines)**: Geist Sans Bold/Black, tracking -3 %.

### Product UI (iOS)
- SF Pro (system) for all UI text with Dynamic Type support.
- Geist for brand moments only (onboarding headline, paywall, empty states).

### Type scale (web, rem; 1rem = 16px)
| Token | Size / line-height / weight |
|---|---|
| display-xl | 4.5 / 1.0 / 800 |
| display | 3.5 / 1.05 / 800 |
| h1 | 2.25 / 1.15 / 700 |
| h2 | 1.75 / 1.2 / 700 |
| h3 | 1.375 / 1.3 / 600 |
| body-lg | 1.125 / 1.55 / 400 |
| body | 1 / 1.55 / 400 |
| small | 0.875 / 1.45 / 500 |
| caption | 0.75 / 1.4 / 500 |

### Creator page font pairings (creator chooses one, all self-hosted, OFL)
1. **Classic** — Inter / Inter
2. **Stage** — Anton (name) / Inter (text) → big condensed names for artists
3. **Editorial** — Instrument Serif / Inter
4. **Modern** — Space Grotesk / Space Grotesk
5. **Bold** — Bricolage Grotesque / Inter
6. **Elegant** — Playfair Display / Lato
7. **Tech** — Geist / Geist Mono
8. **Arabic** — IBM Plex Sans Arabic / IBM Plex Sans Arabic (full RTL support)

---

## 6. Layout & spacing

- **Grid**: 4 px base, 8 px rhythm. Spacing tokens: 0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128.
- **Creator page**: single column, max-width 560 px, side padding 20 px (mobile) / centered on desktop with optional ambient background.
- **Dashboard**: sidebar 248 px + content (max 1120 px) + live phone preview 390 px on ≥ 1280 px screens.
- **Radius tokens**: `xs 6`, `sm 10`, `md 14`, `lg 20`, `xl 28`, `full 9999`. Cards = `lg`, buttons = `md` or `full` (creator choice), inputs = `md`.
- **No shadows: Linkyo is flat** ([ADR 0037](DECISIONS/0037-no-shadows.md)). No `box-shadow`, `drop-shadow` or `text-shadow` anywhere: not on cards, buttons, menus, dialogs, phones, creator pages, share pictures or iOS views. The tokens have no shadow scale. A surface stands apart in one of three ways:
  - **Hairline border** (`border-line`): cards, chips, menus, popovers, dialogs, sheets.
  - **Stronger border** (`border-line-strong`, `border-line-input`): fields and secondary buttons.
  - **Step in the fill**: a white `surface` tile on a teal 50 `canvas-muted` panel; a chosen tab or segment is white with a hairline border.
  - Modal overlays also sit on the scrim. Lint (`linkyo/no-raw-design-values`, Stylelint) rejects any shadow.
- **Links have no underline** ([ADR 0041](DECISIONS/0041-no-underlines.md)): not by default, not on hover. They are marked by Linkyo Teal (`link`) and semibold weight, and turn ink on hover; keyboard focus shows the focus ring.
- **Sticky bars** sit flush under the header on a solid background: nothing scrolls between the header and a sticky filter row.
- **Touch targets**: minimum 44 × 44 pt everywhere.

---

## 7. Buttons

| Variant | Use | Style |
|---|---|---|
| **Primary** | One main action per screen | Linkyo Teal fill, white text, `md` radius |
| **Secondary** | Alternative actions | Surface fill, 1px border, ink text |
| **Ghost** | Low-emphasis, toolbars | Transparent, hover surface |
| **Destructive** | Delete, disconnect | Danger text; fill only in confirmation dialog |
| **Icon button** | Toolbars | 40 px square (web), 44 pt (iOS), tooltip required |

- **Sizes**: sm 32 px · md 40 px · lg 48 px · xl 56 px (creator page links).
- **States (all required)**: default, hover, pressed (scale 0.98 + darker), focus-visible (2 px ring Linkyo Teal, 2 px offset), disabled (40 % opacity, no pointer), loading (spinner replaces icon, width locked, label stays).
- Label: verb first, max 3 words. Icon left (16/20 px) only when it adds meaning.

### Creator page link buttons (themeable)
Styles: Filled, Outline, Soft, Glass (backdrop blur), Card (surface fill + hairline border, saved as `shadow`), Minimal (text + arrow). Shapes: square, rounded, pill. Optional thumbnail/icon left, chevron or "new" badge right.

---

## 8. Iconography

- **Web**: Lucide (ISC license), stroke 1.75, sizes 16 / 20 / 24, `currentColor`.
- **iOS**: SF Symbols, weight matched to text (Regular/Medium), hierarchical rendering.
- **Brand/platform icons** (YouTube, TikTok, Spotify…): Simple Icons (CC0), always in official shapes, monochrome by default; brand color only on hover/press or when the creator enables "brand colors". Respect each platform's brand guidelines.
- Never mix icon families on one screen. Never use emoji as UI icons.

---

## 9. Motion & haptics

- **Principle**: motion explains, never decorates.
- **Durations**: 120 ms (micro), 200 ms (standard), 320 ms (sheets/pages).
- **Easing**: `cubic-bezier(0.2, 0.8, 0.2, 1)` (web); spring response 0.35, damping 0.85 (iOS).
- Drag & drop: lifted item scales 1.03 and gets a Linkyo Teal border (no shadow); others reflow smoothly.
- Respect `prefers-reduced-motion` / Reduce Motion: replace movement with opacity fades.
- **iOS haptics**: selection tick on reorder, success on publish, warning on destructive confirm. Never on every tap.

---

## 10. Imagery

- Creator content always comes first; Linkyo UI frames it, never competes.
- Images: auto-cropped with focal point, WebP/AVIF, blur-up placeholders.
- Marketing: real creator pages on phones (with permission), light, calm backgrounds and Linkyo Teal brand surfaces with white text. No stock-photo clichés, no 3D blobs.

---

## 11. Accessibility (non-negotiable)

WCAG 2.2 AA · keyboard-complete · visible focus · screen-reader labels on every icon button · Dynamic Type / 200 % zoom without breakage · color never the only signal · captions/alt text prompts when uploading media · RTL layout for Arabic.

---

## 12. Do & Don't summary

✅ Generous whitespace · one primary action per screen · creator's content is the hero · consistent tokens everywhere · real states for loading/empty/error.
❌ Purple-pink AI gradients · more than 2 font families per page · centered long text · gray text on colored backgrounds below contrast · icons without labels in key actions · modals for things that can be inline.
