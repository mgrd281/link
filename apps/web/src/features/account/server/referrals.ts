import { isReferralCode } from "@/features/referrals/rules";
import type { Db } from "@/lib/supabase/server";

/** An invite-link code as a browser sent it (any case), or undefined for anything else. */
export function cleanRef(value: string | null | undefined): string | undefined {
  const ref = value?.trim().toLowerCase();
  return ref && isReferralCode(ref) ? ref : undefined;
}

/**
 * Decides a pending invite right after the invited person's sign-in was logged: the database runs the
 * abuse checks on the security log it now has (supabase/migrations/…_referrals.sql, ADR 0064). `ref`
 * is the invite code the confirming browser carries (the sign-up page's `?ref=`, or the one in the
 * emailed link). Without the code the pending invite was made with, the database drops the invite, so
 * nobody attaches their code to someone else's account by asking for a sign-up code first. For
 * everyone who is not a pending invitee this is one indexed lookup. Never throws and never fails a
 * sign-in: anything missed is handled by the hourly job.
 */
export async function settleReferral(service: Db, userId: string, ref: string | undefined): Promise<void> {
  try {
    const { error } = await service.rpc("settle_referral", { invitee: userId, ...(ref ? { ref } : {}) });
    if (error) console.error("settle_referral failed", error.message);
  } catch (error) {
    console.error("settle_referral failed", error instanceof Error ? error.message : error);
  }
}
