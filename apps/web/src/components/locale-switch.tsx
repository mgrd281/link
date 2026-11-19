"use client";

import { cn } from "@linkyo/ui";
import { useLocale, useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const names: Record<string, string> = { de: "DE", en: "EN", ar: "AR" };
const fullNames: Record<string, string> = { de: "Deutsch", en: "English", ar: "العربية" };

/**
 * The language, as a segmented control. "compact" (the header): DE · EN · AR. "full" (the phone
 * menu): as wide as its place, each language in its own name.
 */
export function LocaleSwitch({ variant = "compact" }: { variant?: "compact" | "full" }) {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("common");
  const full = variant === "full";
  return (
    <nav
      aria-label={t("language")}
      className={cn(
        "items-stretch bg-canvas-muted",
        full ? "grid h-control-lg grid-cols-3 gap-1 rounded-full p-1" : "inline-flex h-control-sm gap-0.5 rounded-md p-0.5",
      )}
    >
      {routing.locales.map((code) => (
        <Link
          key={code}
          href={pathname}
          locale={code}
          lang={code}
          hrefLang={code}
          aria-current={code === locale ? "true" : undefined}
          className={cn(
            "inline-flex items-center justify-center border border-transparent font-medium text-fg-secondary",
            "transition-colors duration-micro hover:text-fg focus-visible:focus-ring",
            full ? "rounded-full px-3 text-small" : "min-w-8 rounded-sm px-2 text-caption",
            code === locale && "border-line bg-surface-elevated text-fg",
          )}
        >
          {full ? (
            fullNames[code]
          ) : (
            <>
              {names[code]}
              <span className="sr-only"> – {fullNames[code]}</span>
            </>
          )}
        </Link>
      ))}
    </nav>
  );
}
