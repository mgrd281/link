import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { OrderDetailScreen } from "@/features/admin/orders/order-detail-screen";
import { paymentsEnabled } from "@/lib/flags";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.orders" });
  return { title: t("title") };
}

/** One order for the team: briefing, proposals, timeline and the actions. */
export default async function Page({ params }: Props) {
  const { locale, id } = await params;
  if (!paymentsEnabled || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  setRequestLocale(locale);
  return <OrderDetailScreen orderId={id} />;
}
