import type { BlockOf, Page, Profile } from "@linkyo/blocks";
import { creatorTokens } from "@linkyo/tokens";
import { PAIRING_IDS, type ResolvedCreatorTheme } from "@linkyo/tokens/creator";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import type { DocumentsView } from "@/features/documents/offer";

import { SignpostIndex, SignpostSection, signposts as signpostsOf, type Signpost } from "./laufbahn";
import { DossierBar, useDocumentLinks } from "./laufbahn-bar";
import { LaufbahnContact } from "./laufbahn-contact";
import { LaufbahnDocuments } from "./laufbahn-documents";
import { DossierHero, type HeadFacts, type Lead } from "./laufbahn-hero";
import type { PosterSection as Section } from "./sections";

/** The start of a signposted page's content: "read on" leads here when the first section has no title. */
const CONTENT_ID = "page-content";
/** The documents' section: its own address, in the contents like any titled section. */
const DOCUMENTS_ID = "unterlagen";

/**
 * The theme with its pairing as the tokens' own object. This body is a client module, so the theme it
 * gets from the server is a copy; the name is fitted by finding the theme's pairing among the tokens by
 * identity (`PAIRING_IDS.find(… === theme.pairing)`), which a copy never matches: an Arabic name was
 * fitted as a Latin one and came out smaller.
 */
function withTokenPairing(theme: ResolvedCreatorTheme): ResolvedCreatorTheme {
  const copy = JSON.stringify(theme.pairing);
  const id = PAIRING_IDS.find((key) => creatorTokens.pairings[key] === theme.pairing || JSON.stringify(creatorTokens.pairings[key]) === copy);
  return id ? { ...theme, pairing: creatorTokens.pairings[id] } : theme;
}

/** The hero's own props, the same for every treatment. */
export interface SignpostedHeroProps {
  profile: Page["profile"];
  socials: BlockOf<"socials"> | undefined;
  live: BlockOf<"live"> | undefined;
  theme: ResolvedCreatorTheme;
  preview: boolean;
  contact: BlockOf<"contact"> | undefined;
  primary: BlockOf<"contact">["primary"] | null | undefined;
  now: Date;
}

/**
 * The body of a signposted page (Laufbahn, `layout.headings` "signpost", ADR 0069 round 6, "Dossier"):
 * the app bar on ink, the head on ink (type first; its first action leads to the contact, the cover
 * letter, the first section or the content), the sections on the page's own ground with their titles
 * hanging beside them on the wide canvas, the documents ("Unterlagen") when the page offers them, and
 * the closing Kontakt band on ink with the page's footer in it. The renderer draws the sections' items
 * and loads this body through `./signposted-lazy.tsx`, so Laufbahn's client code ships with Laufbahn's
 * pages alone and never with the pages of other templates (ADR 0008).
 */
