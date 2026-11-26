import type { Block, BlockOf, Page } from "@linkyo/blocks";

import { applicationSample } from "@/features/previews/application-sample";

/**
 * Fictional pages for the documents' tests (nobody here is a real person; contact data is
 * example.com and the film-and-television phone range). Built from the fictional applicant
 * (features/previews/application-sample.ts) with one thing changed each.
 */

export const jonasDe = (): Page => applicationSample("de");
export const jonasEn = (): Page => applicationSample("en");
export const karimAr = (): Page => applicationSample("ar");

/** The fictional applicant with some blocks changed or replaced. */
function withBlocks(page: Page, change: (blocks: Block[]) => Block[]): Page {
  return { ...page, blocks: change(page.blocks) };
}

const replace = <T extends Block["type"]>(type: T, change: (block: BlockOf<T>) => BlockOf<T>) => (blocks: Block[]): Block[] =>
  blocks.map((block) => (block.type === type ? change(block as BlockOf<T>) : block));

/** A name WinAnsi cannot print: no PDF in v1 (a letter is never dropped). */
export const lukasz = (): Page => {
  const page = jonasDe();
  return { ...page, profile: { ...page.profile, displayName: "Łukasz Kowalski" } };
};

/** No cover letter: the CV only. */
export const noLetter = (): Page => withBlocks(jonasDe(), (blocks) => blocks.filter((block) => block.id !== "letter" && block.id !== "letter-title"));

/** The cover letter switched off. */
export const hiddenLetter = (): Page => withBlocks(jonasDe(), replace("text", (block) => (block.id === "letter" ? { ...block, visible: false } : block)));

/** The cover letter scheduled to have ended before `now` in the tests (2026-11-26). */
export const endedLetter = (): Page =>
  withBlocks(jonasDe(), replace("text", (block) => (block.id === "letter" ? { ...block, schedule: { until: "2026-11-01T00:00:00Z" } } : block)));

/** A career only: no about, skills, note, letter or contact. */
export const sparse = (): Page => withBlocks(jonasDe(), (blocks) => blocks.filter((block) => block.type === "timeline"));

/** Skills only. */
export const toolsOnly = (): Page => withBlocks(jonasDe(), (blocks) => blocks.filter((block) => block.type === "tools"));

/** Figures and a bio only: nothing for a CV. */
export const statsAndBio = (): Page => withBlocks(jonasDe(), () => []);

/** The owner's own CV file in the contact block: it replaces the generated one. */
export const ownCv = (): Page =>
  withBlocks(
    jonasDe(),
    replace("contact", (block) => ({ ...block, links: [...(block.links ?? []), { kind: "cv", label: "Mein Lebenslauf", url: "https://example.com/jonas-brandt-lebenslauf.pdf" }] })),
  );

/** The same applicant with a longer e-mail address (the miniature's contact bars keep their width). */
export const longEmail = (): Page =>
  withBlocks(
    jonasDe(),
    replace("contact", (block) => ({ ...block, primary: { ...block.primary, url: "mailto:jonas.brandt.bewerbungen.lagerlogistik@example.com" } })),
  );

/** A letter with no salutation and no closing: nothing is added. */
export const bareLetter = (): Page =>
  withBlocks(
    jonasDe(),
    replace("text", (block) =>
      block.id === "letter"
        ? {
            ...block,
            text: "Seit 2017 arbeite ich in Lagern von Handel und Industrie und bringe Erfahrung mit Scanner, SAP und Stapler mit.\n\nIch kann ab dem 1. März 2027 beginnen und freue mich auf Ihre Antwort, gern auch telefonisch oder per E-Mail.\n\nIm Team bleibe ich ruhig, auch wenn am Freitagnachmittag drei Lkw gleichzeitig an der Rampe stehen.",
          }
        : block,
    ),
  );
