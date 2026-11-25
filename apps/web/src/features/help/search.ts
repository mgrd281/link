import { fold } from "@/features/search/search";

/** One article as the search reads it: its words in the visitor's language. */
export interface SearchableArticle {
  slug: string;
  title: string;
  summary: string;
  body: readonly string[];
}

/**
 * Text as the help search compares it: lower case, without accents or Arabic vowel marks, one
 * spelling per Arabic letter (the people search's `fold`), and German umlauts typed out ("loeschen")
 * found the same as written ("löschen").
 */
export const helpFold = (text: string): string => fold(text).replace(/ae/g, "a").replace(/oe/g, "o").replace(/ue/g, "u");

/** The words of a query, folded; punctuation of the three languages splits words. */
export function queryWords(query: string): string[] {
  return helpFold(query)
    .split(/[\s,.;:!?"'()·…،؛؟„“”–—/]+/u)
    .filter(Boolean);
}

/**
 * The articles that hold every word of the query somewhere in their title, short answer or body
 * (a word may be part of a longer one: "statist" finds "Statistik", "إحصاء" finds "الإحصاءات").
 * Articles whose title holds every word come first; otherwise the reading order stays. An empty
 * query keeps every article.
 */
export function matchArticles<A extends SearchableArticle>(articles: readonly A[], query: string): A[] {
  const words = queryWords(query);
  if (words.length === 0) return [...articles];
  const matched = articles.flatMap((article, index) => {
    const title = helpFold(article.title);
    const all = `${title} ${helpFold(article.summary)} ${helpFold(article.body.join(" "))}`;
    if (!words.every((word) => all.includes(word))) return [];
    return [{ article, index, inTitle: words.every((word) => title.includes(word)) }];
  });
  return matched.sort((a, b) => Number(b.inTitle) - Number(a.inTitle) || a.index - b.index).map((entry) => entry.article);
}
