"use client";

import { accessToken } from "@/lib/supabase/access-token";
import { supabaseEnabled } from "@/lib/supabase/config";
import { browserSupabase } from "@/lib/supabase/browser";

import { missingFunction, sendBilling, type BillingAnswer, type BillingDeps } from "./billing";
import { sendCustomerStatus, type Statement, type StatusAnswer } from "./customer-status";
import type { AccountStatus, Customer } from "./customers/model";
import { overrides, type CustomerPatch } from "./customers/overrides";
import { refreshLive } from "./live";
import { useAdmin } from "./session";
import { adminStore } from "./store";
import type { ActivityEvent, Member, Role } from "./types";

/**
 * Every console action in one place. Demo: the change is kept in this browser and logged there.
 * Real accounts: a team-only database function checks the permission, makes the change and writes
 * the activity log; then the console reloads. Money (refunds, a Stripe subscription) goes through
 * our server and Stripe instead (`billing.ts`). Each action answers whether it worked.
 */
export type SubscriptionAction = "plan" | "trial" | "cancel" | "resume";

const billingDeps: BillingDeps = { token: accessToken, send: (path, init) => fetch(path, init) };

const ok = async (call: PromiseLike<{ error: unknown }>): Promise<boolean> => {
  const { error } = await call;
  if (error) return false;
  await refreshLive();
  return true;
};

