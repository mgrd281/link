import { pageSchema } from "@linkyo/blocks";
import { describe, expect, it } from "vitest";

import { PREVIEWS } from "./registry";
import { starPage } from "./stars";
import { STARS } from "./stars-data";

describe("concept pages for well-known people", () => {
  it("are valid in every language, link only to real https sources, and are never verified", () => {
    for (const star of STARS) {
      for (const locale of ["de", "en", "ar"] as const) {
        const page = starPage(star, locale);
        expect(pageSchema.safeParse(page).success, `${star.slug}/${locale}`).toBe(true);
        expect(page.profile.verified).toBe(false);
      }
      for (const url of [...star.socials.map((social) => social.url), ...star.articles.map((article) => article.url), ...(star.website ? [star.website] : [])]) {
        expect(url, star.slug).toMatch(/^https:\/\//);
        expect(url, star.slug).not.toContain("example.com");
      }
      for (const video of star.videos) expect(video.id, star.slug).toMatch(/^[\w-]{11}$/);
    }
  });

  it("speak only the page's language: no article from another language, no Arabic script on German or English pages", () => {
    const arabic = /[؀-ۿ]/;
    for (const star of STARS) {
      for (const locale of ["de", "en", "ar"] as const) {
        const page = starPage(star, locale);
        const linked = new Set(page.blocks.flatMap((block) => (block.type === "link" ? [block.url] : [])));
        const official = (url: string) => url.replace(/\/$/, "") === star.website?.replace(/\/$/, "");
        for (const article of star.articles) if (article.language !== locale && !official(article.url)) expect(linked.has(article.url), `${star.slug}/${locale}: ${article.url}`).toBe(false);
        if (locale !== "ar") {
          // Text a visitor reads (URLs may carry Arabic article slugs; they are not shown as text).
          const text = JSON.stringify(page, (key, value: unknown) => (key === "url" || key === "src" ? undefined : value));
          expect(text, `${star.slug}/${locale}`).not.toMatch(arabic);
        }
      }
    }
  });

  it("are labelled as concepts, with a photo credit when the photo is free-licensed", () => {
    for (const star of STARS) {
      const preview = PREVIEWS[star.slug];
      expect(preview?.concept, star.slug).toBeDefined();
      expect(preview?.invite, star.slug).toBeUndefined();
      if (star.photo.startsWith("sample:")) expect(star.credit, star.slug).toMatch(/Wikimedia Commons$/);
    }
  });
});
