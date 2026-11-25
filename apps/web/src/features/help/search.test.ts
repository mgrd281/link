import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import { SITE_NUMBERS } from "@/features/marketing/pages/numbers";
import { plainTags } from "@/features/marketing/pages/text";
import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { articleKeys, HELP_ARTICLES, HELP_GROUPS, HELP_SLUGS, helpHref, isHelpSlug } from "./articles";
import { helpFold, matchArticles, queryWords, type SearchableArticle } from "./search";

/**
 * The help articles as data (stable slugs, every article in three languages) and their search, read
 * as the help page reads them: the words of each article with the `<bdi>` markup taken out, the numbers
 * from code (SITE_NUMBERS), as a build that counts pages (`statistics`) or not. A message that does
 * not format (a missing number, a broken tag) fails here instead of showing its key.
 */
const FILES = { de, en, ar } as const;
type Locale = keyof typeof FILES;

function articlesIn(locale: Locale, statistics = true): SearchableArticle[] {
  const t = createTranslator({
    locale,
    messages: FILES[locale],
    onError: (error) => {
      throw error;
    },
  });
  const plain = (key: string) => t.markup(key as never, { ...SITE_NUMBERS, ...plainTags } as never);
  return HELP_ARTICLES.map((article) => {
    const base = `help.articles.${article.slug}`;
    const { summary, body } = articleKeys(article, (t.raw(`${base}.body` as never) as string[]).length, statistics);
    return { slug: article.slug, title: plain(`${base}.title`), summary: plain(summary), body: body.map(plain) };
  });
}

describe("help articles", () => {
  it("have stable, unique slugs that other places may link to", () => {
    expect(new Set(HELP_SLUGS).size).toBe(HELP_SLUGS.length);
    // Renaming a slug breaks links from the dashboard (WP4.5): the list only grows.
    expect(HELP_SLUGS).toEqual(["registrieren", "willkommen", "seitenadresse", "bloecke", "projekte", "vorlagen", "design", "sprachen", "teilen", "statistik", "datenschutz-seite", "impressum", "konto-loeschen"]);
    for (const slug of HELP_SLUGS) expect(slug).toMatch(/^[a-z][a-z-]*$/);
    expect(isHelpSlug("statistik")).toBe(true);
    expect(isHelpSlug("nope")).toBe(false);
    expect(helpHref("ar", "statistik")).toBe("/ar/hilfe#statistik");
    expect(helpHref("de")).toBe("/de/hilfe");
  });

  it("cover the topics the brief names, each in a known group", () => {
    for (const article of HELP_ARTICLES) expect(HELP_GROUPS).toContain(article.group);
    for (const group of HELP_GROUPS) expect(HELP_ARTICLES.some((article) => article.group === group), group).toBe(true);
  });

  for (const locale of ["de", "en", "ar"] as const) {
    it(`${locale}: every article has a title, a short answer and a body of whole paragraphs`, () => {
      for (const article of articlesIn(locale)) {
        expect(article.title.length, article.slug).toBeGreaterThan(3);
        expect(article.summary.length, article.slug).toBeGreaterThan(10);
        expect(article.body.length, article.slug).toBeGreaterThan(0);
        for (const paragraph of [article.title, article.summary, ...article.body]) expect(paragraph, article.slug).not.toMatch(/[{}<>]/);
        // The same number of paragraphs in every language.
        expect(article.body.length, article.slug).toBe(articlesIn("de").find((entry) => entry.slug === article.slug)?.body.length);
      }
    });

    it(`${locale}: while no page is counted, the statistics article says so first, and the QR count is left out`, () => {
      const find = (list: SearchableArticle[], slug: string) => list.find((article) => article.slug === slug);
      const [on, off] = [articlesIn(locale, true), articlesIn(locale, false)];
      expect(find(off, "statistik")?.body.length).toBe((find(on, "statistik")?.body.length ?? 0) + 1);
      expect(find(off, "statistik")?.summary).not.toBe(find(on, "statistik")?.summary);
      expect(find(on, "teilen")?.body.length).toBe((find(off, "teilen")?.body.length ?? 0) + 1);
      for (const article of off) for (const paragraph of [article.summary, ...article.body]) expect(paragraph, article.slug).not.toMatch(/[{}<>]/);
    });
  }

  it("puts the QR count right after the paragraph about the QR code, only while pages are counted", () => {
    const teilen = HELP_ARTICLES.find((article) => article.slug === "teilen");
    if (!teilen) throw new Error("no teilen article");
    const body = (index: number) => `help.articles.teilen.body.${String(index)}`;
    expect(articleKeys(teilen, 4, true).body).toEqual([body(0), body(1), body(2), "help.articles.teilen.counting", body(3)]);
    expect(articleKeys(teilen, 4, false).body).toEqual([body(0), body(1), body(2), body(3)]);
  });

  it("names the numbers the code sets: address length, welcome steps, pictures per project, statistics ranges", () => {
    const find = (slug: string) => articlesIn("de").find((article) => article.slug === slug);
    expect(find("seitenadresse")?.body[0]).toContain(`${String(SITE_NUMBERS.min)} bis ${String(SITE_NUMBERS.max)} Zeichen`);
    expect(find("willkommen")?.summary).toContain(`${String(SITE_NUMBERS.steps)} kurze Schritte`);
    expect(find("willkommen")?.summary).toContain(`bei Portfolios ${String(SITE_NUMBERS.portfolioSteps)}`);
    expect(find("projekte")?.body[0]).toContain(`bis zu ${String(SITE_NUMBERS.pictures)} Bilder`);
    expect(find("statistik")?.body[0]).toContain(`${String(SITE_NUMBERS.week)}, ${String(SITE_NUMBERS.month)} oder ${String(SITE_NUMBERS.quarter)} Tage`);
  });
});

