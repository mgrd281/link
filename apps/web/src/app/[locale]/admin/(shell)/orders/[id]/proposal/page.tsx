import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ProposalEditorScreen } from "@/features/admin/orders/proposal-editor-screen";
import { paymentsEnabled } from "@/lib/flags";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.orders" });
  return { title: t("actions.edit") };
}

/** The proposal of an order in the page editor (never the customer's live page). */
export default async function Page({ params }: Props) {
  const { locale, id } = await params;
  if (!paymentsEnabled || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  setRequestLocale(locale);
  return <ProposalEditorScreen orderId={id} />;
}
