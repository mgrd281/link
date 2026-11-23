import { describe, expect, it } from "vitest";

import { briefingLinks, briefingProblem, choosePhotos, MAX_LINKS, MAX_PHOTO_BYTES, MAX_PHOTOS } from "./briefing-rules";

const photo = (name: string, type = "image/jpeg", size = 1000) => ({ name, type, size });

describe("what a briefing may hold", () => {
  it("reads one link per line and keeps every one of them", () => {
    expect(briefingLinks("  https://a.example \n\n https://b.example\n   \n")).toEqual(["https://a.example", "https://b.example"]);
    const thirty = Array.from({ length: 30 }, (_, index) => `https://example.com/${index}`).join("\n");
    // Nothing is cut here: more than the limit is a problem to show, not a list to shorten.
    expect(briefingLinks(thirty)).toHaveLength(30);
  });

  it("does not send an empty briefing (it would be locked for good)", () => {
    expect(briefingProblem({ links: [], wishes: "" })).toBe("empty");
    expect(briefingProblem({ links: [], wishes: "  \n " })).toBe("empty");
    expect(briefingProblem({ links: ["https://a.example"], wishes: "" })).toBeNull();
    expect(briefingProblem({ links: [], wishes: "Hell und ruhig." })).toBeNull();
  });

  it("stops at more links than the limit instead of dropping the rest", () => {
    const links = (count: number) => Array.from({ length: count }, (_, index) => `https://example.com/${index}`);
    expect(briefingProblem({ links: links(MAX_LINKS), wishes: "" })).toBeNull();
    expect(briefingProblem({ links: links(MAX_LINKS + 1), wishes: "" })).toBe("tooManyLinks");
  });

  it("counts every photo it leaves out: too large, a type the bucket does not take, or no room", () => {
    const picked = [photo("a.jpg"), photo("big.jpg", "image/jpeg", MAX_PHOTO_BYTES + 1), photo("b.png", "image/png"), photo("c.gif", "image/gif"), photo("d.heic", ""), photo("e.webp", "image/webp", MAX_PHOTO_BYTES)];
    const chosen = choosePhotos(picked, 0);
    expect(chosen.kept.map((file) => file.name)).toEqual(["a.jpg", "b.png", "e.webp"]);
    expect(chosen.skipped).toBe(3);
    // Five camera pictures of 12 MB each: none is taken, and all five are counted.
    expect(choosePhotos(Array.from({ length: 5 }, (_, index) => photo(`${index}.jpg`, "image/jpeg", 12 * 1024 * 1024)), 0)).toEqual({ kept: [], skipped: 5 });
  });

  it("takes only as many photos as there is room for", () => {
    const picked = Array.from({ length: 4 }, (_, index) => photo(`${index}.jpg`));
    const chosen = choosePhotos(picked, MAX_PHOTOS - 1);
    expect(chosen.kept.map((file) => file.name)).toEqual(["0.jpg"]);
    expect(chosen.skipped).toBe(3);
    expect(choosePhotos(picked, MAX_PHOTOS)).toEqual({ kept: [], skipped: 4 });
    expect(choosePhotos([], 0)).toEqual({ kept: [], skipped: 0 });
  });
});
