import type { OrderEvent } from "./orders-data";

/**
 * Words the team's order screens need that the shared screens do not have. Pure, so the tests read
 * the same rules.
 */

const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

/**
 * The page editor is the customer's own screen, and with nothing on the page yet it speaks to the
 * customer ("Deine Seite wartet", "… erscheint sofort auf deiner Seite"). In the proposal editor a
 * team member builds a proposal that the account sees only after delivery, so these two sentences
 * are replaced by `admin.orders.editor.emptyTitle` and `.emptyBody`. Everything else stays as it is,
 * and the messages passed in are not changed.
 */
export function teamEditorMessages<M extends object>(messages: M): M {
  const app = record(record(messages).app);
  const editor = record(app.editor);
  const team = record(record(record(record(messages).admin).orders).editor);
  return {
    ...messages,
    app: { ...app, editor: { ...editor, emptyTitle: team.emptyTitle ?? editor.emptyTitle, emptyBody: team.emptyBody ?? editor.emptyBody } },
  };
}

/**
 * A refund of part of the price, with its amount: `record_refund` notes it in the timeline as a
 * `refunded` event with `partial`, and the order goes on. Null for a refund that ended the order.
 */
export function partialRefund(event: OrderEvent): { amountCents: number } | null {
  if (event.kind !== "refunded" || event.details.partial !== true) return null;
  return typeof event.details.amount === "number" && Number.isFinite(event.details.amount) ? { amountCents: event.details.amount } : null;
}
