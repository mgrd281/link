import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

export default getRequestConfig(async (params) => {
  // `requestLocale` is deprecated in favor of `next/root-params`, which is experimental in Next 16.4.
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- see docs/DECISIONS/0006-i18n.md
  const requested = await params.requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const messages = (await import(`../messages/${locale}.json`)) as { default: Record<string, unknown> };
  return { locale, messages: messages.default };
});
