import { describe, expect, it } from "vitest";

import { blockSchema, hasAiContent, pageSchema, profileSchema, type Page } from "../src/schema";

const avatar = { src: "/a.jpg", alt: "" };
const profile = { username: "mila", displayName: "Mila", bio: "Hi", avatar, locale: "de" as const };
const link = { id: "b1", type: "link" as const, title: "Shop", url: "https://example.com" };

describe("block provenance", () => {
  it("accepts the three origins and nothing else", () => {
    for (const origin of ["ai", "ai-edited", "human"]) expect(blockSchema.safeParse({ ...link, origin }).success, origin).toBe(true);
    expect(blockSchema.safeParse({ ...link, origin: "robot" }).success).toBe(false);
  });

  it("keeps every existing page valid: no origin and no aiFields means a person made it", () => {
    const parsed = pageSchema.parse({ profile, blocks: [link] });
    expect(parsed.blocks[0]?.origin).toBeUndefined();
    expect(parsed.profile.aiFields).toBeUndefined();
    expect(hasAiContent(parsed)).toBe(false);
  });

  it("lists AI-written profile texts", () => {
    expect(profileSchema.safeParse({ ...profile, aiFields: ["bio"] }).success).toBe(true);
    expect(profileSchema.safeParse({ ...profile, aiFields: ["displayName", "tagline", "bio"] }).success).toBe(true);
    expect(profileSchema.safeParse({ ...profile, aiFields: ["avatar"] }).success).toBe(false);
  });

  it("finds AI content in blocks or in the profile", () => {
    const page = (blocks: Page["blocks"], aiFields?: Page["profile"]["aiFields"]): Page => pageSchema.parse({ profile: { ...profile, ...(aiFields ? { aiFields } : {}) }, blocks });
    expect(hasAiContent(page([], ["bio"]))).toBe(true);
    expect(hasAiContent(page([{ ...link, visible: true, highlight: false, origin: "ai" }]))).toBe(true);
    expect(hasAiContent(page([{ ...link, visible: true, highlight: false, origin: "ai-edited" }]))).toBe(true);
    expect(hasAiContent(page([{ ...link, visible: true, highlight: false, origin: "human" }], []))).toBe(false);
    expect(hasAiContent(page([{ ...link, visible: true, highlight: false }]))).toBe(false);
  });

  it("an AI-written project counts like any other block", () => {
    const project = { id: "p1", type: "project" as const, slug: "tidewatch", title: "Tidewatch", summary: "A tide table sailors can read at a glance." };
    for (const origin of ["ai", "ai-edited", "human"]) expect(blockSchema.safeParse({ ...project, origin }).success, origin).toBe(true);
    const page = (origin?: "ai" | "ai-edited" | "human"): Page => pageSchema.parse({ profile, blocks: [{ ...project, ...(origin ? { origin } : {}) }] });
    expect(hasAiContent(page("ai"))).toBe(true);
    expect(hasAiContent(page("ai-edited"))).toBe(true);
    expect(hasAiContent(page("human"))).toBe(false);
    expect(hasAiContent(page())).toBe(false);
  });
});
