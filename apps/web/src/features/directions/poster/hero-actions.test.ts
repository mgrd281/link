import type { Block, BlockOf, Page } from "@linkyo/blocks";
import { primaryAction } from "@linkyo/blocks/project";
import { resolveCreatorTheme, TEMPLATE_IDS } from "@linkyo/tokens/creator";
import { NextIntlClientProvider } from "next-intl";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import ar from "@/messages/ar.json";
import de from "@/messages/de.json";

import { PosterRenderer } from "./renderer";

// The page's one primary action, rendered to HTML in Node: it comes from the contact block and
// from nowhere else, the hero and the bar say the same words, and a page without a contact block
// is exactly the page it was.

type Contact = BlockOf<"contact">;

const base = { visible: true, highlight: false } as const;
const link = (id: string, highlight = false): Block => ({ ...base, highlight, id, type: "link", title: highlight ? "Jetzt Tickets sichern" : id, url: `https://example.com/${id}` });
const contact = (extra: Partial<Contact> = {}): Contact => ({ ...base, id: "contact", type: "contact", title: "Ein Projekt im Kopf?", primary: { label: "Shooting anfragen", url: "mailto:ronja@example.com", icon: "mail" }, ...extra });

/** The eleven templates that existed before the portfolio: none of them may change without a contact block. */
const OLD_TEMPLATES = ["nocturne", "daylight", "marquee", "pulse", "atelier", "mono", "studio", "aura", "folio", "signal", "bloom"] as const;

const html = (template: (typeof TEMPLATE_IDS)[number], blocks: Block[], locale: "de" | "ar" = "de", profile: Partial<Page["profile"]> = {}): string =>
  renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale,
      messages: locale === "ar" ? ar : de,
      timeZone: "Europe/Berlin",
      children: createElement(PosterRenderer, {
        page: {
          profile: { username: "ronja", displayName: "Ronja Feldkamp", tagline: "Fotografin", bio: "Porträt und Reportage.", avatar: { src: "sample:mila-avatar", alt: "Ronja Feldkamp" }, verified: false, locale, ...profile },
          blocks,
        },
        theme: resolveCreatorTheme({ template }, { rtlScript: locale === "ar" }),
      }),
    }),
  );

/** The markup of the hero's row and of the bar's button (the opening tag and what is inside). */
const heroRow = (markup: string): string | null => /<div data-hero-actions[\s\S]*?<\/div><\/div>/.exec(markup)?.[0] ?? null;
const barButton = (markup: string): string | null => /<a [^>]*data-bar-action[\s\S]*?<\/a>/.exec(markup)?.[0] ?? null;
const words = (fragment: string | null): string => (fragment ?? "").replace(/<[^>]+>/g, "");
/** The status line: a still dot in the accent, then the text. */
const STATUS_DOT = 'class="size-dot shrink-0 rounded-full bg-creator-accent"';

afterEach(() => {
  vi.useRealTimers();
});

describe("the list of old templates", () => {
  it("is every template but the two portfolio templates", () => {
    expect([...OLD_TEMPLATES, "werkbogen", "tiefdruck"].sort()).toEqual([...TEMPLATE_IDS].sort());
  });
});

