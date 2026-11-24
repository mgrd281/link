import { paymentsEnabled } from "@/lib/flags";

/**
 * Addresses inside the dashboard (/app) and the team area (/admin) whose route exists but that can
 * never show anything in this build: page-service orders and proposals without payments, or with an
 * id that is no order id.
 *
 * Why this lives outside the pages: both areas sit behind a gate in the browser (the session is read
 * there, demo accounts live in local storage). While it reads the session the gate shows its splash
 * and does not render the page, so the server never meets the page's own `notFound()` before the
 * response starts, and such an address used to answer 200. The areas' layouts run this check next
 * to the gate instead, where the server does meet it: the answer is a real 404, and the page's own
 * check stays as the second line.
 */

/** An order or proposal id: a UUID (the form the database hands out). */
export const isOrderId = (id: string): boolean => /^[0-9a-f-]{36}$/i.test(id);

/** An order or proposal address that cannot exist: no payments in this build, or no order id. */
export const orderMissing = (id: string, payments: boolean = paymentsEnabled): boolean => !payments || !isOrderId(id);

export type GatedArea = "app" | "admin";

/**
 * True when the route below an area can never exist. `segments` are the route's segments under the
 * area as `useSelectedLayoutSegments()` returns them: route groups ("(shell)") and Next's own markers
 * ("__PAGE__") are skipped, dynamic segments carry their value.
 */
export function gatedRouteMissing(area: GatedArea, segments: readonly string[], payments: boolean = paymentsEnabled): boolean {
  const parts = segments.filter((segment) => !segment.startsWith("(") && !segment.startsWith("__"));
  const [first, id, ...rest] = parts;
  if (area === "app") {
    // /app/orders/<id> and /app/proposals/<id>: the customer's order and the team's proposal.
    return (first === "orders" || first === "proposals") && id !== undefined && rest.length === 0 && orderMissing(id, payments);
  }
  // /admin/orders, /admin/orders/<id> and /admin/orders/<id>/proposal: the page-service queue.
  if (first !== "orders") return false;
  if (id === undefined) return !payments;
  return orderMissing(id, payments);
}
