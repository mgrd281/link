/**
 * The help articles of /hilfe, as data. Each has a stable slug: it is the article's anchor on the
 * help page (`/de/hilfe#statistik`) and the name other places link to (the dashboard's help entry,
 * WP4.5), so a slug is never renamed. The words live in the messages under `help.articles.<slug>`
 * (`title`, `summary`, `body`: a list of paragraphs) in German, English and Arabic.
 *
 * Every article describes what the product does today. Something that is planned says so in its own
 * words ("geplant", "planned", "مخطط له").
 */

export const HELP_GROUPS = ["start", "page", "share", "account"] as const;
export type HelpGroup = (typeof HELP_GROUPS)[number];

/** A page of the website an article points on to, under its body. */
export type HelpRelated = "/funktionen" | "/portfolio" | "/templates" | "/sicherheit" | "/sicherheit#statistik";

export interface HelpArticle {
  slug: string;
  group: HelpGroup;
  related?: HelpRelated;
  /**
   * How the article follows the cookie-free counting (`siteState().statistics`): "explains", while
   * no page is counted it opens with its `off` paragraph and shows `summaryOff`; or the paragraph after
   * which its `counting` paragraph stands, shown only while pages are counted.
   */
  counting?: "explains" | { after: number };
}

/** In reading order: getting started, the page, sharing and counting, the account and its data. */
export const HELP_ARTICLES = [
  { slug: "registrieren", group: "start" },
  { slug: "willkommen", group: "start" },
  { slug: "seitenadresse", group: "start" },
  { slug: "bloecke", group: "page", related: "/funktionen" },
  { slug: "projekte", group: "page", related: "/portfolio" },
  { slug: "vorlagen", group: "page", related: "/templates" },
  { slug: "design", group: "page" },
  { slug: "sprachen", group: "page" },
  // QR scans count as their own source: said under the QR code, only while pages are counted.
  { slug: "teilen", group: "share", counting: { after: 2 } },
  { slug: "statistik", group: "share", related: "/sicherheit#statistik", counting: "explains" },
  { slug: "datenschutz-seite", group: "account", related: "/sicherheit" },
  { slug: "impressum", group: "account" },
  { slug: "konto-loeschen", group: "account" },
] as const satisfies readonly HelpArticle[];

/**
 * The message keys an article shows, as this build counts pages (`statistics`): its summary and its
 * paragraphs in order (`bodyCount`: the length of its `body`).
 */
export function articleKeys(article: HelpArticle, bodyCount: number, statistics: boolean): { summary: string; body: string[] } {
  const base = `help.articles.${article.slug}`;
  const body = Array.from({ length: bodyCount }, (_, index) => `${base}.body.${String(index)}`);
  const { counting } = article;
  if (counting === "explains") return statistics ? { summary: `${base}.summary`, body } : { summary: `${base}.summaryOff`, body: [`${base}.off`, ...body] };
  if (counting && statistics) body.splice(counting.after + 1, 0, `${base}.counting`);
  return { summary: `${base}.summary`, body };
}

export type HelpSlug = (typeof HELP_ARTICLES)[number]["slug"];

export const HELP_SLUGS: readonly HelpSlug[] = HELP_ARTICLES.map((article) => article.slug);

export const isHelpSlug = (value: string): value is HelpSlug => (HELP_SLUGS as readonly string[]).includes(value);

/** Where an article is read: the help page in the visitor's language, opened at the article. */
export const helpHref = (locale: string, slug?: HelpSlug): string => `/${locale}/hilfe${slug ? `#${slug}` : ""}`;
