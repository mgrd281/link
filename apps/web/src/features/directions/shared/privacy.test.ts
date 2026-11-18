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

describe("YouTube links", () => {
  it("finds the video in every kind of YouTube link and nothing elsewhere", async () => {
    const { youtubeId } = await import("./providers");
    expect(youtubeId("https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=12")).toBe("aqz-KE-bpKQ");
    expect(youtubeId("https://youtu.be/aqz-KE-bpKQ")).toBe("aqz-KE-bpKQ");
    expect(youtubeId("https://youtube.com/shorts/aqz-KE-bpKQ?feature=share")).toBe("aqz-KE-bpKQ");
    expect(youtubeId("https://m.youtube.com/embed/aqz-KE-bpKQ")).toBe("aqz-KE-bpKQ");
    expect(youtubeId("https://example.com/watch?v=aqz-KE-bpKQ")).toBeNull();
    expect(youtubeId("https://www.youtube.com/@channel")).toBeNull();
    expect(youtubeId("not a url")).toBeNull();
  });
});
