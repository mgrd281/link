import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import { SITE_COUNTS } from "@/features/examples/looks";
import { SITE_PAGES } from "@/features/marketing/pages/site-pages";
import { formatEuro, PRICES } from "@/features/payments/prices";
import { routing } from "@/i18n/routing";
import ar from "@/messages/ar.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

import { PAGE_DESCRIPTIONS, PAGE_DESCRIPTIONS_UNCOUNTED, pageDescription, PAID_PATHS, PUBLIC_PATHS, publicPaths, sitemapEntries, type PublicPath } from "./seo";

const FILES = { de, en, ar } as const;
const base = new URL("https://linkyo.example");

describe("the sitemap", () => {
  it("lists every public page in German, English and Arabic, each with its language versions", () => {
    const entries = sitemapEntries({ base, payments: false });
    expect(entries).toHaveLength(PUBLIC_PATHS.length * routing.locales.length);
    for (const path of PUBLIC_PATHS) {
      for (const locale of routing.locales) {
        const entry = entries.find((item) => item.url === new URL(`/${locale}${path}`, base).toString());
        expect(entry, `${locale}${path}`).toBeDefined();
        const languages = entry?.alternates?.languages ?? {};
        for (const code of routing.locales) expect(languages[code as keyof typeof languages], `${locale}${path} → ${code}`).toBe(new URL(`/${code}${path}`, base).toString());
        expect(languages["x-default" as keyof typeof languages]).toBe(new URL(`/de${path}`, base).toString());
      }
    }
  });

  it("holds the website's own pages (help, contact, features, about, changelog, security)", () => {
    const urls = sitemapEntries({ base, payments: false }).map((entry) => entry.url);
    for (const path of Object.values(SITE_PAGES)) for (const locale of routing.locales) expect(urls).toContain(new URL(`/${locale}${path}`, base).toString());
  });

  it("lists the page service only where it can be booked (payments on)", () => {
    const off = sitemapEntries({ base, payments: false }).map((entry) => entry.url);
    const on = sitemapEntries({ base, payments: true }).map((entry) => entry.url);
    expect(off.some((url) => url.endsWith("/service"))).toBe(false);
    for (const locale of routing.locales) expect(on).toContain(new URL(`/${locale}/service`, base).toString());
    expect(publicPaths({ payments: true })).toEqual([...PUBLIC_PATHS, ...PAID_PATHS]);
  });

  it("gives the home page the highest priority", () => {
    const entries = sitemapEntries({ base, payments: false });
    expect(entries.filter((entry) => entry.priority === 1).map((entry) => new URL(entry.url).pathname).sort()).toEqual(["/ar", "/de", "/en"]);
  });
});

describe("meta descriptions", () => {
  const paths = publicPaths({ payments: true });

  /**
   * The cookie-free statistics, as each language names them: no description names them in a build that
   * counts no page. The help page's lists its answers, and the one on the statistics is there in both
   * states (it says when nothing is counted).
   */
  const STATISTICS = { de: /Analytics|Statistik/, en: /analytics|stats/i, ar: /إحصاء/ } as const;
  const TOPICS: ReadonlySet<PublicPath> = new Set<PublicPath>(["/hilfe"]);

  for (const locale of routing.locales) {
    for (const statistics of [true, false]) {
      it(`${locale}, ${statistics ? "pages counted" : "nothing counted"}: every public page has one of its own, and no two are the same`, () => {
        const t = createTranslator({
          locale,
          messages: FILES[locale],
          onError: (error) => {
            throw error;
          },
        });
        const price = (id: "service-start" | "service-premium") => formatEuro(PRICES[id].amountCents, locale);
        const values = { ...SITE_COUNTS, start: price("service-start"), premium: price("service-premium") };
        const described = new Map<string, PublicPath[]>();
        for (const path of paths) {
          const text = t(pageDescription(path, { statistics }) as never, values as never);
          expect(text.trim().length, `${path} has a description`).toBeGreaterThan(50);
          expect(text, `${path}: formatted`).not.toMatch(/[{}<>]/);
          if (!statistics && !TOPICS.has(path)) expect(text, `${path} names no statistics`).not.toMatch(STATISTICS[locale]);
          described.set(text, [...(described.get(text) ?? []), path]);
        }
        const duplicates = [...described.values()].filter((list) => list.length > 1);
        expect(duplicates).toEqual([]);
        // The site-wide default (the layout's) is no page's own description either.
        expect([...described.keys()]).not.toContain(t("meta.description"));
      });
    }
  }

  it("names a description for every public path, the paid one included", () => {
    expect(Object.keys(PAGE_DESCRIPTIONS).sort()).toEqual([...paths].sort());
  });

  it("a build that counts pages describes them with the statistics, one that does not without", () => {
    expect(pageDescription("/funktionen", { statistics: true })).toBe(PAGE_DESCRIPTIONS["/funktionen"]);
    expect(pageDescription("/funktionen", { statistics: false })).toBe("sitePages.features.meta.descriptionOff");
    expect(pageDescription("/changelog", { statistics: false })).toBe("sitePages.changelog.meta.descriptionOff");
    expect(pageDescription("/sicherheit", { statistics: false })).toBe("sitePages.security.meta.descriptionOff");
    expect(pageDescription("", { statistics: false })).toBe("marketing.real.metaDescription");
    expect(pageDescription("/hilfe", { statistics: false })).toBe(PAGE_DESCRIPTIONS["/hilfe"]);
    for (const [path, key] of Object.entries(PAGE_DESCRIPTIONS_UNCOUNTED)) expect(key, `${path}: a description of its own`).not.toBe(PAGE_DESCRIPTIONS[path as PublicPath]);
  });
});
