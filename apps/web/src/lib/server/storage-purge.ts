import { serviceSupabase, type Db } from "../supabase/server";

/**
 * Deleting files. Linkyo removes Storage objects only through the Storage API (never with SQL on
 * `storage.objects`, which would leave the files behind): right away when an account is deleted,
 * and from the `storage_purge` queue for everything the database schedules (briefing photos after
 * their retention period, a deletion that failed). Server only; uses the service client.
 */

export type PurgeBucket = "media" | "briefing" | "deliverables";

/** What we need of the Storage API (Supabase's client in production, a stub in tests). */
export interface StorageApi {
  list(bucket: PurgeBucket, folder: string, page: { limit: number; offset: number }): Promise<{ name: string; folder: boolean }[]>;
  remove(bucket: PurgeBucket, paths: string[]): Promise<void>;
}

export const PAGE = 100;

export function supabaseStorage(db: Db): StorageApi {
  return {
    async list(bucket, folder, { limit, offset }) {
      const { data, error } = await db.storage.from(bucket).list(folder, { limit, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw new Error(`list ${bucket}/${folder}: ${error.message}`);
      // Sub-folders come back without an id (they are prefixes, not objects).
      return data.map((entry) => ({ name: entry.name, folder: entry.id === null }));
    },
    async remove(bucket, paths) {
      const { error } = await db.storage.from(bucket).remove(paths);
      if (error) throw new Error(`remove from ${bucket}: ${error.message}`);
    },
  };
}

/** Every object under a folder, its sub-folders included, read page by page. */
async function objectsUnder(storage: StorageApi, bucket: PurgeBucket, folder: string): Promise<string[]> {
  const found: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const entries = await storage.list(bucket, folder, { limit: PAGE, offset });
    for (const entry of entries) {
      const path = folder ? `${folder}/${entry.name}` : entry.name;
      if (entry.folder) found.push(...(await objectsUnder(storage, bucket, path)));
      else found.push(path);
    }
    if (entries.length < PAGE) return found;
  }
}

/**
 * Removes a folder (`<uid>/`, `<uid>/<order>/`: a path ending in "/") with everything in it, or a
 * single object. Lists everything first, then removes in batches, so paging never skips a file.
 * Answers how many objects went.
 */
export async function removePrefix(bucket: PurgeBucket, prefix: string, storage: StorageApi = supabaseStorage(serviceSupabase())): Promise<number> {
  const clean = prefix.replace(/^\/+/, "");
  if (!clean || clean.includes("..")) throw new Error(`refusing to remove "${prefix}" from ${bucket}`);
  const paths = clean.endsWith("/") ? await objectsUnder(storage, bucket, clean.replace(/\/+$/, "")) : [clean];
  for (let start = 0; start < paths.length; start += PAGE) await storage.remove(bucket, paths.slice(start, start + PAGE));
  return paths.length;
}

export interface PurgeRow {
  id: number;
  bucket: PurgeBucket;
  prefix: string;
  attempts: number;
}

/** The `storage_purge` queue (service client only: no policy lets anyone else read or write it). */
export interface PurgeQueue {
  due(limit: number): Promise<PurgeRow[]>;
  done(id: number): Promise<void>;
  failed(row: PurgeRow, error: string): Promise<void>;
  add(bucket: PurgeBucket, prefix: string, error?: string): Promise<void>;
}

const BUCKETS: readonly PurgeBucket[] = ["media", "briefing", "deliverables"];
const isBucket = (value: string): value is PurgeBucket => (BUCKETS as readonly string[]).includes(value);

export function supabasePurgeQueue(db: Db): PurgeQueue {
  return {
    async due(limit) {
      const { data, error } = await db
        .from("storage_purge")
        .select("id, bucket, prefix, attempts")
        .lte("due_at", new Date().toISOString())
        .order("due_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(limit);
      if (error) throw new Error(`storage_purge: ${error.message}`);
      return data.flatMap((row) => (isBucket(row.bucket) ? [{ id: row.id, bucket: row.bucket, prefix: row.prefix, attempts: row.attempts }] : []));
    },
    async done(id) {
      const { error } = await db.from("storage_purge").delete().eq("id", id);
      if (error) throw new Error(`storage_purge: ${error.message}`);
    },
    async failed(row, message) {
      const { error } = await db
        .from("storage_purge")
        .update({ attempts: row.attempts + 1, last_error: message.slice(0, 500) })
        .eq("id", row.id);
      if (error) throw new Error(`storage_purge: ${error.message}`);
    },
    async add(bucket, prefix, message) {
      const { error } = await db.from("storage_purge").insert({ bucket, prefix, ...(message ? { last_error: message.slice(0, 500) } : {}) });
      if (error) throw new Error(`storage_purge: ${error.message}`);
    },
  };
}

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

interface PurgeDeps {
  queue?: PurgeQueue | undefined;
  storage?: StorageApi | undefined;
}

/** The given queue and Storage API, or Supabase's through the service client. */
function resolve({ queue, storage }: PurgeDeps): { rows: PurgeQueue; files: StorageApi } {
  if (queue && storage) return { rows: queue, files: storage };
  const db = serviceSupabase();
  return { rows: queue ?? supabasePurgeQueue(db), files: storage ?? supabaseStorage(db) };
}

/**
 * Works through the due rows of `storage_purge`: each folder or object is removed and its row
 * deleted; a row that fails stays, with one more attempt and the error, for the next run.
 */
export async function drainStoragePurge(limit = 100, deps: PurgeDeps = {}): Promise<{ removed: number; failed: number }> {
  const { rows, files } = resolve(deps);
  let removed = 0;
  let failed = 0;
  for (const row of await rows.due(limit)) {
    try {
      await removePrefix(row.bucket, row.prefix, files);
      await rows.done(row.id);
      removed += 1;
    } catch (error) {
      await rows.failed(row, errorText(error));
      failed += 1;
    }
  }
  return { removed, failed };
}

/**
 * Everything an account kept in Storage: its page pictures, order photos and delivered story
 * pictures. Removed right away when the account is deleted; whatever fails waits in the queue.
 */
export async function removeAccountFiles(profileId: string, deps: PurgeDeps = {}): Promise<{ removed: number; queued: number }> {
  const { rows, files } = resolve(deps);
  let removed = 0;
  let queued = 0;
  for (const bucket of BUCKETS) {
    const prefix = `${profileId}/`;
    try {
      removed += await removePrefix(bucket, prefix, files);
    } catch (error) {
      await rows.add(bucket, prefix, errorText(error));
      queued += 1;
    }
  }
  return { removed, queued };
}
