import type { Block } from "@linkyo/blocks";
import { describe, expect, it, vi } from "vitest";

import { applyOps, bodySchema, isOwnMedia, MAX_OPS, type OpsContext, type PageOp } from "./ops";

/**
 * The iPhone app's page operations, applied to a stored page (ADR draft-app-sync): links become
 * blocks with the web's own code, pictures must be the account's own uploads, and nothing the call
 * does may leave the page failing the blocks schema where it did not before.
 */

const OWNER = "0f4c5a3e-1111-4222-8333-444455556666";
const STORAGE = "http://127.0.0.1:54321";
const UPLOAD = `${STORAGE}/storage/v1/object/public/media/${OWNER}/2026/8d0b2c1e-4a5b-4c6d-8e7f-901234567890.jpg`;

const link = (id: string, extra: Partial<Block> = {}): Block => ({ id, type: "link", title: id, url: `https://example.com/${id}`, visible: true, highlight: false, ...extra }) as Block;
const stored = (blocks: unknown[]) => ({
  profile: { username: "mira", displayName: "Mira Okafor", bio: "", avatar: { src: "none:", alt: "" }, verified: false, locale: "de" },
  blocks,
});

let counter = 0;
const ctx = (overrides: Partial<OpsContext> = {}): OpsContext => ({
  ownerId: OWNER,
  storageUrl: STORAGE,
  labels: { video: "Video", music: "Musik", event: "Tickets" },
  artist: "Mira Okafor",
  lookup: () => Promise.resolve(null),
  newId: (type) => `${type}-new-${String((counter += 1))}`,
  ...overrides,
});

const run = (blocks: unknown[], ops: PageOp[], context = ctx()) => applyOps(stored(blocks), ops, context);
const blocksOf = (result: Awaited<ReturnType<typeof applyOps>>) => (result.ok ? (result.page.blocks as Block[]) : []);

