import type { MetadataRoute } from "next";

/**
 * Crawlers may read every page; whether a page may be indexed is said by the page itself. Before
 * launch every page says `noindex` (see the locale layout's metadata), and a crawler has to be allowed
 * to read the page to see that: a `Disallow` here would hide the `noindex` and could still list bare
 * addresses. At launch, drop `robots` from the layouts' metadata and add the sitemap here.
 */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" } };
}
