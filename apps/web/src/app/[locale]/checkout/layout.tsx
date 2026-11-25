import { Icon, Logo } from "@linkyo/ui";
import { Languages } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense, type ReactNode } from "react";

import { LEGAL_TEXT_LOCALES } from "@/features/legal/texts";
import { MarketingFooter } from "@/features/marketing/footer";
import { GermanOnlyLink } from "@/features/payments/checkout-summary";
import { StripeLeaveGuard } from "@/features/payments/stripe-js";
import { TestBanner } from "@/features/payments/test-banner";
import { ClientMessages } from "@/i18n/client-messages-provider";
import { Link } from "@/i18n/navigation";
import { paymentsEnabled } from "@/lib/flags";
import { NOINDEX } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!paymentsEnabled) return {};
  const t = await getTranslations({ locale, namespace: "checkout" });
  return { title: t("title"), robots: NOINDEX };
}

/**
 * The checkouts: only the logo on top (nothing to wander off to), the test-mode note in a test build,
 * the checkout, and the website's footer with the legal links. Orders are taken in the contract's
 * language only: while a locale has no legal texts of its own (`LEGAL_TEXT_LOCALES`), its visitors
 * get a notice in their language and a link to the same checkout in German, and no order button.
 */
export default async function CheckoutLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!paymentsEnabled) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "checkout.germanOnly" });
  const tAuth = await getTranslations({ locale, namespace: "auth" });
  const contractLocale = (LEGAL_TEXT_LOCALES as readonly string[]).includes(locale);
  return (
    // The checkouts read the `checkout` words in the browser (`CLIENT_NAMESPACES.checkout`).
    <ClientMessages group="checkout">
      {/* Stripe.js stays on these pages: once it is loaded, leaving the checkout is a full page load. */}
      <StripeLeaveGuard />
      <header className="layer-sticky sticky top-0 bg-canvas">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:rounded-sm focus:bg-surface-elevated focus:px-3 focus:py-2 focus:focus-ring"
        >
          {tAuth("skip")}
        </a>
        <div className="mx-auto flex h-16 max-w-content items-center px-5 md:px-10">
          <Link href="/" className="rounded-xs focus-visible:focus-ring" aria-label={tAuth("home")}>
            <Logo className="h-6" title="Linkyo" />
          </Link>
        </div>
      </header>
      <TestBanner />
      <main id="main" className="mx-auto grid w-full max-w-prose grid-cols-1 px-5 pt-8 pb-16 md:pt-12">
        {contractLocale ? (
          children
        ) : (
          <div className="grid gap-5">
            <span aria-hidden className="grid size-control-xl place-items-center rounded-full bg-tinted text-tinted-fg">
              <Icon icon={Languages} size="lg" />
            </span>
            <h1 className="text-h1 tracking-tight text-balance">{t("title")}</h1>
            <p className="text-body-lg text-pretty text-fg-secondary">{t("body")}</p>
            <Suspense>
              <GermanOnlyLink />
            </Suspense>
          </div>
        )}
      </main>
      <MarketingFooter />
    </ClientMessages>
  );
}
