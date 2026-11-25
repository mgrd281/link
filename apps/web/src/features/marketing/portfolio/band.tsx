import { creatorTokens } from "@linkyo/tokens";
import { Button, cn, Icon } from "@linkyo/ui";
import { ArrowRight, FolderKanban } from "lucide-react";
import { useTranslations } from "next-intl";

import { EXAMPLES } from "@/features/examples/catalog";
import { LOOKS, type LookId } from "@/features/examples/looks";
import { Link } from "@/i18n/navigation";

import { phoneSizes } from "../assets";
import { EXAMPLE_SHOTS, type ExampleShot } from "../examples";
import { SECTION_TITLE } from "../headings";
import { Picture } from "../picture";
import { source } from "../picture-source";
import { pageHref, portfolioExamples } from "./model";

const hasShot = (slug: LookId): slug is LookId & ExampleShot => slug in EXAMPLE_SHOTS;

/** Portfolio examples with a phone picture of their first screen, the first two of them. */
const shown = portfolioExamples().filter(hasShot).slice(0, 2);

/**
 * The homepage's Portfolio band: two real portfolio pages on phones (Ronja on Werkbogen, Tobin on
 * Tiefdruck) beside one sentence on what a portfolio on Linkyo is, and the way to the Portfolio
 * page. Which pages it shows comes from the gallery's Portfolio category.
 */
export function PortfolioBand() {
  const t = useTranslations("marketing.portfolio");
  const tTemplates = useTranslations("marketing.templates");
  return (
    <section id="portfolio-band" aria-labelledby="portfolio-band-title" className="mx-auto w-full max-w-content scroll-mt-24 px-5 py-12 md:px-10 md:py-24">
      <div className="grid items-center gap-10 overflow-hidden rounded-xl bg-canvas-muted p-6 md:p-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16 lg:p-16">
        <div className="mk-reveal grid justify-items-start gap-5">
          <span aria-hidden className="grid size-control-md place-items-center rounded-full bg-tinted text-tinted-fg">
            <Icon icon={FolderKanban} size="md" />
          </span>
          <h2 id="portfolio-band-title" className={SECTION_TITLE}>
            {t("title")}
          </h2>
          <p className="max-w-prose text-body-lg text-pretty text-fg-secondary">{t("lead")}</p>
          <Button asChild variant="primary" size="cta" className="group mt-1 w-full sm:w-auto">
            <Link href="/portfolio">
              {t("cta")}
              <Icon icon={ArrowRight} size="md" className="transition-transform duration-micro group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
            </Link>
          </Button>
        </div>
        <ul aria-label={t("label")} className="grid grid-cols-2 items-start gap-4 sm:gap-6">
          {shown.map((slug, index) => {
            const name = EXAMPLES[slug]?.profile.displayName ?? slug;
            return (
              // The second page sits a little lower: two phones side by side, not a grid of tiles.
              <li key={slug} className={cn("grid content-start gap-3", index % 2 === 1 && "mt-10 md:mt-16")}>
                <a
                  href={pageHref(slug)}
                  aria-label={tTemplates("open", { name })}
                  className="group block rounded-xl focus-visible:focus-ring"
                >
                  <span className="relative block aspect-short overflow-hidden rounded-xl border border-line bg-surface transition-[translate] duration-standard ease-standard group-hover:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
                    {/* The phone's own colour shows until its picture is there (no blurred preview in the page). */}
                    <Picture src={source(EXAMPLE_SHOTS[slug])} alt="" fill sizes={phoneSizes.side} className="object-cover object-top" />
                  </span>
                </a>
                <p className="grid gap-0.5 px-1 text-small">
                  <span className="font-semibold text-fg">{name}</span>
                  <span className="text-fg-secondary">
                    {t.rich("template", { name: creatorTokens.templates[LOOKS[slug].theme.template].label, bdi: (chunks) => <bdi>{chunks}</bdi> })}
                  </span>
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
