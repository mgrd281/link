import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { OrderScreen } from "@/features/app/orders/order-screen";
import { paymentsEnabled } from "@/lib/flags";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "app.meta" });
  return { title: t("order") };
}

/** One page-service order and its briefing: a full-screen task of the dashboard (outside its rail). */
export default async function Page({ params }: Props) {
  const { locale, id } = await params;
  if (!paymentsEnabled || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  setRequestLocale(locale);
  return <OrderScreen orderId={id} />;
}
