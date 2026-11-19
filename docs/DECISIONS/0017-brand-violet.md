# 0017 — Brand color: Linkyo Violet replaces Linkyo Blue

**Context.** The founder doesn't like the blue (#3355FF) and asked for something better. Blue is also the default
color of most SaaS tools, so it does little to make Linkyo recognizable to creators.

**Options compared** (rendered on Paper and Ink, next to the error red and the Spark lime):

| Option | Verdict |
| --- | --- |
| Magenta / fuchsia | Too close to the error red (#F04438): links would read as errors. |
| Orange / coral | Collides with warning and danger; white labels fall below 4.5:1. |
| Green | Collides with success. |
| **Violet (OKLCH hue 305)** | Clearly not blue, far from every status color, high energy with Spark lime, works on Paper and Ink. |

**Decision.** `color.violet` replaces `color.blue` everywhere (same steps, same roles). It was generated in OKLCH at hue
305, gamut-mapped to sRGB:

| Step | Hex | Role | Contrast |
| --- | --- | --- | --- |
| 100 | #F2E8FF | Selected background (light) | 700 on it: 8.3:1 |
| 350 | #C082FF | Links on dark surfaces | 6.4:1 on #1C1C1F |
| 400 | #B35EFF | Focus ring and brand on dark; selected tint (16 %) | 5.6:1 on #0A0A0B |
| **500** | **#9500E9** | **Primary, links, focus, logo** | White 6.1:1 · on Paper 5.6:1 |
| 600 | #7E00C7 | Pressed | — |
| 700 | #6900A6 | Text on selected | — |

Hover is #8900D8 (light) and #A000FB (dark). The logo, favicon, app icons (light/dark), the iOS asset catalog and
AccentColor are regenerated from the tokens. Creator pages are unaffected: they use their own themes (§4.3).

**Status.** Superseded by [0032](0032-brand-teal.md) (Linkyo Teal). Was reversible by changing the scale in `packages/tokens/tokens.json` and running
`pnpm --filter @linkyo/tokens build && pnpm --filter @linkyo/tokens brand`.
