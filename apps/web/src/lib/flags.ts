import { supabaseEnabled } from "./supabase/config";

/**
 * Public switches, fixed at build time (NEXT_PUBLIC_*: inlined into the bundle, never secret).
 * Everything that depends on accounts or payments stays off on the live demo deployment.
 */

export type PaymentsMode = "off" | "test" | "live";

/** NEXT_PUBLIC_PAYMENTS as a mode: only "test" or "live", and only with real accounts. */
export function readPaymentsMode(value: string | undefined, accounts: boolean): PaymentsMode {
  return accounts && (value === "test" || value === "live") ? value : "off";
}

/** "test" shows the test-mode banner; "live" only builds with real company data (live-guard.ts). */
export const paymentsMode: PaymentsMode = readPaymentsMode(process.env.NEXT_PUBLIC_PAYMENTS, supabaseEnabled);
/** Service page, checkouts, withdrawal and cancellation forms, contract links and the Pro buy button. */
export const paymentsEnabled: boolean = paymentsMode !== "off";
/** Mounts the payment form when set (phase 2); without it the payment slot says it is not set up. */
export const stripePublishableKey: string = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
/** The homepage's AI tab (it also needs a real recording). */
export const aiTryPublic: boolean = process.env.NEXT_PUBLIC_AI_TRY === "1";

/**
 * Cookie-free page analytics (Stage 3): a server switch, read on each request. Only the exact value
 * "on" turns it on; production has had it on since 2026-11-25 (ADR 0081, "Update"). Unset means
 * creator pages render no beacon island, /api/collect answers 204 and stores nothing, and real-mode
 * Stats keep their "coming soon" state; removing the variable and redeploying switches it off. Never
 * NEXT_PUBLIC_: the browser learns of it only through the island being on the page.
 */
export function analyticsEnabled(): boolean {
  return process.env.LINKYO_ANALYTICS === "on";
}
