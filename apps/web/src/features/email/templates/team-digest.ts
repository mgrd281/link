import type { EmailMessage } from "../types";

import { longDate, renderEmail, type EmailLocale, type EmailT } from "./render";

export interface TeamDigestData {
  /** A team member who handles reports. */
  to: string;
  locale: EmailLocale;
  /** Reports waiting for a decision. */
  open: number;
  /** Of those, the ones past the team's own target (REPORT_SLA_HOURS). */
  overdue: number;
  /** When the oldest open report came in. */
  oldest: Date;
  /** The website's origin (the queue's address). */
  site: string;
}

/**
 * The team's daily note (A-17): how many reports wait, how many are past the target, since when, and
 * the way to the queue. Only sent when something waits (the caller skips an empty queue). Names no
 * page, no reporter and no content: the queue shows those behind the sign-in.
 */
export function teamDigest(data: TeamDigestData, t: EmailT): EmailMessage {
  return renderEmail({
    to: data.to,
    subject: t("email.digest.subject", { count: data.open }),
    locale: data.locale,
    tag: "report-digest",
    t,
    blocks: [
      { kind: "text", text: t("email.digest.open", { count: data.open }) },
      ...(data.overdue > 0 ? [{ kind: "text" as const, text: t("email.digest.overdue", { count: data.overdue }) }] : []),
      { kind: "text", text: t("email.digest.oldest", { date: longDate(data.oldest, data.locale) }) },
      { kind: "button", label: t("email.digest.action"), href: `${data.site}/${data.locale}/admin/reports` },
    ],
  });
}
