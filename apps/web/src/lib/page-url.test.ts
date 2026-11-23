import { afterEach, describe, expect, it, vi } from "vitest";

const load = async (domain?: string) => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_CREATOR_DOMAIN", domain ?? "");
  return import("./page-url");
};

describe("page addresses", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to linkyo.app over https", async () => {
    const { CREATOR_DOMAIN, pageAddress, pageUrl, creatorOrigin } = await load();
    expect(CREATOR_DOMAIN).toBe("linkyo.app");
    expect(pageAddress("mila")).toBe("linkyo.app/mila");
    expect(pageUrl("mila")).toBe("https://linkyo.app/mila");
    expect(creatorOrigin()).toBe("https://linkyo.app");
  });

  it("uses plain http only for a local address", async () => {
    expect((await load("localhost:3100")).pageUrl("mila")).toBe("http://localhost:3100/mila");
    expect((await load("127.0.0.1:3100")).pageUrl("mila")).toBe("http://127.0.0.1:3100/mila");
    expect((await load("localhost")).creatorOrigin()).toBe("http://localhost");
    const preview = await load("preview.linkyo.app");
    expect(preview.pageAddress("mila")).toBe("preview.linkyo.app/mila");
    expect(preview.pageUrl("mila")).toBe("https://preview.linkyo.app/mila");
    expect((await load("localhost.evil.example")).creatorOrigin()).toBe("https://localhost.evil.example");
  });

  it("adds a project's address part to the page's address", async () => {
    expect((await load()).projectUrl("mila", "hafenlicht")).toBe("https://linkyo.app/mila/hafenlicht");
    expect((await load("localhost:3100")).projectUrl("mila-aurel", "web-2")).toBe("http://localhost:3100/mila-aurel/web-2");
  });
});
