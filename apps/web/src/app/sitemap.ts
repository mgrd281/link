import type { MetadataRoute } from "next";

import { paymentsEnabled } from "@/lib/flags";
import { sitemapEntries } from "@/lib/seo";
import { siteUrl } from "@/lib/site-url";

/**
 * Every public page (lib/seo.ts `PUBLIC_PATHS`, plus the page service where it can be booked), each
 * in German, English and Arabic, with its language versions linked.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries({ base: siteUrl(), payments: paymentsEnabled });
}
