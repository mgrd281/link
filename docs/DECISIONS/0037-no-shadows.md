# 0037 — No shadows: Linkyo is flat; the gallery filters stick flush under the header

**Context.** The founder looked at the template gallery on a phone and asked for two things:
1. "Don't use any shadow, and add this to the docs."
2. While scrolling down, the sticky filter row ("Alle 80 · Creator 16 …") seemed to float in the air. It stuck 80 px
   from the top while the header is 64 px tall, so cards showed through a 16 px gap between them.

Until now the brand allowed three elevation levels (`e1`–`e3`) and a teal glow under primary buttons (0036). They
were used about 140 times: cards, chips, tabs, menus, dialogs, phones, creator link buttons, share pictures.

**Decision.**

- **No shadows anywhere.**
  - This covers the website, sign-up, the dashboard, the team console, creator pages, share pictures and the iOS
    design system.
  - Tokens: the `shadow` scale (`e1`–`e3`) and the `shadow-cta` glow are gone, so the Tailwind theme has no shadow
    utilities at all. The iOS `Elevation` enum is gone too.
  - A surface stands apart in one of three ways:
    - a **hairline border** (`border-line`): cards, chips, menus, popovers, dialogs, sheets;
    - a **stronger border** (`border-line-strong` / `border-line-input`): fields, secondary buttons;
    - a **step in the fill**: a white tile on a teal 50 panel.
- **What changes on screen.**
  - **Buttons:** primary buttons are flat Linkyo Teal; the glow from 0036 is gone. The slight lift on hover and the
    moving arrow stay.
  - **Chosen items:** a chosen tab, segment or language is a white tile with a hairline border in its muted track.
    Every item carries a transparent border, so nothing jumps.
  - **Gallery cards:** every page card has a hairline frame, so light pages never melt into the white page.
  - **Overlays:** borders everywhere, plus the scrim when modal. Dark tooltips and toasts already stand out by color.
  - **Drag and drop:** the lifted row scales slightly and gets a teal border.
  - **Creator pages:** the link style "Shadow" becomes **"Card"** (surface fill + hairline border).
    - It is still saved as `shadow`, so existing pages keep working without a migration.
    - Mosaic tiles and glass buttons get hairline borders.
    - Hover on gallery-direction cards darkens the edge.
  - **Share pictures:** the tilted page cards keep their white frame and lose the drop shadow.
  - **Style guide:** "Elevation" becomes "Depth without shadows", which shows the three ways above.
- **Enforced, not just written down.**
  - `linkyo/no-raw-design-values` rejects `shadow-*`, `drop-shadow-*`, `inset-shadow-*` and `text-shadow-*`
    classes, and `boxShadow`/`textShadow`/`drop-shadow()` in style objects. `shadow-none` and `"none"` stay allowed.
  - Stylelint allows only `box-shadow: none` / `text-shadow: none` and disallows `drop-shadow()`.
  - Unknown classes fail better-tailwindcss anyway, because the theme has no shadow scale.
- **Gallery filters.** The sticky filter row sits flush under the header (`top-16`, the header's height) on a solid
  canvas band:
  - phones: a full-width strip with a hairline below;
  - larger screens: the bordered search-and-chips bar inside the band.
  - Nothing scrolls between the header and the filters any more.

**Supersedes** the elevation levels in brand §6, "cards keep their border and shadow" (0033), the lifted highlight
link (`shadow-e2`, 0022) and the teal glow on primary buttons (0036).

**Status.** Applied. Tests:
- lint rule and Stylelint tests for every shadow form;
- gallery e2e: on a phone, the filter row touches the header while scrolled and no card shows above it;
- the existing e2e and axe suites.
