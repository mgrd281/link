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
