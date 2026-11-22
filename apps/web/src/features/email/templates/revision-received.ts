import type { EmailMessage } from "../types";

import { clockTime, greeting, longDate, renderEmail, type EmailLocale, type EmailT } from "./render";

export interface RevisionReceivedData {
  to: string;
  locale: EmailLocale;
  name?: string | null | undefined;
  number: string;
  /** When the changed proposal is delivered (2 working days, 18:00 Berlin). */
  dueAt: Date;
}

/** The customer asked for changes: we have them, and this is when they come. */
export function revisionReceived(data: RevisionReceivedData, t: EmailT): EmailMessage {
  return renderEmail({
    to: data.to,
    subject: t("email.revision.subject", { number: data.number }),
    locale: data.locale,
    tag: "revision-received",
    t,
    blocks: [
      { kind: "text", text: greeting(t, data.name) },
      { kind: "text", text: t("email.revision.body", { date: longDate(data.dueAt, data.locale), time: clockTime(data.dueAt, data.locale) }) },
    ],
  });
}
