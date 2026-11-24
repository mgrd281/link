import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { OrderScreen } from "@/features/app/orders/order-screen";
import { orderMissing } from "@/features/errors/gated-routes";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  // An address that cannot exist is a 404: its tab says so, not the order screen's name.
  if (orderMissing(id)) return { title: (await getTranslations({ locale, namespace: "errors.meta" }))("notFound") };
  const t = await getTranslations({ locale, namespace: "app.meta" });
  return { title: t("order") };
}

/** One page-service order and its briefing: a full-screen task of the dashboard (outside its rail). */
export default async function Page({ params }: Props) {
  const { locale, id } = await params;
  // The layout answers these addresses with a 404 first (features/errors/gated-routes.ts); this stays as the second line.
  if (orderMissing(id)) notFound();
  setRequestLocale(locale);
  return <OrderScreen orderId={id} />;
}
