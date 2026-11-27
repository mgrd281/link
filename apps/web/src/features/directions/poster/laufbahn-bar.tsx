import type { BlockOf, Page } from "@linkyo/blocks";
import { cn, Icon } from "@linkyo/ui";
import { Check, Download, FileText, Share } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import type { DocumentsView } from "@/features/documents/offer";

import { initials, PlatformGlyph } from "../shared/creator-kit";
import { LinkIconGlyph, linkGlyph } from "../shared/link-icons";
import { aiText } from "./hero";
import type { IndexEntry } from "./laufbahn-index";
import { ShareButtonIsland } from "./share-island";
// Laufbahn's bar parts load with Laufbahn's pages only (a client module that splits them off, ADR 0008).
import { BarReveal, SectionSwitcher } from "./signposted-bar";
import { pageSide } from "./styles";

type Profile = Page["profile"];
type Primary = BlockOf<"contact">["primary"];

/** A document the bar and the contents sheet offer: its address, file name, visible word and accessible name. */
export interface DocumentLink {
  kind: "cv" | "letter";
  href: string;
  /** The `download` file name; absent for the owner's own file (another site's address). */
  filename?: string | undefined;
  label: string;
  /** The bar's name for it ("Lebenslauf herunterladen (PDF)"): its pill shows the document's word alone. */
  name: string;
  /** A row's name ("Lebenslauf · PDF herunterladen"): it starts with the row's visible words (WCAG 2.5.3). */
  rowName: string;
  own?: boolean;
}

/** The documents a page offers, as links with their words (the bar's pills, the sheet's rows, the Kontakt band's rows). */
export function useDocumentLinks(documents: DocumentsView | null, ownCv: { href: string; label: string | null } | null): DocumentLink[] {
  const t = useTranslations("creator");
  const links: DocumentLink[] = [];
  if (documents?.cv) {
    links.push({
      kind: "cv",
      href: documents.cv.href,
      filename: documents.cv.filename,
      label: t("laufbahn.cv"),
      name: t("laufbahn.downloadShort", { document: t("laufbahn.cv") }),
      rowName: t("laufbahn.pdfRowName", { document: t("laufbahn.cv") }),
    });
  } else if (ownCv) {
    const label = ownCv.label ?? t("laufbahn.cv");
    links.push({ kind: "cv", href: ownCv.href, label, name: label, rowName: label, own: true });
  }
  if (documents?.letter) {
    links.push({
      kind: "letter",
      href: documents.letter.href,
      filename: documents.letter.filename,
      label: t("laufbahn.letter"),
      name: t("laufbahn.downloadShort", { document: t("laufbahn.letter") }),
      rowName: t("laufbahn.pdfRowName", { document: t("laufbahn.letter") }),
    });
  }
  return links;
}

/** A round control on ink, 44 px. */
const round = "grid size-touch-target shrink-0 place-items-center rounded-full transition-colors duration-micro focus-visible:focus-ring-inverse motion-reduce:transition-none";
/** A soft fill on ink, a little lighter under the pointer (an overlay in the text's own colour). */
const soft =
  "relative isolate bg-hover-inverse text-white after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-current after:opacity-0 after:transition-opacity after:duration-micro hover:after:opacity-hover";

/** The primary action's icon: the owner's choice, else what its address says (mail, phone, a platform). */
function PrimaryGlyph({ primary }: { primary: Primary }): ReactNode {
  const glyph = linkGlyph(primary.url, primary.icon);
  return glyph.kind === "platform" ? <PlatformGlyph platform={glyph.platform} size="md" /> : <LinkIconGlyph icon={glyph.icon} size="md" className="shrink-0" />;
}

/**
 * Laufbahn's app bar (ADR 0069 round 6): ink like the head and the browser's top, a hairline at its
 * foot, absent while the name is on screen and fading in once it has passed under it (BarReveal,
 * lb-bar); with reduced motion it simply appears. Its row stands on the canvas on wide screens.
 *
 * Start: the initials, then the name over the section being read, which opens the contents (with the
 * documents as a second group). End, on phones: fixed round buttons, so a long label never squeezes
 * the title: the CV as a download (Share where the page offers no CV), then the primary action filled
 * in white. On the wide canvas: the documents as soft pills, the primary action as a white pill with
 * its label, and one round Share; never a second Share.
 */
