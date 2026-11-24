import { resolveCreatorTheme, templatesFor } from "@linkyo/tokens/creator";
import { describe, expect, it } from "vitest";

import { labelInFlow } from "./label-flow";

describe("the example label on a portfolio", () => {
  it("stands above the page for every portfolio hero that opens with a face, a plate or the name", () => {
    // Laid over the top of a strip, title block or README hero it covered the name on a phone (the
    // label is about 42 px tall at 12 px from the top; those heroes start their name at 24 to 40 px).
    for (const template of templatesFor("portfolio")) {
      const { hero } = resolveCreatorTheme({ template }).layout;
      // Pictures the label may lie on: Folio's framed picture, and Laufbahn's from edge to edge, which
      // makes room for the label itself (its `banner`).
      if (hero === "inset" || hero === "bleed") continue;
      expect(labelInFlow(hero), `${template} (${hero})`).toBe(true);
    }
  });

  it("lies over the classic heroes, which open with a picture or a band of colour", () => {
    for (const hero of ["portrait", "cinema", "duotone", "halo", "bleed"] as const) expect(labelInFlow(hero), hero).toBe(false);
  });
});
