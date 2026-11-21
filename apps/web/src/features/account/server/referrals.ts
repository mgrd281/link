import type { Db } from "@/lib/supabase/server";

/**
 * Decides a pending invite right after the invited person's sign-in was logged: the database runs the
 * abuse checks on the security log it now has (supabase/migrations/…_referrals.sql, ADR 0064). For
 * everyone who is not a pending invitee this is one indexed lookup. Never throws and never fails a
 * sign-in: anything missed is settled by the hourly job.
 */
export async function settleReferral(service: Db, userId: string): Promise<void> {
  try {
    const { error } = await service.rpc("settle_referral", { invitee: userId });
    if (error) console.error("settle_referral failed", error.message);
  } catch (error) {
    console.error("settle_referral failed", error instanceof Error ? error.message : error);
  }
}
