import { cn, Icon, icons } from "@linkyo/ui";
import { getTranslations } from "next-intl/server";

import { COMPANY } from "@/features/legal/company";
import { isLegalPromise, LEGAL_PROMISE_MARKER } from "@/features/marketing/pages/review";
import { SitePage, standaloneLink } from "@/features/marketing/pages/site-page";
import { bdi } from "@/features/marketing/pages/text";
import { supabaseEnabled } from "@/lib/supabase/config";
import { anonServerSupabase } from "@/lib/supabase/server";

import { ReportForm } from "./report-form";

/**
 * Whether this deployment takes reports: real accounts, the server key the route files them with, and
 * a database with the function (`reports_accepting`, 20261128100000_reports.sql). Anything else and
 * the page says so and names the e-mail address instead (as the Impressum does), never a form whose
 * button would fail.
 */
export async function reportsAccepting(): Promise<boolean> {
  if (!supabaseEnabled) return false;
  if (!(process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)) return false;
  try {
    const { data, error } = await anonServerSupabase().rpc("reports_accepting");
    return !error && data;
  } catch {
    return false;
  }
}

const marker = (key: string) => (isLegalPromise("report", key) ? LEGAL_PROMISE_MARKER : null);

/** /melden: report content on a creator page (DSA Art. 16). Website frame, teal; no cookie, nothing from another host. */
export async function ReportPage({ locale, accepting }: { locale: string; accepting: boolean }) {
  const t = await getTranslations({ locale, namespace: "report" });
  const email = COMPANY.email.includes("[") ? null : COMPANY.email;
  return (
    <SitePage icon={icons.reports} eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")}>
      <div className="mx-auto grid w-full max-w-content px-5 md:px-10">
        <div className={cn("grid w-full max-w-prose gap-6 rounded-xl border border-line bg-surface-elevated p-5 md:p-10")}>
          {accepting ? (
            <ReportForm contact={email ?? ""} markers={{ privacy: marker("form.privacy"), process: marker("form.process") }} />
          ) : (
            <div className="grid justify-items-start gap-3" data-report-unavailable>
              <h2 className="text-h3 text-balance">{t("unavailable.title")}</h2>
              {email ? (
                <>
                  <p className="text-body text-pretty text-fg-secondary">{t.rich("unavailable.body", { email, bdi })}</p>
                  <a href={`mailto:${email}`} className={cn(standaloneLink, "max-w-full")}>
                    <Icon icon={icons.email} size="md" className="shrink-0" />
                    {t("unavailable.action")}
                  </a>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </SitePage>
  );
}
