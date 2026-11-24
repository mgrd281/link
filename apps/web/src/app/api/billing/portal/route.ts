import { z } from "zod";

import { getPayments, json, paymentsOff, readJson, siteOrigin } from "@/features/payments/server/get-payments";
import { StripePayments, stripeSettingsFromEnv } from "@/features/payments/server/stripe-payments";
import { PaymentsNotConfigured } from "@/features/payments/types";
import { requireUser } from "@/lib/server/user";

export const runtime = "nodejs";

const body = z.object({ locale: z.enum(["de", "en", "ar"]).default("de") });

/** Stripe's portal speaks German and English; it has no Arabic, so it follows the browser there. */
const PORTAL_LOCALE = { de: "de", en: "en", ar: "auto" } as const;

/** What Postgres and PostgREST answer for a table this database does not have (yet). */
const MISSING_TABLE = new Set(["42P01", "PGRST205"]);

/**
 * Where the portal may send the owner: Stripe's own pages over https, or, in tests only, the local
 * Stripe stand-in the client is pointed at (a loopback host, never on Vercel: stripeSettingsFromEnv).
 */
function portalUrlAllowed(address: string, env: Record<string, string | undefined> = process.env): boolean {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return false;
  }
  if (url.protocol === "https:" && (url.hostname === "stripe.com" || url.hostname.endsWith(".stripe.com"))) return true;
  const { host } = stripeSettingsFromEnv(env);
  return Boolean(host) && (url.protocol === "http:" || url.protocol === "https:") && url.hostname === host;
}

/**
 * A Stripe customer portal session for this customer. The Payments interface has no portal call
 * yet and features/payments is not changed here, so this reaches the one configured Stripe client
 * (same key, API version, retries and test host) instead of building a second one.
 */
async function createPortalSession(customer: string, returnUrl: string, locale: keyof typeof PORTAL_LOCALE): Promise<string> {
  const payments = getPayments();
  if (!(payments instanceof StripePayments)) throw new PaymentsNotConfigured("no Stripe client");
  // eslint-disable-next-line @typescript-eslint/dot-notation -- the client is private to StripePayments; see above
  const session = await payments["stripe"].billingPortal.sessions.create({ customer, return_url: returnUrl, locale: PORTAL_LOCALE[locale] });
  return session.url;
}

/**
 * Opens Stripe's customer portal for the signed-in owner: payment method, invoices and receipts
 * live there. Only where contracts can be made (payments test or live; 404 otherwise, like every
 * payment route). The customer comes from the owner's own Stripe entitlement, read under row-level
 * security as the owner: never from the request. 409 `noCustomer` while Stripe does not know the
 * account (it never bought Pro), 409 `unavailable` on a database without the billing tables.
 */
export async function POST(request: Request) {
  const off = paymentsOff();
  if (off) return off;
  const signedIn = await requireUser(request);
  if (signedIn instanceof Response) return signedIn;
  const parsed = body.safeParse((await readJson(request)) ?? {});
  if (!parsed.success) return json({ ok: false, error: "invalid" }, 400);
  const { locale } = parsed.data;

  const { data, error } = await signedIn.db
    .from("entitlements")
    .select("stripe_customer_id")
    .eq("profile_id", signedIn.user.id)
    .eq("source", "stripe")
    .not("stripe_customer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return MISSING_TABLE.has(error.code) ? json({ ok: false, error: "unavailable" }, 409) : json({ ok: false, error: "server" }, 500);
  const customer = data?.stripe_customer_id ?? null;
  if (!customer) return json({ ok: false, error: "noCustomer" }, 409);

  try {
    const url = await createPortalSession(customer, `${siteOrigin()}/${locale}/app/settings/plan`, locale);
    if (!portalUrlAllowed(url)) {
      console.error(JSON.stringify({ evt: "portal_url_refused" }));
      return json({ ok: false, error: "server" }, 502);
    }
    return json({ url });
  } catch (problem) {
    if (problem instanceof PaymentsNotConfigured) return json({ ok: false, error: "notConfigured" }, 503);
    console.error(JSON.stringify({ evt: "portal_failed", error: problem instanceof Error ? problem.message : String(problem) }));
    return json({ ok: false, error: "server" }, 502);
  }
}
