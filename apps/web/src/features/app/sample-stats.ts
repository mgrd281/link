import type { Block } from "@linkyo/blocks";

/**
 * Sample analytics for demo mode, clearly labelled as such in the UI. Deterministic per page (same
 * numbers on every visit) and shaped like real traffic: weekly rhythm, a release spike, more mobile
 * than desktop. Real numbers come from our cookie-free, first-party counter in Phase 1.
 */

export interface DayStat {
  date: string;
  views: number;
  clicks: number;
}

export interface SampleStats {
  days: DayStat[];
  previous: { views: number; clicks: number };
  sources: { key: string; share: number }[];
  countries: { code: string; share: number }[];
  devices: { key: "mobile" | "desktop" | "tablet"; share: number }[];
  links: { block: Block; clicks: number }[];
}

function random(seed: string) {
  let h = 2166136261;
  for (const char of seed) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** Blocks a visitor can tap (a button, a player, a project's card, the way to get in touch). */
const CLICKABLE = new Set(["link", "card", "music", "video", "product", "events", "live", "shorts", "newsletter", "app", "repo", "project", "contact"]);

/** What a visitor can tap on the page: visible blocks of those types, and social icons with an address. */
export const clickableBlocks = (blocks: readonly Block[]): Block[] =>
  blocks.filter((block) => block.visible && (CLICKABLE.has(block.type) || (block.type === "socials" && block.items.some((item) => item.url))));

/**
 * Sample numbers, never impossible ones: a page with nothing to tap has views but no clicks (an
 * empty page showed 1,890 clicks while Home said there was nothing on it yet).
 */
export function sampleStats(seed: string, blocks: Block[], range: number, today = new Date()): SampleStats {
  const rand = random(`${seed}:${range}`);
  const clickable = clickableBlocks(blocks);
  const tappable = clickable.length > 0;
  const base = 60 + Math.round(rand() * 140);
  const spike = Math.floor(range * (0.35 + rand() * 0.4));
  const days: DayStat[] = Array.from({ length: range }, (_, i) => {
    const date = new Date(today.getTime() - (range - 1 - i) * 864e5);
    const weekday = date.getUTCDay();
    const weekend = weekday === 5 || weekday === 6 ? 1.35 : weekday === 0 ? 1.15 : 1;
    const bump = i >= spike && i < spike + 3 ? 2.4 - (i - spike) * 0.45 : 1;
    const trend = 0.85 + (i / range) * 0.3;
    const views = Math.round(base * weekend * bump * trend * (0.85 + rand() * 0.3));
    // Drawn either way, so the views stay the same once something tappable is added.
    const share = 0.32 + rand() * 0.12;
    const clicks = tappable ? Math.round(views * share) : 0;
    return { date: date.toISOString().slice(0, 10), views, clicks };
  });
  const views = days.reduce((sum, day) => sum + day.views, 0);
  const clicks = days.reduce((sum, day) => sum + day.clicks, 0);

  const share = (keys: string[]) => {
    const weights = keys.map((_, i) => (keys.length - i) * (0.7 + rand() * 0.6));
    const total = weights.reduce((sum, w) => sum + w, 0);
    return keys.map((key, i) => ({ key, share: (weights[i] ?? 0) / total })).sort((a, b) => b.share - a.share);
  };

  const weights = clickable.map((block, i) => (block.highlight ? 2.2 : 1) * (1 / (1 + i * 0.35)) * (0.6 + rand() * 0.8));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0) || 1;
  const links = clickable
    .map((block, i) => ({ block, clicks: Math.round((clicks * (weights[i] ?? 0)) / totalWeight) }))
    .sort((a, b) => b.clicks - a.clicks);

  return {
    days,
    previous: { views: Math.round(views * (0.72 + rand() * 0.2)), clicks: Math.round(clicks * (0.7 + rand() * 0.22)) },
    sources: share(["instagram", "tiktok", "direct", "youtube", "qr", "other"]),
    countries: share(["DE", "AT", "CH", "NL", "US"]).map(({ key, share: value }) => ({ code: key, share: value })),
    devices: [
      { key: "mobile", share: 0.78 },
      { key: "desktop", share: 0.17 },
      { key: "tablet", share: 0.05 },
    ],
    links,
  };
}

export const totals = (days: DayStat[]) => {
  const views = days.reduce((sum, day) => sum + day.views, 0);
  const clicks = days.reduce((sum, day) => sum + day.clicks, 0);
  return { views, clicks, ctr: views ? clicks / views : 0 };
};
