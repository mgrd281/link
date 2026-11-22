import { getEmailSender } from "@/features/email/send";
import { paymentsEnabled, paymentsMode } from "@/lib/flags";
import { siteUrl } from "@/lib/site-url";
import { serviceSupabase } from "@/lib/supabase/server";

import { berlinDay } from "../delivery";
import type { Payments } from "../types";

import { loadEmailTranslator, supabaseContractsDb, type ContractsDeps } from "./contracts";
import { StripePayments, stripeSettingsFromEnv } from "./stripe-payments";

/**
 * The payment provider for this server, or `PaymentsNotConfigured` (no STRIPE_SECRET_KEY): routes
 * answer 503 `notConfigured` then, and the webhook answers 404. One client per server instance.
 */
let cached: { key: string; payments: Payments } | null = null;

export function getPayments(env: Record<string, string | undefined> = process.env): Payments {
  const settings = stripeSettingsFromEnv(env);
  const key = [settings.secretKey, settings.webhookSecret, settings.host ?? "", String(settings.port ?? ""), settings.protocol ?? ""].join("|");
  if (cached?.key !== key) cached = { key, payments: new StripePayments(settings) };
  return cached.payments;
}

// ─── Shared by the payment and contract routes ──────────────────────────────────────────────

const NO_STORE = { "Cache-Control": "no-store" } as const;

export const json = (body: object, status = 200): Response => Response.json(body, { status, headers: NO_STORE });

/** Every payment and contract route exists only where contracts can be made (NEXT_PUBLIC_PAYMENTS). */
export const paymentsOff = (): Response | null => (paymentsEnabled ? null : json({ ok: false, error: "notFound" }, 404));

/** A JSON body, or null when it is not JSON. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

/** The website's origin for links we send (return URLs, e-mails): from configuration, never from the request. */
export const siteOrigin = (): string => siteUrl().origin;

/** Orders already due per Berlin day, for the next 30 days (optionally without one order). */
export async function serviceBooking(now: Date, exclude?: string): Promise<{ capacity: number; booked: Map<string, number> }> {
  const db = serviceSupabase();
  const [capacity, load] = await Promise.all([
    db.rpc("service_capacity"),
    db.rpc("service_load", { from_day: berlinDay(now), days: 30, ...(exclude ? { exclude } : {}) }),
  ]);
  if (capacity.error) throw new Error(`service_capacity: ${capacity.error.message}`);
  if (load.error) throw new Error(`service_load: ${load.error.message}`);
  return { capacity: capacity.data, booked: new Map(load.data.map((row) => [row.day, row.booked])) };
}

/** The contract forms' dependencies on this server (service client, Stripe when set up, the e-mail sender). */
export function contractsDeps(): ContractsDeps {
  return {
    db: supabaseContractsDb(serviceSupabase()),
    payments: () => getPayments(),
    send: (message) => getEmailSender().send(message),
    translator: loadEmailTranslator,
  };
}

/** Test-mode builds mark every e-mail they send about money. */
export const testMode = paymentsMode === "test";
