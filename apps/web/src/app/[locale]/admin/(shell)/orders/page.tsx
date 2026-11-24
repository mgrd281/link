import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { OrdersScreen } from "@/features/admin/orders/orders-screen";
import { paymentsEnabled } from "@/lib/flags";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  // Without payments the queue does not exist: a 404, and its tab says so.
  if (!paymentsEnabled) return { title: (await getTranslations({ locale, namespace: "errors.meta" }))("notFound") };
  const t = await getTranslations({ locale, namespace: "admin.orders" });
  return { title: t("title") };
}

/** The page-service queue and the contract requests (only where orders exist: NEXT_PUBLIC_PAYMENTS). */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  if (!paymentsEnabled) notFound();
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    // The tab and the filter can start from the address (?tab=contracts, ?scope=…).
    <Suspense>
      <OrdersScreen />
    </Suspense>
  );
}
