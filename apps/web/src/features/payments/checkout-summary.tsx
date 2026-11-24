"use client";

import { Button, Icon, Skeleton } from "@linkyo/ui";
import { ArrowRight, Check, CircleAlert, LogIn, UserPlus } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Link } from "@/i18n/navigation";

import { formatEuro, vatCents, VAT_MODE } from "./prices";

export type CheckoutLocale = "de" | "en" | "ar";

const websiteLink = "rounded-xs font-semibold text-link transition-colors duration-micro hover:text-fg focus-visible:focus-ring";

/**
 * The § 312j block (Art. 246a § 1 Abs. 1 EGBGB, shown directly above the order button): what is
 * ordered with its main features, the total price large, the VAT line, "no other costs", and the
 * delivery or billing lines passed as children.
 */
export function CheckoutSummary({ line, features, amountCents, children }: { line: string; features: readonly string[]; amountCents: number; children?: ReactNode }) {
  const t = useTranslations("checkout");
  const locale = useLocale() as CheckoutLocale;
  return (
    <section aria-labelledby="checkout-summary-title" data-checkout-summary className="grid gap-5 rounded-xl border border-line bg-surface-elevated p-5 md:p-6">
      <h2 id="checkout-summary-title" className="text-h3 text-balance">
        {line}
      </h2>
      <div className="grid gap-3">
        <p className="text-small font-semibold text-fg-secondary">{t("features")}</p>
        <ul className="grid gap-2">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-3 text-body">
              <span aria-hidden className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-selected text-selected-fg">
                <Icon icon={Check} size="sm" />
              </span>
              {feature}
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-1 border-t border-line pt-5">
        <p className="flex flex-wrap items-baseline justify-between gap-x-4">
          <span className="text-body-lg font-semibold">{t("total")}</span>
          <span className="text-display-sm font-extrabold tracking-display tabular-nums">{formatEuro(amountCents, locale)}</span>
        </p>
        <p className="text-small text-fg-secondary">{vatText(t, amountCents, locale)}</p>
        <p className="text-small text-fg-secondary">{t("noExtras")}</p>
      </div>
      {children ? <div className="grid gap-2 border-t border-line pt-5 text-body">{children}</div> : null}
    </section>
  );
}

/** "inkl. 3,99 € MwSt." or the small-business note. */
export function vatText(t: (key: string, values?: Record<string, string>) => string, amountCents: number, locale: CheckoutLocale): string {
  return VAT_MODE === "standard19" ? t("vat.standard19", { vat: formatEuro(vatCents(amountCents), locale) }) : t("vat.kleinunternehmer");
}

/**
 * The statutory warranty line and the terms links: the only things (besides these three links) that
 * stand between the § 312j block and the order button.
 */
export function TermsLine() {
  const t = useTranslations("checkout");
  const locale = useLocale();
  const link = (href: string) => (chunks: ReactNode) => (
    <a href={`/${locale}${href}`} className={websiteLink}>
      {chunks}
    </a>
  );
  return (
    <div className="grid gap-1 text-small text-pretty text-fg-secondary">
      <p>{t("warranty")}</p>
      <p>{t.rich("terms", { terms: link("/agb"), policy: link("/widerrufsbelehrung"), privacy: link("/datenschutz") })}</p>
    </div>
  );
}

/** Exactly "Zahlungspflichtig bestellen" (§ 312j Abs. 3 BGB), full width on phones. */
export function OrderButton({ disabled, busy, describedBy, onPress }: { disabled: boolean; busy: boolean; describedBy?: string | undefined; onPress: () => void }) {
  const t = useTranslations("checkout");
  return (
    <Button
      type="button"
      variant="primary"
      size="cta"
      className="w-full sm:w-auto sm:justify-self-start"
      disabled={disabled}
      loading={busy}
      aria-describedby={disabled ? describedBy : undefined}
      onClick={onPress}
    >
      {t("submit")}
    </Button>
  );
}

/**
 * Why the order did not go through (a declined payment, an order that could not be placed), right
 * under the button: an alert, so it is read out at once and cannot be taken for a passing note.
 */
export function OrderFailure({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p role="alert" data-order-failure className="flex items-start gap-2 text-small font-medium text-pretty text-danger-strong">
      <Icon icon={CircleAlert} size="sm" className="mt-0.5 shrink-0" />
      {text}
    </p>
  );
}

/** Signed out: the order lands in an account, so first sign in or sign up (and come back here). */
export function CheckoutSignIn({ next }: { next: string }) {
  const t = useTranslations("checkout.signIn");
  const target = encodeURIComponent(next);
  return (
    <div className="grid gap-4 rounded-xl border border-line bg-surface-elevated p-6">
      <h2 className="text-h3">{t("title")}</h2>
      <p className="text-body text-fg-secondary">{t("body")}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild variant="primary" size="lg">
          <Link href={`/signup?next=${target}`}>
            <Icon icon={UserPlus} size="md" />
            {t("signup")}
          </Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link href={`/login?next=${target}`}>
            <Icon icon={LogIn} size="md" />
            {t("login")}
          </Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * English and Arabic visitors: orders, contracts and legal texts are German for now (plan §0.3 #6).
 * The link continues with the same checkout (path and query) under /de.
 */
export function GermanOnlyLink() {
  const t = useTranslations("checkout.germanOnly");
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const path = pathname.replace(/^\/(?:en|ar)(?=\/|$)/, "");
  const href = `/de${path}${search ? `?${search}` : ""}`;
  return (
    <Button asChild variant="primary" size="cta" className="group justify-self-start">
      {/* A plain link: the target is another language's page (a full load sets its lang and dir). */}
      <a href={href} hrefLang="de">
        {t("cta")}
        <Icon icon={ArrowRight} size="md" />
      </a>
    </Button>
  );
}

/** While the session is read: the page's shape, so nothing jumps. */
export function CheckoutSkeleton() {
  return (
    <div className="grid gap-6" aria-hidden>
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-32 rounded-lg" />
      <Skeleton className="h-32 rounded-xl" />
    </div>
  );
}

/** A JSON POST to our own API with the session's bearer token. */
export async function postJson(path: string, body: object, token: string | null): Promise<{ status: number; data: Record<string, unknown> }> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    // An empty or non-JSON answer: the status says enough.
  }
  return { status: response.status, data };
}
