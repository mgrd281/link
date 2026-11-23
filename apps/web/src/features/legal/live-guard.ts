/**
 * Live payments only with real company data, a lawyer's review and a transport that really delivers
 * e-mail. `next.config.ts` calls this at build time with NEXT_PUBLIC_PAYMENTS, `legalReady`
 * (company.ts), LEGAL_REVIEWED and EMAIL_TRANSPORT, so a build that would take real money with
 * placeholder legal texts, or without sending the order confirmation, the withdrawal information and
 * the receipts the law asks for (§ 312f, § 356a, § 312k BGB), fails. The transport must be "tem"
 * (LIVE_EMAIL_TRANSPORT in features/email/send.ts, which checks the same again at run time): unset,
 * "console" and "capture" send nothing. Pure; nothing of it reaches the browser.
 */
export function assertLiveReady({
  payments,
  legalReady,
  reviewed,
  emailTransport,
}: {
  payments: string | undefined;
  legalReady: boolean;
  reviewed: string | undefined;
  emailTransport: string | undefined;
}): void {
  if (payments !== "live") return;
  if (!legalReady || reviewed !== "1") {
    throw new Error("NEXT_PUBLIC_PAYMENTS=live needs the real company data and LEGAL_REVIEWED=1");
  }
  if (emailTransport !== "tem") {
    throw new Error("NEXT_PUBLIC_PAYMENTS=live needs EMAIL_TRANSPORT=tem: contract e-mails must really go out");
  }
}
