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
    expect(templatesFor("portfolio")).toEqual(expect.arrayContaining(["werkbogen", "tiefdruck", "folio", "laufbahn", "leuchttisch", "grundriss", "logbuch"]));
    expect(templatesFor("portfolio")).not.toContain("nocturne");
    expect(templateUses("folio")).toEqual(["portfolio", "link-in-bio"]);
  });

  it("suggests a template for every kind", () => {
    for (const kind of KINDS) expect(suggestedTemplates(kind).length, kind).toBeGreaterThan(0);
    expect(suggestedTemplates("photographer")).toContain("werkbogen");
    expect(suggestedTemplates("nobody")).toEqual([]);
  });

  it("leads with the templates that name the kind in leadFor, then the others in token order", () => {
    for (const id of TEMPLATE_IDS) {
      const t = creatorTokens.templates[id] as { suggestFor?: readonly string[]; leadFor?: readonly string[] };
      // A lead is always also a suggestion.
      for (const kind of t.leadFor ?? []) expect(t.suggestFor, `${id} leads for ${kind}`).toContain(kind);
    }
    // Plan §4.2: Leuchttisch right after Werkbogen for photographers, Logbuch right after Tiefdruck for
    // developers and engineers (the welcome's look step puts the kind's starter first).
    expect(suggestedTemplates("photographer")).toEqual(["leuchttisch", "folio", "werkbogen"]);
    expect(suggestedTemplates("developer")[0]).toBe("logbuch");
    expect(suggestedTemplates("engineer")[0]).toBe("logbuch");
    expect(suggestedTemplates("designer")).toContain("grundriss");
    // Kinds without a lead keep token order.
    const kindsWithLead = new Set(TEMPLATE_IDS.flatMap((id) => (creatorTokens.templates[id] as { leadFor?: readonly string[] }).leadFor ?? []));
    for (const kind of KINDS.filter((k) => !kindsWithLead.has(k))) {
      const order = suggestedTemplates(kind);
      expect(order, kind).toEqual([...order].sort((a, b) => TEMPLATE_IDS.indexOf(a) - TEMPLATE_IDS.indexOf(b)));
    }
  });

  it("orders the given ids first and keeps every template once", () => {
    const order = orderTemplates(["werkbogen", "nope", "werkbogen", "atelier"]);
    expect(order.slice(0, 2)).toEqual(["werkbogen", "atelier"]);
    expect([...order].sort()).toEqual([...TEMPLATE_IDS].sort());
  });
});
