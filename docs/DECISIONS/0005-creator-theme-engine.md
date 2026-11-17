# 0005 — Creator theme engine

**Decision.** `packages/tokens/src/creator` (dependency-free, < 1 ms per palette):
1. Seed (creator's color or extracted from the photo: dominant + vibrant) + optional neutral hue + tint (0–1) + mode.
2. Surfaces from the neutral hue at fixed OKLab lightness; text, muted text, accent text, strong border found by binary
   search on lightness (hue/chroma kept, sRGB gamut-mapped by chroma reduction).
3. **Guarantees** (by construction, verified in `auditPalette`): text/muted/accent-text ≥ 4.5:1 on bg/surface/surface-2
   and every gradient stop; label on accent ≥ 4.5:1; accent and strong borders ≥ 3:1 on bg. If a seed can't satisfy a
   rule, only its lightness moves — the creator never sees a broken combination.
4. Presets (12), font pairings (8), button styles (6) × shapes (3) are tokens; Arabic pages always use the Arabic pairing.

**Evidence.** 4,000 random seeds × both modes pass in CI; extreme seeds (#FFF, #000, #FFFF00, lime) pass;
`test/fixtures/palettes.json` holds parity vectors for the Swift port (Phase 2).
