# 0033 — White backgrounds with Linkyo Teal

**Context.** After Linkyo Teal became the brand color (ADR 0032), the founder asked for the background to be white,
together with the teal. The light mode so far used Paper (#F7F6F2, warm off-white), warm gray fills and four colored
panels (rose, lavender, mint, lime) on the marketing home. Next to the deep teal, the beige read as dated, and the
four colors competed with the brand.

**Decision.** White and Linkyo Teal, nothing else, in light mode:

| Role | Before | Now |
| --- | --- | --- |
| `canvas` (page) | Paper #F7F6F2 | **White #FFFFFF** |
| `surface` (cards) | gray 25 #FCFBF9 | **White #FFFFFF** (cards keep their border and shadow) |
| `canvas-muted` (fields, chips, quiet cards, sidebar) | gray 75 #F2F1ED | **Teal 50 #EFF8F8** |
| New `tint-teal` (panels) | — | **Teal 100 #D9EFF0** (dark: teal 900) |

- The marketing home's four feature panels alternate between teal 100 and teal 50, and the Pro pricing card is teal 100.
- The final section stays the deep teal card with its lighter band (ADR 0032).
- The rose, lavender, mint and lime tints stay in the tokens but the home no longer uses them.
- Paper stays as the text color on dark surfaces.
- Dark mode is unchanged.
- Every text role still reaches 4.5:1 on all four backgrounds and on the new panel; `test/tokens.test.ts` checks it.

**Status.** Applied. Reversible in `packages/tokens/tokens.json` (`canvas`, `canvas-muted`, `surface`, `tint-teal`),
then `pnpm tokens`.