describe("help search", () => {
  const slugs = (list: SearchableArticle[]) => list.map((article) => article.slug);

  it("keeps every article for an empty query", () => {
    expect(slugs(matchArticles(articlesIn("de"), "  "))).toEqual([...HELP_SLUGS]);
  });

  // A word that only the body of one article holds, in each language.
  it("finds an article by a word in its body, in German", () => {
    const found = matchArticles(articlesIn("de"), "Prüfwert");
    expect(slugs(found)).toEqual(["statistik"]);
    expect(articlesIn("de").find((article) => article.slug === "statistik")?.title).not.toMatch(/Prüfwert/);
  });

  it("finds an article by a word in its body, in English", () => {
    expect(slugs(matchArticles(articlesIn("en"), "prefetches"))).toEqual(["statistik"]);
  });

  it("finds an article by a word in its body, in Arabic, with or without vowel marks and hamza", () => {
    const arabic = articlesIn("ar");
    expect(slugs(matchArticles(arabic, "قيمة تحقق"))).toEqual(["statistik"]);
    // "الرسائل غير المرغوب فيها" (the spam folder) is in the sign-up article's body only.
    expect(slugs(matchArticles(arabic, "المرغوب"))).toEqual(["registrieren"]);
    // Typed with an alef without hamza and with vowel marks, it still finds "إحصاءات".
    expect(slugs(matchArticles(arabic, "احصاءات")).length).toBeGreaterThan(0);
    expect(slugs(matchArticles(arabic, "الإِحْصَاءَات"))).toEqual(slugs(matchArticles(arabic, "الإحصاءات")));
  });

  it("puts articles whose title holds every word first", () => {
    const found = slugs(matchArticles(articlesIn("de"), "Konto"));
    expect(found[0]).toBe("konto-loeschen");
    expect(found.length).toBeGreaterThan(1);
  });

  it("finds umlauts however they are typed", () => {
    expect(helpFold("löschen")).toBe(helpFold("loeschen"));
    expect(slugs(matchArticles(articlesIn("de"), "loeschen"))).toContain("konto-loeschen");
    expect(slugs(matchArticles(articlesIn("de"), "LÖSCHEN"))).toContain("konto-loeschen");
  });

  it("needs every word, and finds nothing for words no article holds (the empty state)", () => {
    expect(matchArticles(articlesIn("de"), "Statistik Quittung")).toEqual([]);
    expect(matchArticles(articlesIn("en"), "xylophone")).toEqual([]);
    expect(matchArticles(articlesIn("ar"), "زرافة")).toEqual([]);
  });

  it("splits words at the punctuation of three languages", () => {
    expect(queryWords("Statistik, Adresse")).toEqual(["statistik", "adresse"]);
    expect(queryWords("الإحصاءات، الرابط؟")).toEqual(["الاحصاءات", "الرابط"]);
    expect(queryWords("„Konto“")).toEqual(["konto"]);
  });
});
