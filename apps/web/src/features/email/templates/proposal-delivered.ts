import type { EmailMessage } from "../types";

import { greeting, longDate, renderEmail, type EmailBlock, type EmailLocale, type EmailT } from "./render";

export interface ProposalDeliveredData {
  to: string;
  locale: EmailLocale;
  name?: string | null | undefined;
  number: string;
  /** The proposal's page has AI blocks or AI profile texts (its provenance, not its package). */
  aiAssisted: boolean;
  /** Premium: the marketing kit comes with the proposal. */
  hasKit: boolean;
  revisionsLeft: number;
  /** The end of the 14 days for revision requests (from the first delivery). */
  reviseUntil: Date;
  /** When the e-mail is written (the 14 days may be over: a late round is delivered after them). */
  now?: Date | undefined;
  proposalId: string;
  /** The website's origin, e.g. "https://linkyo.app". */
  site: string;
}

/** What the e-mail may say about further changes: rounds are left and their deadline is ahead, or not. */
export function revisionOffer(data: { revisionsLeft: number; reviseUntil: Date; now?: Date | undefined }): "open" | "none" | "expired" {
  if (data.revisionsLeft <= 0) return "none";
  const until = data.reviseUntil.getTime();
  return Number.isNaN(until) || until > (data.now ?? new Date()).getTime() ? "open" : "expired";
}

/**
 * "Your page proposal is here": who made it follows its provenance (§0.3 #16: the AI drafted it and
 * the team checked it, or the team designed it), the revision rounds left with their deadline, the
 * kit line for Premium, and the one link to the proposal.
 *
 * The deadline is 14 days after the first delivery and never moves, while a round asked for on the
 * last day is delivered two working days later. That e-mail must not promise rounds "until" a day
 * that has passed, nor invite to "request changes": it says the 14 days are over, as the review
 * screen does.
 */
export function proposalDelivered(data: ProposalDeliveredData, t: EmailT): EmailMessage {
  const offer = revisionOffer(data);
  const body = offer === "open" ? (data.aiAssisted ? "bodyAi" : "bodyTeam") : data.aiAssisted ? "bodyAiFinal" : "bodyTeamFinal";
  const blocks: EmailBlock[] = [
    { kind: "text", text: greeting(t, data.name) },
    { kind: "text", text: t(`email.proposal.${body}`) },
    {
      kind: "text",
      text: offer === "expired" ? t("email.proposal.roundsExpired") : t("email.proposal.rounds", { count: Math.max(data.revisionsLeft, 0), date: longDate(data.reviseUntil, data.locale) }),
    },
    ...(data.hasKit ? [{ kind: "text", text: t("email.proposal.kit") } as const] : []),
    { kind: "button", label: t("email.proposal.button"), href: `${data.site}/${data.locale}/app/proposals/${data.proposalId}` },
  ];
  return renderEmail({
    to: data.to,
    subject: t("email.proposal.subject", { number: data.number }),
    locale: data.locale,
    tag: "proposal-delivered",
    t,
    blocks,
  });
}
