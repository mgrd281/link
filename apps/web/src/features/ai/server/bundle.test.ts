import { describe, expect, it } from "vitest";

import type { PipelineInput } from "../request";

import { affiliateHint, buildBundle, bundleCounts, MAX_LINKS, promptSources, redactContacts, stableStringify, withMetadata, type SourceResult } from "./bundle";
import { userTurn } from "./prompts";

const source = (overrides: Partial<SourceResult>): SourceResult => ({ id: "S1", kind: "website", label: "lio-vance.de", status: "read", links: [], ...overrides });

const input = (overrides: Partial<PipelineInput> = {}): PipelineInput => ({
  route: "welcome",
  pageLocale: "de",
  ownerLocale: "de",
  about: "Ich mache Musik.",
  kind: null,
  sources: [],
  pasted: [],
  photo: null,
  ...overrides,
});

describe("buildBundle", () => {
  it("keeps the owner's sources first, then pasted links, in order; a duplicate keeps its first place", () => {
    const bundle = buildBundle(
      [
        source({ self: { url: "https://lio-vance.de/" }, links: [{ url: "https://instagram.com/lio.vance" }, { url: "https://soundcloud.com/lio-vance", title: "SoundCloud" }] }),
        source({ id: "S2", kind: "tiktok", self: { url: "https://www.tiktok.com/@lio.vance" } }),
      ],
      ["https://www.instagram.com/lio.vance/ https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy", "https://www.eventim.de/artist/lio-vance/"],
    );
    expect(bundle.links.map((link) => [link.id, link.url])).toEqual([
      ["L1", "https://lio-vance.de/"],
      ["L2", "https://instagram.com/lio.vance"],
      ["L3", "https://soundcloud.com/lio-vance"],
      ["L4", "https://www.tiktok.com/@lio.vance"],
      ["L5", "https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy"],
      ["L6", "https://www.eventim.de/artist/lio-vance/"],
    ]);
    expect(bundle.links.map((link) => link.type)).toEqual(["link", "social", "social", "social", "music", "events"]);
    expect(bundle.links[3]?.platform).toBe("tiktok");
    expect(bundleCounts(bundle)).toEqual({ links: 6, profiles: 3 });
  });

  it("keeps at most 40 links", () => {
    const pasted = Array.from({ length: 50 }, (_, index) => `https://example.com/page-${String(index)}`);
    const bundle = buildBundle([], pasted);
    expect(bundle.links).toHaveLength(MAX_LINKS);
    expect(bundle.links.at(-1)?.id).toBe("L40");
  });

  it("takes the first non-empty profile text of the sources", () => {
    const bundle = buildBundle([source({ profile: { siteTitle: "Lio Vance", bio: "  " } }), source({ id: "S2", profile: { displayName: "Lio", bio: "DJ & Producer. Berlin." } })], []);
    expect(bundle.profile).toEqual({ siteTitle: "Lio Vance", displayName: "Lio", bio: "DJ & Producer. Berlin." });
  });

  it("adds titles and artists from the platforms", () => {
    const bundle = withMetadata(buildBundle([], ["https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy"]), new Map([["https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy", { title: "Nachtstrom EP", author: "Lio Vance" }]]));
    expect(promptSources(bundle).links[0]).toEqual({ id: "L1", type: "music", platform: "spotify", title: "Nachtstrom EP", author: "Lio Vance" });
  });
});

describe("what the model sees", () => {
  it("shows e-mail and phone links only as their type, social profiles by platform, other links as host and path", () => {
    const bundle = buildBundle([], ["mailto:lio@example.com tel:+491701234567 https://instagram.com/lio.vance https://lio-vance.de/booking?ref=newsletter&utm_source=x"]);
    expect(promptSources(bundle).links).toEqual([
      { id: "L1", type: "email", label: "E-Mail" },
      { id: "L2", type: "phone", label: "Phone" },
      { id: "L3", type: "social", platform: "instagram", label: "Instagram" },
      { id: "L4", type: "link", host: "lio-vance.de", path: "/booking", affiliateHint: true },
    ]);
    // The page keeps the full address (with the partner parameter, without tracking).
    expect(bundle.links[3]?.url).toBe("https://lio-vance.de/booking?ref=newsletter");
  });

  it("computes the affiliate hint before the query is removed", () => {
    expect(affiliateHint(new URL("https://shop.example.com/item?tag=lio-21"))).toBe(true);
    expect(affiliateHint(new URL("https://amzn.to/3xYz"))).toBe(true);
    expect(affiliateHint(new URL("https://www.amazon.de/dp/B0"))).toBe(true);
    expect(affiliateHint(new URL("https://bit.ly/3xYz"))).toBe(false);
    expect(affiliateHint(new URL("https://lio-vance.de/?page=2"))).toBe(false);
  });

  it("serialises with sorted keys, so the same input always gives the same bytes", () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: [{ z: 1, y: 2 }] } })).toBe('{"a":{"c":[{"y":2,"z":1}],"d":2},"b":1}');
  });

  it("never lets an e-mail address or a phone number reach the user turn, from any free text", () => {
    const contact = "Schreib an lio.vance@example.com oder ruf an: +49 (0)170 123 45 67 / 0170-1234567.";
    const bundle = buildBundle(
      [
        source({
          self: { url: "https://lio-vance.de/", title: `Lio Vance ${contact}` },
          links: [{ url: "https://lio-vance.de/shop", title: `Shop ${contact}` }],
          profile: { displayName: `Lio ${contact}`, bio: `Bio ${contact} Nächstes Konzert am 2026-11-22, Tickets ab 24,99 €.`, siteTitle: `Title ${contact}`, siteDescription: `Description ${contact}` },
        }),
      ],
      [],
    );
    const withAuthor = withMetadata(bundle, new Map([["https://lio-vance.de/shop", { author: `Author ${contact}` }]]));
    const turn = userTurn(input({ about: `Ich bin Lio. ${contact} Release am 2026-11-22, Merch für 24,99 €.`, name: `Lio ${contact}` }), withAuthor)
      .map((block) => block.text)
      .join("\n");
    const team = userTurn(input({ route: "team", about: `Wünsche: ${contact}` }), withAuthor)
      .map((block) => block.text)
      .join("\n");
    for (const text of [turn, team]) {
      expect(text).not.toMatch(/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+\.\p{L}{2,}/u);
      expect(text).not.toMatch(/\d{7,}/);
      expect(text.replace(/\D+/g, " ")).not.toMatch(/(?:^|\s)(?:49|0170|170)(?:\s|$).*(?:1234567|123 45 67)/);
      expect(text).toContain("[E-Mail]");
      expect(text).toContain("[Telefon]");
    }
    expect(turn).toContain("2026-11-22");
    expect(turn).toContain("24,99 €");
  });

  it("keeps dates, prices, opening hours and the local mock's marker", () => {
    expect(redactContacts("Am 22.11.2026 von 10:00-18:00 Uhr, ab 24,99 € [[fixture:de-music#t1234567890]]")).toBe("Am 22.11.2026 von 10:00-18:00 Uhr, ab 24,99 € [[fixture:de-music#t1234567890]]");
    expect(redactContacts("Ruf an: 030 1234 5678")).toBe("Ruf an: [Telefon]");
    expect(redactContacts("Mail: a.b@c.de")).toBe("Mail: [E-Mail]");
  });
});
