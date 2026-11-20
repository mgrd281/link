import type { Block, BlockOf } from "@linkyo/blocks";
import { NO_IMAGE } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import { installCommand, metadataPatch, metadataUrl } from "./metadata";

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

  it("apps are looked up in the App Store only; skills fill in their details and keep the command in step", () => {
    const base = { visible: true, highlight: false } as const;
    const app: BlockOf<"app"> = { ...base, id: "app-1", type: "app", title: "Fokus Timer", icon: { src: NO_IMAGE, alt: "" }, stores: [{ store: "googleplay", url: "https://play.google.com/store/apps/details?id=com.example.fokus" }] };
    expect(metadataUrl(app)).toBeNull();
    const both = { ...app, stores: [...app.stores, { store: "appstore" as const, url: "https://apps.apple.com/de/app/fokus-timer/id1234567890" }] };
    expect(metadataUrl(both)).toBe("https://apps.apple.com/de/app/fokus-timer/id1234567890");
    expect(metadataPatch(both, both, { title: "Fokuskreis", author: "Kreisel Labs", rating: 4.8, pricing: "free", image: "https://is1-ssl.mzstatic.com/a.png" })).toEqual({
      title: "Fokuskreis",
      developer: "Kreisel Labs",
      rating: 4.8,
      pricing: "free",
      icon: { src: "https://is1-ssl.mzstatic.com/a.png", alt: "" },
    });
    const skill: BlockOf<"repo"> = {
      ...base,
      id: "repo-1",
      type: "repo",
      title: "voice",
      url: "https://github.com/acme/skills/tree/main/voice",
      owner: "acme",
      repo: "skills",
      path: "voice",
      kind: "skill",
      install: installCommand("acme", "skills", "voice"),
    };
    expect(metadataUrl(skill)).toBe(skill.url);
    expect(metadataPatch(skill, skill, { title: "brand-voice", stars: 12, kind: "skill" })).toEqual({ title: "brand-voice", stars: 12, kind: "skill", install: "npx skills add acme/skills --skill brand-voice" });
    // A display name would need quotes on the command line: the folder's name stays.
    expect(metadataPatch(skill, skill, { title: "Brand Voice", kind: "skill" })).toEqual({ title: "Brand Voice", kind: "skill" });
    // The creator's own command is never replaced.
    expect(metadataPatch({ ...skill, install: "npx skills add acme/skills -s voice" }, skill, { title: "brand-voice", kind: "skill" })).toEqual({ title: "brand-voice", kind: "skill" });
  });
});
