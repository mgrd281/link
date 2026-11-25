import { Icon, icons } from "@linkyo/ui";
import type { LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { legalLinksVisible } from "@/features/legal/company";
import { Link } from "@/i18n/navigation";

import { FinalCta } from "../sections";
import { siteState } from "../site-state";
import { SitePage, SiteSection, standaloneLink } from "./site-page";
import { bdi } from "./text";

/**
 * What Linkyo stands for, each with its glyph. Privacy adds its sentence about the cookie-free counting
 * (`counting`) only while pages are counted (`siteState()`).
 */
const VALUES: { key: "flat" | "privacy" | "languages" | "hosting" | "honest"; icon: LucideIcon; counting?: true }[] = [
  { key: "flat", icon: icons.design },
  { key: "privacy", icon: icons.security, counting: true },
  { key: "languages", icon: icons.website },
  { key: "hosting", icon: icons.place },
  { key: "honest", icon: icons.success },
];

/**
 * /ueber-uns: why Linkyo exists and what it stands for (flat design, privacy by default, three
 * languages, data in Frankfurt, saying what is planned as planned). It names no team, no numbers,
 * no investors and no quotes: who runs Linkyo is in the Impressum, linked where the footer links it.
 */
export async function AboutPage({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "sitePages.about" });
  const common = await getTranslations({ locale, namespace: "sitePages.common" });
  const why = (t.raw("why.body") as unknown[]).map((_, index) => `why.body.${String(index)}`);
  const { statistics } = siteState();
  return (
    <SitePage icon={icons.info} eyebrow={t("eyebrow")} title={t("title")} lead={t.rich("lead", { bdi })}>
      <SiteSection id="warum" title={t("why.title")}>
        <div className="grid max-w-prose gap-4">
          {why.map((key) => (
            <p key={key} className="text-body-lg text-pretty text-fg-secondary">
              {t.rich(key, { bdi })}
            </p>
          ))}
        </div>
      </SiteSection>
      <SiteSection id="werte" title={t("values.title")}>
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {VALUES.map((value) => (
            <li key={value.key} className="mk-reveal grid content-start gap-3 rounded-xl bg-canvas-muted p-6 md:p-8">
              <span aria-hidden className="grid size-control-md place-items-center rounded-full bg-tinted text-tinted-fg">
                <Icon icon={value.icon} size="md" />
              </span>
              <h3 className="text-h3 text-balance">{t(`values.items.${value.key}.title`)}</h3>
              <p className="text-body text-pretty text-fg-secondary">
                {t.rich(`values.items.${value.key}.body`, { bdi })}
                {value.counting && statistics ? <> {t.rich(`values.items.${value.key}.counting`, { bdi })}</> : null}
              </p>
            </li>
          ))}
        </ul>
      </SiteSection>
      <SiteSection id="wer" title={t("who.title")}>
        <div className="grid max-w-prose justify-items-start gap-3">
          <p className="text-body-lg text-pretty text-fg-secondary">{t.rich("who.body", { bdi })}</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            {legalLinksVisible ? (
              <a href={`/${locale}/impressum`} className={standaloneLink}>
                <Icon icon={icons.document} size="md" />
                {common("imprint")}
              </a>
            ) : null}
            <Link href="/kontakt" className={standaloneLink}>
              <Icon icon={icons.email} size="md" />
              {t("who.contact")}
            </Link>
          </div>
        </div>
      </SiteSection>
      <div className="pt-6 md:pt-12">
        <FinalCta />
      </div>
    </SitePage>
  );
}
