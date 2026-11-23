import { blockSchema, pageSchema, type Block, type Page } from "@linkyo/blocks";
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
    expect(brands?.type === "brands" && brands.items[0]?.logo?.src).toBe("https://cdn/1.jpg");
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

  it("walks every picture of every block type: no data URL is left anywhere", async () => {
    let count = 0;
    /** A picture of its own for every place, so a place that is skipped shows up by name. */
    const data = (place: string) => {
      count += 1;
      return { src: `data:image/jpeg;base64,${place.replace(/[^a-z]/gi, "")}${String(count)}AAAA`, alt: "" };
    };
    const base = { visible: true, highlight: false };
    const url = "https://example.com";
    const blocks: Block[] = [
      { ...base, id: "link", type: "link", title: "Shop", url, thumbnail: data("linkThumbnail") },
      { ...base, id: "card", type: "card", title: "Card", url, image: data("cardImage") },
      { ...base, id: "image", type: "image", image: data("image") },
      { ...base, id: "gallery", type: "gallery", images: [data("galleryA"), data("galleryB")] },
      { ...base, id: "video", type: "video", title: "Clip", provider: "youtube", url, poster: data("videoPoster") },
      { ...base, id: "shorts", type: "shorts", items: [{ title: "Short", url, poster: data("shortsPoster") }] },
      { ...base, id: "music", type: "music", title: "EP", artist: "Mila", kind: "ep", cover: data("musicCover"), links: [{ platform: "spotify", url }] },
      { ...base, id: "events", type: "events", items: [{ date: "2027-01-01", city: "Berlin", venue: "Club", url, status: "onsale", image: data("eventImage") }] },
      { ...base, id: "product", type: "product", title: "Vinyl", price: 20, currency: "EUR", url, image: data("productImage") },
      { ...base, id: "brands", type: "brands", columns: 3, items: [{ name: "With a logo", logo: data("brandLogo") }, { name: "A name only" }] },
      { ...base, id: "app", type: "app", title: "App", icon: data("appIcon"), stores: [{ store: "web", url }] },
      {
        ...base,
        id: "project",
        type: "project",
        slug: "tidewatch",
        title: "Tidewatch",
        summary: "A tide table.",
        cover: data("projectCover"),
        pictures: [{ image: data("projectPictureA") }, { image: data("projectPictureB"), decorative: true, caption: "Sketch" }],
      },
      { ...base, id: "about", type: "about", text: "Hello.", portrait: data("aboutPortrait") },
      { ...base, id: "quotes", type: "quotes", items: [{ text: "Great.", name: "M. K.", role: "Client", consent: true, photo: data("quotePhoto") }, { text: "Fine.", name: "A. B.", role: "Client", consent: true }] },
      // Blocks without pictures pass through unchanged.
      { ...base, id: "tools", type: "tools", items: ["Figma"] },
      { ...base, id: "timeline", type: "timeline", items: [{ role: "Lead", years: { from: 2021 } }] },
      { ...base, id: "contact", type: "contact", title: "A project in mind?", primary: { label: "Write", url: "mailto:mila@example.com" } },
    ];
    const full: Page = { profile: { ...page().profile, avatar: data("avatar"), hero: data("hero"), logo: data("logo") }, blocks };
    expect(pageSchema.safeParse(full).success).toBe(true);

    // The fixture has a block for every type the schema lets carry a picture: a new picture-bearing
    // type that is missing here fails this line, before it can be forgotten in mapSources().
    expect(blocks.filter((block) => JSON.stringify(block).includes("data:image")).map((block) => block.type).sort()).toEqual(pictureTypes());

    const places = count;
    expect(collectDataUrls(full)).toHaveLength(places);
    const upload = vi.fn((dataUrl: string) => Promise.resolve(`https://cdn.example.com/${String(dataUrl.length)}-${dataUrl.slice(-9, -4)}.jpg`));
    const migrated = await migrateDataUrls(full, upload);
    expect(upload).toHaveBeenCalledTimes(places);
    expect(JSON.stringify(migrated)).not.toContain("data:");
    expect(collectDataUrls(migrated)).toEqual([]);
    expect(pageSchema.safeParse(migrated).success).toBe(true);
    // Everything that is no picture stays as it was.
    const strip = (value: Page) => JSON.parse(JSON.stringify(value, (key, inner: unknown) => (key === "src" ? "" : inner))) as unknown;
    expect(strip(migrated)).toEqual(strip(full));
    const brands = migrated.blocks.find((block) => block.type === "brands");
    expect(brands?.type === "brands" && brands.items.map((item) => item.logo !== undefined)).toEqual([true, false]);
  });

  it("replaces only what was uploaded", () => {
    const replaced = replaceSources(page(), new Map([[WEBP, STORED]]));
    expect(replaced.blocks[0]?.type === "image" && replaced.blocks[0].image.src).toBe(STORED);
    expect(replaced.profile.avatar.src).toBe(JPEG);
  });
});

/** A schema node, as far as this walk needs it (Zod's own shapes: an object, a list, a wrapper, a union). */
interface Node {
  shape?: Record<string, Node>;
  element?: Node;
  options?: Node[];
  def?: { innerType?: Node };
}

/** Does this schema hold a picture (an object with `src` and `alt`) anywhere inside? */
function holdsPicture(node: Node | undefined, depth = 0): boolean {
  if (!node || depth > 8) return false;
  if (node.shape) return ("src" in node.shape && "alt" in node.shape) || Object.values(node.shape).some((inner) => holdsPicture(inner, depth + 1));
  if (node.element) return holdsPicture(node.element, depth + 1);
  if (node.options) return node.options.some((inner) => holdsPicture(inner, depth + 1));
  return holdsPicture(node.def?.innerType, depth + 1);
}

/** The block types whose schema can carry a picture, read from the schema itself. */
function pictureTypes(): string[] {
  return (blockSchema.options as unknown as (Node & { shape: { type: { value: string } } })[])
    .filter((option) => holdsPicture(option))
    .map((option) => option.shape.type.value)
    .sort();
}
