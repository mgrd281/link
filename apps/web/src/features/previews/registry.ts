import type { Page } from "@linkyo/blocks";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";

import { nizarAr, nizarDe } from "./nizar";

/**
 * Private previews: a page prepared for one creator to see before they sign up. Reached only by an
 * unguessable link, never listed or indexed, always labelled as a preview, removed on request.
 */
export interface Preview {
  /** Who the preview is for, per language (shown in the label). */
  name: Partial<Record<"de" | "en" | "ar", string>>;
  /** Address the sign-up call to action pre-fills. */
  username: string;
  theme: CreatorThemeConfig;
  pages: Partial<Record<"de" | "en" | "ar", Page>>;
  /** Fills in what depends on the day (e.g. tonight's live), run per request. */
  prepare?: (page: Page, now: Date) => Page;
}

/** The next hh:00 in Berlin (today, or tomorrow once it has passed), as an ISO timestamp. */
export function nextBerlinTime(hour: number, now: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  const day =
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) +
    (Number(parts.hour) >= hour ? 864e5 : 0);
  const berlinHour = (date: Date) =>
    Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Berlin",
        hour: "2-digit",
        hourCycle: "h23",
      }).format(date),
    );
  // Berlin is UTC+1 in winter and UTC+2 in summer: pick the offset that lands on the hour.
  const candidates = [1, 2].map((offset) => new Date(day + (hour - offset) * 36e5));
  return (
    candidates.find((date) => berlinHour(date) === hour) ??
    candidates[0] ??
    new Date(day)
  ).toISOString();
}

const tonightAt =
  (hour: number) =>
  (page: Page, now: Date): Page => ({
    ...page,
    blocks: page.blocks.map((block) =>
      block.id === "live-youtube" && block.type === "live"
        ? { ...block, startsAt: nextBerlinTime(hour, now) }
        : block,
    ),
  });

export const PREVIEWS: Record<string, Preview> = {
  "nizar-m3e8dw": {
    name: { de: "Nizar", ar: "نزار" },
    username: "nizarals9",
    theme: { template: "nocturne" },
    pages: { de: nizarDe, ar: nizarAr },
    prepare: tonightAt(21),
  },
};

export const previewPage = (slug: string, locale: string, now = new Date()) => {
  const preview = PREVIEWS[slug];
  const page = preview?.pages[locale as "de" | "en" | "ar"];
  if (!preview || !page) return null;
  return { preview, page: preview.prepare ? preview.prepare(page, now) : page };
};
