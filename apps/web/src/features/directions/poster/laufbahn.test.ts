import type { Block, BlockOf, Page } from "@linkyo/blocks";
import { creatorTokens } from "@linkyo/tokens";
import { resolveCreatorTheme, type CreatorThemeConfig } from "@linkyo/tokens/creator";
import { NextIntlClientProvider } from "next-intl";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { documentFilename, documentLinks, letterSubject, type DocumentsView } from "@/features/documents/offer";
import { MOTION_LIBRARY } from "@/features/creator/motion-library";
import { applicationSample } from "@/features/previews/application-sample";
import { PREVIEWS } from "@/features/previews/registry";
import { SEVAG_SLUG, sevagDe } from "@/features/previews/sevag";
import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { factRows, factSpans, LaufbahnAbout, signposts } from "./laufbahn";
import { widePlateRatio } from "./laufbahn-hero";
import { splitLead } from "./laufbahn-content";
import { PosterRenderer } from "./renderer";
import { portfolioSample } from "./sample";

// Laufbahn (ADR 0069, round 6 "Dossier") rendered to HTML in Node: the head on ink, type first (the
// status, the name, the role, the target line, the place, the sentence, two actions, the figures, the
// plate), the bar on ink with the documents, the sections with hanging titles, "Unterlagen" with its
// cards, and the closing Kontakt band on ink. Fictional pages (Jonas Brandt, Karim Nasser, the
// portfolio sample) and Sevag's page as the repository holds it (no contact block, no private data).

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children?: unknown }) => createElement("a", { href, ...rest }, children as never),
  useRouter: () => ({ push: () => undefined, replace: () => undefined }),
  usePathname: () => "/",
}));

const MESSAGES = { de, en, ar };
const NOW = new Date("2026-11-26T10:00:00Z");

/** The documents as the server's view gives them before the PDF layout lands (one page each, no miniature). */
function documentsOf(page: Page, base: string, asOf: string | null = null): DocumentsView | null {
  const links = documentLinks(page, base, { signposted: true, now: NOW });
  if (!links) return null;
  const locale = page.profile.locale === "en" ? "en" : "de";
  const card = (kind: "cv" | "letter" | "application", href: string | null, pages: number) =>
    href ? { kind, href, filename: documentFilename(kind, page.profile.displayName, locale).ascii, pages, miniature: null } : null;
  const cv = card("cv", links.cv, 1);
  const letter = card("letter", links.letter, 1);
  const words = locale === "de" ? { subjectFor: (value: string) => `Bewerbung als ${value}`, subjectBare: "Bewerbung" } : { subjectFor: (value: string) => `Application for ${value}`, subjectBare: "Application" };
  return {
    cv,
    letter,
    application: card("application", links.application, (cv?.pages ?? 0) + (letter?.pages ?? 0)),
    ownCv: links.ownCv ? { href: links.ownCv, label: null } : null,
    asOf,
    subject: letter ? letterSubject(page, words) : null,
  };
}

const render = (page: Page, config: CreatorThemeConfig = { template: "laufbahn" }, documents: DocumentsView | null = null): string =>
  renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale: page.profile.locale,
      messages: MESSAGES[page.profile.locale],
      timeZone: "Europe/Berlin",
      children: createElement(PosterRenderer, { page, theme: resolveCreatorTheme(config, { rtlScript: page.profile.locale === "ar" }), documents }),
    }),
  );

/** The text a visitor reads, without tags (entities decoded where the page has them). */
const text = (markup: string): string =>
  markup
    .replace(/<[^>]+>/g, "")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll(String.fromCharCode(0xad), "")
    .replaceAll(String.fromCharCode(0xa0), " ");
