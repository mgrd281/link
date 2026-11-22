import { Logo } from "@linkyo/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { CancelForm } from "@/features/legal/cancel-form";
import { TestBanner } from "@/features/payments/test-banner";
import { Link } from "@/i18n/navigation";
import { paymentsEnabled } from "@/lib/flags";
import { NOINDEX } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!paymentsEnabled) return {};
  const t = await getTranslations({ locale, namespace: "legal.cancel" });
  return { title: t("title"), robots: NOINDEX };
}

/**
 * "Verträge hier kündigen" (§ 312k BGB): only the logo and the form. No footer, no marketing, no
 * "pause instead", no offer. Without payments it does not exist.
 */
export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!paymentsEnabled) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "legal.cancel" });
  const tAuth = await getTranslations({ locale, namespace: "auth" });
  return (
    <>
      <header className="mx-auto flex h-16 w-full max-w-prose items-center px-5">
        <Link href="/" className="rounded-xs focus-visible:focus-ring" aria-label={tAuth("home")}>
          <Logo className="h-6" title="Linkyo" />
        </Link>
      </header>
      <TestBanner />
      <main id="main" className="mx-auto grid w-full max-w-prose grid-cols-1 gap-6 px-5 pt-8 pb-16 md:pt-12">
        <h1 className="text-h1 tracking-tight text-balance">{t("title")}</h1>
        <CancelForm />
      </main>
    </>
  );
}
