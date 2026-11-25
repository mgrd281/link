import { Icon } from "@linkyo/ui";
import { FileWarning, Languages } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { NOINDEX, localeAlternates } from "@/lib/seo";

import { legalReady } from "./company";
import { legalIsDraft, reviewMarkers } from "./live-guard";
import type { LegalBlock, LegalDoc } from "./texts";

export type LegalTitle = "imprint" | "privacy" | "terms" | "cancellationPolicy";

/** The title in the visitor's language; drafts are never indexed. */
export async function legalMetadata(locale: string, title: LegalTitle, path: string): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "legal.titles" });
  return { title: t(title), robots: NOINDEX, alternates: localeAlternates(path, locale) };
}

function Block({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case "h2":
      return (
        <h2 id={block.id} className="text-h3 text-fg scroll-mt-20 pt-6 font-semibold text-balance">
          {block.text}
        </h2>
      );
    case "h3":
      return <h3 className="text-body text-fg pt-2 font-semibold">{block.text}</h3>;
    case "p":
      return <p className="text-body text-fg-secondary text-pretty">{block.text}</p>;
    case "list":
      return (
        <ul className="text-body text-fg-secondary grid list-disc gap-2 ps-6">
          {block.items.map((item) => (
            <li key={item} className="text-pretty">
              {item}
            </li>
          ))}
        </ul>
      );
    case "lines":
      return (
        <p className="text-body text-fg-secondary grid gap-1">
          {block.lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </p>
      );
  }
}

/**
 * One of Linkyo's legal pages: the title in the visitor's language, a note that this is a draft for
 * the lawyer (while it is one: company data missing, no review, or a bracketed marker left; a launch
 * build fails in that state, live-guard.ts), in English and Arabic a note that the German text is
 * the binding one, then the German text itself (marked `lang="de"`, left to right, also inside an
 * Arabic page).
 *
 * The German titles hold words of twenty letters ("Geschäftsbedingungen", "Datenschutzerklärung"), wider
 * than a 360 or 390 px column at the large title size. So the title is a size smaller on phones (as every
 * heading of the website is: `text-h2 md:text-h1`), and it may hyphenate and, as a last resort on the
 * narrowest phones, break inside a word (`wrap-anywhere`) instead of running out of its box and widening
 * the whole page. The text below breaks long words and addresses the same way.
 */
export async function LegalPage({ locale, title, doc }: { locale: string; title: LegalTitle; doc: LegalDoc }) {
  const t = await getTranslations({ locale, namespace: "legal" });
  const draft = legalIsDraft({ legalReady, reviewed: process.env.LEGAL_REVIEWED, markers: reviewMarkers([doc]) });
  return (
    <main id="main" className="mx-auto grid w-full max-w-prose grid-cols-1 gap-6 px-4 pt-10 pb-16 md:pt-16">
      <h1 className="text-h2 md:text-h1 text-fg font-semibold text-balance hyphens-auto wrap-anywhere">{t(`titles.${title}`)}</h1>
      <div className="grid gap-3">
        {draft ? (
          <p role="note" className="border-line bg-surface text-small text-fg flex items-start gap-3 rounded-lg border p-4">
            <Icon icon={FileWarning} size="sm" className="text-fg-secondary mt-0.5 shrink-0" />
            <span>{t("draft")}</span>
          </p>
        ) : null}
        {locale === "de" ? null : (
          <p className="border-line bg-surface text-small text-fg flex items-start gap-3 rounded-lg border p-4">
            <Icon icon={Languages} size="sm" className="text-fg-secondary mt-0.5 shrink-0" />
            <span>{t("german")}</span>
          </p>
        )}
      </div>
      <div lang="de" dir="ltr" className="grid grid-cols-1 gap-4 text-start wrap-break-word">
        {doc.map((block, index) => (
          <Block key={`${block.kind}-${String(index)}`} block={block} />
        ))}
      </div>
    </main>
  );
}
