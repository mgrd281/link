import { describe, expect, it } from "vitest";

import { orderTemplates, suggestedTemplates, TEMPLATE_IDS, templatesFor, templateUses } from "../src/creator";
import { creatorTokens } from "../src/generated/tokens";

// The page kinds of @linkyo/blocks (KINDS), copied: this package does not depend on blocks.
const KINDS = [
  "tiktok", "instagram", "youtube", "apps", "streamer", "podcast", "music", "affiliate", "store", "marketing", "shop", "business",
  "coach", "developer", "designer", "photographer", "writer", "journalist", "engineer", "lawyer", "freelancer", "student",
  "warehouse", "other",
];

describe("template use and suggestions", () => {
  it("gives every template a use and at least one kind, and names only real kinds", () => {
    for (const id of TEMPLATE_IDS) {
      const t = creatorTokens.templates[id] as { use?: readonly string[]; suggestFor?: readonly string[] };
      expect(t.use?.length, id).toBeGreaterThan(0);
      expect(t.suggestFor?.length, id).toBeGreaterThan(0);
      for (const kind of t.suggestFor ?? []) expect(KINDS, `${id} → ${kind}`).toContain(kind);
    }
  });

  it("lists the portfolio templates", () => {
    expect(templatesFor("portfolio")).toEqual(expect.arrayContaining(["werkbogen", "tiefdruck", "folio", "laufbahn"]));
    expect(templatesFor("portfolio")).not.toContain("nocturne");
    expect(templateUses("folio")).toEqual(["portfolio", "link-in-bio"]);
  });

  it("suggests a template for every kind", () => {
    for (const kind of KINDS) expect(suggestedTemplates(kind).length, kind).toBeGreaterThan(0);
    expect(suggestedTemplates("photographer")).toContain("werkbogen");
    expect(suggestedTemplates("nobody")).toEqual([]);
  });

  it("orders the given ids first and keeps every template once", () => {
    const order = orderTemplates(["werkbogen", "nope", "werkbogen", "atelier"]);
    expect(order.slice(0, 2)).toEqual(["werkbogen", "atelier"]);
    expect([...order].sort()).toEqual([...TEMPLATE_IDS].sort());
  });
});
