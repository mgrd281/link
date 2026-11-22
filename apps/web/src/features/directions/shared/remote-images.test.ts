import { afterEach, describe, expect, it, vi } from "vitest";

import { isProxiedImage, isStorageImage } from "./remote-images";

const HOSTED = "https://abcd.supabase.co";
const LOCAL = "http://127.0.0.1:54321";

describe("pictures in our own Storage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts the public media bucket over https", () => {
    expect(isStorageImage(`${HOSTED}/storage/v1/object/public/media/u/2026/a.jpg`, { supabaseUrl: HOSTED })).toBe(true);
  });

  it("accepts the local stack over http only outside Vercel", () => {
    const src = `${LOCAL}/storage/v1/object/public/media/u/2026/a.jpg`;
    expect(isStorageImage(src, { supabaseUrl: LOCAL, vercel: undefined })).toBe(true);
    expect(isStorageImage(src, { supabaseUrl: LOCAL, vercel: "1" })).toBe(false);
    expect(isStorageImage(`http://localhost:54321/storage/v1/object/public/media/a.jpg`, { supabaseUrl: "http://localhost:54321", vercel: undefined })).toBe(true);
  });

  it("refuses other buckets, other hosts and http elsewhere", () => {
    expect(isStorageImage(`${HOSTED}/storage/v1/object/public/briefing/u/a.jpg`, { supabaseUrl: HOSTED })).toBe(false);
    expect(isStorageImage(`${HOSTED}/storage/v1/object/sign/media/u/a.jpg`, { supabaseUrl: HOSTED })).toBe(false);
    expect(isStorageImage("https://evil.example/storage/v1/object/public/media/u/a.jpg", { supabaseUrl: HOSTED })).toBe(false);
    expect(isStorageImage(`${HOSTED}.evil.example/storage/v1/object/public/media/a.jpg`, { supabaseUrl: HOSTED })).toBe(false);
    expect(isStorageImage("http://db.example.com/storage/v1/object/public/media/a.jpg", { supabaseUrl: "http://db.example.com", vercel: undefined })).toBe(false);
    expect(isStorageImage(`${HOSTED}/storage/v1/object/public/media/a.jpg`, { supabaseUrl: "" })).toBe(false);
  });

  it("sends Storage pictures through our optimizer with the build's Supabase address", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", HOSTED);
    expect(isProxiedImage(`${HOSTED}/storage/v1/object/public/media/u/2026/a.jpg`)).toBe(true);
    expect(isProxiedImage("https://i.ytimg.com/vi/x/hqdefault.jpg")).toBe(true);
    expect(isProxiedImage("https://example.com/a.jpg")).toBe(false);
  });
});
