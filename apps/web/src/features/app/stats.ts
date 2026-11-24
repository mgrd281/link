import { useEffect, useSyncExternalStore } from "react";

import { accountStore } from "@/features/account/store";
import { parseOwnerStats, type KeyCount, type OwnerStats, type Totals } from "@/features/analytics/answer";
import { addDays, daysBetween } from "@/features/analytics/days";
import { accessToken } from "@/lib/supabase/access-token";

/**
 * Where the dashboard's numbers come from. The demo shows sample numbers, labelled as samples. Real
 * accounts ask the server (`GET /api/collect`): it answers their page's own cookie-free counts, or
 * that nothing is counted yet (the server switch is off, or the database does not have the statistics
 * yet). Then the screens keep their honest "coming soon" state: no invented numbers, and no zeros that
 * were never measured.
 */
export type StatsSource = "sample" | "none";

/** "sample" in the demo; "none" with real accounts, whose numbers come from `useLiveStats`. */
export const statsSource = (): StatsSource => (accountStore.demo ? "sample" : "none");

export const STATS_RANGES = [7, 30, 90] as const;
export type StatsRange = (typeof STATS_RANGES)[number];

/** One day on a dashboard chart: null where nothing was counted yet (before counting began). */
export interface StatsDay {
  date: string;
  views: number | null;
  visitors: number | null;
  clicks: number | null;
}

export interface LiveStats {
  range: StatsRange;
  from: string;
  to: string;
  /** The first day anything was counted for this page; null: nothing yet. */
  since: string | null;
  /** Every day of the range, oldest first. */
  days: StatsDay[];
  totals: Totals;
  /** The period just before, only when it was counted from its first day (else a change would be made up). */
  previous: Totals | null;
  blocks: KeyCount[];
  referrers: KeyCount[];
  countries: KeyCount[];
  devices: KeyCount[];
}

export type LiveStatsState =
  | { status: "loading" }
  /** Nothing is counted for real accounts yet: the switch is off or the database lacks the statistics. */
  | { status: "off" }
  /** The numbers could not be loaded right now. Never shown as zeros. */
  | { status: "error" }
  | { status: "ready"; stats: LiveStats };

/** The owner's answer as the dashboard draws it: every day of the range, unmeasured days as null. */
export function toLiveStats(stats: OwnerStats, range: StatsRange): LiveStats {
  const byDay = new Map(stats.days.map((row) => [row.day, row]));
  const days = daysBetween(stats.from, stats.to).map((date): StatsDay => {
    if (stats.since === null || date < stats.since) return { date, views: null, visitors: null, clicks: null };
    const row = byDay.get(date);
    return { date, views: row?.views ?? 0, visitors: row?.visitors ?? 0, clicks: row?.clicks ?? 0 };
  });
  const sum = (key: keyof Totals) => stats.days.reduce((total, row) => total + row[key], 0);
  const previousStart = addDays(stats.from, -range);
  return {
    range,
    from: stats.from,
    to: stats.to,
    since: stats.since,
    days,
    totals: { views: sum("views"), visitors: sum("visitors"), clicks: sum("clicks") },
    previous: stats.since !== null && stats.since <= previousStart ? stats.previous : null,
    blocks: stats.blocks,
    referrers: stats.referrers,
    countries: stats.countries,
    devices: stats.devices,
  };
}

/** What the server's answer means for the screens. */
export function liveStatsState(response: { ok: boolean; status: number }, json: unknown, range: StatsRange): LiveStatsState {
  if (!response.ok) return { status: "error" };
  const answer = parseOwnerStats(json);
  if (!answer) return { status: "error" };
  if (!answer.counting) return { status: "off" };
  return { status: "ready", stats: toLiveStats(answer, range) };
}

/** What `fetchLiveStats` needs from its surroundings (the browser's own in the app, stubs in tests). */
export interface StatsDeps {
  token: () => Promise<string | null>;
  get: (path: string, init: RequestInit) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
}

const browserDeps: StatsDeps = { token: accessToken, get: (path, init) => fetch(path, init) };

/** Asks the server for the signed-in owner's numbers of the last `range` days. */
export async function fetchLiveStats(range: StatsRange, deps: StatsDeps = browserDeps): Promise<LiveStatsState> {
  try {
    const token = await deps.token();
    if (!token) return { status: "error" };
    const response = await deps.get(`/api/collect?days=${range}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    // 404: a build without real accounts has nothing to ask (the demo never gets here).
    if (response.status === 404) return { status: "off" };
    return liveStatsState(response, response.ok ? await response.json() : null, range);
  } catch {
    return { status: "error" };
  }
}

// ── One small store per account and range, shared by Stats, Home and the editor ─────────────
interface Entry {
  state: LiveStatsState;
  at: number;
  pending: boolean;
}

const LOADING: LiveStatsState = { status: "loading" };
/** Numbers older than this are asked for again when a screen opens. */
const FRESH_MS = 60_000;
const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
const keyOf = (account: string, range: StatsRange) => `${account}:${range}`;

function load(account: string, range: StatsRange) {
  const key = keyOf(account, range);
  const entry = entries.get(key);
  if (entry?.pending) return;
  entries.set(key, { state: entry?.state ?? LOADING, at: entry?.at ?? 0, pending: true });
  void fetchLiveStats(range).then((state) => {
    entries.set(key, { state, at: Date.now(), pending: false });
    for (const listener of listeners) listener();
  });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * The real account's numbers for the last `range` days (`account`: its id, so another sign-in in the
 * same tab asks again). `enabled` false (the demo) asks nothing and stays "loading".
 */
export function useLiveStats(account: string, range: StatsRange, enabled = true): LiveStatsState {
  const key = keyOf(account, range);
  useEffect(() => {
    if (!enabled) return;
    const entry = entries.get(key);
    if (!entry || (!entry.pending && Date.now() - entry.at > FRESH_MS)) load(account, range);
  }, [account, range, enabled, key]);
  return useSyncExternalStore(
    subscribe,
    () => entries.get(key)?.state ?? LOADING,
    () => LOADING,
  );
}

/** Asks again (the Stats screen's "Try again"). */
export function reloadLiveStats(account: string, range: StatsRange): void {
  load(account, range);
}

// ── Export ───────────────────────────────────────────────────────────────────────────────────

/** Characters that make a spreadsheet read a cell as a formula (CSV injection). */
const FORMULA_START = /^[=+\-@\t\r]/;

/** One CSV cell: quoted, inner quotes doubled, and a formula-looking text kept as text. */
export const csvCell = (value: string | number | null): string => {
  const text = value === null ? "" : String(value);
  return `"${(FORMULA_START.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
};

/**
 * The days on screen as CSV: one row per day, oldest first. A day before counting began has empty
 * cells, never a 0; `visitors` false leaves that column out (the demo's samples have none).
 */
export function statsCsv(days: readonly StatsDay[], header: { date: string; views: string; visitors: string; clicks: string }, visitors: boolean): string {
  const head = [header.date, header.views, ...(visitors ? [header.visitors] : []), header.clicks];
  const rows = days.map((day) => [day.date, day.views, ...(visitors ? [day.visitors] : []), day.clicks]);
  return [head, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}
