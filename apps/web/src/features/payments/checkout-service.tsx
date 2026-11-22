"use client";

import { Button, Icon, Skeleton } from "@linkyo/ui";
import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { useAccount } from "@/features/account/store";
import { clockTime, deadline, longDate } from "@/features/email/templates/render";
import { Link } from "@/i18n/navigation";
import { accessToken } from "@/lib/supabase/access-token";
import { browserSupabase } from "@/lib/supabase/browser";

import { CheckoutSignIn, CheckoutSkeleton, CheckoutSummary, OrderButton, postJson, TermsLine, type CheckoutLocale } from "./checkout-summary";
import { PaymentSlot } from "./payment-slot";
import { formatEuro, PRICES } from "./prices";
import type { ConfirmPayment } from "./stripe-js";

export type ServicePackage = "start" | "premium";

/** Stands in for a value that gets its own element (an order number in <bdi>) while a message is formatted. */
const SLOT = "\u0000";

interface Plan {
  startAt: string;
  dueAt: string;
  briefingBy: string;
}

const isPlan = (value: unknown): value is Plan =>
  typeof value === "object" && value !== null && typeof (value as Plan).dueAt === "string" && typeof (value as Plan).startAt === "string" && typeof (value as Plan).briefingBy === "string";

/**
 * The page-service checkout, phone first in one column, in this order (plan §1.6.2, r3 §11): the
 * title; the payment methods and the payment slot; the unticked early-start box; the § 312j block
 * with the ready date for the box's current state; the warranty and terms links; and the button
 * "Zahlungspflichtig bestellen". Only the terms links stand between the block and the button.
 *
 * On press, the server first fixes the ready date that is on screen (consent route): if it changed
 * meanwhile, the new date replaces it and is announced, and nothing is confirmed.
 */
