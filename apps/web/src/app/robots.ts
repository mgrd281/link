import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-url";

/**
 * Crawlers may read every page; whether a page may be indexed is said by the page itself (lib/seo.ts):
 * public marketing pages are indexed, private, internal and example pages say `noindex`, and a crawler
 * has to be allowed to read a page to see that. The API has nothing to index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: new URL("/sitemap.xml", siteUrl()).toString(),
  };
}
