import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { isReferralCode } from "@/features/referrals/rules";
import { NOINDEX } from "@/lib/seo";

/**
 * An invite link (`/i/<code>`, ADR 0064): next-intl has already added the visitor's language; this
 * hands the code to the sign-up page in the address. Nothing is stored before sign-up: no cookie, no
 * storage, no lookup here. A malformed code just leads to the sign-up.
 */
export const metadata: Metadata = { robots: NOINDEX };

// Answered per request, so the redirect is a plain 307 and never a cached page.
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ locale: string; code: string }> }) {
  const { locale, code } = await params;
  const clean = code.toLowerCase();
  redirect(isReferralCode(clean) ? `/${locale}/signup?ref=${clean}` : `/${locale}/signup`);
}
