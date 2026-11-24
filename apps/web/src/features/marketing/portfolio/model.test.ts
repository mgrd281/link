import { TEMPLATE_IDS } from "@linkyo/tokens/creator";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import { PORTFOLIO_KINDS } from "@/features/app/kinds";
import { EXAMPLES } from "@/features/examples/catalog";
import { CATEGORIES, LOOKS, PEOPLE_LOOKS, SITE_COUNTS, type LookId } from "@/features/examples/looks";
import { PREVIEWS } from "@/features/previews/registry";
import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { pageHref, portfolioExamples, portfolioTemplates, professions, startExample, startHref, templateStartHref } from "./model";

const MESSAGES = { de, en, ar } as const;
const LOCALES = ["de", "en", "ar"] as const;

describe("the website's counts (one vocabulary, fed from code)", () => {
  it("designs are the templates in the tokens; example pages are every page the gallery lists", () => {
    expect(SITE_COUNTS.designs).toBe(TEMPLATE_IDS.length);
    expect(SITE_COUNTS.pages).toBe(Object.keys(LOOKS).length + Object.keys(PEOPLE_LOOKS).length);
    // Every look has a page, so the gallery shows exactly that many cards.
    for (const slug of Object.keys(LOOKS) as LookId[]) expect(EXAMPLES[slug] ?? PREVIEWS[slug]?.pages[LOOKS[slug].locale], slug).toBeDefined();
    for (const slug of Object.keys(PEOPLE_LOOKS)) expect(PREVIEWS[slug], slug).toBeDefined();
  });

  it.each(LOCALES)("%s: count sentences take the numbers as placeholders, never as words", (locale) => {
    const t = createTranslator({ locale, messages: MESSAGES[locale] });
    for (const key of ["marketing.meta.description", "examples.meta.description"] as const) {
      const text = t(key, SITE_COUNTS);
      expect(text, key).toContain(String(SITE_COUNTS.designs));
      expect(text, key).toContain(String(SITE_COUNTS.pages));
    }
    expect(t("examples.title", { count: SITE_COUNTS.pages })).toContain(String(SITE_COUNTS.pages));
    // The welcome flow's look step counts the designs too (it said "Vierzehn Vorlagen" in words).
    expect(t("app.welcome.steps.look.lead", { designs: SITE_COUNTS.designs })).toContain(String(SITE_COUNTS.designs));
    // The sentences read without arguments (the layout's default description, the app manifest)
    // name no number at all, so they cannot drift.
    for (const text of [t("meta.description"), t("marketing.real.metaDescription")]) {
      expect(text).not.toMatch(/\d|vierzehn|fourteen|أربعة عشر/i);
    }
  });

  it("German reads \"Designs\" and \"Beispielseiten\"", () => {
    const t = createTranslator({ locale: "de", messages: de });
    expect(t("examples.meta.description", SITE_COUNTS)).toContain(`${String(SITE_COUNTS.designs)} Designs und ${String(SITE_COUNTS.pages)} Beispielseiten`);
    expect(t("examples.stats.examples", { count: SITE_COUNTS.pages })).toBe("Beispielseiten");
  });
});

describe("the Portfolio section", () => {
  it("is a gallery category with at least the six portfolio pages", () => {
    expect(CATEGORIES).toContain("portfolio");
    expect(portfolioExamples()).toEqual(expect.arrayContaining(["ronja-feldkamp", "tobin-achterberg", "naya-aldabbas", "jorinde-ahlfeld", "jonas-ek", "arjun-mehta"]));
    for (const locale of LOCALES) expect(MESSAGES[locale].examples.categories.portfolio).toBeTruthy();
  });

  it("lists the portfolio templates from the pages that use them (Werkbogen and Tiefdruck first)", () => {
    const ids = portfolioTemplates().map((template) => template.id);
    expect(ids.slice(0, 2)).toEqual(["werkbogen", "tiefdruck"]);
    for (const template of portfolioTemplates()) {
      expect(TEMPLATE_IDS).toContain(template.id);
      for (const slug of template.examples) expect(LOOKS[slug].theme.template).toBe(template.id);
    }
  });

  it("offers a field only with an example page, and only portfolio kinds in it", () => {
    const fields = professions();
    expect(fields.map((field) => field.key)).toEqual(["photography", "design", "build"]);
    for (const field of fields) {
      expect(field.examples.length).toBeGreaterThan(0);
      for (const slug of field.examples) expect(PORTFOLIO_KINDS).toContain(LOOKS[slug].kind);
    }
    expect(fields[0]?.examples[0]).toBe("ronja-feldkamp");
  });

  it("starts sign-up with the example's look, which the sign-up form reads", () => {
    expect(startHref("ronja-feldkamp")).toBe("/signup?kind=photographer&look=ronja-feldkamp");
    expect(pageHref("tobin-achterberg")).toBe("/en/p/tobin-achterberg");
  });

  it("starts a template from the same look wherever the page offers it: the template as it comes", () => {
    // Folio: Jonas Ek's page is plain Folio; Arjun Mehta's adds an ink-blue accent.
    expect(startExample("folio")).toBe("jonas-ek");
    expect(startExample("werkbogen")).toBe("ronja-feldkamp");
    expect(startExample("tiefdruck")).toBe("tobin-achterberg");
    for (const template of portfolioTemplates()) {
      const slug = startExample(template.id);
      if (!slug) throw new Error(`no start for ${template.id}`);
      expect(template.examples).toContain(slug);
      expect(templateStartHref(template.id)).toBe(startHref(slug));
    }
  });

  it.each(LOCALES)("%s: the confidential client is quoted as the product shows it", (locale) => {
    const messages = MESSAGES[locale];
    const label = messages.creator.portfolio.confidential;
    const toggle = messages.app.portfolio.hideClient;
    expect(messages.portfolioLanding.project.items.confidential.body).toContain(label);
    const answer = messages.portfolioLanding.faq.items.find((item) => item.a.includes(toggle));
    expect(answer?.a).toContain(label);
  });

  it("isolates Latin names and numbers in the Arabic page's sentences", () => {
    const page = ar.portfolioLanding;
    const plain = (text: string) => text.replace(/<bdi>[^<]*<\/bdi>/g, "");
    for (const text of [page.hero.open, page.fields.start, page.templates.start, page.project.items.pictures.body, ...page.faq.items.flatMap((item) => [item.q, item.a])]) {
      expect(plain(text), text).not.toMatch(/[A-Za-z0-9{}]/);
    }
  });

  it.each(LOCALES)("%s: every portfolioLanding string formats", (locale) => {
    const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: "portfolioLanding" });
    const tag = (chunks: unknown) => `[${String(chunks)}]`;
    expect(t.markup("hero.open", { name: "Ronja", bdi: tag })).toContain("[Ronja]");
    expect(t.markup("fields.start", { name: "Folio", bdi: tag })).toContain("[Folio]");
    expect(t.markup("templates.start", { name: "Folio", bdi: tag })).toContain("[Folio]");
    // The FAQ answers are read by index (faq.items.<n>.a), with <bdi> in Arabic.
    for (const index of [0, 1, 2, 3, 4]) {
      const key = `faq.items.${String(index)}.a` as "hero.caption";
      expect(t.markup(key, { name: "", template: "", bdi: tag }).length).toBeGreaterThan(0);
    }
    expect(t.markup("hero.caption", { name: "Ronja", template: "Werkbogen", bdi: (chunks) => `[${chunks}]` })).toContain("[Werkbogen]");
    expect(t.raw("faq.items")).toHaveLength(5);
  });
});
