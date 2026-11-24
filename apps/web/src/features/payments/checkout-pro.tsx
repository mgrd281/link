"use client";

import { Button, Icon } from "@linkyo/ui";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { useAccount } from "@/features/account/store";
import { Link } from "@/i18n/navigation";
import { accessToken } from "@/lib/supabase/access-token";

import { paymentFailedText } from "./checkout-state";
import { CheckoutSignIn, CheckoutSkeleton, CheckoutSummary, OrderButton, OrderFailure, postJson, TermsLine, vatText, type CheckoutLocale } from "./checkout-summary";
import { billingDay } from "./delivery";
import { PaymentSlot } from "./payment-slot";
import { formatEuro, PRICES, PRO_DRAFTS } from "./prices";
import type { ConfirmPayment } from "./stripe-js";

/**
 * The Pro checkout: the same order as the service checkout, without the early-start box (the § 312j
 * block names the monthly price, the first charge today and the billing day, and the term). An
 * account that already has Pro (bought, team-set or "Pro für immer") sees that instead, and no
 * payment slot or button: a second subscription would add nothing.
 */
export function CheckoutPro() {
  const t = useTranslations("checkout");
  const locale = useLocale() as CheckoutLocale;
  const snapshot = useAccount();
  const statusId = useId();
  const signedIn = snapshot.status === "signedIn";
  const [state, setState] = useState<"opening" | "open" | "alreadyPro" | "failed">("opening");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmPayment | null>(null);
  const [busy, setBusy] = useState(false);
  // Why the order did not go through (a declined payment, an order that could not be placed).
  const [failure, setFailure] = useState("");
  const opened = useRef(false);
  const price = PRICES["pro-monthly"].amountCents;

  useEffect(() => {
    if (!signedIn || opened.current) return;
    opened.current = true;
    void accessToken()
      .then(async (token) => {
        const { status, data } = await postJson("/api/checkout/pro", { locale }, token);
        if (status === 409 && data.error === "alreadyPro") setState("alreadyPro");
        else if (status === 200 && typeof data.clientSecret === "string") {
          setClientSecret(data.clientSecret);
          setState("open");
        } else setState("failed");
      })
      // Unreachable server: the payment slot says so (as for any session that could not be created).
      .catch(() => setState("failed"));
  }, [signedIn, locale]);

  const onReady = useCallback((next: ConfirmPayment | null) => setConfirm(() => next), []);

  const order = async () => {
    if (!confirm) return;
    setBusy(true);
    setFailure("");
    try {
      const result = await confirm();
      // A decline or a cancelled confirmation: the provider's own reason, else that the payment failed.
      if (!result.ok) setFailure(paymentFailedText(result, t("payFailed")));
    } finally {
      setBusy(false);
    }
  };

  // The first charge is today, so today's Berlin day of the month is the billing day.
  const anchor = billingDay(new Date());

  return (
    <div className="grid grid-cols-1 gap-8">
      {state === "alreadyPro" ? (
        <div className="grid gap-4">
          <span aria-hidden className="grid size-control-xl place-items-center rounded-full bg-tinted text-tinted-fg">
            <Icon icon={BadgeCheck} size="lg" />
          </span>
          <h1 className="text-h1 tracking-tight text-balance">{t("alreadyPro.title")}</h1>
          <p className="text-body-lg text-pretty text-fg-secondary">{t("alreadyPro.body")}</p>
          <Button asChild variant="primary" size="cta" className="group justify-self-start">
            <Link href="/app">
              {t("alreadyPro.cta")}
              <Icon icon={ArrowRight} size="md" />
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <h1 className="text-h1 tracking-tight text-balance">{t("title")}</h1>
          {snapshot.status === "loading" || (signedIn && state === "opening") ? (
            <CheckoutSkeleton />
          ) : !signedIn ? (
            <CheckoutSignIn next="/checkout/pro" />
          ) : (
            <>
              <section aria-labelledby="checkout-payment-title" className="grid gap-3">
                <h2 id="checkout-payment-title" className="text-body-lg font-semibold">
                  {t("payment")}
                </h2>
                <p className="text-small text-fg-secondary">{t("methods.pro")}</p>
                <PaymentSlot clientSecret={clientSecret} failed={state === "failed"} statusId={statusId} onReady={onReady} />
              </section>

              <CheckoutSummary line={t("pro.line")} features={[t("pro.includes", { count: PRO_DRAFTS })]} amountCents={price}>
                <p className="font-medium">
                  {t("pro.price", { price: formatEuro(price, locale), vat: vatText(t, price, locale), day: anchor.day, short: anchor.shortMonths ? "yes" : "no" })}
                </p>
                <p className="text-small text-pretty text-fg-secondary">{t("pro.term")}</p>
              </CheckoutSummary>

              <TermsLine />
              <div className="grid gap-3">
                <OrderButton disabled={!confirm || state !== "open"} busy={busy} describedBy={statusId} onPress={() => void order()} />
                <OrderFailure text={failure} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
