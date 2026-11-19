# 0032 — Brand color: Linkyo Teal replaces Linkyo Violet

**Context.** The founder chose the brand color from a reference picture and gave the exact values:

- background **#00454C** (RGB 0, 69, 76);
- the lower band **#00565F** (RGB 0, 86, 95);
- text and icons **#FFFFFF**.

A deep petrol teal is calm and premium next to the light marketing home (ADR 0031). It is far from every status color:
the success green is lighter and more yellow, the danger red is the opposite hue.

**Decision.** A new `color.teal` scale, anchored on the founder's two values, takes over every brand role that violet
had (ADR 0017). The violet scale stays in the palette for creator themes and older examples; nothing in the product UI
uses it any more.

| Step | Hex | Role | Contrast |
| --- | --- | --- | --- |
| 100 | #D9EFF0 | Selected background (light) | 800 on it: 10.5:1 |
| 350 | #5BB3B9 | Links on dark surfaces; selected tint (16 %) | 7.0:1 on #1C1C1F |
| 400 | #2E949C | Focus ring on dark | 5.5:1 on #0A0A0B |
| 500 | #0A6F78 | Hover on dark | White 5.9:1 |
| **600** | **#00565F** | **The lower band; hover; focus (light); primary on dark** | White 8.4:1 · on Paper 7.8:1 |
| **700** | **#00454C** | **Primary, links, logo, brand surfaces** | White 10.7:1 · on Paper 9.9:1 |
| 800 | #003A40 | Pressed; text on selected | — |

The other steps (50, 200, 300, 900, 950) fill out the scale for charts and gradients.

- **Dark mode:** filled buttons use 600, one step lighter, so they stand off the near-black background; white labels
  still pass.
- **Brand surfaces** follow the picture: a Linkyo Teal (700) card with a lighter 600 band along the bottom, white text and
  icons. The marketing home's last section is built this way, and its address field gets a white button with teal text.
- **Actions** on the marketing home (header, address field, "see all", pricing) are Linkyo Teal with white text instead
  of black.
- **Regenerated from the tokens:**
  - logo, favicon and app icons (light: teal 700 → 600 gradient; dark: teal 350 symbol);
  - the iOS asset catalog and AccentColor;
  - share cards and admin charts (one-hue teal steps).

Creator pages are unaffected: they use their own themes (§4.3).

**Status.** Applied. To change it again, edit the scale and the semantic roles in `packages/tokens/tokens.json`, then
run `pnpm tokens` and `pnpm --filter @linkyo/tokens brand`, and re-render the two iOS app icon PNGs from
`packages/tokens/brand/svg/`. Supersedes [0017](0017-brand-violet.md).
