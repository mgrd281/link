import { setRequestLocale } from "next-intl/server";

import { CheckoutService } from "@/features/payments/checkout-service";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ package?: string | string[] }>;
}

/** The page-service checkout; `?package=premium` picks Premium, anything else Start. */
export default async function Page({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { package: chosen } = await searchParams;
  return <CheckoutService pkg={chosen === "premium" ? "premium" : "start"} />;
}
