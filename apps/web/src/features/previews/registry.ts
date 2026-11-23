import type { Page } from "@linkyo/blocks";
import type { CreatorThemeConfig } from "@linkyo/tokens/creator";

import { pageSchema } from "@linkyo/blocks";
import { creatorTokens } from "@linkyo/tokens";
import { z } from "zod";

import { EXAMPLES } from "@/features/examples/catalog";
import { isLook, LOOKS, type Look } from "@/features/examples/looks";

import { journalistAr, journalistDe, journalistEn } from "./journalist";
import { starPage } from "./stars";
import { STARS } from "./stars-data";
import { nizarAr, nizarDe } from "./nizar";
import { PREPARED } from "./prepared";
import { emailHash, privatePreviewDetails } from "./private";
import { SEVAG_SLUG, sevagContact, sevagDe } from "./sevag";

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
  /**
   * Built from details the person gave the team themselves (an application letter, a CV), not from
   * their public channels: the preview's note says so.
   */
  fromOwner?: boolean;
  /** The preview shows example states (live now, the verified look) that are not carried over. */
  examples?: boolean;
  /**
   * An example page for a kind of creator (a fictional person), sent to anyone of that kind. It is
   * labelled as an example, and its call to action starts a new account with that kind's template.
   */
  sample?: {
    kind: string;
    category?: string;
    look?: string;
    /** Who took the page's photographs (a portfolio shows pictures as work, so its example says whose they are). */
    credit?: string;
  };
  /**
   * A concept for a well-known person: how their page could look, built from public facts with links
   * to their official channels. Labelled as a concept, never listed or indexed; `credit` names the
   * photo's author and licence (Wikimedia Commons).
   */
  concept?: { credit?: string };
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

/**
 * Sevag's application page. His phone number, e-mail and invite come from the server's environment
 * (./private); without them the page shows without the contact band and nobody can take it over by
 * e-mail. Verified as soon as he takes it over (the founder's rule for pages the team prepared).
 */
function sevagPreview(): Preview {
  const own = privatePreviewDetails()[SEVAG_SLUG] ?? {};
  const contact = sevagContact(own);
  return {
    name: { de: "Sevag Ghazarian" },
    username: "sevag-ghazarian",
    // Black and grey, easy on the eyes (the founder found the dark page tiring): a soft light grey
    // ground, near-black text, black buttons with white text, untinted greys; the black forklift
    // loop opens the page.
    theme: { template: "laufbahn", mode: "light", accent: creatorTokens.swatches.ink, tint: 0 },
    pages: { de: contact ? { ...sevagDe, blocks: [...sevagDe.blocks, contact] } : sevagDe },
    ...(own.invite?.length ? { invite: { emailSha256: own.invite.map(emailHash) } } : {}),
    verified: true,
    fromOwner: true,
  };
}

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
  // An application page from the letter Sevag gave the team; a placeholder warehouse picture until he sends his own.
  // Laufbahn in navy, the blue of the picture's pallet racks.
  [SEVAG_SLUG]: sevagPreview(),
  journalist: {
    name: { de: "Lea Hartmann", en: "Lea Hartmann", ar: "ليا هارتمان" },
    username: "lea-hartmann",
    theme: { template: "atelier", pairing: "editorial" },
    pages: { de: journalistDe, en: journalistEn, ar: journalistAr },
    sample: { kind: "journalist", category: "careers", look: "journalist" },
  },
  // Concepts for well-known people: unlisted, labelled, official links only (see stars.ts).
  ...Object.fromEntries(
    STARS.map((star): [string, Preview] => [
      star.slug,
      {
        name: star.name,
        username: star.slug,
        theme: star.theme,
        pages: { de: starPage(star, "de"), en: starPage(star, "en"), ar: starPage(star, "ar") },
        concept: star.credit ? { credit: star.credit } : {},
      },
    ]),
  ),
  // The example gallery (/templates): one fictional person or business per kind of page.
  ...Object.fromEntries(
    Object.entries(EXAMPLES).flatMap(([slug, page]): [string, Preview][] => {
      if (!isLook(slug)) return [];
      const look: Look = LOOKS[slug];
      const sample = { kind: look.kind, category: look.category, look: slug, ...(look.credit ? { credit: look.credit } : {}) };
      return [[slug, { name: { [look.locale]: page.profile.displayName }, username: slug, theme: look.theme, pages: { [look.locale]: page }, sample }]];
    }),
  ),
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