describe("a page with a contact block", () => {
  it.each(TEMPLATE_IDS)("%s: the hero shows the primary action, and the bar says the same words", (template) => {
    const blocks = [link("a"), contact()];
    const markup = html(template, blocks);
    const row = heroRow(markup);
    const bar = barButton(markup);
    expect(row, "hero row").not.toBeNull();
    expect(bar, "bar button").not.toBeNull();
    const label = primaryAction(blocks, new Date())?.label;
    expect(label).toBe("Shooting anfragen");
    expect(words(row)).toBe(label);
    expect(words(bar)).toBe(label);
    // Both are plain links to the same address; the hero's button is a full control, the bar's a touch target.
    expect(row).toContain('<a href="mailto:ronja@example.com"');
    expect(bar).toContain('href="mailto:ronja@example.com"');
    expect(row).toContain("min-h-control-xl");
    expect(bar).toContain("min-h-touch-target");
    expect(bar).toContain("truncate");
    // One row, one bar button: the action is never repeated beyond these (the band is its own block).
    expect(markup.match(/data-hero-actions/g)).toHaveLength(1);
    expect(markup.match(/data-bar-action/g)).toHaveLength(1);
  });

  it("never underlines a link and never carries a shadow", () => {
    const markup = html("werkbogen", [contact({ status: "Frei ab März", links: [{ kind: "cv", url: "https://example.com/cv.pdf" }] })]);
    const row = heroRow(markup) ?? "";
    expect(row).not.toMatch(/underline|decoration-|shadow/);
  });

  it("shows the availability line with a still dot, in the hero only", () => {
    for (const template of ["werkbogen", "tiefdruck", "nocturne"] as const) {
      const markup = html(template, [contact({ status: "Frei ab März 2027" })]);
      // The hero ends at the sentinel; below it the contact band repeats the status where the block
      // stands (plan 1.4.9). The bar never carries it.
      const [hero = "", body = ""] = markup.split("data-poster-sentinel");
      expect(hero.split("Frei ab März 2027"), template).toHaveLength(2);
      expect(hero.split(STATUS_DOT), template).toHaveLength(2);
      expect(body.split("Frei ab März 2027"), template).toHaveLength(2);
      expect(words(barButton(markup)), template).not.toContain("Frei ab März 2027");
      expect(markup, template).not.toContain("animate-pulse");
    }
    // Werkbogen prints it in the row above the button; Tiefdruck beside the portrait, not in the row.
    expect(words(heroRow(html("werkbogen", [contact({ status: "Frei ab März 2027" })])))).toBe("Frei ab März 2027Shooting anfragen");
    expect(words(heroRow(html("tiefdruck", [contact({ status: "Frei ab März 2027" })])))).toBe("Shooting anfragen");
  });

  it("shows no status after its last day, and none when it is empty", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-03-31T12:00:00Z"));
    const dated = [contact({ status: "Frei ab März 2027", statusUntil: "2027-03-31" })];
    for (const template of ["werkbogen", "tiefdruck"] as const) expect(html(template, dated), template).toContain("Frei ab März 2027");
    vi.setSystemTime(new Date("2027-04-01T12:00:00Z"));
    for (const template of ["werkbogen", "tiefdruck", "nocturne"] as const) {
      const markup = html(template, dated);
      expect(markup, template).not.toContain("Frei ab März 2027");
      expect(markup, template).not.toContain(STATUS_DOT);
      // The action itself stays.
      expect(words(heroRow(markup)), template).toBe("Shooting anfragen");
    }
    expect(html("werkbogen", [contact({ status: "   " })])).not.toContain(STATUS_DOT);
  });

  it("calls the CV a PDF only when its address ends in .pdf, and uses the owner's own label when there is one", () => {
    const cv = (url: string, label?: string) => words(heroRow(html("werkbogen", [contact({ links: [{ kind: "email", url: "mailto:ronja@example.com" }, { kind: "cv", url, ...(label ? { label } : {}) }] })])));
    expect(cv("https://example.com/files/lebenslauf.pdf")).toBe("Shooting anfragenLebenslauf (PDF)");
    expect(cv("https://example.com/files/Lebenslauf.PDF?download=1")).toBe("Shooting anfragenLebenslauf (PDF)");
    expect(cv("https://example.com/cv")).toBe("Shooting anfragenLebenslauf");
    expect(cv("https://example.com/pdf-viewer?file=cv")).toBe("Shooting anfragenLebenslauf");
    expect(cv("https://example.com/cv.pdf", "Vita")).toBe("Shooting anfragenVita");
    // Without a CV link there is no second link in the row.
    expect((heroRow(html("werkbogen", [contact({ links: [{ kind: "email", url: "mailto:ronja@example.com" }] })])) ?? "").match(/<a /g)).toHaveLength(1);
    // In Arabic the page's own words.
    const arabic = html("werkbogen", [contact({ links: [{ kind: "cv", url: "https://example.com/cv.pdf" }] })], "ar");
    expect(words(heroRow(arabic))).toBe("Shooting anfragenالسيرة الذاتية (PDF)");
  });

  it("takes the action of the first active contact block only", () => {
    const hidden = contact({ visible: false, primary: { label: "Alt", url: "https://example.com/alt" } });
    const markup = html("tiefdruck", [{ ...hidden, id: "old" }, contact()]);
    expect(words(heroRow(markup))).toBe("Shooting anfragen");
    expect(markup).not.toContain("https://example.com/alt");
    // A hidden contact block alone gives the page no action.
    const none = html("tiefdruck", [hidden]);
    expect(heroRow(none)).toBeNull();
    expect(barButton(none)).toBeNull();
  });
});

describe("a page without a contact block", () => {
  const blocks = [link("tickets", true), link("shop"), link("kontakt")];

  it.each(OLD_TEMPLATES)("%s: a highlighted link is never promoted: no hero row, no bar button", (template) => {
    expect(primaryAction(blocks, new Date())).toBeNull();
    const markup = html(template, blocks);
    expect(heroRow(markup)).toBeNull();
    expect(barButton(markup)).toBeNull();
    expect(markup).not.toContain("data-hero-actions");
    expect(markup).not.toContain("data-bar-action");
    // The highlighted link is where it was: once, in the page, as a link.
    expect(markup.split("Jetzt Tickets sichern")).toHaveLength(2);
    expect(markup.split('href="https://example.com/tickets"')).toHaveLength(2);
    // Nothing of the wide canvas reaches an old template.
    expect(markup).not.toContain("@work:");
  });

  it.each(["werkbogen", "tiefdruck"] as const)("%s: the same holds on the portfolio templates", (template) => {
    const markup = html(template, blocks);
    expect(heroRow(markup)).toBeNull();
    expect(barButton(markup)).toBeNull();
    expect(markup.split("Jetzt Tickets sichern")).toHaveLength(2);
  });
});