const count = (markup: string, pattern: RegExp): number => markup.match(pattern)?.length ?? 0;
/** The page without its closed contents sheet (a dialog), as the document reads before it opens. */
const page = (markup: string): string => markup.replace(/<dialog[\s\S]*?<\/dialog>/g, "");
/** The section titles a visitor reads on the page (the h2 headings outside the sheet). */
const headingsOf = (markup: string): string[] => [...page(markup).matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((match) => text(match[1] ?? ""));
const headOf = (markup: string): string => /<header data-lb-head[\s\S]*?<\/header>/.exec(markup)?.[0] ?? "";
const barOf = (markup: string): string => /<div class="poster-bar[\s\S]*?<\/dialog>[\s\S]*?<\/div><\/div><\/div>/.exec(markup)?.[0] ?? "";
const sheetOf = (markup: string): string => /<dialog[^>]*class="lb-sheet"[\s\S]*?<\/dialog>/.exec(markup)?.[0] ?? "";

const jonas = applicationSample("de");
const jonasDocs = documentsOf(jonas, "/de/p/jonas-brandt");
const jonasMarkup = render(jonas, { template: "laufbahn" }, jonasDocs);
const karim = applicationSample("ar");
const karimMarkup = render(karim, { template: "laufbahn" }, documentsOf(karim, "/ar/p/karim-nasser"));
const sevagTheme = PREVIEWS[SEVAG_SLUG]?.theme ?? {};
const sevag = render(sevagDe, sevagTheme);
const base = { visible: true, highlight: false } as const;

describe("the page's contents", () => {
  it("list the titled sections only, each with its own anchor", () => {
    const entries = signposts([
      { id: "top", title: null },
      { id: "about", title: "Über mich" },
      { id: "a b", title: "Zwei" },
      { id: "a-b", title: "Drei" },
    ]);
    expect(entries.map((entry) => entry.title)).toEqual(["Über mich", "Zwei", "Drei"]);
    expect(entries.map((entry) => entry.anchor)).toEqual(["section-about", "section-a-b", "section-a-b-3"]);
  });
});

describe("the head (round 6): type first, on ink", () => {
  const head = headOf(jonasMarkup);

  it("is one header on ink with the parts in reading order", () => {
    expect(head).toMatch(/^<header data-lb-head="true" class="poster-hero-timeline lb-ground text-white/);
    const order = ["Verfügbar ab 1. März 2027", "Jonas Brandt", "Fachkraft für Lagerlogistik · Staplerfahrer", "Bewerbung als Fachkraft für Lagerlogistik (m/w/d)", "Bremen", "Ich sorge dafür", "E-Mail schreiben", "Lebenslauf", "Jahre im Lager"];
    const words = text(head);
    const positions = order.map((part) => words.indexOf(part));
    for (const [index, position] of positions.entries()) expect(position, order[index]).toBeGreaterThanOrEqual(0);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(count(jonasMarkup, /<h1/g)).toBe(1);
    expect(head).toMatch(/<h1 data-lb-name="true"[^>]*><bdi dir="auto">Jonas Brandt<\/bdi><\/h1>/);
  });

  it("keeps a separator's dot at the end of a line (a non-breaking space before it)", () => {
    expect(head).toContain(`Fachkraft für Lagerlogistik${String.fromCharCode(0xa0)}· Staplerfahrer`);
  });

  it("shows the owner's own label and value as the target line, and About no longer repeats that fact", () => {
    const target = /<p data-lb-target[\s\S]*?<\/p>/.exec(head)?.[0] ?? "";
    expect(target).toMatch(/<span dir="auto" class="lb-ink-muted">Bewerbung als<\/span> <bdi dir="auto" class="font-semibold text-white">Fachkraft für Lagerlogistik \(m\/w\/d\)<\/bdi>/);
    const about = /<section id="section-about"[\s\S]*?<\/section>/.exec(jonasMarkup)?.[0] ?? "";
    expect(text(about)).not.toContain("Bewerbung als");
    expect(text(about)).toContain("SprachenDeutsch, Englisch (B1)");
  });

  it("names the employer beside the target when there is one (Sevag's page)", () => {
    const target = text(/<p data-lb-target[\s\S]*?<\/p>/.exec(sevag)?.[0] ?? "");
    expect(target).toBe("Bewerbung als Lagerist / Töner (w/m/d) · Für Sales Center Lörrach");
  });

  it("splits each figure into qualifier, number and unit; the label comes first for screen readers", () => {
    const figures = /<dl class="mt-10[\s\S]*?<\/dl>/.exec(head)?.[0] ?? "";
    const cells = [...figures.matchAll(/<div class="row-span-3[^"]*">([\s\S]*?)<\/div>/g)].map((match) => match[1] ?? "");
    expect(cells).toHaveLength(3);
    for (const cell of cells) expect(cell.indexOf("<dt")).toBe(0);
    // One qualifier ("seit"), so the row is kept for all three: the numbers stand level.
    expect(count(figures, /row-start-1/g)).toBe(3);
    expect(figures).toMatch(/<bdi dir="ltr"[^>]*><span[^>]*>99,6<\/span><span class="[^"]*calc\(var\(--figure-size\)\/2\)[^"]*">%<\/span><\/bdi>/);
    // Sevag's "SAP" is a value in words, set at the words' size.
    expect(headOf(sevag)).toMatch(/<dd dir="auto" class="[^"]*text-h3[^"]*">SAP<\/dd>/);
    // On an Arabic page the digits stand in the template's Latin face (the Arabic face has none).
    expect(headOf(karimMarkup)).toMatch(/<bdi dir="ltr" class="[^"]*rtl:font-display[^"]*"><span[^>]*>99.6<\/span>/);
  });

  it("ends with the picture as a 3 : 2 plate from edge to edge on phones, no parallax and no veil", () => {
    expect(head).toMatch(/data-hero-plate="true" class="relative mt-10 aspect-photo[^"]*@work:col-start-9/);
    expect(jonasMarkup).not.toMatch(/(?<![\w-])lb-(?:parallax|veil|plate|name)\b/);
  });

  it("stands the plate on the wide canvas in the picture's own shape, level with the words (the drawn 4 : 5 clip whole)", () => {
    const plate = /<div data-hero-plate="true" class="([^"]*)" style="([^"]*)"/.exec(head);
    expect(plate?.[1]).toContain("@work:aspect-[var(--plate-ratio)]");
    expect(plate?.[1]).toContain("@work:self-start");
    expect(plate?.[1]).not.toMatch(/@work:(?:self-stretch|min-h-full|aspect-auto)/);
    expect(plate?.[2]).toBe("--plate-ratio:0.8");
    expect(jonas.profile.hero).toMatchObject({ w: 1080, h: 1350 });
    // Only a picture taller than 4 : 5 or flatter than 4 : 3 is cropped to that; no size: 4 : 5.
    expect([widePlateRatio({ w: 1080, h: 1350 }), widePlateRatio({ w: 900, h: 1600 }), widePlateRatio({ w: 1600, h: 900 }), widePlateRatio({ w: 1200, h: 1000 }), widePlateRatio({})]).toEqual([0.8, 0.8, 4 / 3, 1.2, 0.8]);
  });

  it("has no plate and no initials without a picture", () => {
    const bare = render({ ...jonas, profile: { ...jonas.profile, hero: undefined, motion: undefined } });
    expect(headOf(bare)).not.toContain("data-hero-plate");
    expect(headOf(bare)).not.toContain("<img");
    expect(headOf(bare)).toContain("pb-10");
  });

  it("keeps the name's space under a live pill when there is no status", () => {
    const live: Block = { ...base, id: "live", type: "live", platform: "twitch", channel: "example", isLive: true, title: "Q&A", url: "https://www.twitch.tv/example" };
    const noStatus: Page = {
      ...jonas,
      blocks: [live, ...jonas.blocks.map((block) => (block.type === "contact" ? { ...block, status: undefined } : block))],
    };
    const markup = headOf(render(noStatus));
    expect(markup).not.toContain("bg-success");
    expect(markup).toMatch(/<h1 data-lb-name="true" class="mt-5 /);
    // Neither a status nor a live pill: the name starts at the top.
    const quiet = headOf(render({ ...noStatus, blocks: noStatus.blocks.filter((block) => block.type !== "live") }));
    expect(quiet).toMatch(/<h1 data-lb-name="true" class="[^"]*\bmt-0\b/);
  });

  it("drops each row the page does not fill (A.7)", () => {
    const empty: Page = {
      ...jonas,
      profile: { ...jonas.profile, tagline: undefined, location: undefined, bio: "", stats: undefined },
      blocks: jonas.blocks.filter((block) => block.type !== "about" && block.type !== "contact"),
    };
    const markup = headOf(render(empty));
    expect(markup).not.toContain("bg-success");
    expect(markup).not.toContain("data-lb-target");
    expect(markup).not.toContain("lucide-map-pin");
    expect(markup).not.toContain("<dl");
    expect(text(markup)).not.toContain("Fachkraft");
    // Without a contact block the first action is the letter.
    expect(text(/<div data-hero-actions[\s\S]*?<\/button>/.exec(markup)?.[0] ?? "")).toContain("Anschreiben lesen");
  });

  it("offers the CV as the second action, then the owner's own CV, then Share", () => {
    const withCv = /<div data-hero-actions[\s\S]*?<\/a><\/div>/.exec(head)?.[0] ?? "";
    expect(withCv).toMatch(/<a href="\/de\/p\/jonas-brandt\/cv" download="Lebenslauf_Jonas_Brandt.pdf" data-app-download="" aria-label="Lebenslauf herunterladen \(PDF, 1 Seite\)"/);
    expect(withCv).not.toContain("Teilen");
    const own: Page = {
      ...jonas,
      blocks: jonas.blocks.map((block) => (block.type === "contact" ? { ...block, links: [...(block.links ?? []), { kind: "cv" as const, url: "https://example.com/cv.pdf" }] } : block)),
    };
    const ownHead = headOf(render(own, { template: "laufbahn" }, documentsOf(own, "/de/p/jonas-brandt")));
    expect(ownHead).toMatch(/<a href="https:\/\/example.com\/cv.pdf"[^>]*>[\s\S]*?Lebenslauf \(PDF\)/);
    const none = headOf(render(jonas));
    expect(text(/<div data-hero-actions[\s\S]*?<\/button>/.exec(none)?.[0] ?? "")).toBe("E-Mail schreibenTeilen");
  });

  it("uses the white focus ring on ink, and never the accent for the filled action", () => {
    const actions = /<div data-hero-actions[\s\S]*?<\/a><\/div>/.exec(head)?.[0] ?? "";
    expect(count(actions, /focus-visible:focus-ring-inverse/g)).toBe(2);
    expect(actions).toContain("bg-white text-ink");
    expect(actions).not.toContain("bg-creator-accent");
  });
});

describe("the bar on ink", () => {
  it("offers the documents as pills on the wide canvas and as one round download on phones, with one Share", () => {
    const bar = barOf(jonasMarkup);
    expect(bar).toMatch(/class="poster-bar lb-bar lb-ground/);
    expect(count(bar, /aria-label="Seite teilen"/g)).toBe(1);
    // The phone's round download hides on the wide canvas; the Share beside it shows only there.
    expect(bar).toMatch(/<a href="\/de\/p\/jonas-brandt\/cv" download="Lebenslauf_Jonas_Brandt.pdf" data-app-download="" aria-label="Lebenslauf herunterladen \(PDF\)" class="[^"]*@work:hidden/);
    expect(bar).toMatch(/aria-label="Seite teilen" class="[^"]*\bhidden @work:grid/);
    expect(count(bar, /class="hidden min-h-control-md[^"]*@work:inline-flex/g)).toBe(2);
    expect(text(/<a [^>]*data-bar-action[\s\S]*?<\/a>/.exec(bar)?.[0] ?? "")).toBe("E-Mail schreiben");
  });

  it("has exactly one Share in every state: without documents, and in Arabic", () => {
    for (const markup of [render(jonas), karimMarkup]) {
      const bar = barOf(markup);
      expect(count(bar, /<button type="button" aria-label="(Seite teilen|شارك الصفحة)"/g)).toBe(1);
      expect(bar).not.toMatch(/\bhidden @work:grid/);
      expect(bar).not.toMatch(/download=/);
    }
  });

  it("lists the documents as a second group of the contents sheet, each a direct download, both in one file too", () => {
    const sheet = sheetOf(jonasMarkup);
    expect(sheet).toContain(">Unterlagen</h3>");
    expect([...sheet.matchAll(/<a href="([^"]+)" download="([^"]+)"[^>]*aria-label="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((match) => [match[1], match[2], match[3], text(match[4] ?? "")])).toEqual([
      ["/de/p/jonas-brandt/cv", "Lebenslauf_Jonas_Brandt.pdf", "Lebenslauf · PDF herunterladen", "Lebenslauf · PDF"],
      ["/de/p/jonas-brandt/letter", "Anschreiben_Jonas_Brandt.pdf", "Anschreiben · PDF herunterladen", "Anschreiben · PDF"],
      ["/de/p/jonas-brandt/application", "Bewerbung_Jonas_Brandt.pdf", "Beides in einer Datei · 2 Seiten: Anschreiben und Lebenslauf (PDF)", "Beides in einer Datei · 2 Seiten"],
    ]);
    expect(sheetOf(render(jonas))).not.toContain("Unterlagen</h3>");
    // The bar's pills and the Kontakt band keep to the two documents.
    expect(count(barOf(jonasMarkup).replace(sheet, ""), /\/application"/g)).toBe(0);
    expect(count(/<div data-block="contact" data-lb-contact[\s\S]*?<\/footer><\/div>/.exec(jonasMarkup)?.[0] ?? "", /\/application"/g)).toBe(0);
  });

  it("names the documents in English as a sentence would (a lower-case 'cover letter')", () => {
    const jonasEn = applicationSample("en");
    const markup = render(jonasEn, { template: "laufbahn" }, documentsOf(jonasEn, "/en/p/jonas-brandt"));
    expect(markup).toContain('aria-label="Download cover letter (PDF)"');
    expect(markup).toContain('aria-label="Download cover letter · PDF"');
    expect(markup).toContain('aria-label="Download cover letter as PDF (1 page)"');
    expect(markup).toContain('aria-label="Download CV (PDF, 1 page)"');
    expect(markup).not.toMatch(/aria-label="[^"]*Download Cover letter/);
    // The visible words keep their capital where they start a label.
    expect(text(sheetOf(markup))).toContain("Cover letter · PDF");
  });
});

describe("Unterlagen", () => {
  const section = /<section id="unterlagen"[\s\S]*?<\/section>/.exec(jonasMarkup)?.[0] ?? "";

  it("is a titled section in the contents, before the Kontakt band", () => {
    expect(headingsOf(jonasMarkup)).toEqual(["Über mich", "Kenntnisse", "Werdegang", "Als Nächstes", "Anschreiben", "Unterlagen", "Ich freue mich auf ein Gespräch."]);
    expect(jonasMarkup.indexOf('id="unterlagen"')).toBeLessThan(jonasMarkup.indexOf("data-lb-contact"));
  });

  it("makes each card one download link with the real page count, then both in one file and no date on a preview", () => {
    // Each card is named by its own words (no aria-label that would leave visible words out, WCAG
    // 2.5.3), in reading order and each part apart: never "LebenslaufPDF · A4 · 1 SeiteHerunterladen".
    const cards = [...section.matchAll(/<a href="([^"]+)" download="([^"]+)" data-app-download="" class="group grid[^"]*">([\s\S]*?)<\/a>/g)].map((match) => [match[1], match[2], text(match[3] ?? "")]);
    expect(cards).toEqual([
      ["/de/p/jonas-brandt/cv", "Lebenslauf_Jonas_Brandt.pdf", "Lebenslauf PDF · A4 · 1 Seite Herunterladen"],
      ["/de/p/jonas-brandt/letter", "Anschreiben_Jonas_Brandt.pdf", "Anschreiben PDF · A4 · 1 Seite Herunterladen"],
    ]);
    expect(text(section)).toContain("PDF · A4 · 1 Seite");
    expect(section).toMatch(/<a href="\/de\/p\/jonas-brandt\/application" download="Bewerbung_Jonas_Brandt.pdf" data-app-download="" aria-label="Beides in einer Datei · 2 Seiten: Anschreiben und Lebenslauf \(PDF\)"/);
    expect(text(section)).not.toContain("Stand:");
    // A blank paper (no miniature yet) is decorative.
    expect(section).toMatch(/<span aria-hidden="true" class="relative grid aspect-a4/);
  });

  it("dates the documents on a public page by its last save", () => {
    const markup = render(jonas, { template: "laufbahn" }, documentsOf(jonas, "/jonas-brandt", "2026-11-20T09:00:00Z"));
    expect(text(/<section id="unterlagen"[\s\S]*?<\/section>/.exec(markup)?.[0] ?? "")).toContain("Stand: 20. November 2026");
  });

  it("shows one card at full width and no 'Beides' when only one document is offered", () => {
    const cvOnly: Page = { ...jonas, blocks: jonas.blocks.filter((block) => block.id !== "letter") };
    const markup = render(cvOnly, { template: "laufbahn" }, documentsOf(cvOnly, "/de/p/jonas-brandt"));
    const documents = /<section id="unterlagen"[\s\S]*?<\/section>/.exec(markup)?.[0] ?? "";
    expect(count(documents, /class="group grid/g)).toBe(1);
    expect(documents).not.toContain("@work:grid-cols-2");
    expect(documents).not.toContain("/application");
  });

  it("is absent with documents null: no section, no pills, no sheet group, no letter pill, no subject", () => {
    const markup = render(jonas);
    expect(markup).not.toContain('id="unterlagen"');
    expect(markup).not.toMatch(/download=/);
    expect(markup).not.toContain("Unterlagen");
    expect(text(markup)).not.toContain("Bewerbung als Fachkraft für Lagerlogistik (m/w/d)Sehr geehrte Frau Albers");
  });
});

describe("the letter", () => {
  const letter = /<section id="section-letter-title"[\s\S]*?<\/section>/.exec(jonasMarkup)?.[0] ?? "";

  it("is set as a letter on white paper, with its PDF in the top line and the PDF's subject above the owner's words", () => {
    expect(letter).toMatch(/data-lb-letter="" class="[^"]*bg-white text-ink/);
    expect(letter).toMatch(/<a href="\/de\/p\/jonas-brandt\/letter" download="Anschreiben_Jonas_Brandt.pdf" data-app-download="" aria-label="Anschreiben als PDF herunterladen \(1 Seite\)"/);
    const words = text(letter);
    expect(words.indexOf("Bewerbung als Fachkraft für Lagerlogistik (m/w/d)")).toBeLessThan(words.indexOf("Sehr geehrte Frau Albers,"));
    // The owner's text exactly: nothing added before the salutation or after the closing.
    expect(words).toMatch(/Mit freundlichen Grüßen\nJonas BrandtGanzes|Mit freundlichen Grüßen\nJonas Brandt$/);
  });

  it("spans the content's columns like the sheets around it, the words keeping the reading measure", () => {
    const paper = /<div data-lb-letter="" class="([^"]*)"/.exec(letter)?.[1] ?? "";
    expect(paper).not.toMatch(/max-w-/);
    expect(letter).toMatch(/<div class="flex min-w-0 max-w-prose /);
    expect(count(letter, /<p dir="auto" class="[^"]*max-w-prose/g)).toBeGreaterThanOrEqual(6);
  });

  it("keeps its disclosure on phones after two paragraphs once the letter is a long read", () => {
    // Jonas's letter (889 characters) stays whole; one more paragraph makes it a long read (LONG_TEXT).
    expect(letter).not.toContain("<details");
    const longer: Page = {
      ...jonas,
      blocks: jonas.blocks.map((block) =>
        block.id === "letter" && block.type === "text"
          ? { ...block, text: block.text.replace("\n\nMit freundlichen", "\n\nGern komme ich auch zu einem Probetag in Ihr Lager, damit Sie mich bei der Arbeit kennenlernen.\n\nMit freundlichen") }
          : block,
      ),
    };
    const markup = render(longer, { template: "laufbahn" }, documentsOf(longer, "/de/p/jonas-brandt"));
    const long = /<section id="section-letter-title"[\s\S]*?<\/section>/.exec(markup)?.[0] ?? "";
    const [before, details] = long.split("<details");
    expect(count(before ?? "", /<p dir="auto"/g)).toBe(3);
    expect(details).toMatch(/^ class="lb-more /);
  });

  it("is the page's surface on a dark page", () => {
    const dark = render(jonas, { template: "laufbahn", mode: "dark" }, jonasDocs);
    expect(/<section id="section-letter-title"[\s\S]*?<\/section>/.exec(dark)?.[0]).toMatch(/data-lb-letter="" class="[^"]*bg-creator-surface text-creator-fg/);
    // The head adds a hairline at its foot on a dark page.
    expect(headOf(dark)).toMatch(/^<header data-lb-head="true" class="[^"]*border-b border-creator-line/);
    // The documents' paper stays white, as printed, and so do its marks' tones (never near-white on white).
    const papers = (markup: string) => [...(/<section id="unterlagen"[\s\S]*?<\/section>/.exec(markup)?.[0] ?? "").matchAll(/<span aria-hidden="true" class="([^"]*aspect-a4[^"]*)"/g)].map((match) => match[1] ?? "");
    expect(papers(dark)).toHaveLength(2);
    for (const paper of papers(dark)) expect(paper).toMatch(/bg-white .*\[--creator-fg:var\(--color-ink\)\]/);
    for (const paper of papers(jonasMarkup)) expect(paper).not.toContain("--creator-fg:");
  });
});

describe("the career as a table", () => {
  const career = /<section id="section-career"[\s\S]*?<\/section>/.exec(jonasMarkup)?.[0] ?? "";

  it("sets the years first, with an en dash between spaces, and tags the ongoing step", () => {
    expect(text(career)).toContain("2021 – heuteaktuellFachkraft für Lagerlogistik");
    expect(text(career)).toContain("2020 – 2021Lagerist");
    expect(text(career)).toContain("2019Staplerschein");
    expect(count(career, />aktuell</g)).toBe(1);
  });

  it("ends the rail with the last step's words: space under every step but the last", () => {
    const steps = [...career.matchAll(/<div class="(lb-step [^"]*)"/g)].map((match) => match[1] ?? "");
    expect(steps).toHaveLength(4);
    expect(steps.slice(0, -1).every((step) => /\bpb-8\b/.test(step))).toBe(true);
    expect(steps.at(-1)).not.toMatch(/\bpb-/);
  });

  it("puts every step beside one rail with a dot (filled for the ongoing one), no icon nodes", () => {
    expect(count(career, /class="lb-step /g)).toBe(4);
    expect(count(career, /size-dot rounded-full[^"]*bg-creator-accent"/g)).toBe(1);
    expect(career).not.toMatch(/lucide-(briefcase|id-card)/);
  });
});

describe("Arabic pages' Latin runs", () => {
  /** A part of the markup with every span in the template's Latin face taken out, then as text. */
  const outsideLatinFace = (markup: string): string => text(markup.replace(/<span class="font-display">[^<]*<\/span>/g, ""));
  const LATIN = /[0-9A-Za-z·–%()]/u;

  it("sets the career's years, roles, places and notes, the role, the status and the target line with their digits and Latin in Geist", () => {
    const career = /<section id="section-career"[\s\S]*?<\/section>/.exec(karimMarkup)?.[0] ?? "";
    const head = headOf(karimMarkup);
    expect(career).toContain('<span class="font-display">2021 –</span>');
    expect(count(career, /<span class="font-display">/g)).toBeGreaterThanOrEqual(4);
    expect(outsideLatinFace(career)).not.toMatch(LATIN);
    const role = /<p data-lb-role[\s\S]*?<\/p>/.exec(head)?.[0] ?? "";
    expect(role).toContain('<span class="font-display">·</span>');
    expect(outsideLatinFace(role)).not.toMatch(LATIN);
    const status = /<p class="inline-flex min-h-control-sm[\s\S]*?<\/p>/.exec(head)?.[0] ?? "";
    expect(status).toContain('<span class="font-display">2027</span>');
    expect(outsideLatinFace(status)).not.toMatch(LATIN);
  });

  it("leaves German pages as they are: no extra spans", () => {
    const career = /<section id="section-career"[\s\S]*?<\/section>/.exec(jonasMarkup)?.[0] ?? "";
    expect(career).not.toContain('class="font-display"');
    expect(headOf(jonasMarkup)).not.toContain('class="font-display"');
  });
});

describe("About", () => {
  it("shows the facts on one soft sheet in full rows: one a row on phones and tablets, the three side by side on the wide canvas", () => {
    const about = /<section id="section-about"[\s\S]*?<\/section>/.exec(jonasMarkup)?.[0] ?? "";
    // Three facts, two of them long for a phone's half ("Deutsch, Englisch (B1)", "Schichtbetrieb, auch
    // nachts"): one a row below the wide canvas, and one row of three on it (round 6 review: no fact
    // alone beside an empty half of the sheet).
    expect(about).toContain('<dl class="grid min-w-0 grid-cols-12 gap-x-6 gap-y-4 rounded-creator-card bg-creator-surface p-5 @work:p-6">');
    expect(count(about, /<div class="grid min-w-0 grid-cols-1 content-start gap-1 col-span-12 @prose:col-span-12 @work:col-span-4"><dt/g)).toBe(3);
  });

  it("never leaves a fact alone beside an empty half: every row of the facts sheet is full, for one to eight facts", () => {
    const fact = (label: string, value: string) => ({ label, value });
    const kinds = {
      short: (index: number) => fact(`Fakt ${String(index)}`, "Klasse B"),
      medium: (index: number) => fact(`Fakt ${String(index)}`, "Deutsch, Englisch (B1)"),
      long: (index: number) => fact(`Fakt ${String(index)}`, "Schichtbetrieb, auch nachts und am Wochenende"),
      mixed: (index: number) => (index % 2 === 0 ? fact(`Fakt ${String(index)}`, "Klasse B") : fact("Ein sehr langes Etikett", "Schichtbetrieb, auch nachts")),
    };
    const spanOf = (classes: string, prefix: string): number => Number(new RegExp(`(?:^| )${prefix}col-span-(\\d+)`).exec(classes)?.[1] ?? "0");
    for (const [kind, make] of Object.entries(kinds)) {
      for (let total = 1; total <= 8; total += 1) {
        const facts = Array.from({ length: total }, (_, index) => make(index));
        const spans = factSpans(facts);
        for (const width of ["phone", "prose", "work"] as const) {
          const rows = factRows(facts, width);
          const where = `${kind}, ${String(total)} facts, ${width}: ${JSON.stringify(rows)}`;
          expect(rows.reduce((sum, size) => sum + size, 0), where).toBe(total);
          // At most two to a row on phones, three on tablets, four on the wide canvas; the rows even, the fuller first.
          expect(Math.max(...rows), where).toBeLessThanOrEqual({ phone: 2, prose: 3, work: 4 }[width]);
          expect(Math.max(...rows) - Math.min(...rows), where).toBeLessThanOrEqual(1);
          expect([...rows].sort((a, b) => b - a), where).toEqual(rows);
          // No orphan: a row of one only where every row is one (the sheet in a single column).
          if (rows.includes(1)) expect(rows.every((size) => size === 1), where).toBe(true);
          // Each row fills the sheet's twelve columns.
          const prefix = { phone: "", prose: "@prose:", work: "@work:" }[width];
          let at = 0;
          for (const size of rows) {
            const row = spans.slice(at, at + size).map((classes) => spanOf(classes, prefix));
            expect(row.reduce((sum, span) => sum + span, 0), where).toBe(12);
            at += size;
          }
        }
      }
    }
    // Long facts take fewer to a row: the wide canvas holds four short ones, three of the sample's, two long ones.
    expect(factRows(Array.from({ length: 4 }, (_, index) => kinds.short(index)), "work")).toEqual([4]);
    expect(factRows(Array.from({ length: 4 }, (_, index) => kinds.short(index)), "phone")).toEqual([2, 2]);
    expect(factRows(Array.from({ length: 5 }, (_, index) => kinds.short(index)), "work")).toEqual([3, 2]);
    expect(factRows(Array.from({ length: 3 }, (_, index) => kinds.medium(index)), "work")).toEqual([3]);
    expect(factRows(Array.from({ length: 3 }, (_, index) => kinds.short(index)), "phone")).toEqual([1, 1, 1]);
    expect(factRows(Array.from({ length: 4 }, (_, index) => kinds.long(index)), "work")).toEqual([2, 2]);
    expect(factRows([fact("Ein sehr langes Etikett", "kurz")], "work")).toEqual([1]);
    expect(factRows([], "work")).toEqual([]);
  });

  it("never shows a drawn still as the person's portrait (Sevag's placeholder leaves About)", () => {
    const block = sevagDe.blocks.find((entry): entry is BlockOf<"about"> => entry.type === "about");
    const clip = MOTION_LIBRARY.find((entry) => entry.poster === block?.portrait?.src);
    expect(clip?.kind).toBe("illustration");
    const about = /<section id="section-about"[\s\S]*?<\/section>/.exec(sevag)?.[0] ?? "";
    expect(about).not.toContain("data-about-portrait");
    expect(about).not.toContain(`alt="${clip?.alt.de ?? "?"}"`);
    // The facts the head does not show stay, on the sheet.
    expect(text(about)).toContain("Staplervor allem Seitenschubstapler");
    expect(text(about)).not.toContain("Sales Center Lörrach");
  });

  it("keeps the Werkbogen layout with a real portrait (the portfolio sample)", () => {
    const markup = render(portfolioSample("de"));
    expect(markup).toContain("data-about-portrait");
  });
});

describe("Sevag's application page on Laufbahn (no contact block in the repository)", () => {
  it("uses the template in black and grey, now in the grotesk pairing", () => {
    expect(sevagTheme).toEqual({ template: "laufbahn", mode: "light", accent: creatorTokens.swatches.ink, tint: 0 });
    const theme = resolveCreatorTheme(sevagTheme);
    expect(theme.layout.hero).toBe("bleed");
    expect(theme.pairing.id).toBe("grotesk");
  });

  it("keeps every fact of the page and adds none", () => {
    const words = text(sevag);
    const profile = sevagDe.profile;
    for (const fact of [profile.displayName, profile.tagline, profile.bio, ...(profile.stats ?? []).flatMap((stat) => [stat.label])]) expect(words).toContain(fact);
    for (const block of sevagDe.blocks) {
      if (block.type === "about") {
        for (const part of block.text.split("\n\n").flatMap((paragraph) => splitLead(paragraph))) if (part) expect(words).toContain(part);
        for (const fact of block.facts ?? []) expect(words.includes(`${fact.label}${fact.value}`) || words.includes(`${fact.label} ${fact.value}`), fact.label).toBe(true);
      }
      if (block.type === "tools") for (const item of block.items) expect(words).toContain(item);
      if (block.type === "timeline") for (const item of block.items) expect(words).toContain(`${item.role}${item.org ?? ""}`);
      if (block.type === "header") expect(words).toContain(block.title);
      if (block.type === "text") for (const part of block.text.split("\n\n")) expect(words).toContain(part);
    }
  });

  it("without a contact block: no ink band, the hero leads to the letter, 'Teilen' beside it", () => {
    expect(sevag).not.toContain("data-lb-contact");
    expect(sevag).not.toContain("data-bar-action");
    const actions = /<div data-hero-actions[\s\S]*?<\/button>/.exec(sevag)?.[0] ?? "";
    expect(text(/<a href="#section-letter-title"[^>]*>[\s\S]*?<\/a>/.exec(actions)?.[0] ?? "")).toBe("Anschreiben lesen");
    expect(text(actions)).toContain("Teilen");
  });

  it("is flat and unlined: no shadow, no underline", () => {
    for (const markup of [sevag, jonasMarkup, karimMarkup]) expect(markup).not.toMatch(/\b(?:shadow-(?!none)|drop-shadow|underline|decoration-)/);
  });
});

describe("the Kontakt band on ink", () => {
  const band = /<div data-block="contact" data-lb-contact[\s\S]*?<\/footer><\/div>/.exec(jonasMarkup)?.[0] ?? "";

  it("closes the page with the status, the title, the primary action and the rows, the footer inside", () => {
    expect(band).toMatch(/class="lb-ground text-white"/);
    const words = text(band);
    for (const part of ["Verfügbar ab 1. März 2027", "Ich freue mich auf ein Gespräch.", "E-Mail schreiben", "E-Mail", "jonas.brandt@example.com", "Telefon", "+49 30 23125 457", "Lebenslauf · PDF", "Anschreiben · PDF", "Seite teilen", "Impressum"]) {
      expect(words, part).toContain(part);
    }
    expect(band).toMatch(/<footer class="text-caption lb-ink-muted/);
    expect(count(band, /focus-visible:focus-ring-inverse/g)).toBeGreaterThanOrEqual(6);
    // The footer stays the page's contentinfo: it is not inside the band's section.
    expect(band).toMatch(/<\/section><footer/);
  });
});

describe("Arabic pages", () => {
  it("are right to left, offer no documents and keep 'منذ' over its number", () => {
    expect(karimMarkup).toContain('<div lang="ar" dir="rtl"');
    expect(karimMarkup).not.toMatch(/download=|\/cv"|\/letter"|\/application"/);
    expect(karimMarkup).not.toContain('id="unterlagen"');
    expect(text(/<div data-hero-actions[\s\S]*?<\/button>/.exec(headOf(karimMarkup))?.[0] ?? "")).toContain("مشاركة");
    expect(headOf(karimMarkup)).toMatch(/<dd dir="auto" class="[^"]*row-start-1[^"]*">منذ<\/dd>/);
    expect(text(/<p data-lb-target[\s\S]*?<\/p>/.exec(karimMarkup)?.[0] ?? "")).toBe("التقديم على أخصائي لوجستيات مستودعات");
  });

  it("never track or capitalise Arabic display text", () => {
    expect(resolveCreatorTheme({ template: "laufbahn" }, { rtlScript: true }).cssVars["--creator-display-tracking"]).toBe("0em");
    expect(karimMarkup).not.toMatch(/class="[^"]*\buppercase\b[^"]*"[^>]*>[^<]*\p{Script=Arabic}/u);
  });
});

describe("other templates", () => {
  it("change nothing", () => {
    for (const template of ["nocturne", "werkbogen", "tiefdruck", "studio"] as const) {
      const markup = render(jonas, { template }, jonasDocs);
      expect(markup, template).not.toMatch(/lb-(?:ground|section|soft|more|step|sheet|bar|ink-muted)|focus-ring-inverse|data-lb-head|data-lb-contact/);
      expect(markup, template).not.toContain("<dialog");
      expect(markup, template).not.toMatch(/download=/);
    }
  });
});

/** A block list with one of everything that is not signposted on its own, to check nothing breaks. */
const mixed: Block[] = [
  { ...base, id: "intro", type: "text", text: "Kurz und gut." },
  { ...base, id: "links", type: "header", title: "Links" },
  { ...base, id: "site", type: "link", title: "Website", url: "https://example.com" },
];

describe("a page whose first blocks have no title", () => {
  it("shows them before the first titled section; 'Weiterlesen' leads to the start of the content", () => {
    const markup = render({ ...sevagDe, blocks: mixed });
    expect(markup).toMatch(/Kurz und gut\.[\s\S]*<section id="section-links"/);
    expect(markup).not.toContain('aria-label="Abschnitte"');
    expect(markup).toMatch(/<a href="#page-content"[^>]*>[\s\S]*?Weiterlesen/);
    expect(markup).toContain('<main id="page-content"');
  });
});

describe("motion", () => {
  it("nothing in the content moves as the page scrolls but the career's rail; the head rises in once", () => {
    expect(jonasMarkup).not.toMatch(/\blb-(?:reveal|zoom|progress|parallax)\b|\bposter-reveal\b/);
    expect(count(headOf(jonasMarkup), /poster-rise/g)).toBeGreaterThanOrEqual(5);
  });
});

describe("'About' with a portrait (fictional owner)", () => {
  const about = (portrait: BlockOf<"about">["portrait"], words: string, facts: [string, string][]): string =>
    renderToStaticMarkup(
      createElement(LaufbahnAbout, {
        block: { ...base, id: "about", type: "about", title: "Über mich", text: words, ...(portrait ? { portrait } : {}), facts: facts.map(([label, value]) => ({ label, value })) },
      }),
    );
  const facts: [string, string][] = [
    ["Wohnort", "Kempten"],
    ["Sprachen", "Deutsch, Englisch"],
  ];

  it("sets a real portrait beside the facts, and a library still never", () => {
    const real = about({ src: "sample:mila-hero", alt: "Ines Beispiel im Porträt" }, "Ich baue Bühnen.", facts);
    expect(real).toContain("data-about-portrait");
    const still = MOTION_LIBRARY[0]?.poster ?? "";
    const drawn = about({ src: still, alt: "Illustration" }, "Ich baue Bühnen.", facts);
    expect(drawn).not.toContain("data-about-portrait");
    expect(drawn).not.toContain("<img");
  });

  it("leaves out the facts the head shows, and drops the sheet when none are left", () => {
    const markup = renderToStaticMarkup(
      createElement(LaufbahnAbout, {
        block: { ...base, id: "about", type: "about", text: "Ich baue Bühnen.", facts: [{ label: "Bewerbung als", value: "Bühnenbauer" }] },
        omit: [{ label: "Bewerbung als", value: "Bühnenbauer" }],
      }),
    );
    expect(markup).not.toContain("<dl");
  });
});
