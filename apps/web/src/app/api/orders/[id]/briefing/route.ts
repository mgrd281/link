import { z } from "zod";

import { dueOnBriefing } from "@/features/payments/delivery";
import { json, paymentsOff, readJson, serviceBooking } from "@/features/payments/server/get-payments";
import { requireUser } from "@/lib/server/user";
import { toJson } from "@/lib/supabase/json";
import { serviceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const body = z.object({
  links: z.array(z.string().trim().min(1).max(500)).max(20),
  photos: z.array(z.string().min(1).max(300)).max(10),
  wishes: z.string().trim().max(2000),
  pageLocale: z.enum(["de", "en", "ar"]),
});

/**
 * The customer's briefing. On time (by 12:00 of the working day before the promised date) it keeps
 * the promised date, the one the order confirmation named, even when that day has filled up since;
 * a late briefing gets the next free working day, without counting the order itself. Photos must lie
 * in the account's own folder of this order in the private `briefing` bucket.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const off = paymentsOff();
  if (off) return off;
  const signedIn = await requireUser(request);
  if (signedIn instanceof Response) return signedIn;
  const { id } = await params;
  if (!UUID.test(id)) return json({ ok: false, error: "notFound" }, 404);
  const parsed = body.safeParse(await readJson(request));
  if (!parsed.success) return json({ ok: false, error: "invalid" }, 400);
  const folder = `${signedIn.user.id}/${id}/`;
  if (parsed.data.photos.some((path) => !path.startsWith(folder) || path.includes(".."))) return json({ ok: false, error: "invalid" }, 400);

  const db = serviceSupabase();
  const order = await db.from("orders").select("profile_id, promised_due_at, start_after").eq("id", id).maybeSingle();
  if (order.error) return json({ ok: false, error: "server" }, 500);
  if (order.data?.profile_id !== signedIn.user.id) return json({ ok: false, error: "notFound" }, 404);

  const now = new Date();
  const { capacity, booked } = await serviceBooking(now, id);
  const due = dueOnBriefing({ now, promisedDue: new Date(order.data.promised_due_at), startAfter: new Date(order.data.start_after), capacity, bookedWithoutThis: booked });
  const { data, error } = await db.rpc("set_order_briefing", { target: id, account: signedIn.user.id, briefing: toJson(parsed.data), due: due.toISOString() });
  if (error) return json({ ok: false, error: "server" }, 500);
  if (data === "notFound") return json({ ok: false, error: "notFound" }, 404);
  if (data !== "ok") return json({ ok: false, error: "locked" }, 409);
  return json({ ok: true, dueAt: due.toISOString() });
}
