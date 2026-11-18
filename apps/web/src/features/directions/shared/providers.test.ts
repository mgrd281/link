import type { Block } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import { externalProviders, youtubeEnded, youtubeWatchUrl } from "./providers";

const video = (playback?: "inline" | "preview" | "external"): Block => ({
  id: `v-${playback ?? "default"}`,
  type: "video",
  visible: true,
  highlight: false,
  title: "Clip",
  provider: "youtube",
  url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  poster: { src: "x.jpg", alt: "" },
  ...(playback ? { playback } : {}),
});

describe("video playback", () => {
  it("reads the end of a preview from the YouTube player's messages", () => {
    expect(youtubeEnded('{"event":"onStateChange","info":0}')).toBe(true);
    expect(youtubeEnded({ event: "infoDelivery", info: { playerState: 0, currentTime: 30 } })).toBe(true);
    expect(youtubeEnded('{"event":"onStateChange","info":1}')).toBe(false);
    expect(youtubeEnded({ event: "infoDelivery", info: { currentTime: 12 } })).toBe(false);
    expect(youtubeEnded("not json")).toBe(false);
    expect(youtubeEnded(null)).toBe(false);
  });

  it("continues on YouTube where the preview stopped", () => {
    expect(youtubeWatchUrl("dQw4w9WgXcQ")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(youtubeWatchUrl("dQw4w9WgXcQ", 30)).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s");
  });

  it("a video that opens on the platform needs no privacy notice", () => {
    expect(externalProviders([video("external")])).toEqual([]);
    expect(externalProviders([video("preview")])).toEqual(["YouTube"]);
    expect(externalProviders([video()])).toEqual(["YouTube"]);
  });
});
