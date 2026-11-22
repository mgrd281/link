/**
 * Live payments only with real company data and a lawyer's review. `next.config.ts` calls this at
 * build time with NEXT_PUBLIC_PAYMENTS, `legalReady` (company.ts) and LEGAL_REVIEWED, so a build that
 * would take real money with placeholder legal texts fails. Pure; nothing of it reaches the browser.
 */
export function assertLiveReady({ payments, legalReady, reviewed }: { payments: string | undefined; legalReady: boolean; reviewed: string | undefined }): void {
  if (payments === "live" && (!legalReady || reviewed !== "1")) {
    throw new Error("NEXT_PUBLIC_PAYMENTS=live needs the real company data and LEGAL_REVIEWED=1");
  }
}
