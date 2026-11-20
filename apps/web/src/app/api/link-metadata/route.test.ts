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

  it("asks Apple's lookup for an app: name, icon, maker, rating, category and price", async () => {
    const fetchMock = platformAnswers({
      resultCount: 1,
      results: [{ trackName: "Fokus Timer", sellerName: "Fokus GmbH", artworkUrl512: "https://is3-ssl.mzstatic.com/image/thumb/a/512x512bb.jpg", averageUserRating: 4.7612, primaryGenreName: "Productivity", price: 0 }],
    });
    const response = await ask("https://apps.apple.com/de/app/fokus-timer/id1234567890");
    expect(await response.json()).toEqual({
      title: "Fokus Timer",
      author: "Fokus GmbH",
      image: "https://is3-ssl.mzstatic.com/image/thumb/a/512x512bb.jpg",
      rating: 4.8,
      category: "Productivity",
      pricing: "free",
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://itunes.apple.com/lookup?id=1234567890&country=de");
  });

  it("asks GitHub for a skill: its SKILL.md names it, the repository adds stars, language and license", async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(
        url.startsWith("https://api.github.com/")
          ? new Response(JSON.stringify({ name: "skills", description: "All my skills", stargazers_count: 1280, language: "Python", license: { spdx_id: "MIT" }, default_branch: "main" }))
          : new Response("---\nname: pdf-polish\ndescription: >\n  Turns rough drafts into\n  print-ready PDFs.\n---\n# PDF polish\n"),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await ask("https://github.com/arjun/skills/tree/main/skills/pdf-polish");
    expect(await response.json()).toEqual({ title: "pdf-polish", description: "Turns rough drafts into print-ready PDFs.", stars: 1280, language: "Python", license: "MIT", kind: "skill" });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://api.github.com/repos/arjun/skills");
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe("https://raw.githubusercontent.com/arjun/skills/main/skills/pdf-polish/SKILL.md");
  });

  it("calls a repository without a SKILL.md a repository", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(url.startsWith("https://api.github.com/") ? new Response(JSON.stringify({ name: "linkyo", description: "A link in bio", stargazers_count: 3, language: "TypeScript", license: null })) : new Response("Not Found", { status: 404 })),
      ),
    );
    const response = await ask("https://github.com/acme/linkyo");
    expect(await response.json()).toEqual({ title: "linkyo", description: "A link in bio", stars: 3, language: "TypeScript", kind: "repo" });
  });

  it("answers calmly when the platform is down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    const response = await ask("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC");
    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({});
  });
});
