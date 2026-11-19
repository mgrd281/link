import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const ask = (url: string) => GET(new NextRequest(`http://localhost/api/link-metadata?url=${encodeURIComponent(url)}`));

function platformAnswers(body: Record<string, unknown>) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("/api/link-metadata", () => {
  it("asks YouTube's oEmbed and returns title, channel and the large thumbnail", async () => {
    const fetchMock = platformAnswers({ title: "Big Buck Bunny", author_name: "Blender", thumbnail_url: "https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg" });
    const response = await ask("https://youtu.be/aqz-KE-bpKQ?si=tracking");
    expect(await response.json()).toEqual({ title: "Big Buck Bunny", author: "Blender", image: "https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg" });
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/^https:\/\/www\.youtube\.com\/oembed\?/);
    expect(response.headers.get("cache-control")).toContain("s-maxage");
  });

  it("splits SoundCloud's 'Song by Artist' and drops pictures from hosts we don't re-serve", async () => {
    platformAnswers({ title: "Flickermood by Forss", author_name: "Forss", thumbnail_url: "https://evil.example/pixel.gif" });
    const response = await ask("https://soundcloud.com/forss/flickermood");
    expect(await response.json()).toEqual({ title: "Flickermood", author: "Forss" });
  });

  it("only talks to known platforms (never to the pasted address itself)", async () => {
    const fetchMock = platformAnswers({ title: "x" });
    const response = await ask("https://intranet.local/admin");
    expect(response.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers calmly when the platform is down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    const response = await ask("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC");
    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({});
  });
});
