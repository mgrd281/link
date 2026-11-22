"use client";

import { useEffect, useRef } from "react";

/**
 * Stripe.js, loaded by a script tag from js.stripe.com (no npm package), only on the checkout pages
 * and only once a publishable key is set (phase 2). This is the only file that names the host (the
 * static guard enforces it), so no other page can load it by accident. It mounts the Payment Element
 * of a Checkout Session created with `ui_mode: "elements"` and hands back `confirm`, which the
 * page's own "Zahlungspflichtig bestellen" button calls (r3 §8.1; the exact Stripe.js calls are
 * verified against a Stripe test account in phase 2).
 */

const SRC = "https://js.stripe.com/v3/";

interface StripeElement {
  mount(target: HTMLElement): void;
  destroy?(): void;
  on?(event: "ready", handler: () => void): void;
}

interface StripeCheckout {
  createPaymentElement(): StripeElement;
  confirm(): Promise<{ type: "success" } | { type: "error"; error?: { message?: string } }>;
}

interface StripeInstance {
  initCheckout(options: { clientSecret: string }): Promise<StripeCheckout> | StripeCheckout;
}

type StripeFactory = (publishableKey: string) => StripeInstance;

let loading: Promise<StripeFactory> | null = null;

function loadStripeJs(): Promise<StripeFactory> {
  loading ??= new Promise<StripeFactory>((resolve, reject) => {
    const ready = () => {
      const factory = (window as unknown as { Stripe?: StripeFactory }).Stripe;
      if (factory) resolve(factory);
      else reject(new Error("Stripe.js did not load"));
    };
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
    if (existing) {
      if ((window as unknown as { Stripe?: unknown }).Stripe) ready();
      else existing.addEventListener("load", ready, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = SRC;
    script.async = true;
    script.addEventListener("load", ready, { once: true });
    script.addEventListener("error", () => reject(new Error("Stripe.js did not load")), { once: true });
    document.head.append(script);
  });
  return loading;
}

export type ConfirmPayment = () => Promise<{ ok: boolean }>;

export function StripePaymentElement({
  publishableKey,
  clientSecret,
  onReady,
  onError,
}: {
  publishableKey: string;
  clientSecret: string;
  onReady: (confirm: ConfirmPayment) => void;
  onError: () => void;
}) {
  const target = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let element: StripeElement | null = null;
    loadStripeJs()
      .then(async (Stripe) => {
        const checkout = await Stripe(publishableKey).initCheckout({ clientSecret });
        if (cancelled || !target.current) return;
        element = checkout.createPaymentElement();
        element.mount(target.current);
        const confirm: ConfirmPayment = async () => ({ ok: (await checkout.confirm()).type === "success" });
        if (element.on) element.on("ready", () => onReady(confirm));
        else onReady(confirm);
      })
      .catch(() => {
        if (!cancelled) onError();
      });
    return () => {
      cancelled = true;
      element?.destroy?.();
    };
  }, [publishableKey, clientSecret, onReady, onError]);
  return <div ref={target} className="min-h-control-xl" />;
}
