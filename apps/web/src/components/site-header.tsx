import { cn, Logo } from "@linkyo/ui";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import { LocaleSwitch } from "./locale-switch";
import { ThemeSwitch } from "./theme-switch";

export function SiteHeader({ active }: { active?: "design" | "directions" }) {
  const t = useTranslations("common");
  const nav = [
    { href: "/design", label: t("designSystem"), key: "design" },
    { href: "/directions", label: t("directions"), key: "directions" },
  ] as const;
  return (
    <header className="layer-sticky sticky top-0 border-b border-line bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-2 focus:rounded-sm focus:bg-surface-elevated focus:px-3 focus:py-2 focus:focus-ring"
      >
        {t("skip")}
      </a>
      <div className="mx-auto flex h-16 max-w-content items-center gap-4 px-5">
        <Link href="/" className="rounded-xs focus-visible:focus-ring" aria-label={t("home")}>
          <Logo className="h-6" title="Linkyo" />
        </Link>
        <span className="hidden rounded-full border border-line-strong px-2 text-caption text-fg-secondary sm:inline-flex">
          {t("phase")}
        </span>
        <nav aria-label={t("mainNav")} className="ms-auto hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active === item.key ? "page" : undefined}
              className={cn(
                "rounded-sm px-3 py-2 text-small font-medium text-fg-secondary transition-colors duration-micro hover:bg-hover hover:text-fg focus-visible:focus-ring",
                active === item.key && "text-fg",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-2 md:ms-2">
          <ThemeSwitch />
          <LocaleSwitch />
        </div>
      </div>
      <nav aria-label={t("mainNav")} className="flex gap-1 overflow-x-auto border-t border-line px-3 py-1 md:hidden">
        {nav.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active === item.key ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-sm px-3 py-2 text-small font-medium text-fg-secondary focus-visible:focus-ring",
              active === item.key && "bg-hover text-fg",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
