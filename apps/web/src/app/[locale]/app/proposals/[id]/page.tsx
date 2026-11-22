import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ProposalScreen } from "@/features/app/proposals/proposal-screen";
import { paymentsEnabled } from "@/lib/flags";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "app.meta" });
  return { title: t("proposal") };
}

/** The customer's review of a page proposal from the team: a full-screen task of the dashboard. */
export default async function Page({ params }: Props) {
  const { locale, id } = await params;
  if (!paymentsEnabled || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  setRequestLocale(locale);
  return <ProposalScreen proposalId={id} />;
}
