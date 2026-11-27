import type { Profile } from "@linkyo/blocks";
import { cn, Icon } from "@linkyo/ui";
import { Check, Download, FileText, Files } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { PaperMiniature } from "@/features/documents/miniature";
import type { DocumentCard, DocumentsView } from "@/features/documents/offer";

import { isPdf } from "./hero";
import { pageSide } from "./styles";

/** The words of the documents' cards, from the page's language. */
const DATE_LOCALES: Record<Profile["locale"], string> = { de: "de-DE", en: "en-GB", ar: "ar" };

/**
 * On a dark page the paper stays white, as printed, so its marks keep the printed tones too: the
 * page's dark palette would draw near-white bars on white paper (ADR 0089: paper colours are the
 * light palette). Ink for the text, greys for the rules, the accent itself for the accent.
 */
const PRINTED_TONES = "[--creator-fg:var(--color-ink)] [--creator-line-strong:var(--color-gray-400)] [--creator-line:var(--color-gray-200)] [--creator-accent-text:var(--creator-accent)]";

/** The paper: white whatever the page's mode (as printed), A4, its first page's marks or blank. */
function Paper({ marks, paper }: { marks: DocumentCard["miniature"]; paper: "light" | "dark" }): ReactNode {
  return (
    <span
      aria-hidden
      className={cn(
        "relative grid aspect-a4 w-avatar-xl shrink-0 place-items-center overflow-hidden rounded-xs bg-white transition-transform duration-standard ease-emphasized group-hover:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 @work:w-[calc(var(--spacing-avatar-xl)+var(--spacing-12))]",
        paper === "dark" && PRINTED_TONES,
      )}
    >
      {marks ? <PaperMiniature marks={marks} className="absolute inset-0 size-full" /> : <Icon icon={FileText} size="lg" className="text-creator-line-strong" />}
    </span>
  );
}

/** The whole card is one download link: the paper, the title, "PDF · A4 · 1 Seite" and the pill. */
const card = cn(
  "group grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-5 rounded-creator-card bg-creator-surface-2 p-4 @work:p-6",
  "transition-[background-color,scale] duration-micro ease-standard hover:bg-creator-line focus-visible:focus-ring active:scale-pressed",
  "motion-reduce:transition-colors motion-reduce:active:scale-none",
);

/**
 * "Unterlagen" (ADR 0069 round 6): the CV and the cover letter as PDFs set from the page itself, one
 * card each (stacked on phones, side by side on the wide canvas), then both in one file, then the date
 * of the page's last save. Each card is one real `<a download>`: the browser's own download (or iOS's
 * PDF viewer) is the state, so there is no spinner and no toast. An owner's own CV replaces the
 * generated one (a link to their file, a blank paper). Under the pointer the paper rises a little and
 * the pill's arrow nudges down; with reduced motion only the colour changes.
 */
export function LaufbahnDocuments({ documents, locale, paper = "light" }: { documents: DocumentsView; locale: Profile["locale"]; paper?: "light" | "dark" | undefined }): ReactNode {
  const t = useTranslations("creator");
  const cards: { key: string; title: string; href: string; filename?: string | undefined; pages: number | null; marks: DocumentCard["miniature"]; own: boolean }[] = [
    ...(documents.cv ? [{ key: "cv", title: t("laufbahn.cv"), href: documents.cv.href, filename: documents.cv.filename, pages: documents.cv.pages, marks: documents.cv.miniature, own: false }] : []),
    ...(!documents.cv && documents.ownCv
      ? [{ key: "own", title: documents.ownCv.label ?? t("laufbahn.cv"), href: documents.ownCv.href, filename: undefined, pages: null, marks: null, own: true }]
      : []),
    ...(documents.letter
      ? [{ key: "letter", title: t("laufbahn.letter"), href: documents.letter.href, filename: documents.letter.filename, pages: documents.letter.pages, marks: documents.letter.miniature, own: false }]
      : []),
  ];
  const asOf = documents.asOf ? new Date(documents.asOf) : null;
  const date =
    asOf && !Number.isNaN(asOf.getTime())
      ? new Intl.DateTimeFormat(DATE_LOCALES[locale], { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" }).format(asOf)
      : null;
  return (
    <div data-lb-documents className="grid min-w-0 gap-6">
      <p className="max-w-prose text-body text-pretty text-creator-fg-muted">{t("laufbahn.documentsLead")}</p>
      <ul className={cn("grid min-w-0 grid-cols-1 gap-4 @work:gap-6", cards.length > 1 && "@work:grid-cols-2")}>
        {cards.map((entry) => (
          <li key={entry.key} className="min-w-0">
            <a
              href={entry.href}
              download={entry.own ? undefined : entry.filename}
              className={card}
            >
              <Paper marks={entry.marks} paper={paper} />
              <span className="grid min-w-0 justify-items-start gap-1">
                <span dir="auto" className={cn(pageSide, "max-w-full text-title font-bold break-words")}>
                  {entry.title}
                </span>
                {entry.pages !== null ? (
                  <span className="text-small text-creator-fg-muted">{t("laufbahn.pdfMeta", { pages: entry.pages })}</span>
                ) : isPdf(entry.href) ? (
                  <span className="text-small text-creator-fg-muted">{t("laufbahn.pdf")}</span>
                ) : null}
                <span className="mt-3 inline-flex min-h-control-md items-center gap-2 rounded-full bg-creator-fg px-4 text-small font-semibold text-creator-bg">
                  <Icon
                    icon={entry.own ? FileText : Download}
                    size="sm"
                    className="shrink-0 transition-transform duration-micro group-hover:translate-y-0_5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
                  />
                  {t("laufbahn.download")}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      {documents.application ? (
        <a
          href={documents.application.href}
          download={documents.application.filename}
          aria-label={t("laufbahn.applicationName", { pages: documents.application.pages })}
          className="inline-flex min-h-control-lg max-w-full items-center gap-2 justify-self-start rounded-full border border-creator-line-strong px-5 text-body font-semibold transition-[background-color,scale] duration-micro hover:bg-creator-surface-2 focus-visible:focus-ring active:scale-pressed motion-reduce:transition-colors motion-reduce:active:scale-none"
        >
          <Icon icon={Files} size="md" className="shrink-0" />
          <span className="min-w-0 break-words">{t("laufbahn.application", { pages: documents.application.pages })}</span>
        </a>
      ) : null}
      {date ? (
        <p className="inline-flex items-center gap-2 text-small text-creator-fg-muted">
          <Icon icon={Check} size="sm" className="shrink-0" />
          {t("laufbahn.asOf", { date })}
        </p>
      ) : null}
    </div>
  );
}
