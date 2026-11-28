/**
 * Transactional e-mails (orders, Pro, withdrawals, cancellations, proposals, refunds, reports). Templates are
 * pure `(data, t) => EmailMessage`; a sender delivers them. Server only: senders read secrets and
 * write files.
 */

export type EmailTag =
  | "order-confirmation"
  | "pro-confirmation"
  | "withdrawal-receipt"
  | "cancellation-receipt"
  | "cancellation-confirmation"
  | "contract-decision"
  | "proposal-delivered"
  | "revision-received"
  | "refund-issued"
  // Notice and action (DSA Art. 16 and 17; features/moderation).
  | "report-receipt"
  | "report-decision"
  | "statement-of-reasons"
  | "report-digest";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  locale: "de" | "en" | "ar";
  tag: EmailTag;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<{ id: string }>;
}
