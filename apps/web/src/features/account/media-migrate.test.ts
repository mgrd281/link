import type { Page } from "@linkyo/blocks";
import { describe, expect, it, vi } from "vitest";

import { collectDataUrls, hasDataUrls, migrateDataUrls, replaceSources } from "./media-migrate";

const JPEG = "data:image/jpeg;base64,/9j/AAAA";
const PNG = "data:image/png;base64,iVBORw0KGgo=";
const WEBP = "data:image/webp;base64,UklGRgAA";
const SVG = "data:image/svg+xml;base64,PHN2Zz4=";
const STORED = "https://db.example.co/storage/v1/object/public/media/u/2026/x.jpg";

const page = (): Page => ({
  profile: {
    username: "mila",
    displayName: "Mila",
    bio: "",
    avatar: { src: JPEG, alt: "Mila" },
    hero: { src: PNG, alt: "" },
    verified: false,
    locale: "de",
  },
  blocks: [
    { id: "img", type: "image", image: { src: WEBP, alt: "" }, visible: true, highlight: false },
    { id: "gal", type: "gallery", images: [{ src: JPEG, alt: "" }, { src: STORED, alt: "" }], visible: true, highlight: false },
    { id: "logo", type: "image", image: { src: SVG, alt: "" }, visible: true, highlight: false },
    { id: "lnk", type: "link", title: "Shop", url: "https://example.com", visible: true, highlight: false },
    { id: "brands", type: "brands", columns: 3, items: [{ name: "A", logo: { src: PNG, alt: "" } }], visible: true, highlight: false },
  ],
});

describe("moving data URLs to Storage", () => {
  it("finds each storable data URL once, in profile and blocks, and skips other types", () => {
    expect(collectDataUrls(page())).toEqual([JPEG, PNG, WEBP]);
    expect(hasDataUrls(page())).toBe(true);
    expect(hasDataUrls({ ...page(), profile: { ...page().profile, avatar: { src: STORED, alt: "" }, hero: { src: STORED, alt: "" } }, blocks: [] })).toBe(false);
  });

  it("uploads every one once and puts the addresses in their place", async () => {
    const upload = vi.fn((dataUrl: string) => Promise.resolve(`https://cdn/${String(collectDataUrls(page()).indexOf(dataUrl))}.jpg`));
    const migrated = await migrateDataUrls(page(), upload);
    expect(upload).toHaveBeenCalledTimes(3);
    expect(migrated.profile.avatar.src).toBe("https://cdn/0.jpg");
    expect(migrated.profile.hero?.src).toBe("https://cdn/1.jpg");
    const [image, gallery, svg, linkBlock, brands] = migrated.blocks;
    expect(image?.type === "image" && image.image.src).toBe("https://cdn/2.jpg");
    expect(gallery?.type === "gallery" && gallery.images.map((item) => item.src)).toEqual(["https://cdn/0.jpg", STORED]);
    expect(svg?.type === "image" && svg.image.src).toBe(SVG);
    expect(linkBlock).toEqual(page().blocks[3]);
    expect(brands?.type === "brands" && brands.items[0]?.logo.src).toBe("https://cdn/1.jpg");
    expect(collectDataUrls(migrated)).toEqual([]);
  });

  it("keeps a picture whose upload failed and tries it again next time", async () => {
    const uploaded = new Map<string, string>();
    const failing = vi.fn((dataUrl: string) => (dataUrl === PNG ? Promise.reject(new Error("offline")) : Promise.resolve(`https://cdn/${dataUrl.slice(11, 15)}`)));
    const first = await migrateDataUrls(page(), failing, { uploaded });
    expect(first.profile.hero?.src).toBe(PNG);
    expect(collectDataUrls(first)).toEqual([PNG]);
    const second = vi.fn(() => Promise.resolve("https://cdn/png"));
    const again = await migrateDataUrls(first, second, { uploaded });
    // Only the one that failed goes up again; the others are remembered.
    expect(second).toHaveBeenCalledTimes(1);
    expect(collectDataUrls(again)).toEqual([]);
  });

  it("uploads at most three at a time", async () => {
    let running = 0;
    let most = 0;
    const many: Page = {
      ...page(),
      blocks: [{ id: "g", type: "gallery", images: Array.from({ length: 8 }, (_, index) => ({ src: `data:image/jpeg;base64,${String(index)}AAA`, alt: "" })), visible: true, highlight: false }],
    };
    await migrateDataUrls(many, async (dataUrl) => {
      running += 1;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      return `https://cdn/${dataUrl.length}`;
    });
    expect(most).toBe(3);
  });

  it("replaces only what was uploaded", () => {
    const replaced = replaceSources(page(), new Map([[WEBP, STORED]]));
    expect(replaced.blocks[0]?.type === "image" && replaced.blocks[0].image.src).toBe(STORED);
    expect(replaced.profile.avatar.src).toBe(JPEG);
  });
});
