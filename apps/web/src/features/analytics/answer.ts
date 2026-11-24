/**
 * The shapes the statistics travel in: what `my_page_stats` and `admin_page_stats` answer, what
 * `GET /api/collect` hands the dashboard, and how a database without the statistics is recognised.
 * Pure (no server or browser imports), so the route, the dashboard and the console share it.
 */

export interface DayRow {
  day: string;
  views: number;
  visitors: number;
  clicks: number;
}

export interface KeyCount {
  key: string;
  count: number;
}

export interface Totals {
  views: number;
  visitors: number;
  clicks: number;
}

/** The signed-in owner's numbers for one range of Berlin days (`my_page_stats`). */
export interface OwnerStats {
  from: string;
  to: string;
  /** The first day anything was counted for the page; null: nothing yet. */
  since: string | null;
  /** Days with counts only, oldest first. */
  days: DayRow[];
  /** The same number of days just before `from`. */
  previous: Totals;
  /** Taps per block id, most first. */
  blocks: KeyCount[];
  /** Views per referrer group, country and device class, most first. */
  referrers: KeyCount[];
  countries: KeyCount[];
  devices: KeyCount[];
}

/** `GET /api/collect`: not counting (the switch is off, or the database has no statistics yet), or the numbers. */
export type OwnerStatsAnswer = { counting: false } | ({ counting: true } & OwnerStats);

/** The team's totals (`admin_page_stats`). */
export interface ConsoleStats {
  from: string;
  to: string;
  since: string | null;
  days: DayRow[];
  pages: { id: string; views: number; clicks: number }[];
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const count = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0);
const day = (value: unknown): string | null => (typeof value === "string" && DAY.test(value) ? value : null);
const list = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.filter(isRecord) : []);

const dayRows = (value: unknown): DayRow[] =>
  list(value).flatMap((row) => {
    const date = day(row.day);
    return date ? [{ day: date, views: count(row.views), visitors: count(row.visitors), clicks: count(row.clicks) }] : [];
  });

/**
 * Counts per key: the database names the number (`views`, `clicks`), the route hands it on as `count`
 * (the parsed shape), so both read the same way.
 */
const keyCounts = (value: unknown, field: "views" | "clicks"): KeyCount[] =>
  list(value).flatMap((row) => (typeof row.key === "string" && row.key ? [{ key: row.key, count: count(row.count ?? row[field]) }] : []));

/** The owner's answer, checked field by field; null when it is not one (the dashboard then says so). */
export function parseOwnerStats(json: unknown): OwnerStatsAnswer | null {
  if (!isRecord(json)) return null;
  if (json.counting === false) return { counting: false };
  if (json.counting !== true) return null;
  const from = day(json.from);
  const to = day(json.to);
  if (!from || !to) return null;
  const previous = isRecord(json.previous) ? json.previous : {};
  return {
    counting: true,
    from,
    to,
    since: day(json.since),
    days: dayRows(json.days),
    previous: { views: count(previous.views), visitors: count(previous.visitors), clicks: count(previous.clicks) },
    blocks: keyCounts(json.blocks, "clicks"),
    referrers: keyCounts(json.referrers, "views"),
    countries: keyCounts(json.countries, "views"),
    devices: keyCounts(json.devices, "views"),
  };
}

/** The team's totals, checked; null when it is not one. */
export function parseConsoleStats(json: unknown): ConsoleStats | null {
  if (!isRecord(json)) return null;
  const from = day(json.from);
  const to = day(json.to);
  if (!from || !to) return null;
  return {
    from,
    to,
    since: day(json.since),
    days: dayRows(json.days),
    pages: list(json.pages).flatMap((row) => (typeof row.id === "string" ? [{ id: row.id, views: count(row.views), clicks: count(row.clicks) }] : [])),
  };
}

/**
 * The database does not have the statistics yet (the hosted project before 20261125100000_page_stats.sql):
 * PostgREST's "function not found" (PGRST202) or "table not found" (PGRST205), or Postgres' 42883 / 42P01.
 * The app then behaves as before: "not counted yet", never an error and never zeros.
 */
export const missingStats = (error: { code?: string | undefined; message?: string | undefined }): boolean =>
  error.code === "PGRST202" ||
  error.code === "PGRST205" ||
  error.code === "42883" ||
  error.code === "42P01" ||
  /could not find the (function|table)|(function|relation) \S+ does not exist/i.test(error.message ?? "");
