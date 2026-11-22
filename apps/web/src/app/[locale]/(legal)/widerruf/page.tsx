import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { WithdrawForm } from "@/features/legal/withdraw-form";
import { TestBanner } from "@/features/payments/test-banner";
import { paymentsEnabled } from "@/lib/flags";
import { NOINDEX } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!paymentsEnabled) return {};
  const t = await getTranslations({ locale, namespace: "legal.withdraw" });
  return { title: t("title"), robots: NOINDEX };
}

/**
 * "Vertrag widerrufen" (§ 356a BGB): reachable without a login from every page's footer wherever
 * contracts can be made; without payments it does not exist.
 */
export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!paymentsEnabled) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "legal.withdraw" });
  return (
    <>
      <TestBanner />
      <main id="main" className="mx-auto grid w-full max-w-prose grid-cols-1 gap-6 px-5 pt-10 pb-16 md:pt-16">
        <header className="grid gap-3">
          <h1 className="text-h1 tracking-tight text-balance">{t("title")}</h1>
          <p className="text-body-lg text-pretty text-fg-secondary">{t("lead")}</p>
        </header>
        <WithdrawForm />
      </main>
    </>
  );
}
