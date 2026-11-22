import { NO_IMAGE, pageSchema, type Block, type BlockOf } from "@linkyo/blocks";
import { pagePlanSchema, type PagePlan } from "@linkyo/blocks/ai-plan";
import { creatorTokens } from "@linkyo/tokens";
import { describe, expect, it } from "vitest";

import { factsFrom } from "./content-rules";
import { cutText, normalizePlan, planTheme, planToPage, type PlanContext, type PlanLink } from "./plan-to-page";

const LINKS: Record<string, PlanLink> = {
  L1: { url: "https://instagram.com/lio.vance", type: "social", platform: "instagram" },
  L2: { url: "https://soundcloud.com/lio-vance", type: "social", platform: "soundcloud" },
  L3: { url: "https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy", type: "music", platform: "spotify" },
  L4: { url: "https://www.eventim.de/artist/lio-vance/", type: "events", platform: "eventim" },
  L5: { url: "https://lio-vance.de/booking", type: "link", title: "Booking" },
  L6: { url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ", type: "video", platform: "youtube" },
  L7: { url: "https://apps.apple.com/de/app/fokus-timer/id1234567890", type: "app", platform: "appstore" },
  L8: { url: "https://github.com/lio/sets", type: "repo", platform: "github" },
  L9: { url: "https://amzn.to/3xYz", type: "link", affiliateHint: true },
  L10: { url: "https://www.tiktok.com/@lio.vance", type: "social", platform: "tiktok" },
};

const ctx = (overrides: Partial<PlanContext> = {}): PlanContext => ({
  links: new Map(Object.entries(LINKS)),
  metadata: new Map([["https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy", { title: "Nachtstrom EP", author: "Lio Vance", image: "https://i.scdn.co/image/cover" }]]),
  owner: { name: "Lio", username: "lio-vance" },
  pageLocale: "de",
  photo: { vibrant: "#C2410C", dominant: "#1C1917" },
  facts: factsFrom(["Ich bin Lio, ich mache elektronische Musik.", "DJ & Producer. Berlin.", "Nachtstrom EP", "Lio Vance", "Booking", "lio-vance.de", "Tour 2027"]),
  labels: { video: "Video", music: "Musik", event: "Events" },
  ...overrides,
});

const basePlan = (blocks: PagePlan["blocks"], overrides: Partial<PagePlan> = {}): PagePlan => ({
  kind: "music",
  theme: { template: "nocturne", accent: "photo_vibrant", pairing: "template", buttonShape: "template", buttonStyle: "template" },
  profile: { displayName: "Lio Vance", tagline: "DJ und Producer aus Berlin", bio: "Ich mache elektronische Musik.", location: "Berlin" },
  blocks,
  notes: [{ topic: "look", text: "Nocturne passt zu Clubnächten." }],
  ...overrides,
});

const of = <T extends Block["type"]>(blocks: Block[], type: T) => blocks.filter((block): block is BlockOf<T> => block.type === type);

describe("planToPage", () => {
  it("maps r2's example: socials, a release card filled from the platform, a ticket button, a booking button", () => {
    const draft = planToPage(
      basePlan([
        { type: "socials", refs: ["L1", "L2"] },
        { type: "rich", ref: "L3", highlight: true, ad: false },
        { type: "rich", ref: "L4", highlight: false, ad: false },
        { type: "link", ref: "L5", title: "Booking anfragen", subtitle: "", icon: "calendar", highlight: false, ad: false },
      ]),
      ctx(),
    );
    expect(pageSchema.safeParse(draft.page).success).toBe(true);
    expect(draft.page.blocks.map((block) => block.type)).toEqual(["socials", "music", "link", "link"]);
    const [socials] = of(draft.page.blocks, "socials");
    expect(socials?.items).toEqual([
      { platform: "instagram", url: "https://instagram.com/lio.vance" },
      { platform: "soundcloud", url: "https://soundcloud.com/lio-vance" },
    ]);
    const [music] = of(draft.page.blocks, "music");
    expect(music).toMatchObject({ title: "Nachtstrom EP", artist: "Lio Vance", cover: { src: "https://i.scdn.co/image/cover" }, highlight: true });
    const [tickets, booking] = of(draft.page.blocks, "link");
    // A ticket shop without event data becomes a button: no date or city is made up.
    expect(tickets).toMatchObject({ url: "https://www.eventim.de/artist/lio-vance/", icon: "ticket", title: "Eventim" });
    expect(booking).toMatchObject({ title: "Booking anfragen", url: "https://lio-vance.de/booking", icon: "calendar" });
    expect(booking).not.toHaveProperty("subtitle");
    for (const block of draft.page.blocks) {
      expect(block.origin).toBe("ai");
      expect(block.visible).toBe(true);
      expect(block.schedule).toBeUndefined();
      expect(block.id).toMatch(new RegExp(`^${block.type}-`));
    }
    expect(draft.kind).toBe("music");
    expect(draft.drops).toEqual([]);
  });

  it("builds the profile from the plan and the account (name, address, picture, language), never stats", () => {
    const { page } = planToPage(basePlan([]), ctx({ owner: { name: "Lio", username: "lio-vance", avatar: { src: "https://cdn.example/a.jpg", alt: "" } } }));
    expect(page.profile).toEqual({
      username: "lio-vance",
      displayName: "Lio Vance",
      tagline: "DJ und Producer aus Berlin",
      bio: "Ich mache elektronische Musik.",
      location: "Berlin",
      avatar: { src: "https://cdn.example/a.jpg", alt: "" },
      verified: false,
      locale: "de",
      aiFields: ["displayName", "tagline", "bio"],
    });
  });

  it("leaves empty fields out and falls back to the typed name (then not marked as AI text)", () => {
    const { page } = planToPage(basePlan([], { profile: { displayName: "", tagline: "", bio: "", location: "" } }), ctx());
    expect(page.profile.displayName).toBe("Lio");
    expect(page.profile).not.toHaveProperty("tagline");
    expect(page.profile).not.toHaveProperty("location");
    expect(page.profile).not.toHaveProperty("aiFields");
    expect(page.profile.avatar).toEqual({ src: NO_IMAGE, alt: "" });
  });

  it("does not mark the name when the plan uses the name the owner typed", () => {
    const { page } = planToPage(basePlan([], { profile: { displayName: "Lio", tagline: "", bio: "Ich mache elektronische Musik.", location: "" } }), ctx());
    expect(page.profile.aiFields).toEqual(["bio"]);
  });

  it("maps the look: template 1:1, photo and swatch accents, 'template' means absent", () => {
    expect(planTheme({ template: "pulse", accent: "photo_dominant", pairing: "stage", buttonShape: "pill", buttonStyle: "shadow" }, { vibrant: "#C2410C", dominant: "#1C1917" })).toEqual({
      template: "pulse",
      accent: "#1C1917",
      pairing: "stage",
      buttonShape: "pill",
      buttonStyle: "shadow",
    });
    expect(planTheme({ template: "aura", accent: "lagoon", pairing: "template", buttonShape: "template", buttonStyle: "template" }, null)).toEqual({ template: "aura", accent: creatorTokens.swatches.lagoon });
    expect(planTheme({ template: "aura", accent: "photo_vibrant", pairing: "template", buttonShape: "template", buttonStyle: "template" }, null)).toEqual({ template: "aura" });
  });

  it("builds video, app and repository cards from the link, and marks ads and affiliate links", () => {
    const { page } = planToPage(
      basePlan([
        { type: "rich", ref: "L6", highlight: false, ad: false },
        { type: "rich", ref: "L7", highlight: false, ad: true },
        { type: "rich", ref: "L8", highlight: false, ad: false },
        { type: "link", ref: "L9", title: "Meine Kamera", subtitle: "", icon: "auto", highlight: false, ad: false },
      ]),
      ctx(),
    );
    expect(page.blocks.map((block) => block.type)).toEqual(["video", "app", "repo", "link"]);
    expect(of(page.blocks, "app")[0]?.affiliate).toBe(true);
    expect(of(page.blocks, "link")[0]).toMatchObject({ affiliate: true });
    expect(of(page.blocks, "link")[0]).not.toHaveProperty("icon");
  });

  it("drops unknown and reused links", () => {
    const draft = planToPage(
      basePlan([
        { type: "link", ref: "L5", title: "Booking anfragen", subtitle: "", icon: "calendar", highlight: false, ad: false },
        { type: "link", ref: "L5", title: "Nochmal", subtitle: "", icon: "auto", highlight: false, ad: false },
        { type: "rich", ref: "L33", highlight: false, ad: false },
      ]),
      ctx(),
    );
    expect(draft.page.blocks).toHaveLength(1);
    expect(draft.drops).toEqual([
      { index: 1, reason: "duplicate" },
      { index: 2, reason: "unknownLink" },
    ]);
  });

  it("highlights at most two blocks", () => {
    const { page, fixed } = planToPage(
      basePlan([
        { type: "rich", ref: "L3", highlight: true, ad: false },
        { type: "rich", ref: "L6", highlight: true, ad: false },
        { type: "link", ref: "L5", title: "Booking anfragen", subtitle: "", icon: "auto", highlight: true, ad: false },
      ]),
      ctx(),
    );
    expect(page.blocks.map((block) => block.highlight)).toEqual([true, true, false]);
    expect(fixed).toBeGreaterThanOrEqual(1);
  });

  it("applies the header rules: none twice in a row, none at the end, no repeated title", () => {
    const { page } = planToPage(
      basePlan([
        { type: "header", title: "Musik" },
        { type: "header", title: "Hören" },
        { type: "rich", ref: "L3", highlight: false, ad: false },
        { type: "header", title: "hören" },
        { type: "link", ref: "L5", title: "Booking anfragen", subtitle: "", icon: "auto", highlight: false, ad: false },
        { type: "header", title: "Kontakt" },
      ]),
      ctx(),
    );
    expect(page.blocks.map((block) => (block.type === "header" ? `header:${block.title}` : block.type))).toEqual(["header:Hören", "music", "link"]);
  });

  it("splits links that are not social profiles out of the icons into their own buttons", () => {
    const { page } = planToPage(basePlan([{ type: "socials", refs: ["L1", "L5", "L10"] }]), ctx());
    expect(page.blocks.map((block) => block.type)).toEqual(["socials", "link"]);
    expect(of(page.blocks, "socials")[0]?.items.map((item) => item.platform)).toEqual(["instagram", "tiktok"]);
    expect(of(page.blocks, "link")[0]).toMatchObject({ url: "https://lio-vance.de/booking", title: "Booking" });
  });

  it("never puts a newsletter form on a page in phase 1", () => {
    const draft = planToPage(basePlan([{ type: "newsletter", title: "News", description: "" }]), ctx());
    expect(draft.page.blocks).toEqual([]);
    expect(draft.drops).toEqual([{ index: 0, reason: "invalid" }]);
  });

  it("clears invented numbers: a profile field is emptied, a text block or header is dropped", () => {
    const draft = planToPage(
      basePlan([{ type: "text", text: "Über 10.000 verkaufte Tickets." }, { type: "text", text: "Tour 2027 in deiner Stadt." }], {
        profile: { displayName: "Lio Vance", tagline: "Seit 2015 DJ", bio: "Ich mache elektronische Musik.", location: "Berlin" },
      }),
      ctx(),
    );
    expect(draft.page.profile).not.toHaveProperty("tagline");
    expect(draft.page.blocks.map((block) => (block.type === "text" ? block.text : block.type))).toEqual(["Tour 2027 in deiner Stadt."]);
    expect(draft.drops).toEqual([{ index: 0, reason: "invalid" }]);
  });

  it("removes e-mail addresses and foreign addresses from free text", () => {
    const { page } = planToPage(basePlan([], { profile: { displayName: "Lio Vance", tagline: "", bio: "Schreib an lio@example.com oder geh auf spam.io.", location: "" } }), ctx());
    expect(page.profile.bio).toBe("Schreib an oder geh auf.");
  });
});

describe("normalizePlan", () => {
  it("fixes casing, lengths and types, and keeps unreadable blocks in place as null", () => {
    const normalized = normalizePlan({
      kind: "Music",
      theme: { template: "NOCTURNE", accent: "photo_vibrant", pairing: "nope", buttonShape: "Pill", buttonStyle: "template" },
      profile: { displayName: "Lio Vance", tagline: "x".repeat(90), bio: "", location: 7 },
      blocks: [{ type: "LINK", ref: "l5", title: "Booking", subtitle: "", icon: "Calendar", highlight: "true", ad: false }, { type: "poll" }],
      notes: [{ topic: "LOOK", text: "Passt." }, "x"],
    });
    expect(normalized).not.toBeNull();
    expect(normalized?.kind).toBe("music");
    expect(normalized?.theme).toEqual({ template: "nocturne", accent: "photo_vibrant", pairing: "template", buttonShape: "pill", buttonStyle: "template" });
    expect(normalized?.profile.tagline).toHaveLength(80);
    expect(normalized?.profile.tagline.endsWith("…")).toBe(true);
    expect(normalized?.profile.location).toBe("");
    expect(normalized?.blocks).toEqual([{ type: "link", ref: "L5", title: "Booking", subtitle: "", icon: "calendar", highlight: true, ad: false }, null]);
    expect(normalized?.notes).toEqual([{ topic: "look", text: "Passt." }]);
    expect(normalized?.fixed).toBeGreaterThanOrEqual(7);
    const plan = { ...normalized, blocks: normalized?.blocks.filter(Boolean) };
    delete (plan as { fixed?: number }).fixed;
    expect(pagePlanSchema.safeParse(plan).success).toBe(true);
  });

  it("is null for an answer that is not an object", () => {
    expect(normalizePlan([1, 2])).toBeNull();
    expect(normalizePlan("text")).toBeNull();
  });
});

describe("cutText", () => {
  it("cuts at a grapheme with an ellipsis, never splitting an Arabic letter from its mark", () => {
    const arabic = "مُدَرِّبَةٌ ".repeat(20).trim();
    const cut = cutText(arabic, 80);
    expect(cut.length).toBeLessThanOrEqual(80);
    expect(cut.endsWith("…")).toBe(true);
    // The character before the ellipsis is not a lone combining mark's base cut off from its mark.
    const body = cut.slice(0, -1);
    expect(arabic.startsWith(body)).toBe(true);
    expect(/[ً-ْ]$/.test(body) || /[ء-ي]$/.test(body)).toBe(true);
    const next = arabic.charAt(body.length);
    expect(/[ً-ْ]/.test(next)).toBe(false);
  });

  it("prefers a word boundary when it keeps most of the text", () => {
    expect(cutText("DJ und Producer aus Berlin mit Herz", 20)).toBe("DJ und Producer aus…");
  });
});
