import type { ResolvedCreatorTheme } from "@linkyo/tokens/creator";
import { getTranslations } from "next-intl/server";

import type { Legal } from "@/features/account/types";
import { legalStatus } from "@/features/app/legal";
import { themeStyle } from "@/features/creator/theme";

/** The creator's own legal notice is shown (and linked from the footer) only once it is complete. */
export const hasCreatorLegal = (legal: Legal): boolean => legalStatus(legal) === "complete";

/**
 * The creator's Impressum (§ 5 DDG) at the foot of their public page, in the page's colors and
 * language. Only a complete notice is shown: an untouched one would publish the account's e-mail.
 */
export async function CreatorLegal({ legal, theme, locale }: { legal: Legal; theme: ResolvedCreatorTheme; locale: string }) {
  if (!hasCreatorLegal(legal)) return null;
  const t = await getTranslations({ locale, namespace: "creator" });
  const lines = [legal.name, ...legal.address.split("\n"), legal.email, legal.phone].map((line) => line.trim()).filter(Boolean);
  return (
    <section
      id="imprint"
      aria-labelledby="imprint-title"
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      style={themeStyle(theme)}
      className="bg-creator-bg font-creator-body text-creator-fg-muted px-creator-gutter pb-16"
    >
      <div className="border-creator-line text-caption mx-auto grid max-w-creator gap-2 border-t pt-8">
        <h2 id="imprint-title" className="text-small text-creator-fg font-semibold">
          {t("legalTitle")}
        </h2>
        <address className="grid gap-1 not-italic">
          {lines.map((line, index) => (
            // Addresses, e-mails and numbers keep their own direction inside an Arabic page.
            <span key={index} dir="auto">
              {line}
            </span>
          ))}
        </address>
      </div>
    </section>
  );
}
