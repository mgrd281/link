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
  proposalId: string;
  /** The website's origin, e.g. "https://linkyo.app". */
  site: string;
}

/**
 * "Your page proposal is here": who made it follows its provenance (§0.3 #16: the AI drafted it and
 * the team checked it, or the team designed it), the revision rounds left with their deadline, the
 * kit line for Premium, and the one link to the proposal.
 */
export function proposalDelivered(data: ProposalDeliveredData, t: EmailT): EmailMessage {
  const blocks: EmailBlock[] = [
    { kind: "text", text: greeting(t, data.name) },
    { kind: "text", text: t(data.aiAssisted ? "email.proposal.bodyAi" : "email.proposal.bodyTeam") },
    { kind: "text", text: t("email.proposal.rounds", { count: data.revisionsLeft, date: longDate(data.reviseUntil, data.locale) }) },
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
