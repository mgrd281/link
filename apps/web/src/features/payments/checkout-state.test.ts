import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { isCheckoutPath, isLate, leavesCheckout, nextLookDelay, paymentFailedText, paymentResult, QUICK_LOOKS, readSession, SLOW_LOOKS, slotState } from "./checkout-state";

const source = (file: string) => readFileSync(path.resolve(import.meta.dirname, file), "utf8");
const messages = (locale: string) => JSON.parse(readFileSync(path.resolve(import.meta.dirname, `../../messages/${locale}.json`), "utf8")) as { checkout: Record<string, unknown> & { done: Record<string, string> } };

describe("a payment that did not go through", () => {
  it("keeps the provider's own reason", () => {
    expect(paymentResult({ type: "success" })).toEqual({ ok: true });
    expect(paymentResult({ type: "error", error: { message: "Your card was declined." } })).toEqual({ ok: false, message: "Your card was declined." });
    expect(paymentResult({ type: "error" })).toEqual({ ok: false });
    expect(paymentResult({ type: "error", error: { message: "  " } })).toEqual({ ok: false });
    expect(paymentResult(null)).toEqual({ ok: false });
  });

  it("says the reason, or that the payment failed, never that the payment field did not load", () => {
    const fallback = "Die Zahlung hat nicht geklappt.";
    expect(paymentFailedText({ ok: false, message: "Ihre Karte wurde abgelehnt." }, fallback)).toBe("Ihre Karte wurde abgelehnt.");
    expect(paymentFailedText({ ok: false }, fallback)).toBe(fallback);
    // Both checkouts use these texts for a failed payment and a failed order call; `loadFailed` is
    // left to the payment slot (the form or its session could not be loaded).
    for (const file of ["checkout-service.tsx", "checkout-pro.tsx"]) {
      const code = source(file);
      expect(code, file).toContain('paymentFailedText(result, t("payFailed"))');
      expect(code, file).not.toContain('t("loadFailed")');
    }
    expect(source("checkout-service.tsx")).toContain('t("orderFailed")');
    expect(source("payment-slot.tsx")).toContain('t("loadFailed")');
  });

  it("has its sentences in every language", () => {
    for (const locale of ["de", "en", "ar"]) {
      const { checkout } = messages(locale);
      for (const key of ["payFailed", "orderFailed", "loadFailed"]) expect(checkout[key], `${locale} ${key}`).toEqual(expect.any(String));
      expect(checkout.payFailed).not.toBe(checkout.loadFailed);
      expect(checkout.done.late, locale).toEqual(expect.any(String));
      expect(checkout.done.late).not.toBe(checkout.done.pending);
    }
  });
});

describe("the payment slot", () => {
  it("reads a session only from a complete answer", () => {
    expect(readSession(200, { sessionId: "cs_1", clientSecret: "secret" })).toEqual({ sessionId: "cs_1", clientSecret: "secret" });
    for (const [status, data] of [[500, {}], [401, { error: "unauthorized" }], [429, {}], [200, { sessionId: "cs_1" }], [200, {}]] as const) {
      expect(readSession(status, data), String(status)).toBeNull();
    }
  });

  it("shows an error, not an endless skeleton, when the session could not be created", () => {
    expect(slotState({ publishableKey: "pk_test_x", failed: true, clientSecret: null })).toBe("failed");
    expect(slotState({ publishableKey: "pk_test_x", failed: false, clientSecret: null })).toBe("loading");
    expect(slotState({ publishableKey: "pk_test_x", failed: false, clientSecret: "secret" })).toBe("form");
    expect(slotState({ publishableKey: "pk_test_x", failed: true, clientSecret: "secret" })).toBe("failed");
    expect(slotState({ publishableKey: "", failed: true, clientSecret: null })).toBe("notSetUp");
    // Both checkouts tell the slot when their session request failed.
    expect(source("checkout-service.tsx")).toMatch(/<PaymentSlot[^>]*failed=\{sessionFailed\}/);
    expect(source("checkout-pro.tsx")).toMatch(/<PaymentSlot[^>]*failed=\{state === "failed"\}/);
  });
});

describe("waiting for the order after paying", () => {
  it("looks every second at first, then says it takes longer and looks more slowly, then stops", () => {
    expect(nextLookDelay(0)).toBe(1000);
    expect(nextLookDelay(QUICK_LOOKS - 1)).toBe(1000);
    expect(isLate(QUICK_LOOKS - 1)).toBe(false);
    expect(isLate(QUICK_LOOKS)).toBe(true);
    expect(nextLookDelay(QUICK_LOOKS)).toBe(5000);
    expect(nextLookDelay(QUICK_LOOKS + SLOW_LOOKS - 1)).toBe(5000);
    expect(nextLookDelay(QUICK_LOOKS + SLOW_LOOKS)).toBeNull();
  });
});

describe("Stripe.js only on the checkout", () => {
  it("knows the checkout's pages", () => {
    for (const pathname of ["/de/checkout/service", "/en/checkout/pro", "/ar/checkout/done", "/de/checkout", "/checkout/service"]) expect(isCheckoutPath(pathname), pathname).toBe(true);
    for (const pathname of ["/de", "/", "/de/app", "/de/service", "/de/checkouts", "/de/app/checkout", "/checkout-fan", "/mila"]) expect(isCheckoutPath(pathname), pathname).toBe(false);
  });

  it("makes every link from the checkout to another page of the site a full page load", () => {
    const here = "https://linkyo.app/de/checkout/service?package=start";
    for (const href of ["/de", "/de/app", "/de/agb", "https://linkyo.app/de/app/orders/1", "../service", "/mila"]) expect(leavesCheckout(href, here), href).toBe(true);
    // The checkout's own pages, and other sites (a full load anyway), are left alone.
    for (const href of ["/de/checkout/done?session_id=cs_1", "/en/checkout/service?package=start", "#main", "?package=premium", "https://stripe.com/de/privacy", "mailto:hallo@linkyo.app"]) {
      expect(leavesCheckout(href, here), href).toBe(false);
    }
  });

  it("is guarded in the checkout layout, by the one file that names Stripe's host", () => {
    expect(source("../../app/[locale]/checkout/layout.tsx")).toContain("<StripeLeaveGuard />");
    const guard = source("stripe-js.tsx");
    expect(guard).toContain("export function StripeLeaveGuard");
    expect(guard).toContain("window.location.reload()");
  });
});
