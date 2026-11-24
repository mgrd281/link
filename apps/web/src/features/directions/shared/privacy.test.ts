import type { Block } from "@linkyo/blocks";
import { contrastRatio, PRESET_IDS, resolveCreatorTheme, TEMPLATE_IDS, type CreatorThemeConfig } from "@linkyo/tokens/creator";
import { describe, expect, it } from "vitest";

import { SETTINGS_CARD_BG } from "./privacy";
import { externalProviders } from "./providers";

describe("privacy settings in the creator's colours", () => {
  // The palette role behind each background class the settings layer may use.
  const ROLE = { "bg-creator-bg": "bg", "bg-creator-surface": "surface", "bg-creator-surface-2": "surface2" } as const;

  it("draws the consent switch at 3:1 against its card in every template, preset and mode (WCAG 1.4.11)", () => {
    const role = ROLE[SETTINGS_CARD_BG as keyof typeof ROLE];
    expect(role).toBeDefined();
    const configs: CreatorThemeConfig[] = [
      ...TEMPLATE_IDS.map((template) => ({ template })),
      ...PRESET_IDS.flatMap((preset) => [{ preset }, { preset, mode: "light" as const }, { preset, mode: "dark" as const }]),
      ...["#00454C", "#E11D48", "#FACC15", "#22C55E", "#FFFFFF", "#000000"].flatMap((accent) => [{ accent, mode: "light" as const }, { accent, mode: "dark" as const }]),
    ];
    for (const config of configs) {
      const palette = resolveCreatorTheme(config).palette;
      const card = palette[role];
      const name = JSON.stringify(config);
      // Off: the line-strong track (the knob is the surface colour, close to the card); on: the accent.
      expect(contrastRatio(palette.lineStrong, card), `${name} off`).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(palette.accent, card), `${name} on`).toBeGreaterThanOrEqual(3);
    }
  });
});

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
