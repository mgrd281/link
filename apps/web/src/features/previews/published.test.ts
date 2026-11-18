import { createHash } from "node:crypto";

import type { BlockOf } from "@linkyo/blocks";
import { describe, expect, it, vi } from "vitest";

import { findPrepared } from "./claim";
import { PREVIEWS } from "./registry";

const hash = (email: string) => createHash("sha256").update(email).digest("hex");

// Two pages as the team area publishes them (scripts/prepare-page.mjs --add): a new creator in one
// language, and an edited copy of the built-in Nizar page that replaces it.
vi.mock("./prepared", async () => {
  const { createHash: digest } = await import("node:crypto");
  const { nizarDe } = await import("./nizar");
  const sha = (email: string) => digest("sha256").update(email).digest("hex");
  const live = nizarDe.blocks.find((block) => block.id === "live-youtube");
  return {
    PREPARED: [
      {
        slug: "linabeats",
        name: { de: "Lina Beats" },
        username: "linabeats",
        theme: { template: "nocturne" },
        pages: {
          de: {
            profile: { username: "linabeats", displayName: "Lina Beats", bio: "", avatar: { src: "none:", alt: "" }, verified: true, locale: "de" },
            blocks: live ? [{ ...live, startsAt: "2026-12-01T19:00:00.000Z" }] : [],
          },
        },
        verified: true,
        invite: { emailSha256: [sha("lina@example.com")] },
      },
      {
        slug: "nizar",
        name: { de: "Nizar" },
        username: "nizarals9",
        theme: { template: "nocturne" },
        pages: { de: nizarDe },
        verified: true,
        invite: { emailSha256: [sha("team-added@example.com")] },
      },
    ],
  };
});

describe("pages published from the team area", () => {
  it("accepts a page in one language and keeps the team's verification and live dates", () => {
    expect(PREVIEWS.linabeats?.verified).toBe(true);
    const result = findPrepared({ email: "Lina@Example.com", username: "x", invite: "linabeats", locale: "ar" });
    expect(result.kind).toBe("match");
    if (result.kind !== "match") return;
    expect(result.page.profile.locale).toBe("de");
    expect(result.page.profile.verified).toBe(true);
    const block = result.page.blocks[0];
    expect(block?.type === "live" && [block.isLive, block.startsAt]).toEqual([false, "2026-12-01T19:00:00.000Z"]);
  });

  it("replaces a built-in page but keeps every invite already sent, and its example states stay out", () => {
    expect(PREVIEWS.nizar?.invite?.emailSha256).toEqual(expect.arrayContaining([hash("nezaralsweid4@gmail.com"), hash("team-added@example.com")]));
    for (const email of ["nezaralsweid4@gmail.com", "team-added@example.com"]) {
      const result = findPrepared({ email, username: "x", locale: "de" });
      expect(result.kind).toBe("match");
      if (result.kind !== "match") continue;
      expect(result.page.profile.verified).toBe(true);
      const lives = result.page.blocks.filter((block): block is BlockOf<"live"> => block.type === "live");
      expect(lives.length).toBeGreaterThan(0);
      expect(lives.every((block) => !block.isLive && block.startsAt === undefined)).toBe(true);
    }
  });
});