export function DossierBar({
  profile,
  primary,
  primaryBlock,
  sections,
  documents,
}: {
  profile: Profile;
  primary: Primary | null | undefined;
  /** The id of the contact block the primary action comes from (its block mark). */
  primaryBlock?: string | undefined;
  sections: readonly IndexEntry[];
  /** The documents the page offers (useDocumentLinks). */
  documents: readonly DocumentLink[];
}): ReactNode {
  const cv = documents.find((link) => link.kind === "cv");
  const pdfs = documents;
  return (
    <div className="pointer-events-none sticky top-0 layer-sticky h-0">
      <div className="poster-bar lb-bar lb-ground pointer-events-auto relative border-b border-hover-inverse text-white">
        <div className="flex h-control-xl items-center gap-3 ps-creator-gutter pe-2 @work:mx-auto @work:box-content @work:h-16 @work:max-w-work @work:px-creator-gutter">
          <span aria-hidden className="grid size-avatar-sm shrink-0 place-items-center rounded-full bg-white text-caption font-bold text-ink">
            {initials(profile.displayName)}
          </span>
          {sections.length > 1 ? (
            <SectionSwitcher entries={sections} name={profile.displayName} ai={aiText(profile, "displayName")} documents={pdfs} />
          ) : (
            <p dir="auto" className={cn(pageSide, "min-w-0 flex-1 truncate text-small font-semibold")} {...aiText(profile, "displayName")}>
              {profile.displayName}
            </p>
          )}
          <div className="flex shrink-0 items-center gap-2">
            {/* Phones: the CV as one round download. */}
            {cv ? (
              <a href={cv.href} download={cv.filename} aria-label={cv.name} className={cn(round, soft, "@work:hidden")}>
                <Icon icon={cv.own ? FileText : Download} size="md" />
              </a>
            ) : null}
            {/* The wide canvas: each document as a soft pill. */}
            {pdfs.map((link) => (
              <a
                key={link.href}
                href={link.href}
                download={link.filename}
                aria-label={link.own ? undefined : link.name}
                className={cn(
                  "hidden min-h-control-md items-center gap-2 rounded-full px-4 text-small font-semibold transition-colors duration-micro focus-visible:focus-ring-inverse motion-reduce:transition-none @work:inline-flex",
                  soft,
                )}
              >
                <Icon icon={link.own ? FileText : Download} size="sm" className="shrink-0" />
                <span dir="auto">{link.label}</span>
              </a>
            ))}
            {primary ? (
              // Phones: the action's icon in a round white button, named by its whole label; the wide canvas: a white pill with its label.
              <a
                href={primary.url}
                data-bar-action
                data-block={primaryBlock}
                className="inline-flex min-h-touch-target min-w-touch-target shrink-0 items-center justify-center gap-2 rounded-full bg-white text-small font-semibold text-ink transition-[scale] duration-micro focus-visible:focus-ring-inverse active:scale-pressed motion-reduce:transition-none motion-reduce:active:scale-none @work:max-w-[var(--container-menu)] @work:px-4"
              >
                <PrimaryGlyph primary={primary} />
                <span dir="auto" className="@max-work:sr-only @work:truncate">
                  {primary.label}
                </span>
              </a>
            ) : null}
            {/* One Share: on phones only where there is no CV to download; always on the wide canvas. */}
            <ShareButtonIsland
              title={profile.displayName}
              className={cn(round, soft, cv ? "hidden @work:grid" : undefined)}
              icons={{ share: <Icon icon={Share} size="md" />, copied: <Icon icon={Check} size="md" /> }}
            />
          </div>
          <BarReveal />
        </div>
      </div>
    </div>
  );
}
