import { afterEach, describe, expect, it, vi } from "vitest";

import { LINK_ONLY_PLATFORMS, linkOnlyPlatform, lookupLinkMetadata, readRepository } from "./link-metadata";

const REPOSITORY = {
  name: "tidewatch",
  description: "Tide tables for small harbours, offline first.",
  stargazers_count: 412,
  language: "Swift",
  license: { spdx_id: "MIT" },
  topics: ["ios", "tides", "offline-first"],
  homepage: "https://tidewatch.example.com",
  created_at: "2023-04-11T09:12:00Z",
  default_branch: "main",
  // Fields we must never take over.
  owner: { login: "tobin", email: "tobin@example.com" },
};

/** A stubbed network: GitHub's API answers with the repository, everything else has no file. */
function network() {
  const calls: string[] = [];
  const fetchMock = vi.fn((input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    return Promise.resolve(url.startsWith("https://api.github.com/") ? new Response(JSON.stringify(REPOSITORY)) : new Response("Not Found", { status: 404 }));
  });
  return { calls, fetchMock };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readRepository", () => {
  it("is exported and asks GitHub's API exactly once", async () => {
    const { calls, fetchMock } = network();
    const facts = await readRepository("tobin", "tidewatch", { fetch: fetchMock as unknown as typeof fetch });
    expect(calls).toEqual(["https://api.github.com/repos/tobin/tidewatch"]);
    expect(facts).toEqual({
      name: "tidewatch",
      description: "Tide tables for small harbours, offline first.",
      stars: 412,
      language: "Swift",
      license: "MIT",
      topics: ["ios", "tides", "offline-first"],
      homepage: "https://tidewatch.example.com",
      year: 2023,
      defaultBranch: "main",
    });
  });

  it("sends the token only when one is given", async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>).authorization).toBe("Bearer secret-token");
      return Promise.resolve(new Response(JSON.stringify(REPOSITORY)));
    });
    await readRepository("tobin", "tidewatch", { token: "secret-token", fetch: fetchMock as unknown as typeof fetch });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses names that are no repository, without a request", async () => {
    const { calls, fetchMock } = network();
    await expect(readRepository("../etc", "passwd", { fetch: fetchMock as unknown as typeof fetch })).rejects.toThrow();
    expect(calls).toEqual([]);
  });
});

describe("lookupLinkMetadata for a repository", () => {
  it("makes one request to api.github.com and returns topics, homepage and the year", async () => {
    const { calls, fetchMock } = network();
    vi.stubGlobal("fetch", fetchMock);
    const meta = await lookupLinkMetadata("https://github.com/tobin/tidewatch");
    expect(calls.filter((url) => new URL(url).hostname === "api.github.com")).toHaveLength(1);
    // Only GitHub's own hosts are asked (the SKILL.md check reads raw.githubusercontent.com).
    expect(calls.every((url) => ["api.github.com", "raw.githubusercontent.com"].includes(new URL(url).hostname))).toBe(true);
    expect(meta).toMatchObject({ title: "tidewatch", topics: ["ios", "tides", "offline-first"], homepage: "https://tidewatch.example.com", year: 2023, kind: "repo" });
    expect(JSON.stringify(meta)).not.toContain("tobin@example.com");
  });
});

describe("link-only platforms", () => {
  it.each([
    ["https://www.behance.net/gallery/123/Harbour-Identity", "Behance"],
    ["https://dribbble.com/shots/456-tide-app", "Dribbble"],
    ["https://www.linkedin.com/in/someone", "LinkedIn"],
    ["https://www.figma.com/community/file/789", "Figma"],
    ["https://someone.notion.site/Case-study", "Notion"],
    ["https://www.notion.so/Case-study-abc", "Notion"],
  ])("%s is never requested", async (url, platform) => {
    const { calls, fetchMock } = network();
    vi.stubGlobal("fetch", fetchMock);
    expect(linkOnlyPlatform(url)).toBe(platform);
    await expect(lookupLinkMetadata(url)).rejects.toThrow();
    expect(calls).toEqual([]);
  });

  it("knows every listed host and leaves other addresses alone", () => {
    for (const host of Object.keys(LINK_ONLY_PLATFORMS)) expect(linkOnlyPlatform(`https://${host}/x`)).not.toBeNull();
    expect(linkOnlyPlatform("https://studio-ronja.example.com/work")).toBeNull();
    expect(linkOnlyPlatform("https://github.com/tobin/tidewatch")).toBeNull();
    expect(linkOnlyPlatform("not a link")).toBeNull();
  });
});
