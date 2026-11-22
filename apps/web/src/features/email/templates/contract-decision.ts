import { formatEuro } from "@/features/payments/prices";

import type { EmailMessage } from "../types";

import { greeting, longDate, renderEmail, shortDate, type EmailBlock, type EmailLocale, type EmailT } from "./render";

/** What the team decided about a withdrawal or a cancellation. */
export type ContractDecision =
  | { kind: "withdrawalAccepted"; contract: string; amountCents: number }
  | { kind: "withdrawalRejected"; contract: string; note: string }
  | { kind: "cancellationEnded"; endedAt: Date }
  | { kind: "cancellationRejected"; note: string }
  | { kind: "resumed"; nextChargeAt: Date };

export interface ContractDecisionData {
  /** The account's own address (never one typed into a form). */
  to: string;
  locale: EmailLocale;
  name?: string | null | undefined;
  /** When the request arrived (the subject names that day). */
  receivedAt: Date;
  decision: ContractDecision;
  /** The website's origin (the cancellation link of a rejected extraordinary cancellation). */
  site: string;
  testMode?: boolean | undefined;
}

function decisionBlocks(data: ContractDecisionData, t: EmailT): EmailBlock[] {
  const { decision, locale } = data;
  switch (decision.kind) {
    case "withdrawalAccepted":
      return [{ kind: "text", text: t("email.decision.withdrawalAccepted", { contract: decision.contract, price: formatEuro(decision.amountCents, locale) }) }];
    case "withdrawalRejected":
      return [{ kind: "text", text: t("email.decision.withdrawalRejected", { contract: decision.contract, note: decision.note.trim() }) }];
    case "cancellationEnded":
      return [{ kind: "text", text: t("email.decision.cancellationEnded", { date: longDate(decision.endedAt, locale) }) }];
    case "cancellationRejected":
      return [
        { kind: "text", text: t("email.decision.cancellationRejected", { note: decision.note.trim() }) },
        { kind: "button", label: t("email.pro.cancel"), href: `${data.site}/${locale}/kuendigen` },
      ];
    case "resumed":
      return [{ kind: "text", text: t("email.decision.resumed", { date: longDate(decision.nextChargeAt, locale) }) }];
  }
}

/**
 * The team's decision on a withdrawal or cancellation, to the account's own address: accepted with
 * the amount refunded, rejected with the reason, ended at once, or the cancellation taken back on the
 * holder's request.
 */
export function contractDecision(data: ContractDecisionData, t: EmailT): EmailMessage {
  return renderEmail({
    to: data.to,
    subject: t("email.decision.subject", { date: shortDate(data.receivedAt, data.locale) }),
    locale: data.locale,
    tag: "contract-decision",
    t,
    testMode: data.testMode === true,
    blocks: [{ kind: "text", text: greeting(t, data.name) }, ...decisionBlocks(data, t)],
  });
}
