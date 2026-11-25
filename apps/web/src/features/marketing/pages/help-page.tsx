import { Icon, icons } from "@linkyo/ui";
import { getTranslations } from "next-intl/server";

import { articleKeys, HELP_ARTICLES, HELP_GROUPS, type HelpRelated } from "@/features/help/articles";
import { HelpCenter, type HelpCenterArticle } from "@/features/help/help-center";
import { Link } from "@/i18n/navigation";

import { siteState } from "../site-state";
import { SITE_NUMBERS } from "./numbers";
import { SitePage, standaloneLink } from "./site-page";
import { bdi, plainTags } from "./text";

/** The name of the page an article points on to (a message key). */
const RELATED_LABEL: Record<HelpRelated, string> = {
  "/funktionen": "marketing.nav.features",
  "/portfolio": "marketing.nav.portfolio",
  "/templates": "marketing.nav.templates",
  "/sicherheit": "sitePages.security.eyebrow",
  "/sicherheit#statistik": "sitePages.security.eyebrow",
};

/**
 * /hilfe: every help article (features/help/articles.ts) in the visitor's language, grouped and
 * searchable. The articles are rendered here, on the server, and handed to the island with plain copies
 * of their words for the search; the island adds only its own words (`help.search.*`). Articles about
 * the statistics follow the counting switch (`siteState()`). Under the list, where to turn when no
 * article answers: the contact page and the homepage's questions.
 */
export async function HelpPage({ locale }: { locale: string }) {
  const t = await getTranslations({ locale });
  const { statistics } = siteState();
  // The numbers the articles name come from the code that sets them (./numbers.ts).
  const rich = (key: string) => t.rich(key, { ...SITE_NUMBERS, bdi });
  const plain = (key: string) => t.markup(key, { ...SITE_NUMBERS, ...plainTags });
  const articles: HelpCenterArticle[] = HELP_ARTICLES.map((article) => {
    const base = `help.articles.${article.slug}`;
    const { summary, body } = articleKeys(article, (t.raw(`${base}.body`) as string[]).length, statistics);
    return {
      slug: article.slug,
      group: article.group,
      title: plain(`${base}.title`),
      summary: plain(summary),
      body: body.map(plain),
      view: { title: rich(`${base}.title`), summary: rich(summary), body: body.map(rich) },
      related: "related" in article ? { href: article.related, label: t(RELATED_LABEL[article.related]) } : undefined,
    };
  });
  const groups = HELP_GROUPS.map((key) => ({ key, label: t(`sitePages.help.groups.${key}`) }));
  return (
    <SitePage current="help" icon={icons.help} eyebrow={t("sitePages.help.eyebrow")} title={t("sitePages.help.title")} lead={rich("sitePages.help.lead")}>
      <HelpCenter articles={articles} groups={groups} contactHref="/kontakt" />
      <section aria-labelledby="help-more-title" className="mx-auto mt-12 grid w-full max-w-content px-5 md:mt-16 md:px-10">
        <div className="grid max-w-column-wide justify-items-start gap-3 rounded-xl bg-canvas-muted p-6 md:p-10">
          <h2 id="help-more-title" className="text-h3 text-balance">
            {t("sitePages.help.more.title")}
          </h2>
          <p className="max-w-prose text-body text-pretty text-fg-secondary">{t("sitePages.help.more.lead")}</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <Link href="/kontakt" className={standaloneLink}>
              <Icon icon={icons.email} size="md" />
              {t("sitePages.help.more.contact")}
            </Link>
            <Link href="/#faq" className={standaloneLink}>
              <Icon icon={icons.help} size="md" />
              {t("sitePages.help.more.faq")}
            </Link>
          </div>
        </div>
      </section>
    </SitePage>
  );
}
