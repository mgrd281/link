import { cn, Icon, icons } from "@linkyo/ui";
import type { LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { COMPANY, legalLinksVisible } from "@/features/legal/company";
import { Link } from "@/i18n/navigation";

import { SitePage, standaloneLink } from "./site-page";
import { bdi } from "./text";

function Card({ icon, title, children, className }: { icon: LucideIcon; title: string; children: ReactNode; className?: string }) {
  return (
    <article className={cn("grid content-start justify-items-start gap-3 rounded-xl bg-canvas-muted p-6 md:p-8", className)}>
      <span aria-hidden className="grid size-control-md place-items-center rounded-full bg-tinted text-tinted-fg">
        <Icon icon={icon} size="md" />
      </span>
      <h2 className="text-h3 text-balance">{title}</h2>
      {children}
    </article>
  );
}

/**
 * /kontakt: the one contact there is, the e-mail address in COMPANY (the single place for it), as a
 * mailto link; the help pages first; the report form (/melden) for content; and the Impressum for who
 * runs Linkyo.
 * No form (it would need the site's own e-mail sending, which is not set up), no phone number here,
 * no hours or answer times. The Impressum is linked only where the footer links it too (company
 * data complete, `legalLinksVisible`).
 */
export async function ContactPage({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "sitePages.contact" });
  const common = await getTranslations({ locale, namespace: "sitePages.common" });
  const email = COMPANY.email.includes("[") ? null : COMPANY.email;
  return (
    <SitePage icon={icons.email} eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")}>
      <div className="mx-auto grid w-full max-w-content gap-4 px-5 md:grid-cols-2 md:px-10">
        <article className="grid content-start justify-items-start gap-3 rounded-xl border border-line bg-surface-elevated p-6 md:col-span-2 md:p-10">
          <h2 className="text-h3">{t("email.title")}</h2>
          <p className="text-body text-pretty text-fg-secondary">{t.rich("email.lead", { bdi })}</p>
          {email ? (
            <a href={`mailto:${email}`} data-contact-email className={cn(standaloneLink, "max-w-full text-h3")}>
              <Icon icon={icons.email} size="lg" className="shrink-0" />
              {/* An address reads left to right, also inside an Arabic page; a long one may break. */}
              <bdi className="min-w-0 break-all">{email}</bdi>
            </a>
          ) : (
            <p className="text-body text-fg-secondary">{t("email.missing")}</p>
          )}
        </article>
        <Card icon={icons.help} title={t("help.title")}>
          <p className="text-body text-pretty text-fg-secondary">{t("help.body")}</p>
          <Link href="/hilfe" className={standaloneLink}>
            {t("help.action")}
            <Icon icon={icons.next} size="sm" />
          </Link>
        </Card>
        {legalLinksVisible ? (
          <Card icon={icons.warning} title={t("report.title")}>
            <p className="text-body text-pretty text-fg-secondary">{t("report.body")}</p>
            <a href={`/${locale}/melden`} className={standaloneLink}>
              {t("report.action")}
              <Icon icon={icons.next} size="sm" />
            </a>
          </Card>
        ) : null}
        {legalLinksVisible ? (
          <Card icon={icons.document} title={t("imprint.title")} className="md:col-span-2">
            <p className="max-w-prose text-body text-pretty text-fg-secondary">{t.rich("imprint.body", { bdi })}</p>
            <a href={`/${locale}/impressum`} className={standaloneLink}>
              {common("imprint")}
              <Icon icon={icons.next} size="sm" />
            </a>
          </Card>
        ) : null}
      </div>
    </SitePage>
  );
}
