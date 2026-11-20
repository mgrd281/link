# 0056 — Official store badges and a native feel on phones

**Context.** The founder asked for "real Apple buttons and Google Play too", a better design, and a
phone experience that feels like a native iOS app: Apple's Human Interface Guidelines, bottom sheets,
haptics where supported, smooth spring motion, safe areas and loading states, without breaking any
feature. We measured first and audited what was there.

**Store badges.**

- The official artwork, unaltered and served by Linkyo (pages still load nothing from Apple or Google):
  - Apple: the black "Download on the App Store" badge from Apple's App Store Marketing Tools, in
    German, English and Arabic.
  - Google: "Get it on Google Play" from Google's badge page, transparent padding trimmed.
  - Sources and rules are in `apps/web/src/assets/badges/README.md`.
- Apple's guidelines, as written:
  - **One App Store badge per layout.** Only the page's featured app gets the badges (`featuredApp`:
    its first highlighted app, or its only app). That app gets a card like the top of a store page:
    a large icon, name, maker, rating, category, price, the creator's line and code.
  - **Black badges, App Store first, at least 40 px high, a quarter of the height as clear space,**
    never modified, angled or animated. We use 44 px (a touch target) and the same height for Google
    Play, as Google asks.
  - **Credit lines.** The page footer credits the marks whenever badges are shown.
- **Other apps** get the stores' own list button: an "Laden / Get" capsule (the page's accent on a soft
  fill) with the price under it, opening the visitor's own store.
- **Contrast.** Highlighted rows in an app list used a second fill. On Aura's frosted cards this put
  grey text at 4.07:1. They now carry an accent bar at the start instead.
- **License note.** Apple's marketing agreement licenses badges to developers for their own apps, and
  its marketing tools also serve them to marketers. Showing them for apps a creator recommends is
  common practice but not spelled out by Apple. One change brings back our own button if this is ever
  a concern.

**Native feel on phones** (audit by file: viewport, safe areas, sheets, tab bar, motion, haptics,
loading, transitions, touch CSS).

| Area | Before | Now |
|---|---|---|
| Spring motion | iOS spring tokens only in Swift | `ease-spring` + `duration-spring` (487 ms): the same damped spring sampled into CSS `linear()`; `ease-exit` for leaving |
| Bottom sheets | faded in 8 px, no exit, decorative grabber | slide up from below on the spring, slide away when closed; **pull down to close** from the grabber or header, with a rubber band upward, the backdrop fading with the finger, a haptic tick on dismissal and a spring back for short pulls; side panel unchanged on wide screens |
| Haptics | none | `haptic()`: a short vibration on Android, the system's selection tick on iPhone (iOS 18+, via a native switch); on tab changes, the + button, switches, copy and sheet dismissal |
| Tab bar | colour change only | the active pill fills on the spring, tabs dip when pressed, no long-press callout or text selection on app chrome |
| Home screen | no manifest or touch icon | web app manifest (standalone, opens the dashboard), app icons (192, 512, maskable), Apple touch icon, `apple-mobile-web-app-*`, light and dark `theme-color`, no automatic phone links on numbers |
| Touch | grey tap flash, double-tap zoom on controls | no tap highlight, `touch-action: manipulation` on controls |
| iOS input zoom | 14 px search and admin fields zoomed on focus | 16 px on phones |
| Safe areas | toasts and footer-less sheets ignored the home indicator | both clear it; the dashboard's content too |
| Loading | logo and spinner | a skeleton of the dashboard (header, title, profile, blocks, tab bar); the admin console keeps the spinner |

**Deliberately not done.**

- **Frosted bars.** We tried translucent header and tab bars and took them back: CLAUDE.md asks for
  bars on a solid background with nothing showing through, and Linkyo is flat.
- **Animated tab switches.** iOS switches tabs instantly. Only sheets and pushed screens move.
- **Page transitions** with React's `ViewTransition` were left for a later pass.

**Fix along the way.** Undo (⌘Z) was ignored while any dialog was in the DOM. A sheet sliding away no
longer counts as open.

**Measured** (Lighthouse mobile, simulated throttling, local production build, before → after):

| Page | Performance | Accessibility | Best practices | LCP | TBT |
|---|---|---|---|---|---|
| Home (de) | 64 → 74 | 100 → 100 | 100 → 100 | 6.2 → 5.8 s | 530 → 220 ms |
| App tips page (de) | 74 → 82 | 97 → 97* | 100 → 100 | 5.9 → 4.8 s | 230 → 70 ms |
| Skills page (en) | 85 → 85 | 100 → 100 | 100 → 100 | 4.1 → 4.3 s | 120 → 60 ms |
| Templates (de) | 69 → 75 | 100 → 100 | 100 → 100 | 6.8 → 6.1 s | 340 → 190 ms |

CLS is 0 everywhere. SEO is 66 on example pages, which are `noindex` on purpose.

- **Performance.** These changes add no JavaScript to public pages. The performance differences are
  mostly this machine's variance, not a speed-up.
- **\* Accessibility on the app tips page.** The 97 "after" came from the small "CODE" label: its
  contrast is fine at rest, but it dropped below 4.5:1 while fading in at the edge of the screen. The
  label now uses the full text colour.