export function CheckoutService({ pkg }: { pkg: ServicePackage }) {
  const t = useTranslations("checkout");
  const tService = useTranslations("service");
  const tPackage = useTranslations("orders.package");
  const locale = useLocale() as CheckoutLocale;
  const snapshot = useAccount();
  const product = pkg === "premium" ? "service-premium" : "service-start";
  const price = PRICES[product];
  const statusId = useId();
  const earlyId = useId();
  const [early, setEarly] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [session, setSession] = useState<{ sessionId: string; clientSecret: string } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmPayment | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const signedIn = snapshot.status === "signedIn";
  const opened = useRef(false);

  // The ready date for the box's current state (no sign-in needed: it depends only on bookings).
  useEffect(() => {
    let cancelled = false;
    void postJson("/api/checkout/plan", { product, earlyStart: early }, null).then(({ status, data }) => {
      if (!cancelled && status === 200 && isPlan(data)) setPlan(data);
    });
    return () => {
      cancelled = true;
    };
  }, [product, early]);

  // One Checkout Session per visit, once signed in.
  useEffect(() => {
    if (!signedIn || opened.current) return;
    opened.current = true;
    void accessToken().then(async (token) => {
      const { status, data } = await postJson("/api/checkout/service", { product, locale }, token);
      if (status === 200 && typeof data.sessionId === "string" && typeof data.clientSecret === "string") setSession({ sessionId: data.sessionId, clientSecret: data.clientSecret });
    });
  }, [signedIn, product, locale]);

  const onReady = useCallback((next: ConfirmPayment | null) => setConfirm(() => next), []);

  const order = async () => {
    if (!session || !plan || !confirm) return;
    setBusy(true);
    setNotice("");
    try {
      const { status, data } = await postJson("/api/checkout/consent", { sessionId: session.sessionId, earlyStart: early, shownDueAt: plan.dueAt }, await accessToken());
      if (status === 409 && isPlan(data.plan)) {
        const changed = new Date(data.plan.dueAt);
        setPlan(data.plan);
        setNotice(t("dueChanged", { date: longDate(changed, locale), time: clockTime(changed, locale) }));
        return;
      }
      if (status !== 200) {
        setNotice(t("loadFailed"));
        return;
      }
      const result = await confirm();
      if (!result.ok) setNotice(t("loadFailed"));
    } finally {
      setBusy(false);
    }
  };

  const features = (tService.raw(`${pkg}.features`) as string[]).map((feature) => feature.replace(/\*$/, ""));
  const due = plan ? new Date(plan.dueAt) : null;
  const start = plan ? new Date(plan.startAt) : null;

  return (
    <div className="grid grid-cols-1 gap-8">
      <h1 className="text-h1 tracking-tight text-balance">{t("title")}</h1>
      {snapshot.status === "loading" ? (
        <CheckoutSkeleton />
      ) : !signedIn ? (
        <CheckoutSignIn next={`/checkout/service?package=${pkg}`} />
      ) : (
        <>
          <section aria-labelledby="checkout-payment-title" className="grid gap-3">
            <h2 id="checkout-payment-title" className="text-body-lg font-semibold">
              {t("payment")}
            </h2>
            <p className="text-small text-fg-secondary">{t("methods.service")}</p>
            <PaymentSlot clientSecret={session?.clientSecret ?? null} statusId={statusId} onReady={onReady} />
          </section>

          <div className="grid gap-2">
            <label htmlFor={earlyId} className="flex cursor-pointer items-start gap-3 rounded-lg border border-line-strong bg-surface p-4 has-[:focus-visible]:focus-ring">
              <input id={earlyId} type="checkbox" checked={early} onChange={(event) => setEarly(event.target.checked)} className="mt-0.5 size-icon-md shrink-0 cursor-pointer accent-primary" />
              <span className="text-body text-pretty">{t("early.label")}</span>
            </label>
            {!early && start ? <p className="px-1 text-small text-pretty text-fg-secondary">{t("early.without", { date: longDate(start, locale) })}</p> : null}
          </div>

          <CheckoutSummary line={t("service.line", { package: tPackage(pkg) })} features={features} amountCents={price.amountCents}>
            {due && start && plan ? (
              <p data-due-line className="font-medium">
                {early
                  ? t("due", { date: longDate(due, locale), time: clockTime(due, locale), briefingBy: deadline(new Date(plan.briefingBy), locale) })
                  : t("dueLate", { start: longDate(start, locale), date: longDate(due, locale), time: clockTime(due, locale) })}
              </p>
            ) : (
              <Skeleton className="h-6 w-3/4" />
            )}
          </CheckoutSummary>

          <TermsLine />
          <div className="grid gap-3">
            <OrderButton disabled={!confirm || !plan || !session} busy={busy} describedBy={statusId} onPress={() => void order()} />
            <p role="status" className="text-small font-medium empty:hidden">
              {notice}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

interface DoneOrder {
  id: string;
  number: string;
  package: ServicePackage;
  amountCents: number;
  dueAt: string;
}

/**
 * After Stripe's return: waits (up to 20 s) until the webhook has created the session's order, then
 * shows its number, price and ready date and the next step, the briefing. Pro: a short thank you.
 */
export function CheckoutDone({ sessionId, pro }: { sessionId: string | null; pro: boolean }) {
  const t = useTranslations("checkout.done");
  const tPackage = useTranslations("orders.package");
  const locale = useLocale() as CheckoutLocale;
  const snapshot = useAccount();
  const [order, setOrder] = useState<DoneOrder | null>(null);
  const signedIn = snapshot.status === "signedIn";

  useEffect(() => {
    if (!signedIn || pro || !sessionId) return;
    let cancelled = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const look = async () => {
      // Row-level security shows the account only its own orders.
      const { data } = await browserSupabase().from("orders").select("id, number, package, amount_cents, promised_due_at, due_at").eq("stripe_session_id", sessionId).maybeSingle();
      if (cancelled) return;
      if (data) {
        setOrder({ id: data.id, number: data.number, package: data.package, amountCents: data.amount_cents, dueAt: data.due_at ?? data.promised_due_at });
        return;
      }
      tries += 1;
      if (tries < 20) timer = setTimeout(() => void look(), 1000);
    };
    void look();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [signedIn, pro, sessionId]);

  if (snapshot.status === "loading") return <CheckoutSkeleton />;
  if (!signedIn) return <CheckoutSignIn next="/app" />;
  if (pro) {
    return (
      <div className="grid gap-6">
        <h1 className="text-h1 tracking-tight text-balance">{t("pro")}</h1>
        <Button asChild variant="primary" size="cta" className="group justify-self-start">
          <Link href="/app">
            <AppLabel />
            <Icon icon={ArrowRight} size="md" className="rtl:-scale-x-100" />
          </Link>
        </Button>
      </div>
    );
  }
  if (!order) {
    return (
      <div className="grid gap-4">
        <h1 className="text-h1 tracking-tight text-balance">{t("title")}</h1>
        <p role="status" className="text-body text-fg-secondary">
          {t("pending")}
        </p>
      </div>
    );
  }
  const due = new Date(order.dueAt);
  // The order number keeps its own direction inside an Arabic sentence.
  const [before = "", after = ""] = t("line", { number: SLOT, package: tPackage(order.package), price: formatEuro(order.amountCents, locale) }).split(SLOT);
  return (
    <div className="grid gap-6">
      <h1 className="text-h1 tracking-tight text-balance">{t("title")}</h1>
      <div className="grid gap-2 rounded-xl border border-line bg-surface-elevated p-5 md:p-6">
        <p className="text-body-lg font-semibold" data-order-line>
          {before}
          <bdi dir="ltr">{order.number}</bdi>
          {after}
        </p>
        <p className="text-body">{t("due", { date: longDate(due, locale), time: clockTime(due, locale) })}</p>
      </div>
      <p className="text-body text-pretty text-fg-secondary">{t("next")}</p>
      <Button asChild variant="primary" size="cta" className="group justify-self-start">
        <Link href={`/app/orders/${order.id}`}>
          {t("briefing")}
          <Icon icon={ArrowRight} size="md" className="rtl:-scale-x-100" />
        </Link>
      </Button>
    </div>
  );
}

/** "Zum Dashboard" (the same words as on the already-Pro screen). */
function AppLabel() {
  const t = useTranslations("checkout.alreadyPro");
  return <>{t("cta")}</>;
}
