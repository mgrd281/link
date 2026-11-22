import { z } from "zod";

import { deliveryPlan } from "@/features/payments/delivery";
import { json, paymentsOff, readJson, serviceBooking } from "@/features/payments/server/get-payments";

export const runtime = "nodejs";

const body = z.object({ product: z.enum(["service-start", "service-premium"]), earlyStart: z.boolean() });

/**
 * The ready date the checkout shows above the order button, for the early-start box's current state.
 * No sign-in and no personal data: only the days' bookings decide it. The consent route computes it
 * again when the order is placed.
 */
export async function POST(request: Request) {
  const off = paymentsOff();
  if (off) return off;
  const parsed = body.safeParse(await readJson(request));
  if (!parsed.success) return json({ ok: false, error: "invalid" }, 400);
  const now = new Date();
  const { capacity, booked } = await serviceBooking(now);
  const plan = deliveryPlan({ from: now, earlyStart: parsed.data.earlyStart, capacity, booked });
  return json({ startAt: plan.startAt.toISOString(), dueAt: plan.dueAt.toISOString(), briefingBy: plan.briefingBy.toISOString() });
}
