import { isKind } from "@linkyo/blocks";

import { PASTED_MAX, SOURCES_MAX, TEAM_ABOUT_MAX, type PipelineInput } from "../request";

/**
 * The pipeline input for a team member's AI draft of an order (route "team"): the briefing's first
 * five links are read as sources, the rest go in as pasted links, the wishes are the owner text (up
 * to 2,000 characters; e-mail addresses and phone numbers are replaced when the prompt is built,
 * like every free text). No photo ever goes to the model.
 */

export interface TeamOrder {
  /** The order's language (contract e-mails, the team's notes). */
  locale: "de" | "en" | "ar";
  /** The customer's current display name. */
  displayName: string | null;
  /** The customer's site kind. */
  kind: string | null;
}

export interface TeamBriefing {
  links: readonly string[];
  wishes: string;
  /** The language the customer wants the page in. */
  pageLocale: "de" | "en" | "ar";
}

export function teamRunInput(order: TeamOrder, briefing: TeamBriefing): PipelineInput {
  const links = briefing.links.map((link) => link.trim()).filter((link) => link.length > 0);
  const name = order.displayName?.trim().slice(0, 60);
  return {
    route: "team",
    pageLocale: briefing.pageLocale,
    ownerLocale: order.locale,
    about: briefing.wishes.trim().slice(0, TEAM_ABOUT_MAX),
    ...(name ? { name } : {}),
    kind: isKind(order.kind) ? order.kind : null,
    sources: links.slice(0, SOURCES_MAX).map((link) => link.slice(0, 300)),
    pasted: links.slice(SOURCES_MAX, SOURCES_MAX + PASTED_MAX).map((link) => link.slice(0, 2048)),
    photo: null,
  };
}
