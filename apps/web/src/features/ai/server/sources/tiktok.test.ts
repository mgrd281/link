import { describe, expect, it, vi } from "vitest";

import { classifySource } from "./classify";
import { readTikTok } from "./tiktok";

const source = () => {
  const classified = classifySource("https://www.tiktok.com/@lio.vance");
  if (!classified) throw new Error("not a source");
  return classified;
};

describe("readTikTok", () => {
  it("asks TikTok's public oEmbed for the profile and takes the name it shows", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ author_name: "Lio Vance", author_url: "https://www.tiktok.com/@lio.vance" }), { status: 200 }));
    const result = await readTikTok(source(), { id: "S1", fetch: fetchMock });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`https://www.tiktok.com/oembed?url=${encodeURIComponent("https://www.tiktok.com/@lio.vance")}`);
    expect(result).toEqual({ id: "S1", kind: "tiktok", label: "tiktok.com/@lio.vance", status: "read", self: { url: "https://www.tiktok.com/@lio.vance" }, links: [], profile: { displayName: "Lio Vance" } });
  });

  it("says 'not found' for a 400 and keeps the profile as a link", async () => {
    const result = await readTikTok(source(), { id: "S1", fetch: vi.fn().mockResolvedValue(new Response("{}", { status: 400 })) });
    expect(result).toMatchObject({ status: "failed", reason: "notFound", self: { url: "https://www.tiktok.com/@lio.vance" } });
  });

  it("gives up after its time limit", async () => {
    const hanging = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(init.signal?.reason as Error);
          });
        }),
    );
    const result = await readTikTok(source(), { id: "S1", fetch: hanging, timeoutMs: 20 });
    expect(result).toMatchObject({ status: "failed", reason: "timeout" });
  });

  it("fails calmly on a server error", async () => {
    const result = await readTikTok(source(), { id: "S1", fetch: vi.fn().mockResolvedValue(new Response("", { status: 503 })) });
    expect(result).toMatchObject({ status: "failed" });
    expect(result).not.toHaveProperty("reason");
  });
});