export default function SignpostedBody({
  profile,
  primary,
  contact,
  sections,
  items,
  marks,
  letter,
  documents,
  head,
  heroProps,
  hero,
  banner,
  preview,
  footer,
}: {
  profile: Profile;
  primary: BlockOf<"contact">["primary"] | null | undefined;
  contact: BlockOf<"contact"> | undefined;
  sections: Section[];
  /** Each section's items as the renderer drew them, by section id. */
  items: Record<string, ReactNode[]>;
  /** Each section's marks: the dashboard preview's block ids and the AI label, by section id. */
  marks: Record<string, { blockIds: string | undefined; ai: boolean }>;
  /** The page's cover letter: its section and its text block (the renderer finds it). */
  letter: { section: string; block: string } | undefined;
  /** The CV and the cover letter as PDFs, or null when the page offers none. */
  documents: DocumentsView | null;
  /** The position applied for and the employer, which the head shows. */
  head: HeadFacts;
  heroProps: SignpostedHeroProps;
  /** Any other hero than the bleed hero, drawn by the renderer. */
  hero: ReactNode;
  /** An overlay (a preview label) stands over the top of the page. */
  banner: boolean;
  preview: boolean;
  /** The page's footer: inside the Kontakt band on a page with a contact block, after the content otherwise. */
  footer: ReactNode;
}) {
  const t = useTranslations("creator");
  const Main = preview ? "div" : "main";
  const theme = withTokenPairing(heroProps.theme);
  // The contact block closes the page as its own band; it is no section of the content.
  const band = contact && primary ? contact : undefined;
  const content = band ? sections.filter((section) => section.id !== band.id) : sections;
  const ownCv = documents?.ownCv ?? null;
  const offered = documents !== null && (documents.cv !== null || documents.letter !== null || documents.ownCv !== null);
  const titled = signpostsOf(content);
  const documentsSign: Signpost | undefined = offered ? { id: DOCUMENTS_ID, anchor: DOCUMENTS_ID, title: t("laufbahn.documents") } : undefined;
  const signposts = documentsSign ? [...titled, documentsSign] : titled;
  const links = useDocumentLinks(documents, ownCv);
  const firstSign = titled[0];
  // Without a contact block the head's first action leads to the cover letter when the page has
  // one, else to the first section when that is titled, else to the start of the content (an untitled
  // run, a live card or a release first, is never skipped).
  const letterSign = letter ? titled.find((sign) => sign.id === letter.section) : undefined;
  const heroLead: Lead | undefined = letterSign
    ? { href: `#${letterSign.anchor}`, kind: "letter" }
    : !firstSign
      ? undefined
      : content[0]?.id === firstSign.id
        ? { href: `#${firstSign.anchor}`, kind: "section", title: firstSign.title }
        : { href: `#${CONTENT_ID}`, kind: "content" };
  return (
    <>
      <DossierBar profile={profile} primary={primary} primaryBlock={contact?.id} sections={signposts.map(({ anchor, title }) => ({ anchor, title }))} documents={links} />
      {theme.layout.hero === "bleed" ? <DossierHero {...heroProps} theme={theme} lead={heroLead} banner={banner} documents={documents} head={head} /> : hero}
      {/* Marks the end of the hero: the Linkyo bar slides in once this has scrolled up. */}
      <div data-poster-sentinel aria-hidden />
      {/* Phones: the sections in one column (their contents open from the app bar). Tablets: the
          index's chips, then the sections, in the reading column. The wide canvas: every section a row
          of twelve columns, its title hanging in the first three. */}
      <Main
        id={CONTENT_ID}
        className="relative grid grid-cols-1 gap-16 px-creator-gutter pt-16 pb-16 @prose:mx-auto @prose:max-w-prose @prose:px-0 @work:box-content @work:max-w-work @work:gap-24 @work:px-creator-gutter @work:pt-32 @work:pb-24"
      >
        {signposts.length > 1 ? <SignpostIndex entries={signposts} /> : null}
        {content.map((section) => (
          <SignpostSection key={section.id} entry={titled.find((sign) => sign.id === section.id)} blockIds={marks[section.id]?.blockIds} ai={marks[section.id]?.ai ?? false}>
            {items[section.id]}
          </SignpostSection>
        ))}
        {documents && documentsSign ? (
          <SignpostSection entry={documentsSign} ai={false}>
            <LaufbahnDocuments documents={documents} locale={profile.locale} paper={theme.palette.mode === "dark" ? "dark" : "light"} />
          </SignpostSection>
        ) : null}
        {/* The end of the content: once it is on screen, the index marks the last section. Out of the
            grid's flow (absolute), so it adds no gap under the last section. */}
        <div data-lb-end aria-hidden className="absolute inset-x-0 bottom-0 h-px" />
      </Main>
      {band ? <LaufbahnContact contact={band} now={heroProps.now} documents={links} shareTitle={profile.displayName} footer={footer} /> : footer}
    </>
  );
}
