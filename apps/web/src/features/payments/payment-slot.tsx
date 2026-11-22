"use client";

import { Icon, Skeleton } from "@linkyo/ui";
import { CircleAlert, CreditCard } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { stripePublishableKey } from "@/lib/flags";

import { StripePaymentElement, type ConfirmPayment } from "./stripe-js";

/**
 * Where the payment form goes. Without a publishable key (phase 1) it says plainly that payment in
 * test mode is not set up yet, and the order button stays disabled, described by this box. With a key
 * it mounts Stripe's Payment Element for the session and reports `confirm` once the form is ready.
 */
export function PaymentSlot({
  clientSecret,
  statusId,
  onReady,
}: {
  /** The Checkout Session's client secret; null while it is created (or when that failed). */
  clientSecret: string | null;
  /** The id of the box that explains why the button is disabled. */
  statusId: string;
  onReady: (confirm: ConfirmPayment | null) => void;
}) {
  const t = useTranslations("checkout");
  const [failed, setFailed] = useState(false);
  const fail = useCallback(() => {
    setFailed(true);
    onReady(null);
  }, [onReady]);

  if (!stripePublishableKey) {
    return (
      <div id={statusId} role="status" className="grid gap-1 rounded-lg border border-line-strong bg-surface p-4">
        <p className="flex items-center gap-2 text-body font-semibold">
          <Icon icon={CreditCard} size="md" className="shrink-0 text-fg-secondary" />
          {t("notSetUp.title")}
        </p>
        <p className="text-small text-pretty text-fg-secondary">{t("notSetUp.body")}</p>
      </div>
    );
  }
  if (failed) {
    return (
      <p id={statusId} role="alert" className="flex items-start gap-2 rounded-lg border border-line-strong bg-surface p-4 text-body">
        <Icon icon={CircleAlert} size="md" className="mt-0.5 shrink-0 text-danger-strong" />
        {t("loadFailed")}
      </p>
    );
  }
  if (!clientSecret) return <Skeleton id={statusId} className="h-32 rounded-lg" />;
  return <StripePaymentElement publishableKey={stripePublishableKey} clientSecret={clientSecret} onReady={onReady} onError={fail} />;
}
