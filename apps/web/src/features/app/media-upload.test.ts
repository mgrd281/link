import { describe, expect, it, vi } from "vitest";

import { dataUrlToBlob, mediaDepsFor, mediaObjectPath, publicMediaUrl, storePreparedImage, uploadDataUrl, uploadOptions, type MediaDeps } from "./media-upload";

const UID = "6f1c2f3e-1111-4222-8333-944445555666";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const JPEG = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString("base64")}`;

describe("page pictures in Storage", () => {
  it("uploads with a short cache lifetime, so a deleted picture does not live on in caches", () => {
    const options = uploadOptions("image/webp");
    expect(options).toEqual({ cacheControl: "3600", upsert: false, contentType: "image/webp" });
    // Not longer than the image optimizer's own minimum (four hours): then that minimum, not the
    // upload, decides how long an optimized copy of a deleted picture can still be served.
    expect(Number(options.cacheControl)).toBeLessThanOrEqual(4 * 3600);
  });

  it("stores them as media/<uid>/<yyyy>/<uuid>.<ext>", () => {
    const path = `media/${mediaObjectPath(UID, "image/jpeg", new Date("2026-11-22T12:00:00Z"))}`;
    const [bucket, uid, year, file] = path.split("/");
    expect([bucket, uid, year]).toEqual(["media", UID, "2026"]);
    expect(file).toMatch(/\.jpg$/);
    expect(file?.replace(/\.jpg$/, "")).toMatch(UUID);
    expect(mediaObjectPath(UID, "image/webp", new Date("2027-01-01T00:00:00Z"), "abc")).toBe(`${UID}/2027/abc.webp`);
    expect(mediaObjectPath(UID, "image/png", new Date(), "abc")).toMatch(/\.png$/);
  });

  it("builds the public address of the media bucket", () => {
    expect(publicMediaUrl("u/2026/a.jpg", "http://127.0.0.1:54321/")).toBe("http://127.0.0.1:54321/storage/v1/object/public/media/u/2026/a.jpg");
  });

  it("turns a picture data URL into a file, and nothing else", () => {
    const file = dataUrlToBlob(JPEG);
    expect(file?.type).toBe("image/jpeg");
    expect(file?.blob.size).toBe(4);
    expect(dataUrlToBlob("data:image/svg+xml;base64,PHN2Zz4=")).toBeNull();
    expect(dataUrlToBlob("https://example.com/a.jpg")).toBeNull();
  });

  it("uploads to the account's folder and answers the public address", async () => {
    const upload = vi.fn<MediaDeps["upload"]>(() => Promise.resolve());
    const deps: MediaDeps = { enabled: true, userId: () => Promise.resolve(UID), upload, publicUrl: (path) => `https://cdn/${path}` };
    const url = await uploadDataUrl(JPEG, deps);
    expect(upload).toHaveBeenCalledTimes(1);
    const [bucket, path, blob, type] = upload.mock.calls[0] ?? [];
    expect(bucket).toBe("media");
    expect(path).toMatch(new RegExp(`^${UID}/\\d{4}/[0-9a-f-]{36}\\.jpg$`));
    expect(blob?.size).toBe(4);
    expect(type).toBe("image/jpeg");
    expect(url).toBe(`https://cdn/${path ?? ""}`);
  });

  it("the team's proposal editor uploads into the customer's folder, not the team member's", async () => {
    const CUSTOMER = "0c0c0c0c-2222-4333-8444-555566667777";
    const upload = vi.fn<MediaDeps["upload"]>(() => Promise.resolve());
    // The signed-in session is the team member's (UID); the proposal names the customer as the owner.
    const session: MediaDeps = { enabled: true, userId: () => Promise.resolve(UID), upload, publicUrl: (path) => `https://cdn/${path}` };
    const prepared = { src: JPEG, tone: "dark" as const, width: 10, height: 10 };
    const stored = await storePreparedImage(prepared, mediaDepsFor(CUSTOMER, session));
    const [bucket, path] = upload.mock.calls[0] ?? [];
    expect(bucket).toBe("media");
    expect(path).toMatch(new RegExp(`^${CUSTOMER}/\\d{4}/[0-9a-f-]{36}\\.jpg$`));
    expect(path).not.toContain(UID);
    // The address kept in the proposal's page is the customer's object: purged with that account.
    expect(stored.src).toBe(`https://cdn/${path ?? ""}`);
    expect(mediaDepsFor(CUSTOMER, { ...session, enabled: false }).enabled).toBe(false);
  });

  it("keeps the data URL in the demo and fails without a session", async () => {
    const prepared = { src: JPEG, tone: "dark" as const, width: 10, height: 10 };
    const upload = vi.fn<MediaDeps["upload"]>(() => Promise.resolve());
    await expect(storePreparedImage(prepared, { enabled: false, userId: () => Promise.resolve(UID), upload, publicUrl: String })).resolves.toBe(prepared);
    expect(upload).not.toHaveBeenCalled();
    await expect(storePreparedImage(prepared, { enabled: true, userId: () => Promise.resolve(null), upload, publicUrl: String })).rejects.toThrow("not signed in");
    const stored = await storePreparedImage(prepared, { enabled: true, userId: () => Promise.resolve(UID), upload, publicUrl: (path) => `https://cdn/${path}` });
    expect(stored.src).toMatch(/^https:\/\/cdn\//);
    expect({ ...stored, src: "" }).toEqual({ ...prepared, src: "" });
  });
});
