import { getTranslations } from "next-intl/server";

import { samplePage } from "./shared/sample";

export async function loadSamplePage(locale: string) {
  const t = await getTranslations({ locale, namespace: "sampleContent" });
  return samplePage(locale, (key) => t(key));
}
