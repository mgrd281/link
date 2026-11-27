import type { Page } from "@linkyo/blocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MOTION_LIBRARY } from "@/features/creator/motion-library";

import { jonasDe, jpegHead } from "./fixtures";
import { fetchPhoto, photoCandidate, storageObjectUrl } from "./photo";

/**
 * The CV's photo (ADR 0089): only a real JPEG portrait in this deployment's Storage, read with care.
 * Fictional page; the Storage host is a made-up project.
 */
const SUPABASE = "https://project.supabase.co";
const MEDIA = `${SUPABASE}/storage/v1/object/public/media`;
const NOW = new Date("2026-11-26T10:00:00Z");
const ENV = { supabaseUrl: SUPABASE, vercel: "1" };

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

/** The fictional applicant with an uploaded portrait in his about block. */
const withPortrait = (src: string, extra: { visible?: boolean; until?: string; focal?: [number, number] } = {}): Page => {
  const page = jonasDe();
  return {
    ...page,
    blocks: page.blocks.map((block) =>
      block.type === "about"
        ? { ...block, visible: extra.visible ?? true, ...(extra.until ? { schedule: { until: extra.until } } : {}), portrait: { src, alt: "Jonas Brandt", ...(extra.focal ? { focal: extra.focal } : {}) } }
        : block,
    ),
  };
};

describe("the photo's candidate", () => {
  it("is an uploaded JPEG of this deployment's media bucket, with its focal point", () => {
    expect(photoCandidate(withPortrait(`${MEDIA}/uid/2026/a.jpg`, { focal: [0.5, 0.2] }), NOW, ENV)).toEqual({ src: `${MEDIA}/uid/2026/a.jpg`, focal: [0.5, 0.2] });
  });

  it("is none for a WebP or PNG upload, so the miniature and the PDF agree (no photo box on either)", () => {
    expect(photoCandidate(withPortrait(`${MEDIA}/uid/2026/a.webp`), NOW, ENV)).toBeNull();
    expect(photoCandidate(withPortrait(`${MEDIA}/uid/2026/a.png`), NOW, ENV)).toBeNull();
  });

  it("is none for a drawn still or a library scene, even where the page shows it beside the facts (the CV prints only a photo)", () => {
    // The page's "Über mich" shows any picture its owner set (ADR 0069, round 6 review 4); the CV never
    // prints a drawing or a stock still as the applicant, and the avatar does not stand in for it.
    const stills = MOTION_LIBRARY.map((clip) => clip.poster);
    expect(stills.length).toBeGreaterThan(0);
    for (const still of stills) {
      const page = withPortrait(still);
      expect(photoCandidate({ ...page, profile: { ...page.profile, avatar: { src: `${MEDIA}/uid/2026/a.jpg`, alt: "Jonas Brandt" } } }, NOW, ENV), still).toBeNull();
    }
  });

  it("follows the about block the page shows right now (hidden or ended: the avatar, here none)", () => {
    expect(photoCandidate(withPortrait(`${MEDIA}/uid/2026/a.jpg`, { visible: false }), NOW, ENV)).toBeNull();
    expect(photoCandidate(withPortrait(`${MEDIA}/uid/2026/a.jpg`, { until: "2026-11-01T00:00:00Z" }), NOW, ENV)).toBeNull();
  });

  it("refuses an address that leaves the media bucket by dot segments, plain or encoded, or another origin", () => {
    for (const src of [
      `${MEDIA}/../../../rest/v1/users.jpg`,
      `${MEDIA}/%2e%2e/%2E%2e/rest/v1/x.jpg`,
      `${MEDIA}/uid/.%2e/x.jpg`,
      "https://project.supabase.co.evil.example/storage/v1/object/public/media/a.jpg",
      "https://other.supabase.co/storage/v1/object/public/media/a.jpg",
    ]) {
      expect(storageObjectUrl(src, ENV), src).toBeNull();
      expect(photoCandidate(withPortrait(src), NOW, ENV), src).toBeNull();
    }
    expect(storageObjectUrl(`${MEDIA}/uid/2026/a.jpg`, ENV)?.pathname).toBe("/storage/v1/object/public/media/uid/2026/a.jpg");
  });
});

describe("reading the photo", () => {
  const page = withPortrait(`${MEDIA}/uid/2026/a.jpg`, { focal: [0.4, 0.3] });
  const answer = (bytes: Uint8Array, headers: Record<string, string> = {}) => new Response(new Blob([Uint8Array.from(bytes)]), { status: 200, headers });

  it("follows no redirect and keeps the owner's focal point", async () => {
    const load = vi.fn((_url: string | URL | Request, _init?: RequestInit) => Promise.resolve(answer(jpegHead())));
    const jpeg = await fetchPhoto(page, NOW, load);
    expect(load.mock.calls[0]?.[1]?.redirect).toBe("error");
    expect(jpeg).toMatchObject({ width: 350, height: 450, focal: [0.4, 0.3] });
  });

  it("stops reading past 2 MB even without a declared length", async () => {
    let pulled = 0;
    const chunk = new Uint8Array(512 * 1024);
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        if (pulled > 50) controller.close();
        else controller.enqueue(pulled === 1 ? Uint8Array.from([...jpegHead(), ...chunk.slice(0, chunk.length - jpegHead().length)]) : chunk);
      },
    });
    const load = () => Promise.resolve(new Response(stream, { status: 200 }));
    expect(await fetchPhoto(page, NOW, load as unknown as typeof fetch)).toBeNull();
    // Five chunks of 512 KB pass 2 MB: the rest was never read.
    expect(pulled).toBeLessThanOrEqual(6);
  });

  it("is none for a declared size over 2 MB, a failed answer or bytes that are no JPEG", async () => {
    const big = () => Promise.resolve(answer(jpegHead(), { "content-length": String(3 * 1024 * 1024) }));
    const missing = () => Promise.resolve(new Response(null, { status: 404 }));
    const png = () => Promise.resolve(answer(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])));
    const thrown = () => Promise.reject(new TypeError("redirect"));
    for (const load of [big, missing, png, thrown]) expect(await fetchPhoto(page, NOW, load as unknown as typeof fetch)).toBeNull();
  });
});
