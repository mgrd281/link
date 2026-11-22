import { setRequestLocale } from "next-intl/server";

import { CheckoutPro } from "@/features/payments/checkout-pro";

/** The Linkyo Pro checkout. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CheckoutPro />;
}