describe("add", () => {
  it("turns a Spotify link into a music block with the platform's title, artist and cover", async () => {
    const lookup = vi.fn(() => Promise.resolve({ title: "Nachtfahrt", author: "Mira Okafor - Topic", image: "https://i.scdn.co/image/ab67616d0000b273cover" }));
    const result = await run([link("a")], [{ op: "add", url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc" }], ctx({ lookup }));
    expect(result.ok).toBe(true);
    const [music] = blocksOf(result);
    expect(music).toMatchObject({ type: "music", title: "Nachtfahrt", artist: "Mira Okafor", cover: { src: "https://i.scdn.co/image/ab67616d0000b273cover" } });
    // The tracking parameter is gone (detectLink), and the platform was asked about the clean address.
    expect(music?.type === "music" && music.links[0]).toEqual({ platform: "spotify", url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC" });
    expect(lookup).toHaveBeenCalledWith("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC");
    expect(result.ok && result.added).toEqual([music?.id]);
    expect(result.ok && result.changed).toEqual([music?.id]);
  });

  it("keeps the placeholder when the platform has no details, and never a sample picture", async () => {
    const result = await run([], [{ op: "add", url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC" }]);
    const [music] = blocksOf(result);
    expect(music).toMatchObject({ type: "music", title: "Musik", artist: "Mira Okafor", cover: { src: "none:" } });
  });

  it("leaves out platform details that would break the schema", async () => {
    const lookup = () => Promise.resolve({ title: "x".repeat(200) });
    const result = await run([], [{ op: "add", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }], ctx({ lookup }));
    const [video] = blocksOf(result);
    expect(video?.type).toBe("video");
    expect(video?.type === "video" && video.title).toBe("Video · YouTube");
  });

  it("puts new blocks where the Add sheet does: under the social icons, in the order sent", async () => {
    const socials = { id: "s", type: "socials", visible: true, highlight: false, items: [{ platform: "instagram", url: "https://instagram.com/mira" }] };
    const result = await run([socials, link("a")], [
      { op: "add", url: "https://example.org/one" },
      { op: "add", url: "https://example.org/two" },
    ]);
    const blocks = blocksOf(result);
    expect(blocks.map((block) => block.type === "card" && block.url)).toEqual([false, "https://example.org/one", "https://example.org/two", false]);
    expect(blocks[0]?.id).toBe("s");
    expect(blocks[3]?.id).toBe("a");
  });

  it("refuses an address that is not a link (422 badUrl, naming the operation)", async () => {
    expect(await run([link("a")], [{ op: "show", id: "a", visible: false }, { op: "add", url: "not a link" }])).toEqual({ ok: false, error: "badUrl", op: 1 });
    expect(await run([], [{ op: "add", url: "javascript:alert(1)" }])).toEqual({ ok: false, error: "badUrl", op: 0 });
  });

  it("never reuses an id the page has", async () => {
    let calls = 0;
    const newId = () => ((calls += 1) === 1 ? "a" : "card-fresh");
    const result = await run([link("a")], [{ op: "add", url: "https://example.org" }], ctx({ newId }));
    expect(blocksOf(result).map((block) => block.id)).toEqual(["card-fresh", "a"]);
  });
});

describe("addImage", () => {
  it("adds the account's own upload as an image block", async () => {
    const result = await run([link("a")], [{ op: "addImage", src: UPLOAD, alt: "Bühne", w: 1080, h: 1350 }]);
    expect(blocksOf(result)[0]).toMatchObject({ type: "image", visible: true, image: { src: UPLOAD, alt: "Bühne", w: 1080, h: 1350 } });
  });

  it.each([
    ["a foreign host", "https://images.example.com/photo.jpg"],
    ["another account's folder", UPLOAD.replace(OWNER, "11111111-2222-4333-8444-555555555555")],
    ["another bucket", UPLOAD.replace("/public/media/", "/public/briefing/")],
    ["a path outside the upload layout", `${STORAGE}/storage/v1/object/public/media/${OWNER}/../evil.jpg`],
    ["a picture type the bucket refuses", UPLOAD.replace(".jpg", ".svg")],
    ["a platform picture", "https://i.ytimg.com/vi/x/hqdefault.jpg"],
  ])("refuses %s (422 badImage)", async (_name, src) => {
    expect(await run([], [{ op: "addImage", src, alt: "", w: 10, h: 10 }])).toEqual({ ok: false, error: "badImage", op: 0 });
  });

  it("knows the account's own uploads", () => {
    expect(isOwnMedia(UPLOAD, OWNER, STORAGE)).toBe(true);
    expect(isOwnMedia(UPLOAD, OWNER, "https://other.supabase.co")).toBe(false);
  });
});

describe("move, show, remove", () => {
  const page = [link("a"), link("b"), link("c")];

  it("moves a block to a position", async () => {
    const result = await run(page, [{ op: "move", id: "c", to: 0 }]);
    expect(blocksOf(result).map((block) => block.id)).toEqual(["c", "a", "b"]);
    expect(result.ok && result.changed).toEqual(["c"]);
    expect(blocksOf(await run(page, [{ op: "move", id: "a", to: 2 }])).map((block) => block.id)).toEqual(["b", "c", "a"]);
  });

  it("refuses a position past the end", async () => {
    expect(await run(page, [{ op: "move", id: "a", to: 3 }])).toEqual({ ok: false, error: "badIndex", op: 0 });
  });

  it("shows and hides a block", async () => {
    const result = await run(page, [{ op: "show", id: "b", visible: false }]);
    expect(blocksOf(result)[1]).toMatchObject({ id: "b", visible: false });
    expect(blocksOf(await run([link("x", { visible: false })], [{ op: "show", id: "x", visible: true }]))[0]?.visible).toBe(true);
  });

  it("removes a block", async () => {
    const result = await run(page, [{ op: "remove", id: "b" }]);
    expect(blocksOf(result).map((block) => block.id)).toEqual(["a", "c"]);
    expect(result.ok && result.changed).toEqual(["b"]);
  });

  it("refuses an unknown id, naming it (422 unknownBlock), and an id the page has twice", async () => {
    expect(await run(page, [{ op: "remove", id: "zzz" }])).toEqual({ ok: false, error: "unknownBlock", id: "zzz" });
    expect(await run([link("a"), link("a")], [{ op: "show", id: "a", visible: false }])).toEqual({ ok: false, error: "ambiguousBlock", id: "a" });
  });

  it("applies the operations in order, and an added block can be moved in the same call", async () => {
    const result = await run(page, [
      { op: "remove", id: "a" },
      { op: "add", url: "https://example.org" },
      { op: "move", id: "card-new-1", to: 2 },
    ], ctx({ newId: () => "card-new-1" }));
    expect(blocksOf(result).map((block) => block.id)).toEqual(["b", "c", "card-new-1"]);
    expect(result.ok && result.changed).toEqual(["a", "card-new-1"]);
  });
});

describe("the page's own rules", () => {
  it("leaves blocks the schema no longer reads exactly as stored, and still accepts the call", async () => {
    const drifted = { id: "old", type: "link", title: "", url: "nope", visible: true, highlight: false, extra: 1 };
    const result = await run([drifted, link("a")], [{ op: "move", id: "a", to: 0 }]);
    expect(result.ok).toBe(true);
    expect(blocksOf(result)[1]).toEqual(drifted);
  });

  it("refuses a call that breaks the schema anew: more than 200 blocks", async () => {
    const full = Array.from({ length: 200 }, (_, index) => link(`b${String(index)}`));
    expect(await run(full, [{ op: "add", url: "https://example.org" }])).toEqual({ ok: false, error: "invalidPage", problems: ["blocks"] });
  });

  it("accepts at most 20 operations and only a row version as the base", () => {
    const ops = Array.from({ length: MAX_OPS + 1 }, () => ({ op: "remove", id: "a" }));
    expect(bodySchema.safeParse({ baseUpdatedAt: "2026-11-26T10:00:00.123456+00:00", ops: ops.slice(0, MAX_OPS) }).success).toBe(true);
    expect(bodySchema.safeParse({ baseUpdatedAt: "2026-11-26T10:00:00.123456+00:00", ops }).success).toBe(false);
    expect(bodySchema.safeParse({ baseUpdatedAt: "2026-11-26T10:00:00Z", ops: [{ op: "remove", id: "a" }] }).success).toBe(true);
    expect(bodySchema.safeParse({ baseUpdatedAt: "yesterday", ops: [{ op: "remove", id: "a" }] }).success).toBe(false);
    expect(bodySchema.safeParse({ baseUpdatedAt: "2026-11-26T10:00:00Z", ops: [{ op: "rename", id: "a" }] }).success).toBe(false);
  });
});
