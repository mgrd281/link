import type { Block } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import { externalProviders } from "./providers";

const poster = { src: "none:", alt: "" };
const base = { visible: true, highlight: false };

describe("privacy notice", () => {
  it("lists each company whose player a page can load, once, in page order", () => {
    const blocks: Block[] = [
      { ...base, id: "l", type: "link", title: "Shop", url: "https://example.com" },
      { ...base, id: "v", type: "video", title: "Clip", provider: "youtube", url: "https://youtube.com/watch?v=x", poster },
      {
        ...base,
        id: "s",
        type: "shorts",
        items: [
          { title: "a", url: "https://www.tiktok.com/@x/video/1", poster },
          { title: "b", url: "https://youtube.com/shorts/y", poster },
        ],
      },
      { ...base, id: "u", type: "video", title: "Own", provider: "upload", url: "https://example.com/v.mp4", poster },
    ];
    expect(externalProviders(blocks)).toEqual(["YouTube", "TikTok"]);
  });

  it("is not needed on pages without players", () => {
    expect(externalProviders([{ ...base, id: "l", type: "link", title: "Shop", url: "https://example.com" }])).toEqual([]);
  });
});
