import { creatorTokens } from "@linkyo/tokens";
import { describe, expect, it } from "vitest";

import { BUTTON_SHAPES, BUTTON_STYLES, PAGE_PLAN_JSON_SCHEMA, PAGE_PLAN_VERSION, PAIRING_IDS, SWATCH_NAMES, TEMPLATE_IDS, pagePlanSchema } from "../src/ai-plan";
import { KINDS } from "../src/kinds";
import { LINK_ICONS } from "../src/schema";

type Node = Record<string, unknown>;

/** Every object node of a JSON Schema, depth first. */
function nodes(value: unknown, out: Node[] = []): Node[] {
  if (Array.isArray(value)) for (const item of value) nodes(item, out);
  else if (value && typeof value === "object") {
    out.push(value as Node);
    for (const child of Object.values(value)) nodes(child, out);
  }
  return out;
}

const all = nodes(PAGE_PLAN_JSON_SCHEMA);
const count = (key: string) => all.filter((node) => key in node).length;

/** The fictional example answer of the prompt (research report r2 §6.3), verbatim. */
const EXAMPLE_ANSWER = {
  kind: "music",
  theme: { template: "nocturne", accent: "photo_vibrant", pairing: "template", buttonShape: "template", buttonStyle: "template" },
  profile: { displayName: "Lio Vance", tagline: "DJ und Producer aus Berlin", bio: "Ich mache elektronische Musik und lege in Clubs auf.", location: "Berlin" },
  blocks: [
    { type: "socials", refs: ["L1", "L2"] },
    { type: "rich", ref: "L3", highlight: true, ad: false },
    { type: "rich", ref: "L4", highlight: false, ad: false },
    { type: "link", ref: "L5", title: "Booking anfragen", subtitle: "", icon: "calendar", highlight: false, ad: false },
  ],
  notes: [
    { topic: "look", text: "Nocturne mit dem Orange aus deinem Foto passt zu Clubnächten." },
    { topic: "missing", text: "Füg ein Pressefoto hinzu, dann wirkt der Kopf der Seite stärker." },
  ],
};

describe("PagePlan v1", () => {
  it("sends a stable schema (snapshot)", () => {
    expect(PAGE_PLAN_VERSION).toBe("plan-v1");
    expect(PAGE_PLAN_JSON_SCHEMA).toMatchSnapshot();
  });

  it("fits structured outputs: nothing optional, one union, no oneOf, no length or number limits", () => {
    const optional = all.flatMap((node) => {
      if (!node.properties || typeof node.properties !== "object") return [];
      const required = new Set(Array.isArray(node.required) ? (node.required as string[]) : []);
      return Object.keys(node.properties).filter((key) => !required.has(key));
    });
    expect(optional).toEqual([]);
    expect(count("anyOf")).toBe(1);
    expect(count("oneOf")).toBe(0);
    for (const key of ["maxLength", "maxItems", "minLength", "minItems", "minimum", "maximum", "$schema"]) expect(count(key), key).toBe(0);
    // Every object is closed.
    for (const node of all.filter((item) => item.type === "object")) expect(node.additionalProperties).toBe(false);
    // The limits live on in the descriptions, and the one simple pattern stays.
    const text = JSON.stringify(PAGE_PLAN_JSON_SCHEMA);
    expect(text).toContain("(max 30 items)");
    expect(text).toContain("Empty string for none. (max 80 characters)");
    expect(all.filter((node) => "pattern" in node).map((node) => node.pattern)).toEqual(["^L[0-9]{1,2}$", "^L[0-9]{1,2}$", "^L[0-9]{1,2}$"]);
  });

  it("parses the prompt's example answer and still enforces every limit itself", () => {
    expect(pagePlanSchema.safeParse(EXAMPLE_ANSWER).success).toBe(true);
    expect(pagePlanSchema.safeParse({ ...EXAMPLE_ANSWER, profile: { ...EXAMPLE_ANSWER.profile, bio: "x".repeat(161) } }).success).toBe(false);
    expect(pagePlanSchema.safeParse({ ...EXAMPLE_ANSWER, blocks: [{ type: "rich", ref: "https://evil.example", highlight: false, ad: false }] }).success).toBe(false);
    expect(pagePlanSchema.safeParse({ ...EXAMPLE_ANSWER, extra: 1 }).success).toBe(false);
    expect(pagePlanSchema.safeParse({ ...EXAMPLE_ANSWER, theme: { ...EXAMPLE_ANSWER.theme, pairing: "arabic" } }).success).toBe(false);
  });

  it("offers every current token id, kind and icon (and never the Arabic pairing)", () => {
    expect(TEMPLATE_IDS).toEqual(Object.keys(creatorTokens.templates));
    expect(PAIRING_IDS).toEqual(Object.keys(creatorTokens.pairings).filter((id) => id !== "arabic"));
    expect(PAIRING_IDS).not.toContain("arabic");
    expect(BUTTON_STYLES).toEqual([...creatorTokens.buttonStyles]);
    expect(BUTTON_SHAPES).toEqual(Object.keys(creatorTokens.buttonShapes));
    expect(SWATCH_NAMES).toEqual(Object.keys(creatorTokens.swatches));

    const theme = pagePlanSchema.shape.theme.shape;
    expect(theme.template.options).toEqual(TEMPLATE_IDS);
    expect(theme.accent.options).toEqual(["template", "photo_vibrant", "photo_dominant", ...SWATCH_NAMES]);
    expect(theme.pairing.options).toEqual(["template", ...PAIRING_IDS]);
    expect(theme.buttonShape.options).toEqual(["template", ...BUTTON_SHAPES]);
    expect(theme.buttonStyle.options).toEqual(["template", ...BUTTON_STYLES]);
    expect(pagePlanSchema.shape.kind.options).toEqual([...KINDS]);
    const link = all.find((node) => (node.properties as Node | undefined)?.icon);
    expect(((link?.properties as Node).icon as Node).enum).toEqual(["auto", ...LINK_ICONS]);
  });
});
