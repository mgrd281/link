import { describe, expect, it, vi } from "vitest";

import { drainStoragePurge, PAGE, removeAccountFiles, removePrefix, type PurgeBucket, type PurgeQueue, type PurgeRow, type StorageApi } from "./storage-purge";

/** A stub Storage: folders and files by path, listed page by page like the real API. */
function stubStorage(files: Record<PurgeBucket, string[]>, failOn?: { bucket: PurgeBucket; error: string }) {
  const removed: { bucket: PurgeBucket; paths: string[] }[] = [];
  const listings: { bucket: PurgeBucket; folder: string; offset: number }[] = [];
  const storage: StorageApi = {
    list(bucket, folder, { limit, offset }) {
      if (failOn?.bucket === bucket) return Promise.reject(new Error(failOn.error));
      listings.push({ bucket, folder, offset });
      const prefix = folder ? `${folder}/` : "";
      const children = new Map<string, boolean>();
      for (const path of files[bucket]) {
        if (!path.startsWith(prefix)) continue;
        const [name = "", ...rest] = path.slice(prefix.length).split("/");
        children.set(name, rest.length > 0 || (children.get(name) ?? false));
      }
      const entries = [...children.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, folder]) => ({ name, folder }));
      return Promise.resolve(entries.slice(offset, offset + limit));
    },
    remove(bucket, paths) {
      removed.push({ bucket, paths });
      files[bucket] = files[bucket].filter((path) => !paths.includes(path));
      return Promise.resolve();
    },
  };
  return { storage, removed, listings };
}

const many = (folder: string, count: number) => Array.from({ length: count }, (_, index) => `${folder}/${String(index).padStart(3, "0")}.jpg`);

describe("removing files through the Storage API", () => {
  it("pages through a folder and its sub-folders and removes every object", async () => {
    const files = { media: [...many("ana/2025", 150), ...many("ana/2026", 3), ...many("ben/2026", 2)], briefing: [], deliverables: [] };
    const { storage, removed, listings } = stubStorage(files);
    expect(await removePrefix("media", "ana/", storage)).toBe(153);
    // The 2025 folder took two pages of 100.
    expect(listings.filter((entry) => entry.folder === "ana/2025").map((entry) => entry.offset)).toEqual([0, PAGE]);
    expect(removed.every((batch) => batch.paths.length <= PAGE)).toBe(true);
    expect(files.media).toEqual(many("ben/2026", 2));
  });

  it("removes a single object, and refuses an empty or climbing prefix", async () => {
    const files = { media: ["ana/2026/a.jpg", "ana/2026/b.jpg"], briefing: [], deliverables: [] };
    const { storage } = stubStorage(files);
    expect(await removePrefix("media", "ana/2026/a.jpg", storage)).toBe(1);
    expect(files.media).toEqual(["ana/2026/b.jpg"]);
    await expect(removePrefix("media", "", storage)).rejects.toThrow();
    await expect(removePrefix("media", "../x/", storage)).rejects.toThrow();
  });

  it("drains the queue: done rows go, a failure stays with one more attempt", async () => {
    const files = { media: ["ana/2026/a.jpg"], briefing: ["ana/order-1/p.jpg"], deliverables: [] };
    const { storage } = stubStorage(files, { bucket: "deliverables", error: "storage down" });
    const rows: PurgeRow[] = [
      { id: 1, bucket: "briefing", prefix: "ana/order-1/", attempts: 0 },
      { id: 2, bucket: "deliverables", prefix: "ana/order-1/", attempts: 2 },
      { id: 3, bucket: "media", prefix: "ana/", attempts: 0 },
    ];
    const done = vi.fn<PurgeQueue["done"]>(() => Promise.resolve());
    const failed = vi.fn<PurgeQueue["failed"]>(() => Promise.resolve());
    const queue: PurgeQueue = { due: (limit) => Promise.resolve(rows.slice(0, limit)), done, failed, add: () => Promise.resolve() };
    expect(await drainStoragePurge(100, { queue, storage })).toEqual({ removed: 2, failed: 1 });
    expect(done).toHaveBeenCalledWith(1);
    expect(done).toHaveBeenCalledWith(3);
    expect(done).not.toHaveBeenCalledWith(2);
    expect(failed).toHaveBeenCalledWith(rows[1], "storage down");
    expect(files).toEqual({ media: [], briefing: [], deliverables: [] });
  });

  it("removes an account's three folders and queues what fails", async () => {
    const files = { media: ["ana/2026/a.jpg", "ben/2026/b.jpg"], briefing: ["ana/o/p.jpg"], deliverables: [] };
    const { storage } = stubStorage(files, { bucket: "deliverables", error: "timeout" });
    const add = vi.fn<PurgeQueue["add"]>(() => Promise.resolve());
    const queue: PurgeQueue = { due: () => Promise.resolve([]), done: () => Promise.resolve(), failed: () => Promise.resolve(), add };
    expect(await removeAccountFiles("ana", { queue, storage })).toEqual({ removed: 2, queued: 1 });
    expect(add).toHaveBeenCalledWith("deliverables", "ana/", "timeout");
    expect(files.media).toEqual(["ben/2026/b.jpg"]);
  });
});
