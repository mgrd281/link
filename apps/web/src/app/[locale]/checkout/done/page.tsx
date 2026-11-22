import { setRequestLocale } from "next-intl/server";

import { CheckoutDone } from "@/features/payments/checkout-service";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ session_id?: string | string[]; product?: string | string[] }>;
}

/** Where Stripe returns to after a payment (`?session_id=…`, Pro adds `&product=pro`). */
export default async function Page({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { session_id: session, product } = await searchParams;
  return <CheckoutDone sessionId={typeof session === "string" && session !== "" ? session : null} pro={product === "pro"} />;
}
