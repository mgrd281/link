"use client";

import { cn } from "@linkyo/ui";
import { useLocale, useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const names: Record<string, string> = { de: "DE", en: "EN", ar: "AR" };
const fullNames: Record<string, string> = { de: "Deutsch", en: "English", ar: "العربية" };

export function LocaleSwitch() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("common");
  return (
    <nav aria-label={t("language")} className="inline-flex h-control-sm items-stretch gap-0.5 rounded-md bg-canvas-muted p-0.5">
      {routing.locales.map((code) => (
        <Link
          key={code}
          href={pathname}
          locale={code}
          lang={code}
          hrefLang={code}
          aria-current={code === locale ? "true" : undefined}
          className={cn(
            "inline-flex min-w-8 items-center justify-center rounded-sm px-2 text-caption font-medium text-fg-secondary",
            "transition-colors duration-micro hover:text-fg focus-visible:focus-ring",
            code === locale && "bg-surface-elevated text-fg shadow-e1",
          )}
        >
          {names[code]}
          <span className="sr-only"> – {fullNames[code]}</span>
        </Link>
      ))}
    </nav>
  );
}