export function useConsoleActions() {
  const { me, db } = useAdmin();
  const record = (action: ActivityEvent["action"], target: string) => adminStore.record(me.email, action, target);
  const supabase = () => browserSupabase();

  return {
    /**
     * Plan, trial, cancel or resume by hand: `patch` says what changes, the rest stays as it is. Only
     * for Pro the team gives (no money); a Stripe subscription changes through `stripeSubscription`.
     */
    async subscription(customer: Customer, action: SubscriptionAction, patch: CustomerPatch): Promise<boolean> {
      if (!supabaseEnabled) {
        overrides.patch(customer.id, patch);
        record(`customer.${action}`, customer.username);
        return true;
      }
      const sub = customer.subscription;
      const plan = patch.plan ?? sub.plan;
      const status = patch.subscriptionStatus !== undefined ? patch.subscriptionStatus : sub.status;
      const canceledAt = patch.canceledAt === null ? undefined : (patch.canceledAt ?? sub.canceledAt);
      const startedAt = patch.startedAt ?? sub.startedAt;
      const trialEndsAt = patch.trialEndsAt ?? sub.trialEndsAt;
      return ok(
        supabase().rpc("admin_set_subscription", {
          customer: customer.id,
          action,
          plan,
          // Free plans have no status (the database insists); unset dates stay empty.
          ...(plan !== "free" && status ? { status } : {}),
          ...(startedAt ? { started_at: startedAt } : {}),
          ...(trialEndsAt ? { trial_ends_at: trialEndsAt } : {}),
          ...(canceledAt ? { canceled_at: canceledAt } : {}),
        }),
      );
    },

    /**
     * Refunds a paid invoice. Real accounts: through our server and Stripe (never a database-only
     * "refunded"); the answer says "ok" only once Stripe refunded and it is on record. Demo: in this browser.
     */
    async refund(customer: Customer, invoice: string): Promise<BillingAnswer> {
      if (!supabaseEnabled) {
        const refunded = customer.subscription.invoices.filter((entry) => entry.status === "refunded").map((entry) => entry.id);
        overrides.patch(customer.id, { refunded: [...refunded, invoice] });
        record("customer.refund", customer.username);
        return { ok: true, mailed: false };
      }
      const answer = await sendBilling(customer.id, "refund", { invoice }, billingDeps);
      // A refund Stripe made but we could not record yet shows as soon as it is on record.
      await refreshLive();
      return answer;
    },

    /** Cancels a Stripe subscription at the end of its paid period, or takes that back (real accounts only). */
    async stripeSubscription(customer: Customer, action: "cancel" | "resume"): Promise<BillingAnswer> {
      if (!supabaseEnabled) return { ok: false, error: "paymentsOff" };
      const answer = await sendBilling(customer.id, action, {}, billingDeps);
      await refreshLive();
      return answer;
    },

    /**
     * Logs a CSV export of the customer list (`customer.export`, with the row count) before the file
     * is made. A database without the export function yet: the export works as before, unlogged.
     */
    async exported(rows: number): Promise<boolean> {
      if (!supabaseEnabled) return true;
      const { error } = await supabase().rpc("admin_customers_exported", { row_count: rows });
      if (!error) return true;
      return missingFunction(error);
    },

    /**
     * Suspends (with the statement of reasons: what the customer reads, and the ground) or lets an
     * account back in. Demo: in this browser, nothing is sent.
     */
    async status(customer: Customer, next: AccountStatus, statement: Statement | null = null): Promise<StatusAnswer> {
      if (!supabaseEnabled) {
        overrides.patch(customer.id, { status: next });
        record(next === "suspended" ? "customer.suspend" : "customer.unsuspend", customer.username);
        return { ok: true, recorded: true, mailed: false };
      }
      // Through our server, which runs the team function as this member and then drops the cached
      // public page: a suspended page must not be served from the cache once more.
      const answer = await sendCustomerStatus(customer.id, next, statement);
      if (answer.ok) await refreshLive();
      return answer;
    },

    async verified(customer: Customer, value: boolean): Promise<boolean> {
      if (!supabaseEnabled) {
        overrides.patch(customer.id, { verified: value });
        record(value ? "customer.verify" : "customer.unverify", customer.username);
        return true;
      }
      return ok(supabase().rpc("admin_set_verified", { customer: customer.id, value }));
    },

    /** Signs devices out (their open sessions end; the next request asks them to sign in again). */
    async signOut(customer: Customer, deviceIds: string[], alreadySignedOut: readonly string[]): Promise<boolean> {
      if (!supabaseEnabled) {
        overrides.patch(customer.id, { signedOut: [...new Set([...alreadySignedOut, ...deviceIds])] });
        record("customer.signout", customer.username);
        return true;
      }
      const results = await Promise.all(deviceIds.map((device) => supabase().rpc("admin_sign_out_device", { customer: customer.id, device })));
      await refreshLive();
      return results.every((result) => !result.error);
    },

    async note(customer: Customer, text: string): Promise<boolean> {
      if (!supabaseEnabled) {
        overrides.addNote(customer.id, { id: crypto.randomUUID(), at: new Date().toISOString(), author: me.name, text });
        record("customer.note", customer.username);
        return true;
      }
      return ok(supabase().rpc("admin_add_note", { customer: customer.id, body: text }));
    },

    async blockIp(ip: string, reason: string): Promise<boolean> {
      if (!supabaseEnabled) {
        overrides.blockIp({ ip, at: new Date().toISOString(), by: me.email, reason });
        record("ip.block", ip);
        return true;
      }
      return ok(supabase().rpc("admin_block_ip", { address: ip, why: reason }));
    },

    async unblockIp(ip: string): Promise<boolean> {
      if (!supabaseEnabled) {
        overrides.unblockIp(ip);
        record("ip.unblock", ip);
        return true;
      }
      return ok(supabase().rpc("admin_unblock_ip", { address: ip }));
    },

    async remove(customer: Customer): Promise<boolean> {
      if (!supabaseEnabled) {
        overrides.patch(customer.id, { deleted: true });
        record("customer.delete", customer.username);
        return true;
      }
      // Our server deletes the account as this team member (the database checks the permission),
      // then removes the customer's files from Storage.
      const token = await accessToken();
      if (!token) return false;
      try {
        const response = await fetch(`/api/admin/customers/${encodeURIComponent(customer.id)}/delete`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) return false;
      } catch {
        return false;
      }
      await refreshLive();
      return true;
    },

    /** Real accounts: the person must have signed up already ("notFound" otherwise). */
    async addMember(member: Omit<Member, "addedAt">): Promise<true | "notFound" | false> {
      if (!supabaseEnabled) return adminStore.addMember(me.email, member);
      const { error } = await supabase().rpc("admin_add_member", { member_email: member.email, member_role: member.role });
      if (error) return error.message.includes("notFound") ? "notFound" : false;
      await refreshLive();
      return true;
    },

    async setRole(email: string, role: Role): Promise<boolean> {
      if (!supabaseEnabled) return adminStore.setRole(me.email, email, role);
      const member = liveId(db.members, email);
      return member ? ok(supabase().rpc("admin_set_role", { member, member_role: role })) : false;
    },

    async removeMember(email: string): Promise<boolean> {
      if (!supabaseEnabled) return adminStore.removeMember(me.email, email);
      const member = liveId(db.members, email);
      return member ? ok(supabase().rpc("admin_remove_member", { member })) : false;
    },
  };
}

const liveId = (members: readonly Member[], email: string) =>
  (members.find((member) => member.email === email) as (Member & { id?: string }) | undefined)?.id;
