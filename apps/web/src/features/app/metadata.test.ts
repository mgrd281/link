import type { Block, BlockOf } from "@linkyo/blocks";
import { NO_IMAGE } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import { metadataPatch, metadataUrl } from "./metadata";

const video: BlockOf<"video"> = {
  id: "video-1",
  type: "video",
  visible: true,
  highlight: false,
  title: "Video · YouTube",
  provider: "youtube",
  url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
  poster: { src: NO_IMAGE, alt: "" },
};
const music: BlockOf<"music"> = {
  id: "music-1",
  type: "music",
  visible: true,
  highlight: false,
  title: "Musik",
  artist: "Mila Aurel",
  kind: "single",
  cover: { src: NO_IMAGE, alt: "" },
  links: [{ platform: "spotify", url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC" }],
};

describe("link metadata", () => {
  it("looks up videos and releases, nothing else", () => {
    expect(metadataUrl(video)).toBe(video.url);
    expect(metadataUrl(music)).toBe("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC");
    const link: Block = { id: "l", type: "link", visible: true, highlight: false, title: "Shop", url: "https://example.com" };
    expect(metadataUrl(link)).toBeNull();
  });

  it("fills in the real title and picture", () => {
    expect(metadataPatch(video, video, { title: "Big Buck Bunny", image: "https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg" })).toEqual({
      title: "Big Buck Bunny",
      poster: { src: "https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg", alt: "" },
    });
    expect(metadataPatch(music, music, { title: "Nachtstrom", author: "Mila Aurel - Topic", image: "https://i.scdn.co/image/abc" })).toEqual({
      title: "Nachtstrom",
      artist: "Mila Aurel",
      cover: { src: "https://i.scdn.co/image/abc", alt: "" },
    });
  });

  it("keeps whatever the creator changed in the meantime", () => {
    const renamed = { ...video, title: "Mein Lieblingsvideo" };
    expect(metadataPatch(renamed, video, { title: "Big Buck Bunny" })).toBeNull();
    expect(metadataPatch(renamed, video, { title: "Big Buck Bunny", image: "https://i.ytimg.com/vi/x/hqdefault.jpg" })).toEqual({
      poster: { src: "https://i.ytimg.com/vi/x/hqdefault.jpg", alt: "" },
    });
  });
});
