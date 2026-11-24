import { afterEach, describe, expect, it, vi } from "vitest";

import { isForeignImage, isProxiedImage, isStorageImage } from "./remote-images";

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

describe("pictures from someone else's server", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("re-serves YouTube channel avatars instead of letting the browser fetch them", () => {
    const avatar = "https://yt3.googleusercontent.com/abc=s1080-c-k-c0x00ffffff-no-rj";
    expect(isProxiedImage(avatar)).toBe(true);
    expect(isForeignImage(avatar)).toBe(false);
    // Exact hosts only: a look-alike is someone else's server.
    expect(isForeignImage("https://yt3.googleusercontent.com.evil.example/a.jpg")).toBe(true);
    expect(isForeignImage("https://lh3.googleusercontent.com/a.jpg")).toBe(true);
  });

  it("never re-serves an SVG: next/image would hand its address to the browser as it is", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", HOSTED);
    for (const src of ["https://i.ytimg.com/a.svg", "https://i.ytimg.com/a.svg?x", "https://i.ytimg.com/vi/abc/A.SVG#frag", `${HOSTED}/storage/v1/object/public/media/u/2026/logo.svg`]) {
      expect(isProxiedImage(src), src).toBe(false);
      expect(isForeignImage(src), src).toBe(true);
    }
    // An SVG of our own (a path on this site) is not someone else's; a query that names svg is no SVG.
    expect(isForeignImage("/brands/linkyo.svg")).toBe(false);
    expect(isProxiedImage("https://i.ytimg.com/vi/abc/maxres.jpg?svg=1")).toBe(true);
  });

  it("names every address on another host that the optimizer does not serve", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", HOSTED);
    for (const src of ["https://tracker.example/p.gif", "http://tracker.example/p.gif", "HTTPS://tracker.example/p.gif", "//tracker.example/p.gif", "/\\tracker.example/p.gif", " https://tracker.example/p.gif", "http://i.ytimg.com/vi/x/hqdefault.jpg"]) {
      expect(isForeignImage(src), src).toBe(true);
    }
  });

  it("leaves our own files, sample assets, Storage and in-browser pictures alone", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", HOSTED);
    for (const src of ["/samples/a.jpg", "sample:mix-01", "ex:ronja-feldkamp-01", "data:image/png;base64,iVBORw0KGgo=", "blob:http://localhost/1", `${HOSTED}/storage/v1/object/public/media/u/a.jpg`, "https://i.scdn.co/image/ab67"]) {
      expect(isForeignImage(src), src).toBe(false);
    }
  });
});
