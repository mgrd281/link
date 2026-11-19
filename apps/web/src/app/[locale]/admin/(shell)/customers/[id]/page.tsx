import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { CustomerDetailScreen } from "@/features/admin/customer-detail-screen";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.meta" });
  return { title: t("customer") };
}

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <CustomerDetailScreen id={id} />;
}
