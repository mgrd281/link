"use client";

import { useEffect, useRef } from "react";

import { isCheckoutPath, leavesCheckout, paymentResult, type PaymentResult } from "./checkout-state";

/**
 * Stripe.js, loaded by a script tag from js.stripe.com (no npm package), only on the checkout pages
 * and only once a publishable key is set (phase 2). This is the only file that names the host (the
 * static guard enforces it), so no other page can load it by accident. It mounts the Payment Element
 * of a Checkout Session created with `ui_mode: "elements"` and hands back `confirm`, which the
 * page's own "Zahlungspflichtig bestellen" button calls (r3 §8.1; the exact Stripe.js calls are
 * verified against a Stripe test account in phase 2).
 *
 * A script cannot be unloaded: once it is in the document it stays (with its frames and signals)
 * through every in-app navigation. So `StripeLeaveGuard` makes leaving the checkout a full page load.
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

/** Whether this document holds Stripe.js (its script tag was added, here or before a client navigation). */
function stripeInDocument(): boolean {
  return document.querySelector(`script[src="${SRC}"]`) !== null;
}

/** Confirms the payment; a failure carries Stripe's own reason for the customer when there is one. */
export type ConfirmPayment = () => Promise<PaymentResult>;

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
        // A decline, a cancelled 3-D Secure step or a network error: not paid, with Stripe's reason.
        const confirm: ConfirmPayment = async () => {
          try {
            return paymentResult(await checkout.confirm());
          } catch {
            return paymentResult(null);
          }
        };
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

/**
 * Keeps Stripe.js on the checkout pages only (mounted once, in the checkout layout). It does nothing
 * until the script is in the document. From then on:
 *
 * - a click on a link to another page of this site is left to the browser (the router never sees
 *   it), so the next page is a fresh document without the script;
 * - any other way out (the back button, a redirect by the app) reloads the page that was reached.
 *
 * Links to other sites and within the checkout are untouched.
 */
export function StripeLeaveGuard() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!stripeInDocument() || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || (link.target !== "" && link.target !== "_self") || link.hasAttribute("download")) return;
      // Caught on the document before React's own listener: the router's click handler never runs
      // and the browser follows the link itself.
      if (leavesCheckout(link.href, window.location.href)) event.stopPropagation();
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      if (!stripeInDocument()) return;
      // After the navigation that unmounted the checkout has set the new address.
      window.setTimeout(() => {
        if (!isCheckoutPath(window.location.pathname)) window.location.reload();
      }, 0);
    };
  }, []);
  return null;
}
