import { Icon, icons } from "@linkyo/ui";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

import { siteState } from "../site-state";
import { changelogEntries, formatDay } from "./changelog";
import { SitePage, standaloneLink } from "./site-page";
import { bdi, term } from "./text";

/**
 * /changelog: what reached the live site, newest first, each entry under its day (changelog.ts holds
 * the dates from the git history; an entry of a switched-off part leaves out). On laptops the day
 * stands beside the entry, like a timeline.
 */
export async function ChangelogPage({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "sitePages.changelog" });
  return (
    <SitePage icon={icons.activity} eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")}>
      <ol className="mx-auto grid w-full max-w-content gap-4 px-5 md:px-10">
        {changelogEntries(siteState()).map((entry) => {
          const items = (t.raw(`entries.${entry.key}.items`) as unknown[]).map((_, index) => `entries.${entry.key}.items.${String(index)}`);
          return (
            <li key={entry.key} data-changelog={entry.key} className="grid gap-4 rounded-xl bg-canvas-muted p-6 md:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] lg:gap-10">
              <p className="text-small font-semibold text-fg-secondary">
                <time dateTime={entry.date}>{formatDay(entry.date, locale)}</time>
              </p>
              <article aria-labelledby={`changelog-${entry.key}`} className="grid content-start justify-items-start gap-3">
                <h2 id={`changelog-${entry.key}`} className="text-h3 text-balance">
                  {t(`entries.${entry.key}.title`)}
                </h2>
                <ul className="grid gap-2">
                  {items.map((key) => (
                    <li key={key} className="flex items-start gap-3 text-body text-pretty">
                      <span aria-hidden className="mt-2 size-dot shrink-0 rounded-full bg-primary" />
                      <span className="min-w-0">{t.rich(key, { bdi, term })}</span>
                    </li>
                  ))}
                </ul>
                {entry.href ? (
                  <Link href={entry.href} aria-describedby={`changelog-${entry.key}`} className={standaloneLink}>
                    {t("more")}
                    <Icon icon={icons.next} size="sm" />
                  </Link>
                ) : null}
              </article>
            </li>
          );
        })}
      </ol>
    </SitePage>
  );
}
