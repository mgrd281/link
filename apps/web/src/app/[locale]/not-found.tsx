import type { Metadata } from "next";

import { NotFoundScreen } from "@/features/errors/error-screen";
import { NOINDEX } from "@/lib/seo";

/**
 * No translated title here on purpose: this file also answers addresses whose first segment is no
 * language (the layout's own `notFound()`), where no language is set for the request, and reading
 * it from the request would turn statically rendered routes into a 500. The catch-all page names the
 * title in the address's language instead.
 */
export const metadata: Metadata = { robots: NOINDEX };

/**
 * An address that does not exist under a language (unknown routes, unknown example pages, and the
 * dashboard's and team area's addresses that can never exist): Linkyo's page in that language, in
 * the colours of the part of Linkyo it belongs to. Answered with status 404.
 */
export default function LocaleNotFound() {
  return <NotFoundScreen />;
}
