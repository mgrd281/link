import { Icon, icons } from "@linkyo/ui";
import type { LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { aiConfigured } from "@/features/ai/server/config";
import { legalLinksVisible } from "@/features/legal/company";
import { Link } from "@/i18n/navigation";

import { SECTION_TITLE } from "../headings";
import { siteState } from "../site-state";
import { isLegalPromise, LEGAL_PROMISE_MARKER } from "./review";
import { SitePage, standaloneLink } from "./site-page";
import { bdi, term } from "./text";

type SectionKey = "pages" | "hosting" | "statistics" | "ai" | "payments" | "account";

/**
 * The page's sections, each with its anchor, its glyph and its sentences (keys under
 * `sitePages.security.sections.<key>.items`), as the code works today: the AI and payment sections
 * say whether they are switched on, the statistics section whether pages are counted.
 */
function sections({ ai, payments }: { ai: boolean; payments: boolean }): { key: SectionKey; id: string; icon: LucideIcon; items: string[] }[] {
  return [
    { key: "pages", id: "seiten", icon: icons.hide, items: ["cookies", "thirdParty", "embeds"] },
    { key: "hosting", id: "daten", icon: icons.place, items: ["vercel", "supabase", "noSale"] },
    { key: "statistics", id: "statistik", icon: icons.analytics, items: ["what", "script", "how", "access", "noBanner"] },
    { key: "ai", id: "ki", icon: icons.ai, items: [ai ? "on" : "off", "photos", "publish"] },
    { key: "payments", id: "zahlungen", icon: icons.billing, items: [...(payments ? [] : ["off"]), "stripe", "data"] },
    { key: "account", id: "konto", icon: icons.locked, items: ["code", "signIns", "delete"] },
  ];
}

/** The lawyer's review marker after a legal promise: German, like the drafts it belongs with. */
function Marker() {
  return (
    <bdi lang="de" data-review-marker className="font-semibold text-fg">
      {LEGAL_PROMISE_MARKER}
    </bdi>
  );
}

/**
 * /sicherheit: what the code does with data, section by section (creator pages, where the data is,
 * the cookie-free statistics of ADR 0081, AI and photos, payments, the account). It describes; the
 * privacy policy binds. A sentence that is a legal promise rather than a description carries the
 * lawyer's review marker (`LEGAL_PROMISES`, ./review.ts), which the launch guard counts too.
 */
export async function SecurityPage({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "sitePages.security" });
  const common = await getTranslations({ locale, namespace: "sitePages.common" });
  const state = siteState();
  const list = sections({ ai: aiConfigured(), payments: state.payments });
  return (
    <SitePage
      icon={icons.security}
      eyebrow={t("eyebrow")}
      title={t("title")}
      lead={t("lead")}
      opening={
        <div className="grid max-w-prose justify-items-start gap-3">
          <p data-review-note className="text-small text-pretty text-fg-secondary">
            {t.rich("review", {
              text: LEGAL_PROMISE_MARKER,
              marker: (chunks) => (
                <bdi lang="de" className="font-semibold text-fg">
                  {chunks}
                </bdi>
              ),
            })}
          </p>
          {legalLinksVisible ? (
            <a href={`/${locale}/datenschutz`} className={standaloneLink}>
              <Icon icon={icons.document} size="md" />
              {common("privacy")}
            </a>
          ) : null}
        </div>
      }
    >
      <nav aria-label={t("nav")} className="mx-auto w-full max-w-content px-5 md:px-10">
        <ul className="flex flex-wrap gap-2">
          {list.map((section) => (
            <li key={section.key}>
              <a
                href={`#${section.id}`}
                className="inline-flex min-h-touch-target items-center gap-2 rounded-full bg-canvas-muted px-4 text-small font-semibold text-fg transition-colors duration-micro hover:bg-hover focus-visible:focus-ring active:bg-pressed"
              >
                <Icon icon={section.icon} size="sm" className="text-link" />
                {t(`sections.${section.key}.title`)}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mx-auto grid w-full max-w-content gap-4 px-5 pt-8 md:px-10 md:pt-12">
        {list.map((section) => (
          <section
            key={section.key}
            id={section.id}
            aria-labelledby={`${section.id}-title`}
            className="grid scroll-mt-24 gap-5 rounded-xl bg-canvas-muted p-6 md:p-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12"
          >
            <header className="grid content-start justify-items-start gap-4">
              <span aria-hidden className="grid size-control-md place-items-center rounded-full bg-tinted text-tinted-fg">
                <Icon icon={section.icon} size="md" />
              </span>
              <h2 id={`${section.id}-title`} className={SECTION_TITLE}>
                {t(`sections.${section.key}.title`)}
              </h2>
            </header>
            <div className="grid content-start gap-4">
              {section.key === "statistics" && !state.statistics ? <p className="text-body font-semibold text-pretty">{t("sections.statistics.off")}</p> : null}
              {section.items.map((item) => (
                <p key={item} className="max-w-prose text-body text-pretty text-fg-secondary">
                  {t.rich(`sections.${section.key}.items.${item}`, { bdi, term })}
                  {isLegalPromise("security", `${section.key}.${item}`) ? (
                    <>
                      {" "}
                      <Marker />
                    </>
                  ) : null}
                </p>
              ))}
            </div>
          </section>
        ))}
        <section aria-labelledby="sicherheitsluecke-title" id="sicherheitsluecke" className="grid scroll-mt-24 justify-items-start gap-3 rounded-xl border border-line bg-surface-elevated p-6 md:p-10">
          <span aria-hidden className="grid size-control-md place-items-center rounded-full bg-tinted text-tinted-fg">
            <Icon icon={icons.warning} size="md" />
          </span>
          <h2 id="sicherheitsluecke-title" className="text-h3 text-balance">
            {t("sections.report.title")}
          </h2>
          <p className="max-w-prose text-body text-pretty text-fg-secondary">{t.rich("sections.report.body", { bdi })}</p>
          <Link href="/kontakt" className={standaloneLink}>
            <Icon icon={icons.email} size="md" />
            {t("sections.report.action")}
          </Link>
        </section>
      </div>
    </SitePage>
  );
}
