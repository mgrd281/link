import { detectLink } from "@linkyo/blocks";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({ Link: () => null, useRouter: () => ({ push: () => undefined }), usePathname: () => "/" }));

import { sameProfile, socialProfile } from "./add-sheet";

/** D-16: a pasted profile address can go to the Social icons row instead of becoming a plain link. */

const profile = (address: string) => socialProfile(detectLink(address));

describe("a pasted social profile", () => {
  it("is offered for the Social icons row with its platform", () => {
    expect(profile("instagram.com/mila")).toEqual({ platform: "instagram", url: "https://instagram.com/mila" });
    expect(profile("https://www.tiktok.com/@mila.berg")?.platform).toBe("tiktok");
    expect(profile("x.com/milaberg")?.platform).toBe("x");
    expect(profile("https://www.linkedin.com/in/mila-berg")?.platform).toBe("linkedin");
    expect(profile("github.com/mila-berg")?.platform).toBe("github");
    expect(profile("https://www.youtube.com/@milaberg")?.platform).toBe("youtube");
    expect(profile("twitch.tv/milaberg")?.platform).toBe("twitch");
    expect(profile("bsky.app/profile/mila.bsky.social")?.platform).toBe("bluesky");
  });

  it("is the same profile with or without www., a trailing slash or capitals, and not another one", () => {
    expect(sameProfile("https://www.instagram.com/Mila/", "https://instagram.com/mila")).toBe(true);
    expect(sameProfile("https://m.tiktok.com/@mila", "https://www.tiktok.com/@mila")).toBe(true);
    expect(sameProfile("https://instagram.com/mila", "https://instagram.com/mila.berg")).toBe(false);
    expect(sameProfile("https://x.com/mila", "https://instagram.com/mila")).toBe(false);
  });

  it("drops tracking parameters, as every pasted link does", () => {
    expect(profile("https://www.instagram.com/mila?igsh=abc123&utm_source=qr")?.url).toBe("https://www.instagram.com/mila");
  });

  it("is not offered for a post, a song, a repository, a shop, an e-mail address or a front page", () => {
    for (const address of [
      "https://www.instagram.com/p/C0abc123/",
      "https://www.tiktok.com/@mila/video/7300000000000000000",
      "https://x.com/milaberg/status/1800000000000000000",
      "https://www.linkedin.com/posts/mila-berg_activity-1",
      "https://open.spotify.com/artist/4aawyAB9vmqN3uQ7FjRGTy",
      "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      "github.com/mila-berg/portfolio",
      "https://mila-berg.de/booking",
      "mila@example.com",
      "instagram.com",
    ]) {
      expect(profile(address), address).toBeNull();
    }
    expect(socialProfile(null)).toBeNull();
  });
});
