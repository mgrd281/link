import type { Page } from "@linkyo/blocks";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";

import { pageSchema } from "@linkyo/blocks";
import { z } from "zod";

import { nizarAr, nizarDe } from "./nizar";
import { PREPARED } from "./prepared";

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
  /**
   * Who may take this page over: SHA-256 of the email(s) the creator gave the Linkyo team. Signing
   * up with one of them opens an account with this page ready. Plain emails never enter the code.
   */
  invite?: { emailSha256: string[] };
  /** Verified by the team: the badge stays when the creator takes the page over. */
  verified?: boolean;
  /** The preview shows example states (live now, the verified look) that are not carried over. */
  examples?: boolean;
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

const HAND_MADE: Record<string, Preview> = {
  nizar: {
    name: { de: "Nizar", ar: "نزار" },
    username: "nizarals9",
    theme: { template: "nocturne" },
    pages: { de: nizarDe, ar: nizarAr },
    prepare: tonightAt(21),
    // The business email from his public TikTok profile; add the one he gives you with prepare-page.
    invite: { emailSha256: ["f162f82de536c27fc25ee9575813959d7f7ddbbd4603cdbc383112a487af2647"] },
    examples: true,
  },
};

/** Pages the team prepared with scripts/prepare-page.mjs (checked with the page schema at start). */
const preparedFile = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,64}$/),
  name: z.partialRecord(z.enum(["de", "en", "ar"]), z.string()),
  username: z.string(),
  theme: z.record(z.string(), z.union([z.string(), z.number()])),
  pages: z.partialRecord(z.enum(["de", "en", "ar"]), pageSchema),
  invite: z.object({ emailSha256: z.array(z.string().regex(/^[0-9a-f]{64}$/)) }),
  verified: z.boolean().optional(),
});

/**
 * A page the team edited in the team area and published replaces the built-in one with the same
 * address; invites already given stay valid (the team area never sees them, only their count).
 */
export const PREVIEWS: Record<string, Preview> = {
  ...HAND_MADE,
  ...Object.fromEntries(
    PREPARED.map((raw) => preparedFile.parse(raw)).map((file) => {
      const before = HAND_MADE[file.slug];
      const invites = new Set([...(before?.invite?.emailSha256 ?? []), ...file.invite.emailSha256]);
      return [
        file.slug,
        {
          name: file.name,
          username: file.username,
          theme: file.theme,
          pages: file.pages,
          invite: { emailSha256: [...invites] },
          verified: file.verified ?? false,
          ...(before?.examples ? { examples: true } : {}),
        },
      ];
    }),
  ),
};

export { PREVIEW_ALIASES } from "./aliases";

export const previewPage = (slug: string, locale: string, now = new Date()) => {
  const preview = PREVIEWS[slug];
  const page = preview?.pages[locale as "de" | "en" | "ar"];
  if (!preview || !page) return null;
  return { preview, page: preview.prepare ? preview.prepare(page, now) : page };
};
